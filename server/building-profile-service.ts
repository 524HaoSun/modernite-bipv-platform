import { buildProfile, type BuildingProfile } from "../lib/building-profile";
import type { BuildingFootprint } from "../lib/building-footprint";
import { MARKET_TO_STUDIO_REGION } from "../lib/studio-catalog";
import { getBuildingFootprint } from "./building-service";
import { getGoogleSolarReference } from "./google-solar-service";
import { ENV } from "./_core/env";

const ELEVATION_ENDPOINT = "https://maps.googleapis.com/maps/api/elevation/json";
const elevationCache = new Map<string, number | null>();

export async function getGroundElevation(lat: number, lng: number): Promise<number | null | undefined> {
  if (!ENV.googleSolarApiKey) return undefined;
  const key = `${lat.toFixed(5)}:${lng.toFixed(5)}`;
  if (elevationCache.has(key)) return elevationCache.get(key);
  const url = new URL(ELEVATION_ENDPOINT);
  url.searchParams.set("locations", `${lat.toFixed(6)},${lng.toFixed(6)}`);
  url.searchParams.set("key", ENV.googleSolarApiKey);
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const payload = (await response.json()) as { status?: string; results?: { elevation?: number }[] };
    const elevation = payload.status === "OK" && Number.isFinite(payload.results?.[0]?.elevation) ? payload.results![0].elevation! : null;
    elevationCache.set(key, elevation);
    return elevation;
  } catch {
    return null;
  }
}

export async function getBuildingProfile(lat: number, lng: number, market: string): Promise<BuildingProfile> {
  const region = MARKET_TO_STUDIO_REGION[market] ?? "UK";
  const [footprintResult, solar, groundElevationM] = await Promise.all([
    getBuildingFootprint(lat, lng).then(
      (footprint): { footprint: BuildingFootprint | null; status: "ok" | "not-found" | "unavailable" } => ({ footprint, status: footprint.status }),
      () => ({ footprint: null, status: "unavailable" as const }),
    ),
    getGoogleSolarReference(lat, lng).catch(() => null),
    getGroundElevation(lat, lng),
  ]);
  return buildProfile({
    region,
    site: { lat, lng },
    footprint: footprintResult.footprint,
    footprintStatus: footprintResult.status,
    solar: ENV.googleSolarApiKey ? solar ?? { status: "unavailable", note: "" } : undefined,
    groundElevationM,
  });
}
