import type { BalanceScenario, EnergyBalance } from "../../../lib/customer-study";
import type { ProjectCalculation } from "../../../server/estimate-service";

/** The hourly balance for a scenario; studies saved before the balance existed are rebuilt from their totals. */
export function balanceFor(study: ProjectCalculation, scenario: string): EnergyBalance {
  const id: BalanceScenario = scenario === "solar-battery" ? "solar-battery" : "solar-only";
  const stored = study.simulation.balances?.[id];
  if (stored) return stored;
  const sim = study.simulation;
  const battery = id === "solar-battery";
  const generationKwh = sim.annualGenerationKwh, loadKwh = sim.annualLoadKwh;
  const directKwh = sim.selfConsumedKwh;
  const pvUsedKwh = battery ? sim.battery.selfConsumedKwh : directKwh;
  const exportKwh = battery ? sim.battery.exportKwh : sim.exportKwh;
  return {
    scenario: id,
    batteryKwh: battery ? sim.battery.nominalKwh : 0,
    generationKwh,
    loadKwh,
    directKwh,
    batteryToLoadKwh: Math.max(0, pvUsedKwh - directKwh),
    pvUsedKwh,
    exportKwh,
    importKwh: battery ? sim.battery.gridImportKwh : sim.gridImportKwh,
    coverage: loadKwh ? pvUsedKwh / loadKwh : 0,
    selfConsumptionRate: generationKwh ? pvUsedKwh / generationKwh : 0,
    exportRate: generationKwh ? exportKwh / generationKwh : 0,
  };
}

export const pct = (value: number) => Math.round(value * 100);
