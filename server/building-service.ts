import { cachedValue } from "./persistent-cache";
import { getGoogleBuilding, getGoogleNeighbours } from "./google-building-service";
import { candidatesFromOverpass, footprintFromOverpass, type BuildingCandidate, type BuildingFootprint, type LatLng, type OverpassElement } from "../lib/building-footprint";

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
const OSM_WAIT_MS = 1500;
const OSM_GRACE_MS = 300;
const NEARBY_WAIT_MS = 2500;
const NEARBY_GRACE_MS = 600;

function pointInPath(point: LatLng, path: LatLng[]) {
  let inside = false;
  for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
    const a = path[i]!, b = path[j]!;
    if (a.lat > point.lat !== b.lat > point.lat && point.lng < ((b.lng - a.lng) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lng) inside = !inside;
  }
  return inside;
}

const ringPoints = (element: OverpassElement): LatLng[] => (element.geometry ?? []).map((p) => ({ lat: p.lat, lng: p.lon }));
const centroid = (ring: LatLng[]) => ring.reduce((sum, p) => ({ lat: sum.lat + p.lat / ring.length, lng: sum.lng + p.lng / ring.length }), { lat: 0, lng: 0 });

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

const within = <T>(promise: Promise<T>, ms: number) =>
  Promise.race([promise.catch(() => undefined), new Promise<undefined>((resolve) => setTimeout(resolve, ms))]);

function osmBuildingIn(elements: OverpassElement[], site: LatLng) {
  const value = footprintFromOverpass(elements, site);
  return value.status === "ok" && value.distanceM === 0 ? value : null;
}

/**
 * Google answers in well under a second, so its outline, neighbours and street point lead. Public
 * Overpass mirrors often take several seconds; an OSM outline still wins when it is already in hand,
 * because it can carry storeys and building type.
 */
export async function getBuildingFootprint(lat: number, lng: number): Promise<BuildingFootprint> {
  const key = `${lat.toFixed(5)}_${lng.toFixed(5)}`;
  const site = { lat, lng };
  return cachedValue("footprint-v5", key, STORE_TTL_MS, async () => {
    const nearby = areaElements.find((entry) => entry.expiresAt > Date.now() && metresBetween(entry.center, site) <= REUSE_WITHIN_M);
    const osm = nearby ? Promise.resolve(nearby.elements) : requestOverpass(lat, lng);
    const google = getGoogleBuilding(lat, lng)
      .then(async (found) => (found ? { ...found, neighbours: await getGoogleNeighbours(found.building) } : null))
      .catch(() => null);
    const found = await google;
    const quick = await within(osm, found ? OSM_GRACE_MS : OSM_WAIT_MS);
    const osmHit = quick && osmBuildingIn(quick, site);
    if (osmHit) return osmHit;
    if (found) {
      const { building } = found;
      const ring = ringPoints(building);
      const centre = centroid(ring);
      const osmContext = (quick ?? []).filter((element) => {
        if (!element.tags?.building) return true;
        const other = ringPoints(element);
        return !pointInPath(centre, other) && !pointInPath(centroid(other), ring);
      });
      const hasRoad = osmContext.some((element) => element.tags?.highway);
      const hasNeighbours = osmContext.some((element) => element.tags?.building);
      const value = footprintFromOverpass([building, ...osmContext, ...(hasNeighbours ? [] : found.neighbours), ...(!hasRoad && found.road ? [found.road] : [])], site);
      if (value.status === "ok") return value;
    }
    return footprintFromOverpass(quick ?? (await osm), site);
  });
}

function rememberArea(center: LatLng, elements: OverpassElement[]) {
  if (areaElements.some((entry) => entry.elements === elements)) return;
  areaElements.unshift({ center, elements, expiresAt: Date.now() + TTL_MS });
  areaElements.splice(50);
}

export async function getNearbyBuildings(lat: number, lng: number): Promise<BuildingCandidate[]> {
  const key = `${lat.toFixed(5)}_${lng.toFixed(5)}`;
  const site = { lat, lng };
  const osm = cachedValue("nearby-area", key, STORE_TTL_MS, () =>
    requestOverpass(lat, lng, `[out:json][timeout:20];(way(around:${NEARBY_RADIUS_M + 30},${lat},${lng})["building"];way(around:${NEARBY_RADIUS_M + 120},${lat},${lng})["highway"];);out tags geom;`),
  );
  void osm.then((elements) => rememberArea(site, elements), () => undefined);
  const google = getGoogleBuilding(lat, lng)
    .then(async (found) => (found ? [found.building, ...(await getGoogleNeighbours(found.building))] : []))
    .catch(() => []);
  const googleBuildings = await google;
  const elements = (await within(osm, googleBuildings.length ? NEARBY_GRACE_MS : NEARBY_WAIT_MS)) ?? [];
  const candidates = candidatesFromOverpass(elements, site).filter((candidate) => candidate.distanceM <= NEARBY_RADIUS_M);
  for (const extra of candidatesFromOverpass(googleBuildings, site)) {
    if (extra.distanceM <= NEARBY_RADIUS_M && !candidates.some((candidate) => pointInPath(extra.center, candidate.path))) candidates.push(extra);
  }
  candidates.sort((a, b) => a.distanceM - b.distanceM);
  return candidates;
}
