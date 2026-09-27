import type { ArchetypeRecord, BuildingConfig } from "../../../types/solar";
import { publicPath } from "../lib/paths";

export type BuildingVisualKey = "detached" | "semi" | "terrace" | "endTerrace" | "bungalow" | "lowrise" | "highrise";
export type StructureVisualKey = "conservatory" | "carport" | "canopy";

type ArchitectureVisual = {
  key: BuildingVisualKey;
  image: string;
  label: string;
  caption: string;
};

type StructureVisual = {
  key: StructureVisualKey;
  image: string;
  label: string;
  caption: string;
};

export const BUILDING_VISUALS: Record<BuildingVisualKey, ArchitectureVisual> = {
  detached: {
    key: "detached",
    image: publicPath("assets/detached-house_f79b6b45.png"),
    label: "Detached house",
    caption: "Two-storey detached home · integrated solar-tile roof",
  },
  semi: {
    key: "semi",
    image: publicPath("assets/semi-detached-house_0511b432.png"),
    label: "Semi-detached pair",
    caption: "Shared party wall · selected half receives the BIPV study",
  },
  terrace: {
    key: "terrace",
    image: publicPath("assets/mid-terrace-house_0de5a7c9.png"),
    label: "Terrace row",
    caption: "Repeated bays · target dwelling is studied within the row",
  },
  endTerrace: {
    key: "endTerrace",
    image: publicPath("assets/end-terrace-house_250f90f1.png"),
    label: "End-terrace home",
    caption: "Free side elevation · one attached neighbour and a garden edge",
  },
  bungalow: {
    key: "bungalow",
    image: publicPath("assets/bungalow_35abcd7c.png"),
    label: "Single-storey bungalow",
    caption: "Low-eaves roof form · broad solar-tile plane",
  },
  lowrise: {
    key: "lowrise",
    image: publicPath("assets/low-rise-apartments_242e13d8.png"),
    label: "Low-rise apartments",
    caption: "Four-storey block · rooftop and façade BIPV opportunities",
  },
  highrise: {
    key: "highrise",
    image: publicPath("assets/high-rise-apartments_e3b8a2e6.png"),
    label: "High-rise apartments",
    caption: "Tower envelope · roof, façade and railing BIPV opportunities",
  },
};

export const STRUCTURE_VISUALS: Record<StructureVisualKey, StructureVisual> = {
  conservatory: {
    key: "conservatory",
    image: publicPath("assets/conservatory_23ac1c3c.png"),
    label: "Solar conservatory",
    caption: "Enclosed glazed room · photovoltaic glass roof",
  },
  carport: {
    key: "carport",
    image: publicPath("assets/carport_6e22b3cc.png"),
    label: "Solar carport",
    caption: "Vehicle parking · clear-span photovoltaic canopy",
  },
  canopy: {
    key: "canopy",
    image: publicPath("assets/entrance-canopy_4cf1579c.png"),
    label: "Solar entrance canopy",
    caption: "Compact threshold shade · photovoltaic glass roof",
  },
};

export function visualKeyForArchetype(archetype: ArchetypeRecord | undefined, building?: BuildingConfig): BuildingVisualKey {
  const id = archetype?.id.toLowerCase() ?? "";
  const label = archetype?.labelKey.toLowerCase() ?? "";
  const floors = building?.storeys ?? archetype?.floors ?? 2;
  const baseModel = archetype?.baseModel;
  // `labelKey` is deliberately language-neutral (e.g. `archetypes.uk02`),
  // so use the source-model family as the primary visual discriminator.
  if (baseModel === 7) return "highrise";
  if (baseModel === 6) return "lowrise";
  if (baseModel === 5 || (baseModel === 1 && floors === 1)) return "bungalow";
  if (baseModel === 2) return "semi";
  if (baseModel === 3) return "terrace";
  if (baseModel === 4) return "endTerrace";
  if (floors >= 8 || id.includes("high") || label.includes("high-rise")) return "highrise";
  if (floors >= 3 || id.includes("apartment") || id.includes("flats") || label.includes("multi-family") || label.includes("tenement")) return "lowrise";
  if (id.includes("bungalow") || id.includes("ranch") || id.includes("single-storey") || floors === 1) return "bungalow";
  if (id.includes("semi") || label.includes("semi")) return "semi";
  if (id.includes("terrace") || id.includes("row") || label.includes("terrace") || label.includes("row")) return "terrace";
  return "detached";
}

export function buildingVisualFor(archetype: ArchetypeRecord | undefined, building?: BuildingConfig) {
  return BUILDING_VISUALS[visualKeyForArchetype(archetype, building)];
}
