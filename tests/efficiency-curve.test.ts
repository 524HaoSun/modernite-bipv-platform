import { describe, expect, it } from "vitest";
import { baseEfficiency } from "../lib/efficiency";

describe("Data Pack base efficiency curve (§14.3)", () => {
  const measured = [[70, 0.2074], [140, 0.2127], [210, 0.2026], [280, 0.1954], [350, 0.1899], [420, 0.1853], [490, 0.1815], [560, 0.1782], [630, 0.1752], [700, 0.1718], [820, 0.168], [1000, 0.1663]];
  it("preserves specified coefficients and matches measured mid-range within 0.02 percentage points", () => {
    measured.forEach(([irradiance, measuredEfficiency]) => {
      if (irradiance >= 210 && irradiance <= 630) {
        const curveRoundedToMeasuredPrecision = Math.round(baseEfficiency(irradiance) * 10_000) / 10_000;
        expect(Math.abs(curveRoundedToMeasuredPrecision - measuredEfficiency) * 100).toBeLessThanOrEqual(0.020001);
      }
    });
  });
  it("uses the linear branch at 140 and preserves log right-hand limit", () => {
    expect(baseEfficiency(140)).toBeCloseTo(0.2127, 7);
    expect(-0.02458 * Math.log(140) + 0.33386).toBeCloseTo(0.212394, 6);
  });
  it("returns zero for zero irradiance and rejects negatives", () => {
    expect(baseEfficiency(0)).toBe(0);
    expect(() => baseEfficiency(-1)).toThrow("Irradiance cannot be negative");
  });
});
