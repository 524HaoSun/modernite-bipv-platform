import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import type { GoogleSolarRoofSegment } from "../lib/google-solar";
import { envelopeCells, fitRoofPlanes, planArea, roofHeightAt, type RoofPlane } from "../lib/roof-planes";

const center = { lat: 51.5, lng: -0.12 };
const mPerDegLng = 111_320 * Math.cos((center.lat * Math.PI) / 180);
const t = Math.tan((35 * Math.PI) / 180), sec = 1 / Math.cos((35 * Math.PI) / 180);
// Front faces south (180°): local +z is south and local +x is west.
const at = (east: number, north: number) => ({ lat: center.lat + north / 110_540, lng: center.lng + east / mPerDegLng });
const segment = (azimuthDeg: number, east: number, north: number, rise: number, areaM2: number): GoogleSolarRoofSegment => ({
  pitchDeg: 35, azimuthDeg, areaM2, groundAreaM2: areaM2 / sec, sunshineMedianHoursPerYear: null, center: at(east, north), planeHeightAslM: 30 + rise,
});
const frame = { center, frontAzimuthDeg: 180, widthM: 10, depthM: 8 };
const gable = [segment(180, 0, -2, 2 * t, 40 * sec), segment(0, 0, 2, 2 * t, 40 * sec)];
const hip = [segment(180, 0, -2, 2 * t, 24 * sec), segment(0, 0, 2, 2 * t, 24 * sec), segment(90, 4, 0, t, 16 * sec), segment(270, -4, 0, t, 16 * sec)];

function studioRoofPlanes() {
  const studio = fs.readFileSync(path.resolve(import.meta.dirname, "../client/public/studio.html"), "utf8");
  const script = studio.match(/<script id="modernite-building-core">([\s\S]*?)<\/script>/)![1];
  const context = vm.createContext({ Math, Number, Array, Object, Set, Error });
  vm.runInContext("var window = this;", context);
  vm.runInContext(script, context);
  return (context as unknown as { ModerniteRoofPlanes: { faces: Function; gables: Function; top: Function; level: Function; valid: Function } }).ModerniteRoofPlanes;
}

describe("measured multi-plane roofs", () => {
  it("rebuilds a gable roof from two Google Solar segments", () => {
    const model = fitRoofPlanes(gable, frame)!;
    expect(model.planes).toHaveLength(2);
    expect(model.pitchDeg).toBe(35);
    expect(model.ridgeM).toBeCloseTo(4 * t, 1);
    expect(roofHeightAt(model.planes, 0, 4)).toBeCloseTo(0, 3);
    expect(roofHeightAt(model.planes, 3, 0)).toBeCloseTo(4 * t, 3);
  });

  it("rebuilds a hipped roof with the right face areas", () => {
    const model = fitRoofPlanes(hip, frame)!;
    expect(model.planes).toHaveLength(4);
    const areas = envelopeCells(model.planes, 10, 8).map((cell) => planArea(cell.poly)).sort((a, b) => a - b);
    expect(areas[0]).toBeCloseTo(16, 3);
    expect(areas[3]).toBeCloseTo(24, 3);
  });

  it("keeps the main roof and ignores stepped-down extensions", () => {
    const extension = segment(180, 0, -3, 2 * t - 1.5, 30 * sec);
    expect(fitRoofPlanes([...gable, extension], frame)!.planes).toEqual(fitRoofPlanes(gable, frame)!.planes);
  });

  it("rejects single planes and roofs that do not fit the building rectangle", () => {
    expect(fitRoofPlanes([gable[0]], frame)).toBeNull();
    expect(fitRoofPlanes(gable, { ...frame, widthM: 4, depthM: 4 })).toBeNull();
  });

  it("matches the Design Studio copy of the envelope, with outward wall infill under the gables", () => {
    const studio = studioRoofPlanes();
    for (const segments of [gable, hip]) {
      const planes: RoofPlane[] = fitRoofPlanes(segments, frame)!.planes;
      const faces = studio.faces(planes, 10.6, 8.6) as number[][][];
      const cells = envelopeCells(planes, 10.6, 8.6);
      expect(faces).toHaveLength(cells.length);
      faces.forEach((face, i) => face.forEach(([x, , z], j) => expect([x, z]).toEqual(cells[i].poly[j])));
      expect(studio.valid(planes)).toBe(true);
    }
    const gablePlanes = fitRoofPlanes(gable, frame)!.planes;
    const walls = studio.gables(gablePlanes, 10, 8) as number[][][];
    expect(walls).toHaveLength(2);
    for (const wall of walls) {
      const [p0, p1, p2] = wall;
      const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
      const normalX = e1[1] * e2[2] - e1[2] * e2[1];
      expect(Math.sign(normalX)).toBe(Math.sign(p0[0]));
    }
    expect(studio.gables(fitRoofPlanes(hip, frame)!.planes, 10, 8)).toHaveLength(0);
    expect(studio.level(gablePlanes, 10.6, 4.3)).toBe(true);
    expect(studio.level(fitRoofPlanes(hip, frame)!.planes, 10.6, 2)).toBe(false);
    expect(studio.top(gablePlanes, 10, 8)).toBeCloseTo(4 * t, 3);
  });
});
