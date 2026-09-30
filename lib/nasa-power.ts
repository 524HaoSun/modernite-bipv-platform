import { validateWeather, type Location, type Weather, type WeatherRow } from "./customer-energy-core";

/** Port of the customer Studio `ModerniteLocationCore` NASA POWER hourly request and parser. */
export const NASA_POWER_PARAMS = {
  ta: "T2M",
  ghi: "ALLSKY_SFC_SW_DWN",
  dhi: "ALLSKY_SFC_SW_DIFF",
  dni: "ALLSKY_SFC_SW_DNI",
  longwave: "ALLSKY_SFC_LW_DWN",
  humidity: "RH2M",
  wind: "WS10M",
} as const;

export const NASA_POWER_SOURCE = "NASA POWER / CERES / MERRA-2";

export type NasaPowerPayload = {
  header?: { time_standard?: string; fill_value?: number };
  parameters?: Record<string, { units?: string; longname?: string }>;
  properties?: { parameter?: Record<string, Record<string, number>> };
};

export type WeatherSiteInput = Location & { address?: string; year?: number };

/** Latest complete calendar year NASA POWER can serve (the customer Studio rule). */
export const latestNasaPowerYear = (now = new Date()) => now.getUTCFullYear() - 1;

export function nasaPowerUrl(site: { lat: number; lon: number }, year: number, now = new Date()) {
  if (!Number.isInteger(year) || year < 2001 || year > latestNasaPowerYear(now)) throw new Error("WEATHER_YEAR");
  if (!Number.isFinite(site.lat) || !Number.isFinite(site.lon) || Math.abs(site.lat) > 89.9 || Math.abs(site.lon) > 180) throw new Error("LOCATION_RANGE");
  const url = new URL("https://power.larc.nasa.gov/api/temporal/hourly/point");
  const params: Record<string, string> = {
    parameters: Object.values(NASA_POWER_PARAMS).join(","),
    community: "RE",
    longitude: site.lon.toFixed(5),
    latitude: site.lat.toFixed(5),
    start: `${year}0101`,
    end: `${year}1231`,
    format: "JSON",
    "time-standard": "UTC",
  };
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

export function nasaPowerToWeather(data: NasaPowerPayload, site: WeatherSiteInput, year: number, requireYear = true): Weather {
  const values = data.properties?.parameter;
  if (!values) throw new Error("WEATHER_RESPONSE");
  if (data.header?.time_standard && data.header.time_standard !== "UTC") throw new Error("WEATHER_TIME_STANDARD");
  const fill = data.header?.fill_value ?? -999;
  const rows: WeatherRow[] = [];
  const keys = Object.keys(values.T2M ?? {}).sort();
  for (const key of keys) {
    if (!/^\d{10}$/.test(key)) throw new Error("WEATHER_DATE");
    const y = +key.slice(0, 4), m = +key.slice(4, 6), d = +key.slice(6, 8), h = +key.slice(8, 10);
    const t = Date.UTC(y, m - 1, d, h);
    if (h > 23 || new Date(t).getUTCMonth() !== m - 1 || new Date(t).getUTCDate() !== d) throw new Error("WEATHER_DATE");
    const row: Record<string, number> = { t };
    for (const [field, param] of Object.entries(NASA_POWER_PARAMS)) {
      const value = values[param]?.[key];
      const units = data.parameters?.[param]?.units;
      if (!Number.isFinite(value) || value === fill || value <= -990) throw new Error(`WEATHER_MISSING:${key}:${param}`);
      if (["ghi", "dhi", "dni", "longwave"].includes(field)) {
        if (!["Wh/m^2", "W/m^2", "kWh/m^2"].includes(units ?? "")) throw new Error(`WEATHER_UNITS:${param}:${units}`);
        row[field] = value * (units === "kWh/m^2" ? 1000 : 1);
      } else row[field] = value;
    }
    if (row.longwave < 0 || row.longwave > 1000 || row.humidity < 0 || row.humidity > 100 || row.wind < 0 || row.wind > 150) throw new Error("WEATHER_RANGE");
    rows.push(row as WeatherRow);
  }
  validateWeather(rows);
  const hours = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 3_600_000;
  if (requireYear && (rows.length !== hours || rows[0].t !== Date.UTC(year, 0, 1) || rows[rows.length - 1].t !== Date.UTC(year + 1, 0, 1) - 3_600_000)) throw new Error("WEATHER_INCOMPLETE");
  return {
    rows,
    location: { lat: site.lat, lon: site.lon, tz: site.tz, zone: site.zone ?? "" },
    year,
    timeStandard: "UTC",
    synthetic: false,
    name: `NASA POWER · ${year}${site.address ? ` · ${site.address}` : ""}`,
    source: NASA_POWER_SOURCE,
    sourceURL: nasaPowerUrl(site, year),
    fetchedAt: new Date().toISOString(),
    site: { ...site, year },
    resolution: "Solar: 1° × 1°; meteorology: 0.5° × 0.625° (native source grids)",
    note: "Historical year, not TMY or on-site measurements. Hourly UTC averages; schedules use local standard time. Longwave, humidity and wind are stored for reference and are not extra PV irradiance or explicit terms in the single-node sensible model.",
  };
}
