import { describe, expect, it } from "vitest";
import { degradationFactor } from "../lib/degradation";

describe("Degradation schedule (§14.6)", () => {
  it("uses a 25-year horizon with 95% in year one and approximately 85% in year 25", () => {
    expect(degradationFactor(1)).toBe(0.95);
    expect(degradationFactor(25)).toBeCloseTo(0.854, 8);
    expect(() => degradationFactor(26)).toThrow("Year must be an integer from 1 to 25");
  });
});
