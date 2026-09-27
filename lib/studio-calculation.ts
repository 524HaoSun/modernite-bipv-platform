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
};

export type StudioCalculationSnapshot = {
  building: {
    id: string;
    width?: number;
    depth?: number;
    floors?: number;
    storeyHeight?: number;
    usage?: "office" | "residential";
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
  projectPriceGbp?: number | null;
  batteryPriceGbp?: number | null;
};

type ProductMapping = {
  productId: string;
  kind: SurfaceKind;
  finishId: string | null;
};

function productForSnapshot(surface: StudioSurfaceSnapshot): ProductMapping | null {
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
      schemePriceGbp: settings?.projectPriceGbp && settings.projectPriceGbp > 0 ? settings.projectPriceGbp : null,
      conventionalMaterialGbp: null,
      conventionalLabourGbp: null,
      batteryInterest: settings?.batteryMode === "solar-battery" ? "yes" : "no",
      batteryCapacityKwh: settings?.batteryMode === "solar-battery" ? Math.max(1, settings.batteryCapacityKwh) : 0,
      batteryPriceGbp: settings?.batteryMode === "solar-battery" && settings.batteryPriceGbp && settings.batteryPriceGbp > 0 ? settings.batteryPriceGbp : null,
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
