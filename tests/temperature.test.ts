import { describe, expect, it } from "vitest";
import { referencePowerDensityWm2, temperatureFactor } from "../lib/temperature";

describe("Temperature model (§14.5)", () => {
  it("returns temperature factor 0.9622 at 45°C", () => {
    expect(temperatureFactor(45)).toBeCloseTo(0.9622, 8);
  });
  it("returns 157.87 W/m² for reference power at 1000 W/m² and 45°C", () => {
    expect(referencePowerDensityWm2(1000, 45)).toBeCloseTo(157.87, 2);
  });
});
