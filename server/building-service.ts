import { candidatesFromOverpass, footprintFromOverpass, type BuildingCandidate, type BuildingFootprint, type OverpassElement } from "../lib/building-footprint";

const OVERPASS_ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const STAGGER_MS = 2500;
const TIMEOUT_MS = 25_000;
const TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { value: BuildingFootprint; expiresAt: number }>();
const inflight = new Map<string, Promise<BuildingFootprint>>();

const nearbyCache = new Map<string, { value: BuildingCandidate[]; expiresAt: number }>();
const nearbyInflight = new Map<string, Promise<BuildingCandidate[]>>();
const NEARBY_RADIUS_M = 80;
/** Raw Overpass results around searched addresses; a building picked from them needs no second request. */
const areaElements: { center: { lat: number; lng: number }; elements: OverpassElement[]; expiresAt: number }[] = [];
const REUSE_WITHIN_M = 60;

function metresBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  return Math.hypot((a.lat - b.lat) * 111_320, (a.lng - b.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180));
}

function query(lat: number, lng: number) {
  return `[out:json][timeout:20];(way(around:50,${lat},${lng})["building"];way(around:120,${lat},${lng})["highway"];);out tags geom;`;
}

/** Public Overpass mirrors are individually flaky, so they are raced with a short stagger. */
async function requestOverpass(lat: number, lng: number, data = query(lat, lng)): Promise<OverpassElement[]> {
  const controllers = OVERPASS_ENDPOINTS.map(() => new AbortController());
  const attempts = OVERPASS_ENDPOINTS.map(async (endpoint, index) => {
    const controller = controllers[index];
    if (index) await new Promise((resolve) => setTimeout(resolve, index * STAGGER_MS));
    if (controller.signal.aborted) throw new Error("cancelled");
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "ModerniteBIPV/1.0 (building preview)" },
        body: new URLSearchParams({ data }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Overpass ${response.status}`);
      const payload = (await response.json()) as { elements?: OverpassElement[] };
      return payload.elements ?? [];
    } finally {
      clearTimeout(timer);
    }
  });
  try {
    return await Promise.any(attempts);
  } catch {
    throw new Error("Overpass unavailable");
  } finally {
    controllers.forEach((controller) => controller.abort());
  }
}

export async function getBuildingFootprint(lat: number, lng: number): Promise<BuildingFootprint> {
  const key = `${lat.toFixed(5)}_${lng.toFixed(5)}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const nearby = areaElements.find((entry) => entry.expiresAt > Date.now() && metresBetween(entry.center, { lat, lng }) <= REUSE_WITHIN_M);
  if (nearby) {
    const value = footprintFromOverpass(nearby.elements, { lat, lng });
    if (value.status === "ok") {
      cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
      return value;
    }
  }
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

export async function getNearbyBuildings(lat: number, lng: number): Promise<BuildingCandidate[]> {
  const key = `${lat.toFixed(5)}_${lng.toFixed(5)}`;
  const cached = nearbyCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  let pending = nearbyInflight.get(key);
  if (!pending) {
    pending = requestOverpass(lat, lng, `[out:json][timeout:20];(way(around:${NEARBY_RADIUS_M + 30},${lat},${lng})["building"];way(around:${NEARBY_RADIUS_M + 120},${lat},${lng})["highway"];);out tags geom;`)
      .then((elements) => {
        areaElements.unshift({ center: { lat, lng }, elements, expiresAt: Date.now() + TTL_MS });
        areaElements.splice(50);
        const value = candidatesFromOverpass(elements, { lat, lng }).filter((candidate) => candidate.distanceM <= NEARBY_RADIUS_M);
        nearbyCache.set(key, { value, expiresAt: Date.now() + TTL_MS });
        return value;
      })
      .finally(() => nearbyInflight.delete(key));
    nearbyInflight.set(key, pending);
  }
  return pending;
}
