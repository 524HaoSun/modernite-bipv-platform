import { describe, expect, it } from "vitest";
import { getProduct } from "../data/catalogue";
import { calculateGenerationStep, empiricalBaseEfficiency, photovoltaicLayerTemperature, totalIrradiance } from "../lib/empirical-generation";
import { canonicalSurfaces, createDemonstrationEstimate } from "../lib/estimate-engine";
import { ARCHETYPES } from "../data/archetypes";

describe("simplified workflow and empirical model integration", () => {
  it("calculates documented baseline efficiency points accurately", () => {
    expect(totalIrradiance({ directWm2: 600, diffuseWm2: 150, reflectedWm2: 50 })).toBe(800);
    expect(empiricalBaseEfficiency(140)).toBeCloseTo(0.2127, 7);
    expect(empiricalBaseEfficiency(800)).toBeCloseTo(0.169552, 5);
  });

  it("calculates the documented Solar Window Edge example matching document results", () => {
    const product = getProduct("window-edge");
    if (!product) throw new Error("window-edge missing");
    const irradiance = { directWm2: 600, diffuseWm2: 150, reflectedWm2: 50 };
    const temp = photovoltaicLayerTemperature(25, irradiance, {
      powerDensityWpM2: 100,
      directRiseKPerWm2: 0.03814,
      diffuseReflectedRiseKPerWm2: 0.03605,
    });
    expect(temp).toBeCloseTo(55.094, 3);

    const step = calculateGenerationStep({
      surface: { areaM2: 1, coverage: 1, finishId: null },
      product,
      airTemperatureC: 25,
      irradiance,
      durationHours: 1,
    });
    expect(step.efficiency).toBeCloseTo(0.097465, 5);
    expect(step.dcPowerW).toBeCloseTo(77.972, 2);
    expect(step.acEnergyKwh).toBeCloseTo(0.07017, 5);
  });

  it("produces a valid estimate result with the empirical engine and visible ledger", () => {
    const location = { region: "UK" as const, lat: 52.9548, lng: -1.1581, footprint: [], footprintAreaM2: 67, centroid: { lat: 52.9548, lng: -1.1581 }, measureMode: "traced" as const };
    const building = { archetypeId: "UK02", use: "residential" as const, storeys: 2, storeyHeightM: 2.95, widthM: 6.1, depthM: 8.4, roofForm: "hip" as const, roofPitchDeg: 31, structures: [] };
    const energy = { demandMode: "actual" as const, annualDemandKwh: 3050, demandSource: "bill" as const, householdSize: 2, daytimeOccupancy: "sometimes" as const, electricHeating: false, heatPump: false, electricHotWater: false, evCharger: false, importPence: 25, exportPence: 12, offPeakPence: 8, offPeakHours: 5, peakPence: 35, peakHours: 3 };
    const costs = { schemePriceGbp: 13500, conventionalMaterialGbp: null, conventionalLabourGbp: null, batteryInterest: "no" as const, batteryCapacityKwh: 0, batteryPriceGbp: null, batteryUsablePercent: 90, batteryEfficiencyPercent: 90, importGrowthPercent: 3, exportGrowthPercent: 2, annualMaintenanceGbp: 100, inverterReplacementYear: 12, inverterReplacementGbp: 1200, batteryReplacementYear: 13, batteryReplacementPercent: 70 };
    const estimate = createDemonstrationEstimate({ location, building, surfaces: canonicalSurfaces(), energy, costs });

    expect(estimate.range.representative).toBeGreaterThan(3000);
    expect(estimate.range.low).toBeLessThan(estimate.range.representative);
    expect(estimate.range.high).toBeGreaterThan(estimate.range.representative);
    expect(estimate.engine.conversionRule).toContain("Empirical coefficients");
    expect(estimate.ledger.some((row) => row.label === "Generation model")).toBe(true);
  });

  it("contains the expected archetype forms for the UK region", () => {
    const ukList = Object.values(ARCHETYPES).filter((item) => item.region === "UK");
    expect(ukList.length).toBeGreaterThanOrEqual(7);
  });
});
