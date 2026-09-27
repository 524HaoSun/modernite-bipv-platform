import { GROUND_ALBEDO, IRRADIANCE_CACHE_TTL_MS, PVGIS_TIMEOUT_MS, REGION_CONFIG, SYSTEM_LOSS_FACTOR } from "../data/constants";
import type { Region } from "../types/solar";
import { toPvgisAspect } from "./geometry";

export type MonthlyIrradiance = { month: number; irradiationKwhM2: number; averageAirTemperatureC: number; beamKwhM2: number; diffuseKwhM2: number; reflectedKwhM2: number };
export type IrradianceSeries = { database: string; monthly: MonthlyIrradiance[]; source: "pvgis" | "demonstration-fixture" | "local-empirical-climate" };

const memoryCache = new Map<string, { expiresAt: number; value: IrradianceSeries }>();

function cacheKey(lat: number, lng: number, tiltDeg: number, azimuthDeg: number, database: string): string {
  return `${lat.toFixed(3)}:${lng.toFixed(3)}:${tiltDeg}:${azimuthDeg}:${database}`;
}

function parseTimestampMonth(timestamp: string): number {
  const match = timestamp.match(/^(\d{4})(\d{2})/);
  return match ? Number(match[2]) : 1;
}

export async function fetchPvgisSeries(input: { region: Region; lat: number; lng: number; tiltDeg: number; azimuthDeg: number }): Promise<IrradianceSeries> {
  const database = REGION_CONFIG[input.region].irradianceDatabase;
  const key = cacheKey(input.lat, input.lng, input.tiltDeg, input.azimuthDeg, database);
  const cached = memoryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const params = new URLSearchParams({
    lat: String(input.lat), lon: String(input.lng), angle: String(input.tiltDeg), aspect: String(toPvgisAspect(input.azimuthDeg)),
    pvtechchoice: "CdTe", trackingtype: "0", components: "1", outputformat: "json", raddatabase: database,
  });
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PVGIS_TIMEOUT_MS);
    try {
      const response = await fetch(`https://re.jrc.ec.europa.eu/api/v5_3/seriescalc?${params}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`PVGIS unavailable (${response.status})`);
      const payload = await response.json() as { outputs?: { hourly?: Array<{ time: string; Gb?: number; Gd?: number; Gr?: number; T2m?: number }> } };
      const hourly = payload.outputs?.hourly;
      if (!hourly?.length) throw new Error("PVGIS returned no hourly records");
      const totals = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, irradiationKwhM2: 0, averageAirTemperatureC: 0, beamKwhM2: 0, diffuseKwhM2: 0, reflectedKwhM2: 0, count: 0 }));
      hourly.forEach((entry) => {
        const target = totals[parseTimestampMonth(entry.time) - 1];
        const beam = Math.max(0, entry.Gb ?? 0) / 1000;
        const diffuse = Math.max(0, entry.Gd ?? 0) / 1000;
        const reflected = Math.max(0, entry.Gr ?? 0) / 1000;
        target.beamKwhM2 += beam; target.diffuseKwhM2 += diffuse; target.reflectedKwhM2 += reflected;
        target.irradiationKwhM2 += beam + diffuse + reflected;
        target.averageAirTemperatureC += entry.T2m ?? 10; target.count += 1;
      });
      const value: IrradianceSeries = { database, source: "pvgis", monthly: totals.map(({ count, ...entry }) => ({ ...entry, averageAirTemperatureC: count ? entry.averageAirTemperatureC / count : 10 })) };
      memoryCache.set(key, { expiresAt: Date.now() + IRRADIANCE_CACHE_TTL_MS, value });
      return value;
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise<void>((resolve) => setTimeout(resolve, 250));
    } finally {
      clearTimeout(timer);
    }
  }
  const detail = lastError instanceof Error && !/abort/i.test(lastError.message) ? ` (${lastError.message})` : "";
  throw new Error(`PVGIS irradiance service is temporarily unavailable${detail}. Your Studio configuration is still saved; please try the project study again.`);
}

// A labelled development fixture for ?preview=1 only; never used as a replacement for a failed PVGIS request.
export function demonstrationIrradianceSeries(region: Region, azimuthDeg: number, tiltDeg: number): IrradianceSeries {
  const orientation = azimuthDeg >= 135 && azimuthDeg < 225 ? 1 : azimuthDeg >= 45 && azimuthDeg < 315 ? 0.83 : 0.58;
  const vertical = tiltDeg >= 80 ? 0.72 : 1;
  const base = [31, 52, 88, 122, 152, 163, 158, 136, 101, 67, 39, 27];
  const temperatures = [4, 5, 7, 10, 14, 17, 19, 19, 16, 12, 8, 5];
  return {
    database: `${REGION_CONFIG[region].irradianceDatabase} · demonstration fixture`, source: "demonstration-fixture",
    monthly: base.map((value, index) => {
      const irradiationKwhM2 = value * orientation * vertical;
      const diffuseShare = tiltDeg >= 80 ? 0.48 : 0.32;
      const reflectedShare = tiltDeg >= 80 ? 0.12 : 0.05;
      return { month: index + 1, irradiationKwhM2, averageAirTemperatureC: temperatures[index], beamKwhM2: irradiationKwhM2 * (1 - diffuseShare - reflectedShare), diffuseKwhM2: irradiationKwhM2 * diffuseShare, reflectedKwhM2: irradiationKwhM2 * reflectedShare };
    }),
  };
}

export { GROUND_ALBEDO, SYSTEM_LOSS_FACTOR };
