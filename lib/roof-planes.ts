/**
 * Multi-plane roofs for the Design Studio. Google Solar roof segments (pitch, azimuth, centre and
 * plane height) become planes in the Studio's building frame; the roof is their lower envelope over
 * the rectangular building, so every roof face is convex and the Studio's existing face, tile and
 * energy code can use it unchanged. Roofs that are not a lower envelope over one rectangle
 * (L-shaped wings, valleys) fail the area check and keep the catalogue roof forms.
 *
 * Studio frame: origin at the building rectangle centre, +z towards the front façade, +x at
 * front azimuth + 90°, height relative to the wall top (eaves). Must match the Studio copy in
 * scripts/patch-studio-render.mjs (`ModerniteRoofPlanes`).
 */
import type { LatLng } from "./building-footprint";
import type { GoogleSolarRoofSegment } from "./google-solar";

/** Roof plane: height above the wall top = a·x + b·z + k (metres). */
export type RoofPlane = { a: number; b: number; k: number };
type XZ = [number, number];

const height = (p: RoofPlane, x: number, z: number) => p.a * x + p.b * z + p.k;

function clip(poly: XZ[], f: (p: XZ) => number): XZ[] {
  const out: XZ[] = [];
  for (let i = 0; i < poly.length; i++) {
    const A = poly[i], B = poly[(i + 1) % poly.length], fa = f(A), fb = f(B);
    if (fa <= 0) out.push(A);
    if (fa <= 0 !== fb <= 0) {
      const t = fa / (fa - fb);
      out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]);
    }
  }
  return out;
}

function clean(poly: XZ[]): XZ[] {
  const out: XZ[] = [];
  for (const p of poly) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6) out.push(p);
  }
  if (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= 1e-6) out.pop();
  return out.filter((p, i) => {
    const a = out[(i + out.length - 1) % out.length], b = out[(i + 1) % out.length];
    return Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) > 1e-7;
  });
}

export const planArea = (poly: XZ[]) => poly.reduce((sum, p, i) => {
  const q = poly[(i + 1) % poly.length];
  return sum + p[0] * q[1] - q[0] * p[1];
}, 0) / 2;

/**
 * Starts each face at its lowest horizontal edge: the Studio lays tiles and skylights in rows
 * along a face's first edge, so that edge must be the eaves (as in the catalogue roof forms).
 */
function eavesFirst(poly: XZ[], p: RoofPlane): XZ[] {
  let best = -1, bestHeight = Infinity, bestLength = 0;
  poly.forEach((A, i) => {
    const B = poly[(i + 1) % poly.length], ha = height(p, A[0], A[1]), hb = height(p, B[0], B[1]);
    const length = Math.hypot(B[0] - A[0], B[1] - A[1]), mid = (ha + hb) / 2;
    if (Math.abs(ha - hb) < 1e-6 && (mid < bestHeight - 1e-6 || (Math.abs(mid - bestHeight) <= 1e-6 && length > bestLength))) {
      best = i; bestHeight = mid; bestLength = length;
    }
  });
  return best > 0 ? [...poly.slice(best), ...poly.slice(0, best)] : poly;
}

/** Plan polygon of each plane's part of the lower envelope over a width × depth rectangle. */
export function envelopeCells(planes: RoofPlane[], width: number, depth: number): { plane: number; poly: XZ[] }[] {
  const rect: XZ[] = [[width / 2, depth / 2], [-width / 2, depth / 2], [-width / 2, -depth / 2], [width / 2, -depth / 2]];
  return planes
    .map((p, i) => {
      let poly = rect;
      planes.forEach((q, j) => {
        if (j !== i && poly.length) poly = clip(poly, ([x, z]) => height(p, x, z) - height(q, x, z) + (j < i ? 1e-7 : -1e-7));
      });
      return { plane: i, poly: eavesFirst(clean(poly), p) };
    })
    .filter((cell) => cell.poly.length >= 3 && planArea(cell.poly) > 1e-3);
}

export const roofHeightAt = (planes: RoofPlane[], x: number, z: number) => Math.min(...planes.map((p) => height(p, x, z)));

export type RoofPlaneFrame = { center: LatLng; frontAzimuthDeg: number; widthM: number; depthM: number };
export type RoofPlaneModel = { planes: RoofPlane[]; ridgeM: number; pitchDeg: number };

const angleGap = (a: number, b: number) => {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return Math.min(d, 360 - d);
};

/**
 * True when the pitched roof planes mostly face the side walls, i.e. the ridge runs from front to
 * back. The Studio's standard gable always runs its ridge parallel to the front.
 */
export function ridgeRunsFrontToBack(segments: GoogleSolarRoofSegment[], frontAzimuthDeg: number): boolean {
  let side = 0, frontBack = 0;
  for (const s of segments) {
    if (s.pitchDeg < 10) continue;
    const r = ((s.azimuthDeg - frontAzimuthDeg) * Math.PI) / 180;
    side += s.areaM2 * Math.abs(Math.sin(r));
    frontBack += s.areaM2 * Math.abs(Math.cos(r));
  }
  return side > 1.5 * frontBack;
}

/** Gable with its ridge along the building depth, eaves at height 0 on the side walls. */
export function sideGablePlanes(pitchDeg: number, widthM: number): RoofPlane[] {
  const t = Math.round(Math.tan((pitchDeg * Math.PI) / 180) * 1e4) / 1e4, k = Math.round(t * (widthM / 2) * 1e4) / 1e4;
  return [{ a: -t, b: 0, k }, { a: t, b: 0, k }];
}

/**
 * Fits Studio roof planes to Google Solar segments, or null when the segments do not form a
 * lower-envelope roof over the building rectangle (or there are fewer than two pitched planes).
 */
export function fitRoofPlanes(segments: GoogleSolarRoofSegment[], frame: RoofPlaneFrame): RoofPlaneModel | null {
  const { widthM: w, depthM: d } = frame;
  if (!(w > 3 && d > 3)) return null;
  const mPerDegLng = 111_320 * Math.cos((frame.center.lat * Math.PI) / 180);
  const front = (frame.frontAzimuthDeg * Math.PI) / 180;
  const local = (p: LatLng): XZ => {
    const e = (p.lng - frame.center.lng) * mPerDegLng, n = (p.lat - frame.center.lat) * 110_540;
    return [e * Math.cos(front) - n * Math.sin(front), e * Math.sin(front) + n * Math.cos(front)];
  };

  const usable = segments.filter((s) => s.pitchDeg <= 60 && s.center && Number.isFinite(s.planeHeightAslM));
  const total = usable.reduce((sum, s) => sum + s.areaM2, 0);
  // Highest planes first: the main roof is accepted before lower extensions, porches and garages.
  const candidates = usable
    .map((s) => ({ s, c: local(s.center!) }))
    .filter(({ s, c }) => s.areaM2 >= 0.06 * total && Math.abs(c[0]) <= w / 2 + 1 && Math.abs(c[1]) <= d / 2 + 1)
    .sort((a, b) => b.s.planeHeightAslM! - a.s.planeHeightAslM! || b.s.areaM2 - a.s.areaM2);

  // A plane belongs to the envelope only if it is the lowest surface at its own centre and leaves
  // every accepted plane lowest at theirs; a stepped-down or raised roof part fails this.
  const kept: { s: GoogleSolarRoofSegment; c: XZ; plane: RoofPlane }[] = [];
  for (const { s, c } of candidates) {
    // Roof slopes run square to the walls; snapping removes Google's few-degree azimuth noise so
    // eaves stay level along the Studio walls. Slopes far off the wall axes cannot be modelled.
    const relative = ((s.azimuthDeg - frame.frontAzimuthDeg) % 360 + 360) % 360, axis = Math.round(relative / 90) * 90;
    if (s.pitchDeg >= 10 && Math.abs(relative - axis) > 12) {
      if (s.areaM2 >= 0.15 * total) return null;
      continue;
    }
    const r = s.pitchDeg >= 10 ? (axis * Math.PI) / 180 : 0, t = Math.tan((s.pitchDeg * Math.PI) / 180);
    const plane = { a: -t * Math.sin(r), b: -t * Math.cos(r), k: s.planeHeightAslM! + t * (Math.sin(r) * c[0] + Math.cos(r) * c[1]) };
    const duplicate = kept.some((k) => angleGap(k.s.azimuthDeg, s.azimuthDeg) < 15 && Math.abs(k.s.pitchDeg - s.pitchDeg) < 7 && Math.abs(height(k.plane, c[0], c[1]) - height(plane, c[0], c[1])) < 0.5);
    const onEnvelope = kept.every((k) => height(plane, k.c[0], k.c[1]) >= height(k.plane, k.c[0], k.c[1]) - 0.25 && height(k.plane, c[0], c[1]) >= height(plane, c[0], c[1]) - 0.25);
    if (!duplicate && onEnvelope) kept.push({ s, c, plane });
  }
  if (kept.filter((k) => k.s.pitchDeg >= 10).length < 2) return null;

  const cells = envelopeCells(kept.map((k) => k.plane), w, d);
  const keptArea = kept.reduce((sum, k) => sum + k.s.areaM2, 0);
  for (let i = 0; i < kept.length; i++) {
    const k = kept[i], cell = cells.find((c) => c.plane === i);
    const area = cell ? planArea(cell.poly) / Math.cos((k.s.pitchDeg * Math.PI) / 180) : 0;
    // Pitched planes may grow over parts of the rectangle Google models as lower roofs; flat decks may not.
    if (k.s.areaM2 >= 0.15 * keptArea && (area < 0.35 * k.s.areaM2 || (k.s.pitchDeg < 10 && area > 2.5 * k.s.areaM2))) return null;
  }
  const envelopeArea = cells.reduce((sum, c) => sum + planArea(c.poly) / Math.cos(Math.atan(Math.hypot(kept[c.plane].plane.a, kept[c.plane].plane.b))), 0);
  if (envelopeArea > 2.5 * keptArea) return null;
  const used = cells.map((c) => c.plane);
  if (used.filter((i) => kept[i].s.pitchDeg >= 10).length < 2) return null;
  const vertices = cells.flatMap((c) => c.poly.map(([x, z]) => height(kept[c.plane].plane, x, z)));
  const eaves = Math.min(...vertices), ridge = Math.max(...vertices) - eaves;
  if (!(ridge >= 0.6 && ridge <= 0.8 * Math.min(w, d) + 1)) return null;

  const round = (n: number) => Math.round(n * 1e4) / 1e4;
  const planes = used.map((i) => kept[i].plane).map((p) => ({ a: round(p.a), b: round(p.b), k: round(p.k - eaves) }));
  const pitched = used.filter((i) => kept[i].s.pitchDeg >= 10), pitchedArea = pitched.reduce((sum, i) => sum + kept[i].s.areaM2, 0);
  const pitchDeg = Math.round(pitched.reduce((sum, i) => sum + kept[i].s.pitchDeg * kept[i].s.areaM2, 0) / pitchedArea);
  return { planes, ridgeM: Math.round(ridge * 10) / 10, pitchDeg };
}
