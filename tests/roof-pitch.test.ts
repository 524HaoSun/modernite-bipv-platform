import { describe, expect, it } from "vitest";
import { clampRoofPitch, MAX_ROOF_PITCH_DEG, MIN_ROOF_PITCH_DEG } from "../lib/roof-pitch";

describe("roof pitch semantics", () => {
  it("keeps building roofs within the viable 0–70 degree range", () => {
    expect(clampRoofPitch(-8)).toBe(MIN_ROOF_PITCH_DEG);
    expect(clampRoofPitch(31)).toBe(31);
    expect(clampRoofPitch(90)).toBe(MAX_ROOF_PITCH_DEG);
  });

  it("prevents invalid numeric roof pitches from reaching the building model", () => {
    expect(clampRoofPitch(Number.NaN)).toBe(MIN_ROOF_PITCH_DEG);
    expect(clampRoofPitch(Number.POSITIVE_INFINITY)).toBe(MIN_ROOF_PITCH_DEG);
  });
});
