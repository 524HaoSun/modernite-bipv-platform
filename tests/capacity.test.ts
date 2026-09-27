import { describe, expect, it } from "vitest";
import { capacityMatchesSubmitted, deriveCapacity, deriveSurfaceCapacity } from "../lib/capacity";
import type { Surface } from "../types/solar";

const surface: Surface = { id: "roof", kind: "roof-plane", label: "South roof", areaM2: 20, areaSource: "measured", azimuthDeg: 180, tiltDeg: 31, tiltSource: "archetype", coverage: 0.8, productId: "tile-windsor", finishId: "black", included: true };

describe("Capacity invariant (§14.1)", () => {
  it("uses area × coverage × density ÷ 1000", () => {
    expect(deriveSurfaceCapacity(surface).capacityKwp).toBeCloseTo((20 * 0.8 * 140.6) / 1000, 8);
    expect(deriveCapacity([surface])).toBeCloseTo(2.2496, 8);
  });
  it("uses the exact coloured-tile rating", () => {
    expect(deriveSurfaceCapacity({ ...surface, finishId: "graphite-grey" }).capacityKwp).toBeCloseTo((20 * 0.8 * 98.42) / 1000, 8);
  });
  it("rejects a server re-derivation mismatch greater than 0.1%", () => {
    const derived = deriveCapacity([surface]);
    expect(capacityMatchesSubmitted(derived * 1.01, [surface])).toBe(false);
    expect(capacityMatchesSubmitted(derived, [surface])).toBe(true);
  });
});
