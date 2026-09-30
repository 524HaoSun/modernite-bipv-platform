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
  return {
    status: "ok",
    osmId: chosen.element.id,
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
    buildingTag: tags.building,
    attachedSides,
    center: centroid,
    note: `OpenStreetMap way ${chosen.element.id}; width and depth from the minimum bounding rectangle${frontSource === "road" ? `, front facing ${roadName ?? "the nearest road"}` : ", front taken as the south-facing long side"}.`,
  };
}
