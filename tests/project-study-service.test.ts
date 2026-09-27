import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runProjectCalculation } from "../server/estimate-service";

describe("project study calculation service", () => {
  beforeEach(() => vi.clearAllMocks());

  afterEach(() => vi.unstubAllGlobals());

  it("uses mapped customer Studio geometry and a local empirical climate profile without external weather availability", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("External weather service unavailable"));
    vi.stubGlobal("fetch", fetchMock);
    const study = await runProjectCalculation({
      market: "GB",
      address: "London, UK",
      coordinates: { lat: 51.5, lng: -0.12 },
      studioSnapshot: {
        building: { id: "UK01", width: 9, depth: 8, floors: 2, usage: "residential" },
        surfaces: [{ id: "roof:main", product: "roof_tiles", profile: "yorkshire_black", area: 24, tilt: 35, az: 180, enabled: true }],
      },
      energySettings: {
        demandMode: "bill",
        annualDemandKwh: 4800,
        householdSize: 3,
        daytimeOccupancy: "usually",
        electricHeating: false,
        heatPump: true,
        electricHotWater: false,
        evCharger: true,
        batteryMode: "solar-only",
        batteryCapacityKwh: 5,
        projectPriceGbp: 12000,
        batteryPriceGbp: null,
      },
    });

    expect(study.caseId).toMatch(/^MOD-[A-F0-9]{8}$/);
    expect(study.result.engine.method).toBe("deterministic");
    expect(study.result.surfaces).toHaveLength(1);
    expect(study.result.surfaces[0]).toMatchObject({ productName: "Yorkshire Longspan" });
    expect(study.validation).toMatchObject({ status: "not-connected", annualKwh: null, endpoint: null });
    expect(study.validation.note).toContain("local empirical model is the active primary calculation");
    expect(study.result.engine.irradianceDatabase).toContain("Modernité local empirical climate profile");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(study.energy).toMatchObject({ annualDemandKwh: 4800, source: "bill" });
    expect(study.result.scenarios.find((scenario) => scenario.id === "solar-only")?.annualCashFlows).toHaveLength(25);
  });

  it("returns a clear configuration requirement instead of a raw array validation error for an empty Studio snapshot", async () => {
    await expect(runProjectCalculation({
      market: "GB",
      address: "London, UK",
      coordinates: { lat: 51.5, lng: -0.12 },
      studioSnapshot: { building: { id: "UK01", width: 9, depth: 8, floors: 2, usage: "residential" }, surfaces: [] },
    })).rejects.toThrow("Add at least one supported solar product in Solar Studio");
  });
});
