import { ARCHETYPES } from "../../../data/archetypes";
import { REGION_CONFIG } from "../../../data/constants";
import { deriveCapacity } from "../../../lib/capacity";
import { canonicalSurfaces, createDemonstrationEstimate } from "../../../lib/estimate-engine";
import { geodesicArea, polygonCentroid, rectangleFootprint } from "../../../lib/geometry";
import { clampRoofPitch } from "../../../lib/roof-pitch";
import type { BuildingConfig, CostProfile, EnergyProfile, EstimateResult, LatLng, LocationInfo, Region, SavedRoofArea, Surface } from "../../../types/solar";
import type { Language } from "../lib/i18n";
import { create } from "zustand";

const defaultLocation: LocationInfo = { region: "UK", lat: 52.9548, lng: -1.1581, footprint: [], footprintAreaM2: 0, centroid: { lat: 52.9548, lng: -1.1581 }, measureMode: "traced" };
const defaultBuilding: BuildingConfig = { archetypeId: "UK02", use: "residential", storeys: 2, storeyHeightM: 2.95, widthM: 6.1, depthM: 8.4, roofForm: "hip", roofPitchDeg: 31, structures: [] };
const defaultEnergy: EnergyProfile = { demandMode: "estimated", annualDemandKwh: 3050, demandSource: "deterministic", householdSize: 2, daytimeOccupancy: "sometimes", electricHeating: false, heatPump: false, electricHotWater: false, evCharger: false, importPence: 25, exportPence: 12, offPeakPence: 8, offPeakHours: 5, peakPence: 35, peakHours: 3 };
const defaultCosts: CostProfile = { schemePriceGbp: 13500, conventionalMaterialGbp: null, conventionalLabourGbp: null, batteryInterest: "maybe", batteryCapacityKwh: 5, batteryPriceGbp: 4000, batteryUsablePercent: 90, batteryEfficiencyPercent: 90, importGrowthPercent: 3, exportGrowthPercent: 2, annualMaintenanceGbp: 100, inverterReplacementYear: 12, inverterReplacementGbp: 1200, batteryReplacementYear: 13, batteryReplacementPercent: 70 };
const initialEstimate = createDemonstrationEstimate({ location: defaultLocation, building: defaultBuilding, surfaces: canonicalSurfaces(), energy: defaultEnergy, costs: defaultCosts });
const supportedLanguages: Language[] = ["en", "zh", "ja", "fr"];

function storedLanguage(): Language {
  try {
    const value = typeof window === "undefined" ? "en" : localStorage.getItem("modernite-language");
    return value && supportedLanguages.includes(value as Language) ? value as Language : "en";
  } catch {
    return "en";
  }
}

type DesignState = { language: Language; location: LocationInfo; savedRoofAreas: SavedRoofArea[]; building: BuildingConfig; surfaces: Surface[]; energy: EnergyProfile; costs: CostProfile; totalCapacityKwp: number; result: EstimateResult; isCalculating: boolean; error: string | null; setLanguage: (language: Language) => void; setRegion: (region: Region) => void; setLocation: (partial: Partial<LocationInfo>) => void; setFootprint: (points: LatLng[], mode: LocationInfo["measureMode"]) => void; saveRoofArea: (name?: string) => void; loadRoofArea: (id: string) => void; deleteRoofArea: (id: string) => void; setDimensions: (widthM: number, depthM: number) => void; setBuilding: (partial: Partial<BuildingConfig>) => void; setArchetype: (id: string) => void; toggleStructure: (kind: "conservatory" | "carport" | "canopy") => void; updateStructure: (kind: "conservatory" | "carport" | "canopy", partial: { widthM?: number; depthM?: number; eavesHeightM?: number; solarCoverage?: number }) => void; updateSurface: (id: string, partial: Partial<Surface>) => void; setEnergy: (partial: Partial<EnergyProfile>) => void; setCosts: (partial: Partial<CostProfile>) => void; calculateDemo: () => Promise<void>; seedPreview: () => void; reset: () => void; };

function refresh(surfaces: Surface[]) { return { surfaces, totalCapacityKwp: deriveCapacity(surfaces) }; }

export const useDesignStore = create<DesignState>((set, get) => ({
  language: storedLanguage(), location: defaultLocation, savedRoofAreas: (() => { try { return typeof window === "undefined" ? [] : JSON.parse(localStorage.getItem("modernite-saved-roofs") ?? "[]") as SavedRoofArea[]; } catch { return []; } })(), building: defaultBuilding, surfaces: canonicalSurfaces(), energy: defaultEnergy, costs: defaultCosts, totalCapacityKwp: deriveCapacity(canonicalSurfaces()), result: initialEstimate, isCalculating: false, error: null,
  setLanguage: (language) => {
    if (!supportedLanguages.includes(language)) return;
    if (typeof window !== "undefined") localStorage.setItem("modernite-language", language);
    if (typeof document !== "undefined") document.documentElement.lang = language;
    set({ language });
  },
  setRegion: (region) => { const config = REGION_CONFIG[region]; const archetype = Object.values(ARCHETYPES).find((item) => item.region === region)!; const location = { ...get().location, region, countryCode: undefined, countryName: undefined, lat: config.initialMap.lat, lng: config.initialMap.lng, footprint: [], footprintAreaM2: 0, centroid: { lat: config.initialMap.lat, lng: config.initialMap.lng }, postcode: undefined, label: undefined, locality: undefined, adminRegion: undefined }; get().setArchetype(archetype.id); set({ location, energy: { ...get().energy, importPence: config.tariffDefaults.import, exportPence: config.tariffDefaults.export, offPeakPence: config.tariffDefaults.offPeak, peakPence: config.tariffDefaults.peak } }); },
  setLocation: (partial) => set({ location: { ...get().location, ...partial } }),
  setFootprint: (points, measureMode) => { const area = geodesicArea(points); set({ location: { ...get().location, footprint: points, footprintAreaM2: area, centroid: points.length ? polygonCentroid(points) : get().location.centroid, measureMode } }); },
  saveRoofArea: (name) => { const location = get().location; if (location.footprint.length < 3) return; const savedRoofAreas = [{ id: crypto.randomUUID(), name: name?.trim() || `${location.label || "Saved site"} roof`, savedAt: Date.now(), location: structuredClone(location) }, ...get().savedRoofAreas].slice(0, 12); if (typeof window !== "undefined") localStorage.setItem("modernite-saved-roofs", JSON.stringify(savedRoofAreas)); set({ savedRoofAreas }); },
  loadRoofArea: (id) => { const saved = get().savedRoofAreas.find((item) => item.id === id); if (saved) set({ location: structuredClone(saved.location) }); },
  deleteRoofArea: (id) => { const savedRoofAreas = get().savedRoofAreas.filter((item) => item.id !== id); if (typeof window !== "undefined") localStorage.setItem("modernite-saved-roofs", JSON.stringify(savedRoofAreas)); set({ savedRoofAreas }); },
  setDimensions: (widthM, depthM) => { const location = get().location; const points = rectangleFootprint(location.centroid, widthM, depthM); set({ building: { ...get().building, widthM, depthM }, location: { ...location, footprint: points, footprintAreaM2: widthM * depthM, measureMode: "typed" } }); },
  setBuilding: (partial) => {
    const normalizedPitch = partial.roofPitchDeg === undefined ? undefined : clampRoofPitch(partial.roofPitchDeg);
    const building = { ...get().building, ...partial, ...(normalizedPitch === undefined ? {} : { roofPitchDeg: normalizedPitch }) };
    const surfaces = partial.roofPitchDeg === undefined
      ? get().surfaces
      : get().surfaces.map((surface) => surface.kind === "roof-plane" ? { ...surface, tiltDeg: normalizedPitch!, tiltSource: "user" as const } : surface);
    set({ building, ...refresh(surfaces) });
  },
  setArchetype: (id) => { const archetype = Object.values(ARCHETYPES).find((item) => item.id === id); if (!archetype) return; set({ building: { ...get().building, archetypeId: id, storeys: archetype.floors, storeyHeightM: archetype.storeyHeightM, widthM: archetype.widthM, depthM: archetype.depthM, roofForm: archetype.roofForm, roofPitchDeg: archetype.roofPitchDeg } }); },
  toggleStructure: (kind) => { const building = get().building; const exists = building.structures.some((item) => item.kind === kind); const structures = exists ? building.structures.filter((item) => item.kind !== kind) : [...building.structures, { id: kind, kind, widthM: kind === "conservatory" ? 4.16 : 5, depthM: 3, eavesHeightM: 2.6, ridgeHeightM: kind === "conservatory" ? 3.1 : undefined, attachElevation: "rear" as const, solarCoverage: 1 }]; set({ building: { ...building, structures } }); },
  updateStructure: (kind, partial) => { const building = get().building; const structures = building.structures.map((structure) => structure.kind === kind ? { ...structure, ...partial } : structure); set({ building: { ...building, structures } }); },
  updateSurface: (id, partial) => { const surfaces = get().surfaces.map((surface) => surface.id === id ? { ...surface, ...partial } : surface); set(refresh(surfaces)); },
  setEnergy: (partial) => { const energy = { ...get().energy, ...partial }; if (energy.electricHeating && energy.heatPump) energy.heatPump = false; set({ energy }); },
  setCosts: (partial) => set({ costs: { ...get().costs, ...partial } }),
  calculateDemo: async () => { set({ isCalculating: true, error: null }); await new Promise((resolve) => window.setTimeout(resolve, 800)); const { location, building, surfaces, energy, costs } = get(); set({ result: createDemonstrationEstimate({ location, building, surfaces, energy, costs }), isCalculating: false }); },
  seedPreview: () => { const surfaces = canonicalSurfaces(); set({ location: defaultLocation, building: defaultBuilding, surfaces, energy: defaultEnergy, costs: defaultCosts, totalCapacityKwp: deriveCapacity(surfaces), result: initialEstimate }); },
  reset: () => { const surfaces = canonicalSurfaces(); set({ location: defaultLocation, building: defaultBuilding, surfaces, energy: defaultEnergy, costs: defaultCosts, totalCapacityKwp: deriveCapacity(surfaces), result: initialEstimate, error: null }); },
}));
