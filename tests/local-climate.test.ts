import { describe, expect, it } from "vitest";
import { localEmpiricalClimateSeries } from "../lib/local-climate";

describe("local empirical climate profile", () => {
  it("provides a complete local monthly profile without an external weather request", () => {
    const result = localEmpiricalClimateSeries({ region: "UK", azimuthDeg: 180, tiltDeg: 35 });

    expect(result.source).toBe("local-empirical-climate");
    expect(result.database).toContain("Modernité local empirical climate profile");
    expect(result.monthly).toHaveLength(12);
    expect(result.monthly.every((month) => month.irradiationKwhM2 > 0 && month.beamKwhM2 >= 0 && month.diffuseKwhM2 >= 0 && month.reflectedKwhM2 >= 0)).toBe(true);
  });

  it("retains an explicit orientation response in the local planning profile", () => {
    const south = localEmpiricalClimateSeries({ region: "UK", azimuthDeg: 180, tiltDeg: 35 });
    const north = localEmpiricalClimateSeries({ region: "UK", azimuthDeg: 0, tiltDeg: 35 });

    const southAnnual = south.monthly.reduce((total, month) => total + month.irradiationKwhM2, 0);
    const northAnnual = north.monthly.reduce((total, month) => total + month.irradiationKwhM2, 0);
    expect(southAnnual).toBeGreaterThan(northAnnual);
  });
});
