import { degradedGeneration } from "./degradation";
import type { CostProfile, EnergyProfile, FinancialScenario } from "../types/solar";

export function incrementalInvestment(costs: Pick<CostProfile, "schemePriceGbp" | "conventionalMaterialGbp" | "conventionalLabourGbp">): { value: number | null; warning: string | null } {
  if (costs.schemePriceGbp === null) return { value: null, warning: "A scheme price is needed for an incremental investment." };
  const material = costs.conventionalMaterialGbp ?? 0;
  const labour = costs.conventionalLabourGbp ?? 0;
  const value = costs.schemePriceGbp - material - labour;
  return { value: Math.max(0, value), warning: value < 0 ? "The entered displaced costs exceed the scheme price; the investment is shown as zero." : null };
}

export function directUseShare(profile: EnergyProfile): number {
  const base = profile.daytimeOccupancy === "usually" ? 0.5 : profile.daytimeOccupancy === "sometimes" ? 0.4 : 0.3;
  const uplift = (profile.evCharger ? 0.06 : 0) + (profile.heatPump ? 0.06 : 0) + (profile.electricHotWater ? 0.04 : 0);
  return Math.max(0.25, Math.min(0.72, base + uplift));
}

type ScenarioInput = {
  annualGenerationKwh: number;
  energy: EnergyProfile;
  costs: CostProfile;
  unitPriceDivisor: number;
};

function projectScenario(id: FinancialScenario["id"], input: ScenarioInput): FinancialScenario {
  const { annualGenerationKwh, energy, costs, unitPriceDivisor } = input;
  const incremental = incrementalInvestment(costs).value ?? costs.schemePriceGbp ?? 0;
  const batteryPrice = costs.batteryPriceGbp ?? 0;
  const batteryRequested = costs.batteryInterest !== "no" && batteryPrice > 0;
  const directShare = directUseShare(energy);
  const requiresTou = id === "battery-only";
  const hasTou = energy.peakPence > 0 && energy.offPeakPence >= 0 && energy.peakHours > 0 && energy.offPeakHours > 0;
  if (requiresTou && !hasTou) {
    return { id, title: "Battery only", available: false, unavailableReason: "Time-of-use prices are needed for the battery-only comparison.", upfrontGbp: batteryPrice, firstYearBenefitGbp: 0, breakEvenYear: null, net25YearGbp: -batteryPrice, annualCashFlows: [] };
  }
  const hasSolar = id !== "battery-only";
  const hasBattery = id === "battery-only" || id === "solar-battery";
  if (hasBattery && !batteryRequested && id === "solar-battery") {
    return { id, title: "Solar + battery", available: false, unavailableReason: "Enter a battery price to compare solar with battery storage.", upfrontGbp: incremental, firstYearBenefitGbp: 0, breakEvenYear: null, net25YearGbp: -incremental, annualCashFlows: [] };
  }
  const upfront = (hasSolar ? incremental : 0) + (hasBattery ? batteryPrice : 0);
  let cumulative = -upfront;
  const flows = Array.from({ length: 25 }, (_, index) => {
    const year = index + 1;
    const generation = hasSolar ? degradedGeneration(annualGenerationKwh, year) : 0;
    const effectiveDirectShare = hasBattery ? Math.min(0.9, directShare + 0.18) : directShare;
    const directUse = Math.min(generation * effectiveDirectShare, energy.annualDemandKwh ?? 0);
    const exportKwh = Math.max(0, generation - directUse);
    const importRate = (energy.importPence / unitPriceDivisor) * (1 + costs.importGrowthPercent / 100) ** (year - 1);
    const exportRate = (energy.exportPence / unitPriceDivisor) * (1 + costs.exportGrowthPercent / 100) ** (year - 1);
    const arbitrage = id === "battery-only"
      ? Math.min(costs.batteryCapacityKwh * (costs.batteryUsablePercent / 100) * 365 * (costs.batteryEfficiencyPercent / 100), (energy.annualDemandKwh ?? 0) * (energy.peakHours / 24)) * ((energy.peakPence - energy.offPeakPence) / unitPriceDivisor)
      : 0;
    const billSaving = directUse * importRate;
    const exportIncome = exportKwh * exportRate;
    const maintenance = hasSolar ? costs.annualMaintenanceGbp : 0;
    const inverterReplacement = hasSolar && year === costs.inverterReplacementYear ? costs.inverterReplacementGbp : 0;
    const batteryReplacement = hasBattery && year === costs.batteryReplacementYear ? batteryPrice * (costs.batteryReplacementPercent / 100) : 0;
    const replacementCostGbp = inverterReplacement + batteryReplacement;
    const netBenefit = billSaving + exportIncome + arbitrage - maintenance - replacementCostGbp;
    cumulative += netBenefit;
    return { year, solarGenerationKwh: generation, directUseKwh: directUse, exportKwh, billSavingGbp: billSaving, exportIncomeGbp: exportIncome, arbitrageIncomeGbp: arbitrage, maintenanceCostGbp: maintenance, replacementCostGbp, netBenefitGbp: netBenefit, cumulativeNetGbp: cumulative };
  });
  const breakEven = flows.find((flow) => flow.cumulativeNetGbp >= 0)?.year ?? null;
  const labels: Record<FinancialScenario["id"], string> = { "solar-only": "Solar only", "battery-only": "Battery only", "solar-battery": "Solar + battery" };
  return { id, title: labels[id], available: true, upfrontGbp: upfront, firstYearBenefitGbp: flows[0]?.netBenefitGbp ?? 0, breakEvenYear: breakEven, net25YearGbp: flows.at(-1)?.cumulativeNetGbp ?? -upfront, annualCashFlows: flows };
}

export function calculateFinancialScenarios(input: ScenarioInput): FinancialScenario[] {
  return (["solar-only", "battery-only", "solar-battery"] as const).map((id) => projectScenario(id, input));
}
