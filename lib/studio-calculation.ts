import { REGION_CONFIG } from "../data/constants";
import type { BuildingConfig, CostProfile, EnergyProfile, LocationInfo, Region, Surface, SurfaceKind } from "../types/solar";

export type StudioSurfaceSnapshot = {
  id: string;
  product: string;
  profile: string;
  area: number;
  tilt: number;
  az: number;
  enabled?: boolean;
  role?: string;
  linked?: boolean;
  u?: number;
  g?: number;
};

export type StudioCalculationSnapshot = {
  building: {
    id: string;
    width?: number;
    depth?: number;
    floors?: number;
    storeyHeight?: number;
    usage?: "office" | "residential";
    wwr?: number;
    glazedArea?: number;
  };
  surfaces: StudioSurfaceSnapshot[];
};

/**
 * Inputs collected after a user has completed the customer-owned Design Studio.
 * They affect demand, financial scenarios and the planning uncertainty band, but
 * never alter the customer building geometry or product catalogue.
 */
export type HomeEnergySettings = {
  demandMode: "bill" | "estimate";
  annualDemandKwh?: number | null;
  householdSize: number;
  daytimeOccupancy: "usually" | "sometimes" | "rarely";
  electricHeating: boolean;
  heatPump: boolean;
  electricHotWater: boolean;
  evCharger: boolean;
  batteryMode: "solar-only" | "solar-battery";
  batteryCapacityKwh: number;
  /** When not false, the battery is sized to the hourly recommendation and batteryCapacityKwh is ignored. */
  batteryCapacityAuto?: boolean;
  /** Quoted Modernite PV product cost (product only, before common roofing works). */
  projectPriceGbp?: number | null;
  /** Quoted cost of the conventional roof tiles / cladding / glazing the PV products replace. */
  conventionalPriceGbp?: number | null;
  batteryPriceGbp?: number | null;
};

export type ProductFamily = "roof" | "facade" | "glazing" | "railing" | "canopy";

/**
 * Indicative UK product prices per m² (GBP): the Modernite PV product and the conventional product it replaces.
 * Common works (labour, installation, scaffolding, roofing) occur either way and are excluded from the PV investment.
 */
const UK_PRODUCT_RATES: Record<ProductFamily, { pv: number; conventional: number }> = {
  roof: { pv: 165, conventional: 35 },
  facade: { pv: 220, conventional: 90 },
  glazing: { pv: 260, conventional: 150 },
  railing: { pv: 240, conventional: 160 },
  canopy: { pv: 230, conventional: 120 },
};

/** Local-currency multiplier on the UK product rates, battery price per usable kWh and PV-specific costs. */
export const PLANNING_COST_RATES: Record<Region, { factor: number; batteryPerKwh: number; pvFixed: number; pvPerKwp: number }> = {
  UK: { factor: 1, batteryPerKwh: 770, pvFixed: 1500, pvPerKwp: 40 },
  EU: { factor: 1.0625, batteryPerKwh: 800, pvFixed: 1600, pvPerKwp: 42 },
  CA: { factor: 1.5, batteryPerKwh: 1150, pvFixed: 2250, pvPerKwp: 60 },
  JP: { factor: 162.5, batteryPerKwh: 160000, pvFixed: 240000, pvPerKwp: 6500 },
};

export function productFamily(product: string): ProductFamily {
  if (product === "roof_tiles") return "roof";
  if (product === "facade") return "facade";
  if (product === "railing") return "railing";
  if (["canopy", "carport", "pergola", "shading"].includes(product)) return "canopy";
  return "glazing";
}

export function activeSolarAreaM2(snapshot: Pick<StudioCalculationSnapshot, "surfaces">): number {
  return snapshot.surfaces.filter((surface) => surface.enabled !== false && surface.area > 0).reduce((sum, surface) => sum + surface.area, 0);
}

export function activeAreaByFamily(snapshot: Pick<StudioCalculationSnapshot, "surfaces">): Partial<Record<ProductFamily, number>> {
  const out: Partial<Record<ProductFamily, number>> = {};
  for (const surface of snapshot.surfaces) {
    if (surface.enabled === false || !(surface.area > 0) || !productForSnapshot(surface)) continue;
    const family = productFamily(surface.product);
    out[family] = (out[family] ?? 0) + surface.area;
  }
  return out;
}

export type PlanningCosts = {
  /** Modernite PV product cost. */
  pvProductPrice: number;
  /** Conventional product cost the PV products replace. */
  conventionalPrice: number;
  /** Costs that only arise because the roof generates electricity (inverter, electrical connection, commissioning). */
  pvSpecificPrice: number;
  /** pvProductPrice − conventionalPrice + pvSpecificPrice. */
  incrementalPrice: number;
  /** Gross PV scheme price before the conventional credit (pvProductPrice + pvSpecificPrice). */
  projectPrice: number;
  projectPriceSource: "user" | "estimate";
  conventionalPriceSource: "user" | "estimate";
  batteryPrice: number | null;
  batteryPriceSource: "user" | "estimate" | null;
};

export function planningCosts(
  region: Region,
  areas: number | Partial<Record<ProductFamily, number>>,
  settings?: Pick<HomeEnergySettings, "projectPriceGbp" | "conventionalPriceGbp" | "batteryPriceGbp" | "batteryMode" | "batteryCapacityKwh">,
  capacityKwp = 0,
): PlanningCosts {
  const rates = PLANNING_COST_RATES[region];
  const step = region === "JP" ? 10000 : 100;
  const round = (value: number) => Math.round(value / step) * step;
  const byFamily = typeof areas === "number" ? { roof: areas } : areas;
  let pv = 0, conventional = 0;
  for (const [family, area] of Object.entries(byFamily) as [ProductFamily, number][]) {
    pv += Math.max(0, area) * UK_PRODUCT_RATES[family].pv * rates.factor;
    conventional += Math.max(0, area) * UK_PRODUCT_RATES[family].conventional * rates.factor;
  }
  const userProject = settings?.projectPriceGbp && settings.projectPriceGbp > 0 ? settings.projectPriceGbp : null;
  const userConventional = settings?.conventionalPriceGbp !== null && settings?.conventionalPriceGbp !== undefined && settings.conventionalPriceGbp >= 0 ? settings.conventionalPriceGbp : null;
  const pvProductPrice = userProject ?? round(pv);
  const conventionalPrice = userConventional ?? round(conventional);
  const pvSpecificPrice = pv > 0 || userProject ? round(rates.pvFixed + Math.max(0, capacityKwp) * rates.pvPerKwp) : 0;
  const battery = settings?.batteryMode === "solar-battery";
  const userBattery = battery && settings?.batteryPriceGbp && settings.batteryPriceGbp > 0 ? settings.batteryPriceGbp : null;
  return {
    pvProductPrice,
    conventionalPrice,
    pvSpecificPrice,
    incrementalPrice: Math.max(0, pvProductPrice - conventionalPrice) + pvSpecificPrice,
    projectPrice: pvProductPrice + pvSpecificPrice,
    projectPriceSource: userProject ? "user" : "estimate",
    conventionalPriceSource: userConventional !== null ? "user" : "estimate",
    batteryPrice: battery ? userBattery ?? round(Math.max(1, settings?.batteryCapacityKwh ?? 0) * rates.batteryPerKwh) : null,
    batteryPriceSource: battery ? (userBattery ? "user" : "estimate") : null,
  };
}

/** Household electricity estimate used when no bill is entered; the hourly model is calibrated to it. */
export function estimateAnnualDemandKwh(settings: Pick<HomeEnergySettings, "householdSize" | "daytimeOccupancy" | "electricHeating" | "heatPump" | "electricHotWater" | "evCharger">): number {
  return Math.max(
    1600,
    Math.round(
      1450
      + settings.householdSize * 900
      + (settings.daytimeOccupancy === "usually" ? 500 : settings.daytimeOccupancy === "rarely" ? -250 : 0)
      + (settings.electricHeating ? 7000 : settings.heatPump ? 3800 : 0)
      + (settings.electricHotWater ? 1300 : 0)
      + (settings.evCharger ? 2100 : 0),
    ),
  );
}

export type ProductMapping = {
  productId: string;
  kind: SurfaceKind;
  finishId: string | null;
};

export function productForSnapshot(surface: StudioSurfaceSnapshot): ProductMapping | null {
  const profile = surface.profile.toLowerCase();
  if (surface.product === "roof_tiles") {
    const roofId = ["windsor", "cotswold", "yorkshire", "highland"].find((name) => profile.startsWith(name));
    if (!roofId) return null;
    return {
      productId: `tile-${roofId}`,
      kind: "roof-plane",
      finishId: profile.endsWith("_black") ? "black" : "graphite-grey",
    };
  }
  if (surface.product === "facade") {
    return {
      productId: profile === "facade_lt" ? "facade-light" : profile === "facade_grey" ? "facade-grey" : "facade-black",
      kind: "facade",
      finishId: null,
    };
  }
  if (surface.product === "skylight") return { productId: "skylight", kind: "skylight", finishId: null };
  if (surface.product === "sunroom") return { productId: "conservatory-roof", kind: "conservatory-roof", finishId: null };
  if (surface.product === "railing") return { productId: "railing", kind: "railing", finishId: null };
  if (["canopy", "carport", "pergola", "shading"].includes(surface.product)) return { productId: "canopy", kind: "canopy", finishId: null };
  if (surface.product === "window" || profile.includes("window") || profile === "edge") return { productId: profile.includes("standard") ? "window-standard" : "window-edge", kind: "window", finishId: null };
  return null;
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export function mapStudioSnapshotToSurfaces(snapshot: StudioCalculationSnapshot): Surface[] {
  return snapshot.surfaces
    .filter((surface) => surface.enabled !== false && finite(surface.area, 0) > 0)
    .map((surface): Surface | null => {
      const mapping = productForSnapshot(surface);
      if (!mapping) return null;
      return {
        id: surface.id,
        kind: mapping.kind,
        label: surface.id.replaceAll("_", " ").replaceAll(":", " · "),
        areaM2: finite(surface.area, 0),
        areaSource: "measured" as const,
        azimuthDeg: ((finite(surface.az, 180) % 360) + 360) % 360,
        tiltDeg: Math.min(90, Math.max(0, finite(surface.tilt, 30))),
        tiltSource: "archetype" as const,
        coverage: 1,
        productId: mapping.productId,
        finishId: mapping.finishId,
        included: true,
      };
    })
    .filter((surface): surface is Surface => surface !== null);
}

export function buildPlanningInput(input: {
  region: Region;
  label: string;
  coordinates: { lat: number; lng: number };
  snapshot: StudioCalculationSnapshot;
  energySettings?: HomeEnergySettings;
  capacityKwp?: number;
}): {
  location: LocationInfo;
  building: BuildingConfig;
  energy: EnergyProfile;
  costs: CostProfile;
  surfaces: Surface[];
} {
  const regional = REGION_CONFIG[input.region];
  const widthM = finite(input.snapshot.building.width ?? 8, 8);
  const depthM = finite(input.snapshot.building.depth ?? 8, 8);
  const storeys = Math.max(1, Math.round(finite(input.snapshot.building.floors ?? 2, 2)));
  const settings = input.energySettings;
  const householdSize = Math.max(1, Math.min(12, Math.round(settings?.householdSize ?? 2)));
  const annualDemandKwh = settings?.annualDemandKwh && settings.annualDemandKwh > 0 ? Math.round(settings.annualDemandKwh) : null;
  const prices = planningCosts(input.region, activeAreaByFamily(input.snapshot), settings, input.capacityKwp ?? 0);

  return {
    location: {
      region: input.region,
      lat: input.coordinates.lat,
      lng: input.coordinates.lng,
      label: input.label,
      footprint: [],
      footprintAreaM2: widthM * depthM,
      centroid: input.coordinates,
      measureMode: "typed",
    },
    building: {
      archetypeId: input.snapshot.building.id,
      use: input.snapshot.building.usage === "office" ? "office" : "residential",
      storeys,
      storeyHeightM: finite(input.snapshot.building.storeyHeight ?? 2.95, 2.95),
      widthM,
      depthM,
      roofForm: "gable",
      roofPitchDeg: 30,
      structures: [],
    },
    energy: {
      demandMode: settings?.demandMode === "bill" ? "actual" : "estimated",
      annualDemandKwh,
      demandSource: settings?.demandMode === "bill" ? "bill" : settings ? "llm" : "deterministic",
      householdSize,
      daytimeOccupancy: settings?.daytimeOccupancy ?? "sometimes",
      electricHeating: settings?.electricHeating ?? false,
      heatPump: settings?.heatPump ?? false,
      electricHotWater: settings?.electricHotWater ?? false,
      evCharger: settings?.evCharger ?? false,
      importPence: regional.tariffDefaults.import,
      exportPence: regional.tariffDefaults.export,
      offPeakPence: regional.tariffDefaults.offPeak,
      offPeakHours: 5,
      peakPence: regional.tariffDefaults.peak,
      peakHours: 3,
    },
    costs: {
      schemePriceGbp: prices.projectPrice > 0 ? prices.projectPrice : null,
      conventionalMaterialGbp: prices.projectPrice > 0 ? prices.conventionalPrice : null,
      conventionalLabourGbp: null,
      batteryInterest: settings?.batteryMode === "solar-battery" ? "yes" : "no",
      batteryCapacityKwh: settings?.batteryMode === "solar-battery" ? Math.max(1, settings.batteryCapacityKwh) : 0,
      batteryPriceGbp: prices.batteryPrice,
      batteryUsablePercent: 90,
      batteryEfficiencyPercent: 90,
      importGrowthPercent: 0,
      exportGrowthPercent: 0,
      annualMaintenanceGbp: 0,
      inverterReplacementYear: 12,
      inverterReplacementGbp: 0,
      batteryReplacementYear: 13,
      batteryReplacementPercent: 0,
    },
    surfaces: mapStudioSnapshotToSurfaces(input.snapshot),
  };
}

export function regionForMarket(market: "GB" | "EU" | "CA" | "JP"): Region {
  return market === "GB" ? "UK" : market;
}
