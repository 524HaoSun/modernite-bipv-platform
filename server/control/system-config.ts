import type { SystemConfig } from "../../shared/control";
import type { SystemAssumptions } from "../../lib/customer-energy-core";
import type { PlanningCostRateOverride } from "../../lib/studio-calculation";
import type { Region } from "../../types/solar";
import { ControlStore } from "./store";
import { system as baselineSystem } from "./baseline";

export function systemAssumptionsFromConfig(config: SystemConfig): SystemAssumptions {
  return {
    maxDcAc: config.inverter.maxDcAc,
    maxClipping: config.inverter.maxClipping,
    usableFraction: config.battery.usableFraction,
    roundTrip: config.battery.roundTrip,
    cRate: config.battery.cRate,
    target: config.battery.target,
  };
}

export function planningRateOverrideFromConfig(
  config: SystemConfig,
  region: Region
): PlanningCostRateOverride | undefined {
  const row = config.planningRates.find(item => item.region === region);
  if (!row) return undefined;
  return {
    perM2: row.bipvPerM2,
    batteryPerKwh: row.batteryPerKwh,
    materialPerM2: row.conventionalMaterialPerM2,
    labourPerM2: row.conventionalLabourPerM2,
  };
}

export function publishedSystemConfig(store: ControlStore): SystemConfig {
  try {
    const release = store.current("system");
    if (release.status === "approved") return release.data as SystemConfig;
  } catch {
    // Fall through to baseline when the domain is not yet seeded.
  }
  return baselineSystem;
}
