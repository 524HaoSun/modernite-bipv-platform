import type { Location, Weather, WeatherRow } from "./customer-energy-core";

/** Hourly record returned by the PVGIS 5.3 `tmy` endpoint (JSON output). */
export type PvgisTmyHour = {
  "time(UTC)": string;
  T2m: number;
  RH?: number;
  "G(h)": number;
  "Gb(n)": number;
  "Gd(h)": number;
  "IR(h)"?: number;
  WS10m?: number;
};

export type PvgisTmyPayload = {
  inputs?: {
    location?: { latitude?: number; longitude?: number; elevation?: number };
    meteo_data?: { radiation_db?: string; meteo_db?: string; year_min?: number; year_max?: number };
  };
  outputs?: { months_selected?: { month: number; year: number }[]; tmy_hourly?: PvgisTmyHour[] };
};

export const PVGIS_API_BASE = "https://re.jrc.ec.europa.eu/api/v5_3";

export function pvgisTmyUrl(lat: number, lon: number) {
  const url = new URL(`${PVGIS_API_BASE}/tmy`);
  url.searchParams.set("lat", lat.toFixed(4));
  url.searchParams.set("lon", lon.toFixed(4));
  url.searchParams.set("outputformat", "json");
  return url.toString();
}

const nonNegative = (value: number | undefined) => (Number.isFinite(value) ? Math.max(0, value as number) : 0);

/**
 * Converts a PVGIS typical meteorological year into the customer Studio
 * weather contract: consecutive UTC hours of one calendar `year`, with
 * `ta`, `ghi`, `dni`, `dhi` (W/m²) plus reference longwave, humidity and wind.
 *
 * PVGIS stitches 12 months from different source years, so rows are re-dated
 * onto `year`. A leap `year` repeats 28 February for 29 February.
 */
export function pvgisTmyToWeather(payload: PvgisTmyPayload, site: Location & { address?: string }, year: number): Weather {
  const hours = payload.outputs?.tmy_hourly;
  if (!hours || hours.length !== 8760) throw new Error("PVGIS TMY response must contain 8760 hourly records");
  const leap = new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1;
  const source = leap ? [...hours.slice(0, 59 * 24), ...hours.slice(58 * 24, 59 * 24), ...hours.slice(59 * 24)] : hours;
  const start = Date.UTC(year, 0, 1);
  const rows: WeatherRow[] = source.map((hour, index) => {
    const t = start + index * 3_600_000;
    const month = Number(hour["time(UTC)"].slice(4, 6));
    if (month !== new Date(t).getUTCMonth() + 1) throw new Error(`PVGIS TMY record ${index + 1} is out of calendar order`);
    return {
      t,
      ta: hour.T2m,
      ghi: nonNegative(hour["G(h)"]),
      dni: nonNegative(hour["Gb(n)"]),
      dhi: nonNegative(hour["Gd(h)"]),
      longwave: nonNegative(hour["IR(h)"]),
      humidity: Math.min(100, nonNegative(hour.RH)),
      wind: nonNegative(hour.WS10m),
    };
  });
  const meteo = payload.inputs?.meteo_data;
  const database = [meteo?.radiation_db, meteo?.meteo_db].filter(Boolean).join(" / ") || "PVGIS";
  const period = meteo?.year_min && meteo?.year_max ? `${meteo.year_min}–${meteo.year_max}` : "";
  return {
    rows,
    location: { lat: site.lat, lon: site.lon, tz: site.tz, zone: site.zone ?? "" },
    year,
    timeStandard: "UTC",
    synthetic: false,
    name: `PVGIS TMY${period ? ` ${period}` : ""}${site.address ? ` · ${site.address}` : ""}`,
    source: `PVGIS 5.3 TMY (${database})`,
    sourceURL: pvgisTmyUrl(site.lat, site.lon),
    fetchedAt: new Date().toISOString(),
    site: { ...site, year },
    monthsSelected: payload.outputs?.months_selected ?? [],
    note: "Typical meteorological year assembled by PVGIS from multi-year satellite and reanalysis records. Hourly UTC values; schedules use local standard time.",
  };
}

export type CompactWeather = Omit<Weather, "rows"> & { columns: Record<"t" | "ta" | "ghi" | "dni" | "dhi" | "longwave" | "humidity" | "wind", number[]> };

export function compactWeather(weather: Weather): CompactWeather {
  const { rows, ...meta } = weather;
  const keys = ["t", "ta", "ghi", "dni", "dhi", "longwave", "humidity", "wind"] as const;
  return { ...meta, columns: Object.fromEntries(keys.map((key) => [key, rows.map((row) => Math.round((row[key] ?? 0) * 100) / 100)])) as CompactWeather["columns"] };
}

export function expandWeather(compact: CompactWeather): Weather {
  const { columns, ...meta } = compact;
  const rows = columns.t.map((t, index) => ({ t, ta: columns.ta[index], ghi: columns.ghi[index], dni: columns.dni[index], dhi: columns.dhi[index], longwave: columns.longwave[index], humidity: columns.humidity[index], wind: columns.wind[index] }));
  return { ...meta, rows } as Weather;
}
