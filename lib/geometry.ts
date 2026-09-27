import type { LatLng, SurfaceKind } from "../types/solar";

const EARTH_RADIUS_M = 6_378_137;

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function normalizeAzimuth(azimuth: number): number {
  return ((azimuth % 360) + 360) % 360;
}

export function toPvgisAspect(azimuthCompass: number): number {
  return ((180 - normalizeAzimuth(azimuthCompass) + 540) % 360) - 180;
}

export function compassName(azimuth: number): "north" | "east" | "south" | "west" {
  const normalized = normalizeAzimuth(azimuth);
  if (normalized >= 135 && normalized < 225) return "south";
  if (normalized >= 45 && normalized < 135) return "east";
  if (normalized >= 225 && normalized < 315) return "west";
  return "north";
}

export function surfaceAreaFromPlan(planAreaM2: number, tiltDeg: number, kind: SurfaceKind): number {
  if (!Number.isFinite(planAreaM2) || planAreaM2 < 0) throw new Error("Plan area must be a non-negative finite number");
  if (!Number.isFinite(tiltDeg) || tiltDeg < 0 || tiltDeg > 90) throw new Error("Tilt must be between 0 and 90 degrees");
  if (kind === "facade" || kind === "window" || kind === "skylight" || kind === "railing" || tiltDeg === 90) return planAreaM2;
  return planAreaM2 / Math.cos(degreesToRadians(tiltDeg));
}

function project(point: LatLng, referenceLatitude: number): { x: number; y: number } {
  return {
    x: EARTH_RADIUS_M * degreesToRadians(point.lng) * Math.cos(degreesToRadians(referenceLatitude)),
    y: EARTH_RADIUS_M * degreesToRadians(point.lat),
  };
}

export function geodesicArea(points: LatLng[]): number {
  if (points.length < 3) return 0;
  const referenceLatitude = points.reduce((total, point) => total + point.lat, 0) / points.length;
  const projected = points.map((point) => project(point, referenceLatitude));
  let doubledArea = 0;
  for (let index = 0; index < projected.length; index += 1) {
    const current = projected[index];
    const next = projected[(index + 1) % projected.length];
    doubledArea += current.x * next.y - next.x * current.y;
  }
  return Math.abs(doubledArea) / 2;
}

export function polygonCentroid(points: LatLng[]): LatLng {
  if (!points.length) throw new Error("At least one point is required");
  const count = points.length;
  return {
    lat: points.reduce((total, point) => total + point.lat, 0) / count,
    lng: points.reduce((total, point) => total + point.lng, 0) / count,
  };
}

function orientation(a: LatLng, b: LatLng, c: LatLng): number {
  return (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng);
}

function onSegment(a: LatLng, b: LatLng, c: LatLng): boolean {
  return Math.min(a.lng, c.lng) <= b.lng && b.lng <= Math.max(a.lng, c.lng)
    && Math.min(a.lat, c.lat) <= b.lat && b.lat <= Math.max(a.lat, c.lat);
}

function segmentsIntersect(a: LatLng, b: LatLng, c: LatLng, d: LatLng): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (o1 === 0 && onSegment(a, c, b)) return true;
  if (o2 === 0 && onSegment(a, d, b)) return true;
  if (o3 === 0 && onSegment(c, a, d)) return true;
  if (o4 === 0 && onSegment(c, b, d)) return true;
  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
}

export function isSelfIntersecting(points: LatLng[]): boolean {
  if (points.length < 4) return false;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    for (let j = i + 1; j < points.length; j += 1) {
      const adjacent = Math.abs(i - j) <= 1 || (i === 0 && j === points.length - 1);
      if (adjacent) continue;
      const c = points[j];
      const d = points[(j + 1) % points.length];
      if (segmentsIntersect(a, b, c, d)) return true;
    }
  }
  return false;
}

export function bearingDegrees(from: LatLng, to: LatLng): number {
  const lat1 = degreesToRadians(from.lat);
  const lat2 = degreesToRadians(to.lat);
  const dLng = degreesToRadians(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return normalizeAzimuth(radiansToDegrees(Math.atan2(y, x)));
}

export function rectangleFootprint(center: LatLng, widthM: number, depthM: number): LatLng[] {
  const latDelta = radiansToDegrees((depthM / 2) / EARTH_RADIUS_M);
  const lngDelta = radiansToDegrees((widthM / 2) / (EARTH_RADIUS_M * Math.cos(degreesToRadians(center.lat))));
  return [
    { lat: center.lat - latDelta, lng: center.lng - lngDelta },
    { lat: center.lat - latDelta, lng: center.lng + lngDelta },
    { lat: center.lat + latDelta, lng: center.lng + lngDelta },
    { lat: center.lat + latDelta, lng: center.lng - lngDelta },
  ];
}
