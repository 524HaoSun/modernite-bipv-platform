import { describe, expect, it } from "vitest";
import {
  applySystemToStudio,
  planningRateOverrideFromPublic,
  systemAssumptionsFromPublic,
  type PublicSystemConfig,
} from "../client/src/lib/control-system";

const sample: PublicSystemConfig = {
  systemVersion: "sys-1",
  inverter: { maxDcAc: 1.4, maxClipping: 0.02 },
  battery: {
    usableFraction: 0.85,
    roundTrip: 0.88,
    cRate: 0.6,
    target: 0.8,
  },
  planningRates: [
    {
      region: "UK",
      bipvPerM2: 321,
      batteryPerKwh: 771,
      conventionalMaterialPerM2: 81,
      conventionalLabourPerM2: 66,
    },
    {
      region: "EU",
      bipvPerM2: 340,
      batteryPerKwh: 800,
      conventionalMaterialPerM2: 85,
      conventionalLabourPerM2: 70,
    },
    {
      region: "CA",
      bipvPerM2: 480,
      batteryPerKwh: 1150,
      conventionalMaterialPerM2: 120,
      conventionalLabourPerM2: 95,
    },
    {
      region: "JP",
      bipvPerM2: 52000,
      batteryPerKwh: 160000,
      conventionalMaterialPerM2: 14000,
      conventionalLabourPerM2: 10000,
    },
  ],
};

describe("public system SSOT helpers", () => {
  it("maps published assumptions and planning rates for the host UI", () => {
    expect(systemAssumptionsFromPublic(sample)).toEqual({
      maxDcAc: 1.4,
      maxClipping: 0.02,
      usableFraction: 0.85,
      roundTrip: 0.88,
      cRate: 0.6,
      target: 0.8,
    });
    expect(planningRateOverrideFromPublic(sample, "UK")).toEqual({
      perM2: 321,
      batteryPerKwh: 771,
      materialPerM2: 81,
      labourPerM2: 66,
    });
  });

  it("injects published assumptions into the Studio system core", () => {
    const systemCore = {
      ASSUMPTIONS: {
        maxDcAc: 1.3,
        maxClipping: 0.01,
        usableFraction: 0.9,
        roundTrip: 0.9,
        cRate: 0.5,
        target: 0.9,
      },
    };
    const result = applySystemToStudio(systemCore, sample);
    expect(result.updated).toBe(6);
    expect(systemCore.ASSUMPTIONS).toEqual({
      maxDcAc: 1.4,
      maxClipping: 0.02,
      usableFraction: 0.85,
      roundTrip: 0.88,
      cRate: 0.6,
      target: 0.8,
    });
  });

  it("no-ops when system core or config is missing", () => {
    expect(applySystemToStudio(null, sample)).toEqual({ updated: 0 });
    expect(applySystemToStudio({ ASSUMPTIONS: {} }, null)).toEqual({ updated: 0 });
  });
});
