/**
 * Building types of the customer Solar Studio (`Up` / `Kf` arrays in client/public/studio.html).
 * Values are the Studio's own defaults; tests/studio-catalog.test.ts keeps this list in sync.
 */

export type StudioRegion = "UK" | "EU" | "CA" | "JP";
export type StudioRoofForm = "hip" | "gable" | "flat" | "mono";
export type StudioBuildingType = {
  id: string;
  labelEn: string;
  labelZh: string;
  region: StudioRegion;
  kind: string;
  width: number;
  depth: number;
  floors: number;
  roofForm: StudioRoofForm;
  pitch: number;
  units: number;
  storeyHeight: number;
};

export const STUDIO_BUILDING_TYPES: StudioBuildingType[] = [
  { id: "UK01", labelEn: "Detached house", labelZh: "独立住宅", region: "UK", kind: "detached", width: 10.8, depth: 8.4, floors: 2, roofForm: "hip", pitch: 34, units: 1, storeyHeight: 2.95 },
  { id: "UK02", labelEn: "Semi-detached house", labelZh: "半独立住宅", region: "UK", kind: "semi", width: 6.1, depth: 8.4, floors: 2, roofForm: "hip", pitch: 31, units: 2, storeyHeight: 2.95 },
  { id: "UK03", labelEn: "Mid-terrace house", labelZh: "联排住宅中间户", region: "UK", kind: "mid", width: 5.2, depth: 8.5, floors: 2, roofForm: "gable", pitch: 34, units: 3, storeyHeight: 2.95 },
  { id: "UK04", labelEn: "End-terrace house", labelZh: "联排住宅端户", region: "UK", kind: "end", width: 5.2, depth: 8.5, floors: 2, roofForm: "gable", pitch: 32, units: 3, storeyHeight: 2.95 },
  { id: "UK05", labelEn: "Bungalow", labelZh: "单层住宅", region: "UK", kind: "bungalow", width: 11.4, depth: 8.2, floors: 1, roofForm: "hip", pitch: 25, units: 1, storeyHeight: 2.95 },
  { id: "UK06", labelEn: "Low-rise flats / tenement", labelZh: "低层公寓楼", region: "UK", kind: "lowrise", width: 19, depth: 11.5, floors: 3, roofForm: "flat", pitch: 18, units: 1, storeyHeight: 2.95 },
  { id: "UK07", labelEn: "Mid-/high-rise apartment block", labelZh: "中高层公寓楼", region: "UK", kind: "tower", width: 17, depth: 13, floors: 10, roofForm: "flat", pitch: 18, units: 1, storeyHeight: 3.05 },
  { id: "EU01", labelEn: "Detached single-family house", labelZh: "独立住宅", region: "EU", kind: "detached", width: 10.5, depth: 9.2, floors: 2, roofForm: "gable", pitch: 38, units: 1, storeyHeight: 2.95 },
  { id: "EU02", labelEn: "Semi-detached house", labelZh: "半独立／双拼住宅", region: "EU", kind: "semi", width: 6.2, depth: 8.7, floors: 2, roofForm: "hip", pitch: 34, units: 2, storeyHeight: 2.95 },
  { id: "EU03", labelEn: "Mid-terrace / row house", labelZh: "联排住宅中间户", region: "EU", kind: "mid", width: 5.7, depth: 9, floors: 2, roofForm: "gable", pitch: 35, units: 3, storeyHeight: 2.95 },
  { id: "EU04", labelEn: "End-terrace / end-row house", labelZh: "联排住宅端户", region: "EU", kind: "end", width: 5.7, depth: 9, floors: 2, roofForm: "flat", pitch: 18, units: 3, storeyHeight: 2.95 },
  { id: "EU05", labelEn: "Small multi-family building", labelZh: "低层／小型多户住宅楼", region: "EU", kind: "lowrise", width: 20, depth: 12, floors: 3, roofForm: "hip", pitch: 30, units: 1, storeyHeight: 2.95 },
  { id: "EU06", labelEn: "Large multi-family / apartment block", labelZh: "中高层／大型公寓楼", region: "EU", kind: "slab", width: 25, depth: 12, floors: 8, roofForm: "flat", pitch: 18, units: 1, storeyHeight: 3.05 },
  { id: "CA01", labelEn: "Multi-storey single-detached house", labelZh: "多层独立住宅", region: "CA", kind: "detached", width: 10.6, depth: 9.2, floors: 2, roofForm: "hip", pitch: 32, units: 1, storeyHeight: 2.95 },
  { id: "CA02", labelEn: "Bungalow / ranch house", labelZh: "单层独立住宅", region: "CA", kind: "bungalow", width: 15, depth: 8.5, floors: 1, roofForm: "hip", pitch: 24, units: 1, storeyHeight: 2.95 },
  { id: "CA03", labelEn: "Semi-detached house", labelZh: "半独立住宅", region: "CA", kind: "semi", width: 6.3, depth: 8.8, floors: 2, roofForm: "gable", pitch: 32, units: 2, storeyHeight: 2.95 },
  { id: "CA04", labelEn: "Mid-row townhouse", labelZh: "联排住宅中间户", region: "CA", kind: "mid", width: 5.8, depth: 8.5, floors: 3, roofForm: "gable", pitch: 30, units: 3, storeyHeight: 2.95 },
  { id: "CA05", labelEn: "End-row townhouse", labelZh: "联排住宅端户", region: "CA", kind: "end", width: 5.8, depth: 8.5, floors: 3, roofForm: "gable", pitch: 30, units: 3, storeyHeight: 2.95 },
  { id: "CA06", labelEn: "Stacked duplex", labelZh: "上下叠置双户住宅", region: "CA", kind: "duplex", width: 9.8, depth: 9, floors: 2, roofForm: "flat", pitch: 18, units: 1, storeyHeight: 2.95 },
  { id: "CA07", labelEn: "Apartment building below 5 storeys", labelZh: "低层公寓楼", region: "CA", kind: "lowrise", width: 21, depth: 12, floors: 3, roofForm: "flat", pitch: 18, units: 1, storeyHeight: 2.95 },
  { id: "CA08", labelEn: "Apartment building of 5 or more storeys", labelZh: "5层及以上公寓楼", region: "CA", kind: "tower", width: 19, depth: 14, floors: 10, roofForm: "flat", pitch: 18, units: 1, storeyHeight: 3.05 },
  { id: "JP01", labelEn: "Detached house / 一戸建て", labelZh: "两／三层独栋住宅", region: "JP", kind: "detached", width: 7.28, depth: 8.19, floors: 2, roofForm: "gable", pitch: 24, units: 1, storeyHeight: 2.8 },
  { id: "JP02", labelEn: "Single-storey house / 平屋", labelZh: "单层独栋住宅", region: "JP", kind: "bungalow", width: 10.92, depth: 8.19, floors: 1, roofForm: "gable", pitch: 22, units: 1, storeyHeight: 2.75 },
  { id: "JP03", labelEn: "Low-rise apartment / アパート", labelZh: "低层公寓楼", region: "JP", kind: "corridor", width: 18, depth: 8.2, floors: 2, roofForm: "mono", pitch: 10, units: 1, storeyHeight: 2.95 },
  { id: "JP04", labelEn: "Mid-rise apartment / 集合住宅", labelZh: "中层集合住宅", region: "JP", kind: "slab", width: 25, depth: 10.5, floors: 5, roofForm: "flat", pitch: 18, units: 1, storeyHeight: 3.05 },
  { id: "JP05", labelEn: "High-rise apartment / マンション", labelZh: "高层公寓楼", region: "JP", kind: "tower", width: 20, depth: 15, floors: 12, roofForm: "flat", pitch: 18, units: 1, storeyHeight: 3.05 },
  { id: "JP01_3F", labelEn: "Urban three-storey house / 3階建て", labelZh: "城市窄地三层一户建", region: "JP", kind: "detached", width: 5.46, depth: 8.64, floors: 3, roofForm: "mono", pitch: 10, units: 1, storeyHeight: 2.75 },
];

export const studioTypesForRegion = (region: StudioRegion) => STUDIO_BUILDING_TYPES.filter((type) => type.region === region);
export const studioTypeById = (id: string) => STUDIO_BUILDING_TYPES.find((type) => type.id === id);

export const MARKET_TO_STUDIO_REGION: Record<string, StudioRegion> = { GB: "UK", EU: "EU", CA: "CA", JP: "JP" };

/** Roof forms the Studio geometry can draw for a building type (mono-pitch only exists in the Japanese set). */
export const roofFormsFor = (type: StudioBuildingType): StudioRoofForm[] => (type.region === "JP" ? ["gable", "hip", "flat", "mono"] : ["hip", "gable", "flat"]);
