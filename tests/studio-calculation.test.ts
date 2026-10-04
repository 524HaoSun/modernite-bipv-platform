import { describe, expect, it } from "vitest";
import { activeAreaByFamily, buildPlanningInput, estimateAnnualDemandKwh, mapStudioSnapshotToSurfaces, planningCosts } from "../lib/studio-calculation";

describe("Studio snapshot calculation mapping", () => {
  const snapshot = {
    building: { id: "UK01", width: 10.8, depth: 8.4, floors: 2, storeyHeight: 2.95, usage: "residential" as const },
    surfaces: [
      { id: "roof_tiles:front", product: "roof_tiles", profile: "windsor_colour", area: 26.5, tilt: 32, az: 180, enabled: true },
      { id: "facade:front", product: "facade", profile: "facade_grey", area: 9.2, tilt: 90, az: 180, enabled: true },
      { id: "ignored", product: "unknown", profile: "unknown", area: 4, tilt: 30, az: 180, enabled: true },
    ],
  };

  it("maps live customer Studio product snapshots onto the approved empirical catalogue", () => {
    expect(mapStudioSnapshotToSurfaces(snapshot)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "roof_tiles:front", productId: "tile-windsor", finishId: "graphite-grey", kind: "roof-plane" }),
      expect.objectContaining({ id: "facade:front", productId: "facade-grey", kind: "facade" }),
    ]));
    expect(mapStudioSnapshotToSurfaces(snapshot)).toHaveLength(2);
  });

  it("keeps the selected address and geometry in the server calculation input", () => {
    const input = buildPlanningInput({
      region: "UK",
      label: "10 Downing Street, London SW1A 2AA, UK",
      coordinates: { lat: 51.5034, lng: -0.1276 },
      snapshot,
    });
    expect(input.location).toMatchObject({ lat: 51.5034, lng: -0.1276, label: "10 Downing Street, London SW1A 2AA, UK" });
    expect(input.building).toMatchObject({ archetypeId: "UK01", widthM: 10.8, depthM: 8.4, storeys: 2 });
    expect(input.surfaces).toHaveLength(2);
  });

  it("prices the BIPV increment as PV product minus the conventional product plus PV-specific costs", () => {
    const area = 26.5 + 9.2 + 4;
    expect(planningCosts("UK", area)).toMatchObject({ pvProductPrice: 6600, conventionalPrice: 1400, pvSpecificPrice: 1500, incrementalPrice: 6700, projectPrice: 8100 });
    expect(planningCosts("JP", area).projectPrice).toBe(1300000);
    expect(planningCosts("UK", { roof: 20, facade: 10 }, undefined, 5)).toMatchObject({ pvProductPrice: 5500, conventionalPrice: 1600, pvSpecificPrice: 1700, incrementalPrice: 5600 });
    const battery = planningCosts("UK", area, { batteryMode: "solar-battery", batteryCapacityKwh: 7.5, projectPriceGbp: 18000, conventionalPriceGbp: 2000, batteryPriceGbp: null });
    expect(battery).toMatchObject({ pvProductPrice: 18000, conventionalPrice: 2000, incrementalPrice: 17500, projectPriceSource: "user", conventionalPriceSource: "user", batteryPrice: 5800, batteryPriceSource: "estimate" });
    const input = buildPlanningInput({ region: "UK", label: "London", coordinates: { lat: 51.5, lng: -0.12 }, snapshot });
    expect(activeAreaByFamily(snapshot)).toEqual({ roof: 26.5, facade: 9.2 });
    const costs = planningCosts("UK", activeAreaByFamily(snapshot));
    expect(input.costs.schemePriceGbp).toBe(costs.projectPrice);
    expect(input.costs.conventionalMaterialGbp).toBe(costs.conventionalPrice);
  });

  it("estimates household demand from people, daytime occupancy and electric loads", () => {
    const base = { householdSize: 3, daytimeOccupancy: "sometimes" as const, electricHeating: false, heatPump: false, electricHotWater: false, evCharger: false };
    expect(estimateAnnualDemandKwh(base)).toBe(4150);
    expect(estimateAnnualDemandKwh({ ...base, householdSize: 5, daytimeOccupancy: "usually" })).toBe(6450);
    expect(estimateAnnualDemandKwh({ ...base, heatPump: true, evCharger: true })).toBe(10050);
  });
});
