import { describe, expect, it } from "vitest";
import { formatAdvisorStudy, publishAdvisorStudy, publishedAdvisorStudy } from "../client/src/lib/advisor-study-context";
import type { ProjectCalculation } from "../server/estimate-service";

const study = {
  caseId: "MOD-TESTCASE",
  project: { market: "GB", address: "Richmond, London", coordinates: { lat: 51.46, lng: -0.3 }, buildingTypeId: "UK02", building: { width: 8, depth: 9, floors: 2 }, heatMode: "gas", electricHotWater: false, evCharger: true },
  weather: { name: "PVGIS TMY", kind: "pvgis-tmy", source: "PVGIS", hours: 8760, annualGhiKwhM2: 1000, annualDniKwhM2: 900, annualDhiKwhM2: 500, meanAirTemperatureC: 10.4 },
  result: {
    totalCapacityKwp: 7.62,
    range: { low: 7000, representative: 8433, high: 9000 },
    surfaces: [
      { surfaceLabel: "South roof", productName: "Yorkshire Longspan", finishName: "All Black", orientationName: "south", azimuthDeg: 0, tiltDeg: 35, areaM2: 32, capacityKwp: 4.8, annualKwh: 5200, sharePercent: 62 },
      { surfaceLabel: "West roof", productName: "Yorkshire Longspan", orientationName: "west", azimuthDeg: 90, tiltDeg: 35, areaM2: 14, capacityKwp: 2.1, annualKwh: 2400, sharePercent: 28 },
    ],
    monthlyByOrientation: Array.from({ length: 12 }, (_, month) => ({ total: 400 + month * 50 })),
    scenarios: [
      { id: "solar-only", available: true, upfrontGbp: 18000, breakEvenYear: 8, net25YearGbp: 26000, annualCashFlows: [{ billSavingGbp: 900, exportIncomeGbp: 270 }] },
      { id: "solar-battery", available: true, upfrontGbp: 25200, breakEvenYear: 20, net25YearGbp: 14000, annualCashFlows: [{ billSavingGbp: 1100, exportIncomeGbp: 200, monetizableValueGbp: 150 }] },
    ],
  },
  energy: { annualDemandKwh: 8369, source: "bill" },
  simulation: { inverterKw: 6, peakAcKw: 5.4, recommendedBatteryKwh: 5, battery: { nominalKwh: 10 }, kpis: { solarBattery: { solarCoverage: 0.47, pvSelfConsumption: 0.53, exportRate: 0.47, selfConsumedKwh: 3929, exportKwh: 4133, gridImportKwh: 4440 } } },
} as unknown as ProjectCalculation;

describe("advisor study context", () => {
  it("includes the figures the results prompts ask about, for the scenario on screen", () => {
    const text = formatAdvisorStudy(study, "solar-battery");
    expect(text).toContain("MOD-TESTCASE");
    expect(text).toContain("PVGIS TMY");
    expect(text).toContain("South roof");
    expect(text).toContain("5200 kWh/year");
    expect(text).toContain("solar-battery (currently on screen)");
    expect(text).toContain("simple payback 20 years");
    expect(text).toContain("solar coverage 47%");
    expect(text).not.toContain("solar-only (currently on screen)");
  });

  it("publishes and clears the on-screen study", () => {
    publishAdvisorStudy("on screen");
    expect(publishedAdvisorStudy()).toBe("on screen");
    publishAdvisorStudy(null);
    expect(publishedAdvisorStudy()).toBeNull();
  });
});
