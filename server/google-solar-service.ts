import { fetchBuildingInsights, type GoogleSolarReference } from "../lib/google-solar";
import { cachedValue } from "./persistent-cache";
import { ENV } from "./_core/env";

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function getGoogleSolarReference(lat: number, lng: number): Promise<GoogleSolarReference | null> {
  if (!ENV.googleSolarApiKey) return null;
  const key = `${lat.toFixed(5)}:${lng.toFixed(5)}`;
  return cachedValue("solar-insights", key, CACHE_TTL_MS, () => fetchBuildingInsights({ lat, lng, apiKey: ENV.googleSolarApiKey }), (value) => value.status !== "unavailable");
}
