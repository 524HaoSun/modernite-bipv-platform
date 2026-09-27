import { PVGIS_TIMEOUT_MS } from "../data/constants";
import { toPvgisAspect } from "./geometry";

export type PvgisAnnualValidation = {
  annualKwh: number;
  annualStandardDeviationKwh: number | null;
  irradiationKwhM2: number | null;
  lossesPercent: number | null;
  database: string;
  endpoint: "v5_3/PVcalc";
};

export async function fetchPvgisAnnualValidation(input: {
  lat: number;
  lng: number;
  tiltDeg: number;
  azimuthDeg: number;
  capacityKwp: number;
  database: string;
}): Promise<PvgisAnnualValidation> {
  if (!Number.isFinite(input.lat) || input.lat < -90 || input.lat > 90) throw new Error("Latitude must be between -90 and 90");
  if (!Number.isFinite(input.lng) || input.lng < -180 || input.lng > 180) throw new Error("Longitude must be between -180 and 180");
  if (!Number.isFinite(input.tiltDeg) || input.tiltDeg < 0 || input.tiltDeg > 90) throw new Error("Tilt must be between 0 and 90 degrees");
  if (!Number.isFinite(input.capacityKwp) || input.capacityKwp <= 0) throw new Error("PVGIS validation requires positive capacity");

  const params = new URLSearchParams({
    lat: String(input.lat),
    lon: String(input.lng),
    peakpower: input.capacityKwp.toFixed(6),
    loss: "10",
    fixed: "1",
    angle: String(input.tiltDeg),
    aspect: String(toPvgisAspect(input.azimuthDeg)),
    pvtechchoice: "CdTe",
    mountingplace: "building",
    raddatabase: input.database,
    usehorizon: "1",
    outputformat: "json",
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PVGIS_TIMEOUT_MS);
  try {
    const response = await fetch(`https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?${params}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`PVGIS validation unavailable (${response.status})`);
    const payload = await response.json() as {
      inputs?: { meteo_data?: { radiation_db?: string } };
      outputs?: { totals?: { fixed?: { E_y?: number; SD_y?: number; "H(i)_y"?: number; l_total?: number } } };
    };
    const fixed = payload.outputs?.totals?.fixed;
    if (!fixed || !Number.isFinite(fixed.E_y)) throw new Error("PVGIS validation returned no annual output");
    return {
      annualKwh: Number(fixed.E_y),
      annualStandardDeviationKwh: Number.isFinite(fixed.SD_y) ? fixed.SD_y! : null,
      irradiationKwhM2: Number.isFinite(fixed["H(i)_y"]) ? fixed["H(i)_y"]! : null,
      lossesPercent: Number.isFinite(fixed.l_total) ? fixed.l_total! : null,
      database: payload.inputs?.meteo_data?.radiation_db ?? input.database,
      endpoint: "v5_3/PVcalc",
    };
  } finally {
    clearTimeout(timer);
  }
}
