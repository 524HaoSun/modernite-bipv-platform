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

  it("splits annual value into direct solar, stored solar, off-peak battery and export earnings", () => {
    const scenarios = calculateFinancialScenarios({
      annualGenerationKwh: 1000,
      energy: { ...energy, annualDemandKwh: 1400, offPeakPence: 7, offPeakHours: 7, peakPence: 35, peakHours: 8 },
      costs,
      unitPriceDivisor: 100,
      simulatedEnergyKwh: {
        solarOnly: { directSolarKwh: 400, storedSolarKwh: 0, exportKwh: 600 },
        solarBattery: { directSolarKwh: 400, storedSolarKwh: 250, exportKwh: 250, offPeakChargeKwh: 100, offPeakDischargeKwh: 90 },
      },
    });
    const first = scenarios.find((scenario) => scenario.id === "solar-battery")?.annualCashFlows[0];

    expect(first).toMatchObject({
      directUseKwh: 400,
      storedSolarKwh: 250,
      offPeakChargeKwh: 100,
      offPeakDischargeKwh: 90,
      exportKwh: 250,
    });
    expect(first?.directSolarSavingsGbp).toBeCloseTo(100, 6);
    expect(first?.storedSolarSavingsGbp).toBeCloseTo(62.5, 6);
    expect(first?.offPeakBatterySavingsGbp).toBeCloseTo(24.5, 6);
    expect(first?.exportEarningsGbp).toBeCloseTo(30, 6);
    expect(first?.billSavingGbp).toBeCloseTo(187, 6);
  });

  it("keeps uneconomic off-peak charging visible instead of clamping it away", () => {
    const scenarios = calculateFinancialScenarios({
      annualGenerationKwh: 0,
      energy: { ...energy, offPeakPence: 30, offPeakHours: 7, peakPence: 25, peakHours: 8 },
      costs,
      unitPriceDivisor: 100,
      simulatedEnergyKwh: {
        batteryOnly: { offPeakChargeKwh: 100, offPeakDischargeKwh: 90 },
      },
    });
    const first = scenarios.find((scenario) => scenario.id === "battery-only")?.annualCashFlows[0];

    expect(first?.offPeakBatterySavingsGbp).toBeCloseTo(-7.5, 6);
    expect(first?.billSavingGbp).toBeCloseTo(-7.5, 6);
  });

  it("uses each year's hourly re-dispatch instead of scaling the first-year battery split", () => {
    const solarOnly = Array.from({ length: 25 }, (_, index) => ({ directSolarKwh: index === 1 ? 250 : 400, storedSolarKwh: 0, exportKwh: index === 1 ? 650 : 600 }));
    const solarBattery = Array.from({ length: 25 }, (_, index) => ({ directSolarKwh: index === 1 ? 240 : 400, storedSolarKwh: index === 1 ? 180 : 250, exportKwh: index === 1 ? 480 : 250, offPeakChargeKwh: index === 1 ? 120 : 100, offPeakDischargeKwh: index === 1 ? 100 : 90 }));
    const scenarios = calculateFinancialScenarios({
      annualGenerationKwh: 1000,
      energy: { ...energy, annualDemandKwh: 1400, offPeakPence: 7, offPeakHours: 7, peakPence: 35, peakHours: 8 },
      costs,
      unitPriceDivisor: 100,
      simulatedEnergyByYear: { solarOnly, solarBattery },
    });
    const year2 = scenarios.find((scenario) => scenario.id === "solar-battery")?.annualCashFlows[1];

    expect(year2).toMatchObject({ directUseKwh: 240, storedSolarKwh: 180, exportKwh: 480, offPeakChargeKwh: 120, offPeakDischargeKwh: 100 });
  });

  it("uses hourly tariff-weighted solar values when the dispatch provides them", () => {
    const scenarios = calculateFinancialScenarios({
      annualGenerationKwh: 1000,
      energy: { ...energy, annualDemandKwh: 1200, offPeakPence: 7, offPeakHours: 7, peakPence: 35, peakHours: 3 },
      costs,
      unitPriceDivisor: 100,
      simulatedEnergyByYear: {
        solarBattery: Array.from({ length: 25 }, () => ({ directSolarKwh: 300, storedSolarKwh: 200, exportKwh: 400, directSolarValue: 60, storedSolarValue: 55, offPeakChargeKwh: 0, offPeakDischargeKwh: 0 })),
      },
    });
    const first = scenarios.find((scenario) => scenario.id === "solar-battery")?.annualCashFlows[0];

    expect(first?.directSolarSavingsGbp).toBe(60);
    expect(first?.storedSolarSavingsGbp).toBe(55);
  });

  it("builds annual economic value from bill saving, export income and monetizable value", () => {
    const touEnergy = { ...energy, offPeakPence: 8, offPeakHours: 7, peakPence: 32, peakHours: 5 };
    const batteryOnly = calculateFinancialScenarios({ annualGenerationKwh: 0, energy: touEnergy, costs, unitPriceDivisor: 100 }).find((scenario) => scenario.id === "battery-only");
    const firstYear = batteryOnly?.annualCashFlows[0];
    expect(firstYear?.offPeakBatterySavingsGbp).toBe(firstYear?.arbitrageIncomeGbp);
    expect(firstYear?.netBenefitGbp).toBeCloseTo((firstYear?.billSavingGbp ?? 0) + (firstYear?.exportIncomeGbp ?? 0) - (firstYear?.maintenanceCostGbp ?? 0) - (firstYear?.replacementCostGbp ?? 0), 6);
  });
});
