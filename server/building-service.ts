import { cachedValue } from "./persistent-cache";
import { candidatesFromOverpass, footprintFromOverpass, type BuildingCandidate, type BuildingFootprint, type OverpassElement } from "../lib/building-footprint";

const OVERPASS_ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const STAGGER_MS = 2500;
const TIMEOUT_MS = 25_000;
const TTL_MS = 24 * 60 * 60 * 1000;
/** OSM outlines change rarely; persisted results are kept for a month. */
const STORE_TTL_MS = 30 * TTL_MS;
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
  return cachedValue("footprint", key, STORE_TTL_MS, async () => {
    const nearby = areaElements.find((entry) => entry.expiresAt > Date.now() && metresBetween(entry.center, { lat, lng }) <= REUSE_WITHIN_M);
    if (nearby) {
      const value = footprintFromOverpass(nearby.elements, { lat, lng });
      if (value.status === "ok") return value;
    }
    return footprintFromOverpass(await requestOverpass(lat, lng), { lat, lng });
  });
}

export async function getNearbyBuildings(lat: number, lng: number): Promise<BuildingCandidate[]> {
  const key = `${lat.toFixed(5)}_${lng.toFixed(5)}`;
  const elements = await cachedValue("nearby-area", key, STORE_TTL_MS, () =>
    requestOverpass(lat, lng, `[out:json][timeout:20];(way(around:${NEARBY_RADIUS_M + 30},${lat},${lng})["building"];way(around:${NEARBY_RADIUS_M + 120},${lat},${lng})["highway"];);out tags geom;`),
  );
  if (!areaElements.some((entry) => entry.elements === elements)) {
    areaElements.unshift({ center: { lat, lng }, elements, expiresAt: Date.now() + TTL_MS });
    areaElements.splice(50);
  }
  return candidatesFromOverpass(elements, { lat, lng }).filter((candidate) => candidate.distanceM <= NEARBY_RADIUS_M);
}
