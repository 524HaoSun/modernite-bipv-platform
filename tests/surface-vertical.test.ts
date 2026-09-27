import { describe, expect, it } from "vitest";
import { surfaceAreaFromPlan } from "../lib/geometry";
import { calculateSurfaceResult } from "../lib/estimate-engine";
import { demonstrationIrradianceSeries } from "../lib/pvgis";
import type { Surface } from "../types/solar";

describe("Vertical surface support (§8.3 and §14.8)", () => {
  const wall: Surface = { id: "north-wall", kind: "facade", label: "North façade", areaM2: 10, areaSource: "user", azimuthDeg: 0, tiltDeg: 90, tiltSource: "user", coverage: 0.3, productId: "facade-light", finishId: null, included: true };
  it("does not divide by zero at 90 degrees", () => {
    expect(surfaceAreaFromPlan(10, 90, "facade")).toBe(10);
  });
  it("returns a positive north-facing vertical generation value", () => {
    expect(calculateSurfaceResult(wall, demonstrationIrradianceSeries("UK", 0, 90)).annualKwh).toBeGreaterThan(0);
  });
});
