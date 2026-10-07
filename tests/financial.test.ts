import { describe, expect, it } from "vitest";
import { calculateFinancialScenarios, incrementalInvestment } from "../lib/financial";
import type { CostProfile, EnergyProfile } from "../types/solar";

const energy: EnergyProfile = { demandMode: "actual", annualDemandKwh: 4000, demandSource: "bill", householdSize: 2, daytimeOccupancy: "usually", electricHeating: false, heatPump: false, electricHotWater: false, evCharger: false, importPence: 25, exportPence: 12, offPeakPence: 0, offPeakHours: 0, peakPence: 0, peakHours: 0 };
const costs: CostProfile = { schemePriceGbp: 13000, conventionalMaterialGbp: 7000, conventionalLabourGbp: 1000, batteryInterest: "yes", batteryCapacityKwh: 5, batteryPriceGbp: 4000, batteryUsablePercent: 90, batteryEfficiencyPercent: 90, importGrowthPercent: 3, exportGrowthPercent: 2, annualMaintenanceGbp: 100, inverterReplacementYear: 12, inverterReplacementGbp: 1200, batteryReplacementYear: 13, batteryReplacementPercent: 70 };

describe("Financial model (§14.10)", () => {
  it("uses incremental investment and warns before negative values", () => {
    expect(incrementalInvestment(costs)).toMatchObject({ value: 5000, warning: null });
    expect(incrementalInvestment({ ...costs, conventionalMaterialGbp: 14000 }).warning).toBeTruthy();
  });
  it("marks battery-only unavailable without time-of-use prices", () => {
    expect(calculateFinancialScenarios({ annualGenerationKwh: 4500, energy, costs, unitPriceDivisor: 100 }).find((scenario) => scenario.id === "battery-only")).toMatchObject({ available: false });
  });

  it("projects solar cash flows for the confirmed 25-year horizon", () => {
    const solar = calculateFinancialScenarios({ annualGenerationKwh: 4500, energy, costs, unitPriceDivisor: 100 }).find((scenario) => scenario.id === "solar-only");
    expect(solar?.annualCashFlows).toHaveLength(25);
    expect(solar?.annualCashFlows.at(-1)?.year).toBe(25);
  });

  it("uses BIPV incremental investment, not total scheme price, for solar payback", () => {
    const solar = calculateFinancialScenarios({ annualGenerationKwh: 4500, energy, costs, unitPriceDivisor: 100 }).find((scenario) => scenario.id === "solar-only");
    const battery = calculateFinancialScenarios({ annualGenerationKwh: 4500, energy, costs, unitPriceDivisor: 100 }).find((scenario) => scenario.id === "solar-battery");
    expect(solar?.upfrontGbp).toBe(5000);
    expect(solar?.annualCashFlows[0].cumulativeNetGbp).toBeGreaterThan(-costs.schemePriceGbp!);
    expect(battery?.upfrontGbp).toBe(9000);
  });

  it("uses hourly export shares instead of treating battery losses as exported energy", () => {
    const scenarios = calculateFinancialScenarios({
      annualGenerationKwh: 1000,
      energy: { ...energy, annualDemandKwh: 1000 },
      costs,
      unitPriceDivisor: 100,
      simulatedEnergyShares: {
        solarOnly: { self: 0.4, export: 0.6 },
        solarBattery: { self: 0.7, export: 0.2 },
      },
    });
    const battery = scenarios.find((scenario) => scenario.id === "solar-battery");
    expect(battery?.annualCashFlows[0]).toMatchObject({ directUseKwh: 700, exportKwh: 200 });
  });

  it("builds annual economic value from bill saving, export income and monetizable value", () => {
    const touEnergy = { ...energy, offPeakPence: 8, offPeakHours: 7, peakPence: 32, peakHours: 5 };
    const batteryOnly = calculateFinancialScenarios({ annualGenerationKwh: 0, energy: touEnergy, costs, unitPriceDivisor: 100 }).find((scenario) => scenario.id === "battery-only");
    const firstYear = batteryOnly?.annualCashFlows[0];
    expect(firstYear?.monetizableValueGbp).toBe(firstYear?.arbitrageIncomeGbp);
    expect(firstYear?.netBenefitGbp).toBeCloseTo((firstYear?.billSavingGbp ?? 0) + (firstYear?.exportIncomeGbp ?? 0) + (firstYear?.monetizableValueGbp ?? 0) - (firstYear?.maintenanceCostGbp ?? 0) - (firstYear?.replacementCostGbp ?? 0), 6);
  });
});
