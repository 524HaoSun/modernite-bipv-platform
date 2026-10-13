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

type SimulatedSolarEnergy = { directSolarKwh: number; storedSolarKwh?: number; exportKwh: number; offPeakChargeKwh?: number; offPeakDischargeKwh?: number };
type SimulatedBatteryEnergy = { offPeakChargeKwh: number; offPeakDischargeKwh: number };

type ScenarioInput = {
  annualGenerationKwh: number;
  energy: EnergyProfile;
  costs: CostProfile;
  unitPriceDivisor: number;
  /** Self-consumed share of generation from an hourly simulation, replacing the occupancy heuristic. */
  simulatedDirectShares?: { solarOnly: number; solarBattery: number };
  /** Full hourly energy-balance shares. Export must not be inferred from generation minus self-use when a battery has losses. */
  simulatedEnergyShares?: {
    solarOnly: { self: number; export: number };
    solarBattery: { self: number; export: number };
  };
  /** Absolute first-year hourly energy balance, used to split direct solar, battery solar and tariff-charged battery value. */
  simulatedEnergyKwh?: {
    solarOnly?: SimulatedSolarEnergy;
    solarBattery?: SimulatedSolarEnergy;
    batteryOnly?: SimulatedBatteryEnergy;
  };
};

function isSolarEnergy(value: SimulatedSolarEnergy | SimulatedBatteryEnergy | undefined): value is SimulatedSolarEnergy {
  return !!value && "directSolarKwh" in value;
}

function projectScenario(id: FinancialScenario["id"], input: ScenarioInput): FinancialScenario {
  const { annualGenerationKwh, energy, costs, unitPriceDivisor } = input;
  const incremental = incrementalInvestment(costs).value ?? costs.schemePriceGbp ?? 0;
  const batteryPrice = costs.batteryPriceGbp ?? 0;
  const batteryRequested = costs.batteryInterest !== "no" && batteryPrice > 0;
  const directShare = input.simulatedDirectShares?.solarOnly ?? directUseShare(energy);
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
    const generationScale = annualGenerationKwh > 0 ? generation / annualGenerationKwh : 0;
    const energyShares = hasBattery ? input.simulatedEnergyShares?.solarBattery : input.simulatedEnergyShares?.solarOnly;
    const energyKwh = id === "solar-only" ? input.simulatedEnergyKwh?.solarOnly : id === "solar-battery" ? input.simulatedEnergyKwh?.solarBattery : input.simulatedEnergyKwh?.batteryOnly;
    const solarEnergyKwh = isSolarEnergy(energyKwh) ? energyKwh : undefined;
    const effectiveDirectShare = energyShares?.self ?? (hasBattery ? input.simulatedDirectShares?.solarBattery ?? Math.min(0.9, directShare + 0.18) : directShare);
    const fallbackSelfUse = Math.min(generation * effectiveDirectShare, energy.annualDemandKwh ?? 0);
    const directSolarKwh = hasSolar && solarEnergyKwh
      ? Math.max(0, solarEnergyKwh.directSolarKwh * generationScale)
      : fallbackSelfUse;
    const storedSolarKwh = hasSolar && solarEnergyKwh
      ? Math.max(0, (solarEnergyKwh.storedSolarKwh ?? 0) * generationScale)
      : 0;
    const directUse = Math.min(directSolarKwh + storedSolarKwh, energy.annualDemandKwh ?? Number.POSITIVE_INFINITY);
    const exportKwh = hasSolar && solarEnergyKwh
      ? Math.max(0, solarEnergyKwh.exportKwh * generationScale)
      : energyShares ? Math.max(0, generation * energyShares.export) : Math.max(0, generation - directUse);
    const importRate = (energy.importPence / unitPriceDivisor) * (1 + costs.importGrowthPercent / 100) ** (year - 1);
    const peakAvoidedRate = ((energy.peakPence > 0 ? energy.peakPence : energy.importPence) / unitPriceDivisor) * (1 + costs.importGrowthPercent / 100) ** (year - 1);
    const offPeakRate = ((energy.offPeakPence > 0 ? energy.offPeakPence : energy.importPence) / unitPriceDivisor) * (1 + costs.importGrowthPercent / 100) ** (year - 1);
    const exportRate = (energy.exportPence / unitPriceDivisor) * (1 + costs.exportGrowthPercent / 100) ** (year - 1);
    const fallbackArbitrageDischarge = 0;
    const offPeakChargeKwh = Math.max(0, (energyKwh && "offPeakChargeKwh" in energyKwh ? energyKwh.offPeakChargeKwh ?? 0 : 0));
    const offPeakDischargeKwh = Math.max(0, (energyKwh && "offPeakDischargeKwh" in energyKwh ? energyKwh.offPeakDischargeKwh ?? 0 : fallbackArbitrageDischarge));
    const inferredOffPeakChargeKwh = offPeakChargeKwh || (fallbackArbitrageDischarge > 0 ? fallbackArbitrageDischarge / Math.max(0.01, costs.batteryEfficiencyPercent / 100) : 0);
    const directSolarSavings = directSolarKwh * importRate;
    const storedSolarSavings = storedSolarKwh * importRate;
    const offPeakBatterySavings = offPeakDischargeKwh * peakAvoidedRate - inferredOffPeakChargeKwh * offPeakRate;
    const billSaving = directSolarSavings + storedSolarSavings + offPeakBatterySavings;
    const exportIncome = exportKwh * exportRate;
    const monetizableValue = 0;
    const arbitrage = offPeakBatterySavings;
    const maintenance = hasSolar ? costs.annualMaintenanceGbp : 0;
    const inverterReplacement = hasSolar && year === costs.inverterReplacementYear ? costs.inverterReplacementGbp : 0;
    const batteryReplacement = hasBattery && year === costs.batteryReplacementYear ? batteryPrice * (costs.batteryReplacementPercent / 100) : 0;
    const replacementCostGbp = inverterReplacement + batteryReplacement;
    const netBenefit = billSaving + exportIncome + monetizableValue - maintenance - replacementCostGbp;
    cumulative += netBenefit;
    return {
      year,
      solarGenerationKwh: generation,
      selfConsumedKwh: directUse,
      directUseKwh: directSolarKwh,
      storedSolarKwh,
      offPeakChargeKwh: inferredOffPeakChargeKwh,
      offPeakDischargeKwh,
      directSolarSavingsGbp: directSolarSavings,
      storedSolarSavingsGbp: storedSolarSavings,
      offPeakBatterySavingsGbp: offPeakBatterySavings,
      exportEarningsGbp: exportIncome,
      exportKwh,
      billSavingGbp: billSaving,
      exportIncomeGbp: exportIncome,
      monetizableValueGbp: monetizableValue,
      arbitrageIncomeGbp: arbitrage,
      maintenanceCostGbp: maintenance,
      replacementCostGbp,
      netBenefitGbp: netBenefit,
      cumulativeNetGbp: cumulative,
    };
  });
  const breakEven = flows.find((flow) => flow.cumulativeNetGbp >= 0)?.year ?? null;
  const labels: Record<FinancialScenario["id"], string> = { "solar-only": "Solar only", "battery-only": "Battery only", "solar-battery": "Solar + battery" };
  return { id, title: labels[id], available: true, upfrontGbp: upfront, firstYearBenefitGbp: flows[0]?.netBenefitGbp ?? 0, breakEvenYear: breakEven, net25YearGbp: flows.at(-1)?.cumulativeNetGbp ?? -upfront, annualCashFlows: flows };
}

export function calculateFinancialScenarios(input: ScenarioInput): FinancialScenario[] {
  return (["solar-only", "battery-only", "solar-battery"] as const).map((id) => projectScenario(id, input));
}
