import { fetchBuildingInsights, type GoogleSolarReference } from "../lib/google-solar";
import { ENV } from "./_core/env";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; value: GoogleSolarReference }>();

export async function getGoogleSolarReference(lat: number, lng: number): Promise<GoogleSolarReference | null> {
  if (!ENV.googleSolarApiKey) return null;
  const key = `${lat.toFixed(5)}:${lng.toFixed(5)}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const value = await fetchBuildingInsights({ lat, lng, apiKey: ENV.googleSolarApiKey });
  if (value.status !== "unavailable") cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return value;
}
