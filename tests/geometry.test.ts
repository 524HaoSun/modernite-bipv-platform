import { describe, expect, it } from "vitest";
import { geodesicArea, isSelfIntersecting, rectangleFootprint } from "../lib/geometry";

describe("Footprint geometry (§6.3)", () => {
  it("measures an 8 × 5.5m rectangle at UK latitude at about 44 m²", () => {
    const polygon = rectangleFootprint({ lat: 52.9548, lng: -1.1581 }, 8, 5.5);
    expect(geodesicArea(polygon)).toBeCloseTo(44, 1);
  });
  it("blocks self-intersecting polygons", () => {
    expect(isSelfIntersecting([{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }, { lat: 0, lng: 1 }, { lat: 1, lng: 0 }])).toBe(true);
  });
});
