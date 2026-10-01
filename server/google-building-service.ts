import type { LatLng, OverpassElement } from "../lib/building-footprint";
import { cachedValue } from "./persistent-cache";
import { ENV } from "./_core/env";

const DESTINATIONS = "https://geocode.googleapis.com/v4/geocode/destinations";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PROBE_OFFSET_M = 2;

type Polygon = { type: "Polygon"; coordinates: number[][][] } | { type: "MultiPolygon"; coordinates: number[][][][] };
type Destination = {
  primary?: { placeId?: string; structureType?: string; formattedAddress?: string; displayPolygon?: Polygon; postalAddress?: { addressLines?: string[] } };
  navigationPoints?: { displayName?: { text?: string }; location?: { latitude?: number; longitude?: number } }[];
};
export type GoogleBuilding = { building: OverpassElement; road?: OverpassElement };

function outerRing(polygon: Polygon | undefined) {
  if (!polygon) return null;
  const rings = polygon.type === "Polygon" ? [polygon.coordinates[0]] : polygon.coordinates.map((part) => part[0]);
  const ring = rings.filter(Boolean).sort((a, b) => b!.length - a!.length)[0];
  return ring && ring.length >= 4 ? ring : null;
}

const MAX_AREA_M2 = 20_000;
const MAX_SPAN_M = 250;

/** Google sometimes returns a whole block or complex as one "building"; such outlines are no use for a house. */
function plausible(ring: number[][]) {
  const lat0 = ring[0]![1]!, mPerDegLng = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const xy = ring.map(([lon, lat]) => ({ x: (lon! - ring[0]![0]!) * mPerDegLng, y: (lat! - lat0) * 110_540 }));
  let area = 0;
  for (let i = 0; i < xy.length; i++) {
    const a = xy[i]!, b = xy[(i + 1) % xy.length]!;
    area += a.x * b.y - b.x * a.y;
  }
  const span = Math.max(Math.max(...xy.map((p) => p.x)) - Math.min(...xy.map((p) => p.x)), Math.max(...xy.map((p) => p.y)) - Math.min(...xy.map((p) => p.y)));
  return Math.abs(area) / 2 <= MAX_AREA_M2 && span <= MAX_SPAN_M;
}

function idFor(text: string) {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return -Math.abs(hash || 1);
}

/**
 * Google's building outline at a point (Geocoding API v4 SearchDestinations, billed as Geocoding),
 * shaped like OSM ways so the footprint and candidate logic treat both sources alike. The
 * navigation point sits on the street in front of the building and stands in for the nearest road.
 */
export async function getGoogleBuilding(lat: number, lng: number): Promise<GoogleBuilding | null> {
  if (!ENV.googleSolarApiKey) return null;
  const key = `${lat.toFixed(5)}:${lng.toFixed(5)}`;
  return cachedValue("google-building-v3", key, TTL_MS, async () => {
    const response = await fetch(DESTINATIONS, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": ENV.googleSolarApiKey, "X-Goog-FieldMask": "destinations.primary,destinations.navigationPoints" },
      body: JSON.stringify({ locationQuery: { location: { latitude: lat, longitude: lng }, placeFilter: { structureType: "BUILDING", addressability: "ANY" } }, languageCode: "en" }),
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error(`Google destinations ${response.status}`);
    const payload = (await response.json()) as { destinations?: Destination[] };
    const destination = payload.destinations?.find((item) => item.primary?.structureType === "BUILDING");
    const primary = destination?.primary;
    const ring = outerRing(primary?.displayPolygon);
    if (!primary || !ring || !plausible(ring)) return null;
    const street = primary.postalAddress?.addressLines?.[0] ?? primary.formattedAddress?.split(",")[0];
    const id = idFor(primary.placeId ?? key);
    const nav = destination.navigationPoints?.find((point) => Number.isFinite(point.location?.latitude) && Number.isFinite(point.location?.longitude));
    const navPoint = nav ? { lat: nav.location!.latitude!, lon: nav.location!.longitude! } : null;
    return {
      building: { type: "way", id, tags: { building: "yes", source: "google", ...(street ? { name: street } : {}) }, geometry: ring.map(([lon, lat]) => ({ lat: lat!, lon: lon! })) },
      road: navPoint ? { type: "way", id: id - 1, tags: { highway: "residential", ...(nav!.displayName?.text ? { name: nav!.displayName.text } : {}) }, geometry: [navPoint, navPoint] } : undefined,
    };
  });
}

/** Buildings just outside the four longest walls; any that share a wall make the house semi-detached or terraced. */
export async function getGoogleNeighbours(building: OverpassElement): Promise<OverpassElement[]> {
  const ring: LatLng[] = (building.geometry ?? []).map((p) => ({ lat: p.lat, lng: p.lon }));
  if (ring.length > 1 && ring[0]!.lat === ring.at(-1)!.lat && ring[0]!.lng === ring.at(-1)!.lng) ring.pop();
  if (ring.length < 3) return [];
  const centre = ring.reduce((sum, p) => ({ lat: sum.lat + p.lat / ring.length, lng: sum.lng + p.lng / ring.length }), { lat: 0, lng: 0 });
  const mPerDegLng = 111_320 * Math.cos((centre.lat * Math.PI) / 180), mPerDegLat = 110_540;
  const xy = ring.map((p) => ({ x: (p.lng - centre.lng) * mPerDegLng, y: (p.lat - centre.lat) * mPerDegLat }));
  const probes = xy
    .map((a, i) => {
      const b = xy[(i + 1) % xy.length]!;
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      let normal = { x: (b.y - a.y) / (length || 1), y: -(b.x - a.x) / (length || 1) };
      if (normal.x * mid.x + normal.y * mid.y < 0) normal = { x: -normal.x, y: -normal.y };
      return { length, point: { lat: centre.lat + (mid.y + normal.y * PROBE_OFFSET_M) / mPerDegLat, lng: centre.lng + (mid.x + normal.x * PROBE_OFFSET_M) / mPerDegLng } };
    })
    .sort((a, b) => b.length - a.length)
    .slice(0, 4);
  const found = await Promise.all(probes.map(({ point }) => getGoogleBuilding(point.lat, point.lng).catch(() => null)));
  const seen = new Set([building.id]);
  return found.flatMap((item) => (item && !seen.has(item.building.id) && seen.add(item.building.id) ? [item.building] : []));
}
