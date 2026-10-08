import { describe, expect, it } from "vitest";
import { alignOsmToReference, footprintFromOverpass, osmOffsetToReference, type OverpassElement } from "../lib/building-footprint";

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

  it("marks Google outlines as such and keeps OSM roads for the front", () => {
    const value = footprintFromOverpass([
      { type: "way", id: -7, tags: { building: "yes", source: "google" }, geometry: rectangle(14, 9, 0) },
      { type: "way", id: 2, tags: { highway: "residential", name: "Test Road" }, geometry: [toLatLon(-60, -25), toLatLon(60, -25)] },
    ], site);
    expect(value.status).toBe("ok");
    expect(value.source).toBe("google");
    expect(value.osmId).toBeUndefined();
    expect(value.buildingTag).toBeUndefined();
    expect(value.widthM).toBeCloseTo(14, 0);
    expect(value.frontAzimuthDeg).toBe(180);
    expect(value.note).toContain("Google Maps building outline");
  });
});

describe("OSM outline alignment to Google outlines", () => {
  /** A street of 6 m × 9 m semi-detached houses (pairs 3 m apart, one pair stepped back), moved by (dx, dy) metres. */
  const terrace = (dx: number, dy: number, source?: string): OverpassElement[] =>
    [0, 1, 2, 3, 4, 5].map((i) => {
      const x0 = i * 6 + Math.floor(i / 2) * 3 - 22 + dx, y0 = dy + (i >= 4 ? 2 : 0);
      return { type: "way", id: source ? -(i + 1) : i + 1, tags: { building: "house", ...(source ? { source } : {}) }, geometry: [[x0, y0], [x0 + 6, y0], [x0 + 6, y0 + 9], [x0, y0 + 9], [x0, y0]].map(([x, y]) => toLatLon(x, y)) };
    });
  const road: OverpassElement = { type: "way", id: 99, tags: { highway: "residential" }, geometry: [toLatLon(-40, -8), toLatLon(40, -8)] };

  it("measures a whole-area OSM offset against several Google outlines", () => {
    const google = terrace(2.3, 0.6, "google").slice(1, 4);
    const offset = osmOffsetToReference([...terrace(0, 0), road], google);
    expect(offset?.x).toBeCloseTo(2.3, 0);
    expect(offset?.y).toBeCloseTo(0.6, 0);
    const aligned = alignOsmToReference([...terrace(0, 0), road], google);
    const firstHouse = (aligned[0].geometry ?? [])[0];
    expect((firstHouse.lon - toLatLon(-22, 0).lon) * mPerDegLng).toBeCloseTo(offset!.x, 5);
    // Roads were traced from the same imagery, so they move with the buildings.
    expect((aligned.at(-1)!.geometry![0].lat - road.geometry![0].lat) * 110_540).toBeCloseTo(offset!.y, 5);
  });

  it("leaves outlines alone when they already match or the match is ambiguous", () => {
    expect(osmOffsetToReference(terrace(0, 0), terrace(0.2, -0.1, "google").slice(1, 4))).toBeNull();
    // One terraced house matches every house in the row equally well along the street.
    expect(osmOffsetToReference(terrace(0, 0), terrace(3, 0, "google").slice(2, 3))).toBeNull();
    const elements = terrace(0, 0);
    expect(alignOsmToReference(elements, [])).toBe(elements);
  });
});
