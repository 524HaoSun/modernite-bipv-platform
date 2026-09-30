import { footprintFromOverpass, type BuildingFootprint, type OverpassElement } from "../lib/building-footprint";

const OVERPASS_ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const TIMEOUT_MS = 25_000;
const TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { value: BuildingFootprint; expiresAt: number }>();
const inflight = new Map<string, Promise<BuildingFootprint>>();

function query(lat: number, lng: number) {
  return `[out:json][timeout:20];(way(around:50,${lat},${lng})["building"];way(around:120,${lat},${lng})["highway"];);out tags geom;`;
}

async function requestOverpass(lat: number, lng: number): Promise<OverpassElement[]> {
  let lastError: unknown;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "ModerniteBIPV/1.0 (building preview)" },
        body: new URLSearchParams({ data: query(lat, lng) }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Overpass ${response.status}`);
      const payload = (await response.json()) as { elements?: OverpassElement[] };
      return payload.elements ?? [];
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Overpass unavailable");
}

export async function getBuildingFootprint(lat: number, lng: number): Promise<BuildingFootprint> {
  const key = `${lat.toFixed(5)}_${lng.toFixed(5)}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  let pending = inflight.get(key);
  if (!pending) {
    pending = requestOverpass(lat, lng)
      .then((elements) => {
        const value = footprintFromOverpass(elements, { lat, lng });
        cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
        return value;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  return pending;
}
