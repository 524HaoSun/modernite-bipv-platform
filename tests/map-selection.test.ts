import { describe, expect, it } from "vitest";
import { geodesicArea, rectangleFootprint } from "../lib/geometry";

describe("interactive map boundary measurements", () => {
  it("returns a stable metric area for a roof-sized traced polygon", () => {
    const footprint = rectangleFootprint({ lat: 52.9548, lng: -1.1581 }, 8.4, 6.1);
    expect(geodesicArea(footprint)).toBeCloseTo(51.24, 1);
  });

  it("returns no usable area before a boundary has three vertices", () => {
    expect(geodesicArea([])).toBe(0);
    expect(geodesicArea([{ lat: 52.9, lng: -1.1 }, { lat: 52.91, lng: -1.1 }])).toBe(0);
  });
});
