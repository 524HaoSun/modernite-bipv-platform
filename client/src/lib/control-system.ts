/** Public system/storage config from the administration SSOT (`/api/control/system`). */

import type { SystemAssumptions } from "../../../lib/customer-energy-core";
import type { PlanningCostRateOverride } from "../../../lib/studio-calculation";
import type { Region } from "../../../types/solar";
export type PublicSystemPlanningRate = {
  region: "UK" | "EU" | "CA" | "JP";
  bipvPerM2: number;
  batteryPerKwh: number;
  conventionalMaterialPerM2: number;
  conventionalLabourPerM2: number;
};

export type PublicSystemConfig = {
  systemVersion: string;
  inverter: { maxDcAc: number; maxClipping: number };
  battery: {
    usableFraction: number;
    roundTrip: number;
    cRate: number;
    target: number;
  };
  planningRates: PublicSystemPlanningRate[];
};

export type StudioSystemCore = {
  ASSUMPTIONS?: Partial<SystemAssumptions> & Record<string, number>;
};

let cached: PublicSystemConfig | null = null;
let inflight: Promise<PublicSystemConfig | null> | null = null;

export function getCachedPublicSystem(): PublicSystemConfig | null {
  return cached;
}

export async function fetchPublicSystem(force = false): Promise<PublicSystemConfig | null> {
  if (!force && cached) return cached;
  if (!force && inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/api/control/system", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return cached;
      const body = (await res.json()) as PublicSystemConfig;
      if (
        !body?.inverter ||
        !body?.battery ||
        !Array.isArray(body.planningRates) ||
        body.planningRates.length === 0
      ) {
        return cached;
      }
      cached = body;
      return body;
    } catch {
      return cached;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function systemAssumptionsFromPublic(
  config: PublicSystemConfig | null | undefined
): SystemAssumptions | undefined {
  if (!config?.inverter || !config?.battery) return undefined;
  return {
    maxDcAc: config.inverter.maxDcAc,
    maxClipping: config.inverter.maxClipping,
    usableFraction: config.battery.usableFraction,
    roundTrip: config.battery.roundTrip,
    cRate: config.battery.cRate,
    target: config.battery.target,
  };
}

export function planningRateOverrideFromPublic(
  config: PublicSystemConfig | null | undefined,
  region: Region
): PlanningCostRateOverride | undefined {
  const row = config?.planningRates?.find(item => item.region === region);
  if (!row) return undefined;
  return {
    perM2: row.bipvPerM2,
    batteryPerKwh: row.batteryPerKwh,
    materialPerM2: row.conventionalMaterialPerM2,
    labourPerM2: row.conventionalLabourPerM2,
  };
}

/**
 * Push admin-published inverter/battery sizing assumptions into the embedded
 * Studio system core so local sizing demos match the same SSOT as formal studies.
 */
export function applySystemToStudio(
  systemCore: StudioSystemCore | null | undefined,
  config: PublicSystemConfig | null | undefined
): { updated: number } {
  const assumptions = systemAssumptionsFromPublic(config);
  if (!systemCore?.ASSUMPTIONS || !assumptions) return { updated: 0 };
  let updated = 0;
  for (const [key, value] of Object.entries(assumptions) as [keyof SystemAssumptions, number][]) {
    if (systemCore.ASSUMPTIONS[key] !== value) {
      systemCore.ASSUMPTIONS[key] = value;
      updated += 1;
    }
  }
  return { updated };
}
