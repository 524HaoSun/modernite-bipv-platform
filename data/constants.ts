import type { Region } from "../types/solar";

export const INTERIM_CONVERSION_RULE = "interim-shape-factor-v1" as const;
export const REFERENCE_TEMPERATURE_C = 25;
export const TEMPERATURE_COEFFICIENT_PER_C = -0.00189;
export const GROUND_ALBEDO = 0.2;
export const SYSTEM_LOSS_FACTOR = 0.96 * 0.97 * 0.98;
export const PVGIS_TIMEOUT_MS = 15_000;
export const IRRADIANCE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type RegionConfig = {
  region: Region;
  labelKey: string;
  defaultLanguage: "en" | "fr" | "ja" | "zh";
  currency: "GBP" | "EUR" | "CAD" | "JPY";
  priceDivisor: number;
  initialMap: { lat: number; lng: number; zoom: number };
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  irradianceDatabase: "PVGIS-SARAH3" | "PVGIS-NSRDB" | "PVGIS-ERA5";
  tariffDefaults: { import: number; export: number; offPeak: number; peak: number };
  recommendedFinishId: string;
  geocodingBias: string;
};

export const REGION_CONFIG: Record<Region, RegionConfig> = {
  UK: {
    region: "UK", labelKey: "regions.uk", defaultLanguage: "en", currency: "GBP", priceDivisor: 100,
    initialMap: { lat: 54.3, lng: -2.8, zoom: 5 },
    bounds: { minLat: 49.8, maxLat: 60.9, minLng: -8.7, maxLng: 1.8 },
    irradianceDatabase: "PVGIS-SARAH3", tariffDefaults: { import: 25, export: 12, offPeak: 8, peak: 35 },
    recommendedFinishId: "graphite-grey", geocodingBias: "gb",
  },
  EU: {
    region: "EU", labelKey: "regions.eu", defaultLanguage: "fr", currency: "EUR", priceDivisor: 100,
    initialMap: { lat: 50.7, lng: 10.3, zoom: 4 },
    bounds: { minLat: 34, maxLat: 71.5, minLng: -25, maxLng: 45 },
    irradianceDatabase: "PVGIS-SARAH3", tariffDefaults: { import: 28, export: 10, offPeak: 12, peak: 38 },
    recommendedFinishId: "terracotta", geocodingBias: "fr",
  },
  CA: {
    region: "CA", labelKey: "regions.ca", defaultLanguage: "en", currency: "CAD", priceDivisor: 100,
    initialMap: { lat: 56.1, lng: -106.3, zoom: 3 },
    bounds: { minLat: 41.5, maxLat: 83.2, minLng: -141.1, maxLng: -52.5 },
    irradianceDatabase: "PVGIS-NSRDB", tariffDefaults: { import: 14, export: 9, offPeak: 7, peak: 20 },
    recommendedFinishId: "black", geocodingBias: "ca",
  },
  JP: {
    region: "JP", labelKey: "regions.jp", defaultLanguage: "ja", currency: "JPY", priceDivisor: 1,
    initialMap: { lat: 36.2, lng: 138.3, zoom: 5 },
    bounds: { minLat: 24, maxLat: 45.6, minLng: 122.9, maxLng: 146 },
    irradianceDatabase: "PVGIS-ERA5", tariffDefaults: { import: 31, export: 8, offPeak: 18, peak: 40 },
    recommendedFinishId: "night-blue", geocodingBias: "jp",
  },
};

export function isWithinRegionBounds(region: Region, lat: number, lng: number): boolean {
  const bounds = REGION_CONFIG[region].bounds;
  return lat >= bounds.minLat && lat <= bounds.maxLat && lng >= bounds.minLng && lng <= bounds.maxLng;
}

export const SURFACE_KIND_COSTS = {
  "roof-plane": "pitchedRoof",
  facade: "facadeCladding",
  window: "windowGlazing",
  skylight: "windowGlazing",
  railing: "balustradeGlass",
  "conservatory-roof": "conservatoryRoof",
  canopy: "canopyRoof",
  ground: "canopyRoof",
} as const;
