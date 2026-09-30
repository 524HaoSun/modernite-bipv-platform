import { describe, expect, it } from "vitest";
import { footprintFromOverpass, type OverpassElement } from "../lib/building-footprint";

const site = { lat: 51.5, lng: -0.12 };
const mPerDegLng = 111_320 * Math.cos((site.lat * Math.PI) / 180);
const toLatLon = (x: number, y: number) => ({ lat: site.lat + y / 110_540, lon: site.lng + x / mPerDegLng });

/** Rectangle with `width` along `angleDeg` (anticlockwise from east), centred on the site. */
function rectangle(width: number, depth: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180, u = { x: Math.cos(a), y: Math.sin(a) }, v = { x: -u.y, y: u.x };
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([i, j]) => toLatLon((i * width) / 2 * u.x + (j * depth) / 2 * v.x, (i * width) / 2 * u.y + (j * depth) / 2 * v.y));
  return corners;
}

describe("OpenStreetMap building footprint", () => {
  it("derives width, depth, storeys and a road-facing front from a rotated outline", () => {
    const elements: OverpassElement[] = [
      { type: "way", id: 1, tags: { building: "house", "building:levels": "2" }, geometry: rectangle(12, 8, 20) },
      // Road 25 m to the south of the building, running east–west.
      { type: "way", id: 2, tags: { highway: "residential", name: "Test Road" }, geometry: [toLatLon(-60, -25), toLatLon(60, -25)] },
    ];
    const result = footprintFromOverpass(elements, site);
    expect(result.status).toBe("ok");
    expect(result.footprintAreaM2).toBeCloseTo(96, 0);
    expect(result.widthM).toBeCloseTo(12, 0);
    expect(result.depthM).toBeCloseTo(8, 0);
    expect(result.floors).toBe(2);
    expect(result.floorsSource).toBe("osm-levels");
    expect(result.frontSource).toBe("road");
    expect(result.roadName).toBe("Test Road");
    // The long side runs 20° anticlockwise from east, so its road-facing normal points to 160° (SSE).
    expect(result.frontAzimuthDeg).toBeCloseTo(160, -1);
  });

  it("falls back to height tags and the south-facing long side without roads", () => {
    const result = footprintFromOverpass([{ type: "way", id: 3, tags: { building: "yes", height: "9.5 m" }, geometry: rectangle(6, 14, 90) }], site);
    expect(result.floors).toBe(3);
    expect(result.floorsSource).toBe("osm-height");
    expect(result.frontSource).toBe("south-facing");
    expect(result.widthM).toBeCloseTo(14, 0);
    expect(result.frontAzimuthDeg).toBe(180);
  });

  it("reports not-found when no outline is near the address", () => {
    const far = rectangle(10, 10, 0).map((p) => ({ lat: p.lat + 0.01, lon: p.lon }));
    expect(footprintFromOverpass([{ type: "way", id: 4, tags: { building: "yes" }, geometry: far }], site).status).toBe("not-found");
  });
});
