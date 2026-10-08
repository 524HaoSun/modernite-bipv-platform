/**
 * Derives Studio building parameters (front width, depth, storeys, front azimuth)
 * from an OpenStreetMap building outline and the nearest mapped road.
 */

export type LatLng = { lat: number; lng: number };

export type OverpassElement = {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
};

export type BuildingFootprint = {
  status: "ok" | "not-found";
  /** Where the outline came from; Google outlines carry no levels or height tags. */
  source?: "osm" | "google";
  osmId?: number;
  path?: LatLng[];
  footprintAreaM2?: number;
  widthM?: number;
  depthM?: number;
  frontAzimuthDeg?: number;
  frontSource?: "road" | "south-facing";
  roadName?: string;
  floors?: number;
  floorsSource?: "osm-levels" | "osm-height";
  heightM?: number;
  distanceM?: number;
  /** OSM `building=*` value, e.g. house, detached, semidetached_house, terrace, apartments. */
  buildingTag?: string;
  /** Neighbouring outlines sharing a party wall (0 detached, 1 semi / end-terrace, 2+ mid-terrace). */
  attachedSides?: number;
  center?: LatLng;
  note: string;
};

type XY = { x: number; y: number };

const M_PER_DEG_LAT = 110_540;

function projector(origin: LatLng) {
  const mPerDegLng = 111_320 * Math.cos((origin.lat * Math.PI) / 180);
  return (point: LatLng): XY => ({ x: (point.lng - origin.lng) * mPerDegLng, y: (point.lat - origin.lat) * M_PER_DEG_LAT });
}

function ringOf(element: OverpassElement): LatLng[] {
  const points = (element.geometry ?? []).map((p) => ({ lat: p.lat, lng: p.lon }));
  if (points.length > 1) {
    const first = points[0], last = points[points.length - 1];
    if (first.lat === last.lat && first.lng === last.lng) points.pop();
  }
  return points;
}

function polygonArea(points: XY[]) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function contains(points: XY[], p: XY) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function closestOnSegment(p: XY, a: XY, b: XY): XY {
  const dx = b.x - a.x, dy = b.y - a.y, len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len)) : 0;
  return { x: a.x + t * dx, y: a.y + t * dy };
}

function closestOnPath(p: XY, path: XY[], closed: boolean) {
  let best: XY | null = null, bestDistance = Infinity;
  const count = closed ? path.length : path.length - 1;
  for (let i = 0; i < count; i++) {
    const q = closestOnSegment(p, path[i], path[(i + 1) % path.length]);
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < bestDistance) { bestDistance = d; best = q; }
  }
  return { point: best, distance: bestDistance };
}

function convexHull(points: XY[]) {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: XY, a: XY, b: XY) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: XY[] = [], upper: XY[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  for (const p of [...sorted].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Minimum-area bounding rectangle: side lengths along axis `u` (a) and its normal `v` (b). */
export function minimumRectangle(points: XY[]) {
  const hull = convexHull(points);
  let best = { area: Infinity, angle: 0, a: 0, b: 0, center: { x: 0, y: 0 } };
  for (let i = 0; i < hull.length; i++) {
    const p = hull[i], q = hull[(i + 1) % hull.length];
    const angle = Math.atan2(q.y - p.y, q.x - p.x);
    const c = Math.cos(angle), s = Math.sin(angle);
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const h of hull) {
      const u = h.x * c + h.y * s, v = -h.x * s + h.y * c;
      minU = Math.min(minU, u); maxU = Math.max(maxU, u); minV = Math.min(minV, v); maxV = Math.max(maxV, v);
    }
    const area = (maxU - minU) * (maxV - minV);
    if (area < best.area) {
      const cu = (minU + maxU) / 2, cv = (minV + maxV) / 2;
      best = { area, angle, a: maxU - minU, b: maxV - minV, center: { x: cu * c - cv * s, y: cu * s + cv * c } };
    }
  }
  return best;
}

const azimuthOf = (n: XY) => ((Math.atan2(n.x, n.y) * 180) / Math.PI + 360) % 360;

function parseMetres(value: string | undefined) {
  if (!value) return undefined;
  const match = value.replace(",", ".").match(/^\s*([\d.]+)\s*(m|metres|meters)?\s*$/i);
  const metres = match ? Number(match[1]) : NaN;
  return Number.isFinite(metres) && metres > 0 ? metres : undefined;
}

export type BuildingCandidate = {
  id: number;
  path: LatLng[];
  center: LatLng;
  areaM2: number;
  distanceM: number;
  /** House number and street from OSM `addr:*` tags, or the building name. */
  address?: string;
  buildingTag?: string;
};

const ANCILLARY_TAGS = /^(garage|garages|shed|carport|roof|hut|container|kiosk|toilets|bunker|greenhouse|construction|ruins)$/;

/** Buildings around a geocoded point (postcode or street) that the user can pick from on the map. */
export function candidatesFromOverpass(elements: OverpassElement[], site: LatLng, limit = 40): BuildingCandidate[] {
  const project = projector(site);
  return elements
    .filter((e) => e.type === "way" && e.tags?.building && !ANCILLARY_TAGS.test(e.tags.building) && (e.geometry?.length ?? 0) >= 4)
    .map((e) => {
      const ring = ringOf(e);
      const xy = ring.map(project);
      const area = polygonArea(xy);
      const center = ring.reduce((sum, p) => ({ lat: sum.lat + p.lat / ring.length, lng: sum.lng + p.lng / ring.length }), { lat: 0, lng: 0 });
      const c = project(center);
      const tags = e.tags ?? {};
      const address = tags["addr:housenumber"] ? [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ") : tags.name;
      return { id: e.id, path: ring, center, areaM2: Math.round(area * 10) / 10, distanceM: Math.round(Math.hypot(c.x, c.y)), address, buildingTag: tags.building };
    })
    .filter((b) => b.path.length >= 3 && b.areaM2 >= 30)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limit);
}

const ALIGN_CELL_M = 0.5;
const ALIGN_MAX_SHIFT_M = 5;

/**
 * OSM outlines are often traced from imagery that sits a few metres off Google's aerial photo, while
 * Google's own outlines match it (and the Solar API roof layers). Returns the translation in metres
 * (x east, y north) that best lays the OSM buildings over the Google outlines, or null when no move
 * is needed or the evidence is too weak to justify one.
 */
export function osmOffsetToReference(osm: OverpassElement[], reference: OverpassElement[]): XY | null {
  const refRings = reference.map(ringOf).filter((ring) => ring.length >= 3);
  if (!refRings.length) return null;
  const project = projector(refRings[0][0]);
  const refXY = refRings.map((ring) => ring.map(project));
  const refPts = refXY.flat();
  const margin = ALIGN_MAX_SHIFT_M + 1;
  const box = { x0: Math.min(...refPts.map((p) => p.x)) - margin, x1: Math.max(...refPts.map((p) => p.x)) + margin, y0: Math.min(...refPts.map((p) => p.y)) - margin, y1: Math.max(...refPts.map((p) => p.y)) + margin };
  const osmXY = osm
    .filter((e) => e.type === "way" && e.tags?.building && e.tags.source !== "google" && (e.geometry?.length ?? 0) >= 4)
    .map((e) => ringOf(e).map(project))
    .filter((ring) => ring.length >= 3 && ring.some((p) => p.x >= box.x0 - margin && p.x <= box.x1 + margin && p.y >= box.y0 - margin && p.y <= box.y1 + margin));
  if (!osmXY.length) return null;

  const s = Math.round(ALIGN_MAX_SHIFT_M / ALIGN_CELL_M);
  const nx = Math.ceil((box.x1 - box.x0) / ALIGN_CELL_M), ny = Math.ceil((box.y1 - box.y0) / ALIGN_CELL_M);
  const gx = nx + 2 * s, gy = ny + 2 * s;
  const ref = new Uint8Array(nx * ny), osmGrid = new Uint8Array(gx * gy);
  const inside = (rings: XY[][], p: XY) => rings.some((ring) => contains(ring, p));
  let refCount = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (inside(refXY, { x: box.x0 + (i + 0.5) * ALIGN_CELL_M, y: box.y0 + (j + 0.5) * ALIGN_CELL_M })) { ref[j * nx + i] = 1; refCount++; }
  }
  for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
    if (inside(osmXY, { x: box.x0 + (i - s + 0.5) * ALIGN_CELL_M, y: box.y0 + (j - s + 0.5) * ALIGN_CELL_M })) osmGrid[j * gx + i] = 1;
  }
  if (refCount < 40) return null;

  // OSM moved by (dx, dy) covers window cell p when the unshifted OSM covers p - (dx, dy).
  const iou = (dx: number, dy: number) => {
    let inter = 0, osmCount = 0;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const o = osmGrid[(j + s - dy) * gx + (i + s - dx)];
      osmCount += o;
      inter += o & ref[j * nx + i];
    }
    return inter / (refCount + osmCount - inter);
  };
  const scores: { dx: number; dy: number; score: number }[] = [];
  for (let dy = -s; dy <= s; dy++) for (let dx = -s; dx <= s; dx++) scores.push({ dx, dy, score: iou(dx, dy) });
  const best = scores.reduce((a, b) => (b.score > a.score ? b : a));
  const unshifted = scores.find((c) => c.dx === 0 && c.dy === 0)!.score;
  // A row of identical terraced houses fits equally well one house along; such matches prove nothing.
  const rival = Math.max(...scores.filter((c) => Math.hypot(c.dx - best.dx, c.dy - best.dy) * ALIGN_CELL_M > 1.5).map((c) => c.score));
  const offset = { x: best.dx * ALIGN_CELL_M, y: best.dy * ALIGN_CELL_M };
  if (Math.abs(best.dx) === s || Math.abs(best.dy) === s || best.score - rival < 0.03) return null;
  if (best.score < 0.5 || best.score - unshifted < 0.05 || Math.hypot(offset.x, offset.y) < 0.75) return null;
  return offset;
}

/** OSM ways moved onto the Google outlines when they are measurably offset; Google ways are left untouched. */
export function alignOsmToReference(elements: OverpassElement[], reference: OverpassElement[]): OverpassElement[] {
  const offset = osmOffsetToReference(elements, reference);
  if (!offset) return elements;
  const origin = ringOf(reference[0])[0];
  const dLat = offset.y / M_PER_DEG_LAT, dLon = offset.x / (111_320 * Math.cos((origin.lat * Math.PI) / 180));
  return elements.map((e) => (e.tags?.source === "google" || !e.geometry ? e : { ...e, geometry: e.geometry.map((p) => ({ lat: p.lat + dLat, lon: p.lon + dLon })) }));
}

const ROAD_TYPES = /^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|pedestrian)(_link)?$/;

export function footprintFromOverpass(elements: OverpassElement[], site: LatLng, maxDistanceM = 35): BuildingFootprint {
  const project = projector(site);
  const origin: XY = { x: 0, y: 0 };
  const buildings = elements
    .filter((e) => e.type === "way" && e.tags?.building && (e.geometry?.length ?? 0) >= 4)
    .map((e) => {
      const ring = ringOf(e);
      const xy = ring.map(project);
      const inside = contains(xy, origin);
      return { element: e, ring, xy, inside, distance: inside ? 0 : closestOnPath(origin, xy, true).distance, area: polygonArea(xy) };
    })
    .filter((b) => b.ring.length >= 3 && b.area >= 12);
  const chosen = buildings.filter((b) => b.inside).sort((a, b) => a.area - b.area)[0] ?? buildings.filter((b) => b.distance <= maxDistanceM).sort((a, b) => a.distance - b.distance)[0];
  if (!chosen) return { status: "not-found", note: "No OpenStreetMap building outline was found at this address." };

  const rect = minimumRectangle(chosen.xy);
  const u = { x: Math.cos(rect.angle), y: Math.sin(rect.angle) }, v = { x: -u.y, y: u.x };
  const sides = [
    { normal: v, length: rect.a, other: rect.b },
    { normal: { x: -v.x, y: -v.y }, length: rect.a, other: rect.b },
    { normal: u, length: rect.b, other: rect.a },
    { normal: { x: -u.x, y: -u.y }, length: rect.b, other: rect.a },
  ];

  let front = sides[0], frontSource: BuildingFootprint["frontSource"] = "south-facing", roadName: string | undefined;
  let nearestRoad: { point: XY; distance: number; name?: string } | null = null;
  for (const road of elements.filter((e) => e.type === "way" && ROAD_TYPES.test(e.tags?.highway ?? "") && (e.geometry?.length ?? 0) >= 2)) {
    const hit = closestOnPath(rect.center, road.geometry!.map((p) => project({ lat: p.lat, lng: p.lon })), false);
    if (hit.point && hit.distance < (nearestRoad?.distance ?? Infinity)) nearestRoad = { point: hit.point, distance: hit.distance, name: road.tags?.name };
  }
  if (nearestRoad && nearestRoad.distance <= 120) {
    const toRoad = { x: nearestRoad.point.x - rect.center.x, y: nearestRoad.point.y - rect.center.y };
    front = sides.reduce((best, side) => (side.normal.x * toRoad.x + side.normal.y * toRoad.y > best.normal.x * toRoad.x + best.normal.y * toRoad.y ? side : best));
    frontSource = "road";
    roadName = nearestRoad.name;
  } else {
    front = sides.filter((side) => side.length >= side.other - 1e-6).reduce((best, side) => (-side.normal.y > -best.normal.y ? side : best));
  }

  const attachedSides = buildings.filter((other) => other !== chosen && other.xy.filter((p) => closestOnPath(p, chosen.xy, true).distance <= 0.6).length >= 2).length;
  const centroid = chosen.ring.reduce((sum, p) => ({ lat: sum.lat + p.lat / chosen.ring.length, lng: sum.lng + p.lng / chosen.ring.length }), { lat: 0, lng: 0 });
  const tags = chosen.element.tags ?? {};
  const levels = Number.parseFloat(tags["building:levels"] ?? "");
  const heightM = parseMetres(tags.height);
  const floors = Number.isFinite(levels) && levels >= 1 ? Math.round(levels) : heightM ? Math.max(1, Math.round(heightM / 3)) : undefined;
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const fromGoogle = tags.source === "google";
  const outlineNote = fromGoogle ? "Google Maps building outline" : `OpenStreetMap way ${chosen.element.id}`;
  return {
    status: "ok",
    source: fromGoogle ? "google" : "osm",
    osmId: fromGoogle ? undefined : chosen.element.id,
    path: chosen.ring,
    footprintAreaM2: round1(chosen.area),
    widthM: round1(front.length),
    depthM: round1(front.other),
    frontAzimuthDeg: Math.round(azimuthOf(front.normal)),
    frontSource,
    roadName,
    floors,
    floorsSource: Number.isFinite(levels) && levels >= 1 ? "osm-levels" : heightM ? "osm-height" : undefined,
    heightM,
    distanceM: round1(chosen.distance),
    buildingTag: fromGoogle ? undefined : tags.building,
    attachedSides,
    center: centroid,
    note: `${outlineNote}; width and depth from the minimum bounding rectangle${frontSource === "road" ? `, front facing ${roadName ?? "the nearest road"}` : ", front taken as the south-facing long side"}.`,
  };
}
