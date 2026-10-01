/**
 * Building types of the customer Solar Studio (`Up` / `Kf` arrays in client/public/studio.html).
 * Values are the Studio's own defaults; tests/studio-catalog.test.ts keeps this list in sync.
 */

export type StudioRegion = "UK" | "EU" | "CA" | "JP";
/** "custom" = roof planes (lib/roof-planes.ts): measured multi-plane roofs and gables turned front to back. */
export type StudioRoofForm = "hip" | "gable" | "flat" | "mono" | "custom";
/** Gable ridge direction: "width" runs parallel to the front, "depth" from front to back. */
export type StudioRidge = "width" | "depth";
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
  /** Default gable ridge direction when not parallel to the front (the Studio's `ridgeAxis: "z"`). */
  ridge?: StudioRidge;
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
  { id: "JP01", labelEn: "Detached house / 一戸建て", labelZh: "两／三层独栋住宅", region: "JP", kind: "detached", width: 7.28, depth: 8.19, floors: 2, roofForm: "gable", pitch: 24, units: 1, storeyHeight: 2.8, ridge: "depth" },
  { id: "JP02", labelEn: "Single-storey house / 平屋", labelZh: "单层独栋住宅", region: "JP", kind: "bungalow", width: 10.92, depth: 8.19, floors: 1, roofForm: "gable", pitch: 22, units: 1, storeyHeight: 2.75 },
  { id: "JP03", labelEn: "Low-rise apartment / アパート", labelZh: "低层公寓楼", region: "JP", kind: "corridor", width: 18, depth: 8.2, floors: 2, roofForm: "mono", pitch: 10, units: 1, storeyHeight: 2.95 },
  { id: "JP04", labelEn: "Mid-rise apartment / 集合住宅", labelZh: "中层集合住宅", region: "JP", kind: "slab", width: 25, depth: 10.5, floors: 5, roofForm: "flat", pitch: 18, units: 1, storeyHeight: 3.05 },
  { id: "JP05", labelEn: "High-rise apartment / マンション", labelZh: "高层公寓楼", region: "JP", kind: "tower", width: 20, depth: 15, floors: 12, roofForm: "flat", pitch: 18, units: 1, storeyHeight: 3.05 },
  { id: "JP01_3F", labelEn: "Urban three-storey house / 3階建て", labelZh: "城市窄地三层一户建", region: "JP", kind: "detached", width: 5.46, depth: 8.64, floors: 3, roofForm: "mono", pitch: 10, units: 1, storeyHeight: 2.75 },
];

type TypeLabels = { en: string; zh: string | null; zhHant: string; ja: string; fr: string; es: string; it: string };
const L = (en: string, zh: string | null, zhHant: string, ja: string, fr: string, es: string, it: string): TypeLabels => ({ en, zh, zhHant, ja, fr, es, it });

/** Names as the Studio itself displays them (its house-type dictionary, including its JP01 override), so both sides match. */
const STUDIO_TYPE_LABELS: Record<string, TypeLabels> = {
  UK01: L("Detached house", null, "獨立住宅", "一戸建て住宅", "Maison individuelle", "Casa independiente", "Casa indipendente"),
  UK02: L("Semi-detached house", null, "半獨立住宅", "二戸一住宅", "Maison jumelée", "Casa pareada", "Casa bifamiliare"),
  UK03: L("Mid-terrace house", null, "聯排住宅中間戶", "連棟住宅の中間住戸", "Maison mitoyenne intermédiaire", "Casa adosada intermedia", "Casa a schiera centrale"),
  UK04: L("End-terrace house", null, "聯排住宅端戶", "連棟住宅の端部住戸", "Maison en bout de rangée", "Casa adosada de esquina", "Casa a schiera di testa"),
  UK05: L("Bungalow", null, "單層住宅", "平屋住宅", "Maison de plain-pied", "Casa de una planta", "Casa a un piano"),
  UK06: L("Low-rise apartment building", null, "低層公寓樓", "低層集合住宅", "Petit immeuble collectif", "Edificio residencial bajo", "Edificio residenziale basso"),
  UK07: L("Mid-/high-rise apartment building", null, "中高層公寓樓", "中高層集合住宅", "Immeuble collectif de moyenne ou grande hauteur", "Edificio residencial medio/alto", "Edificio residenziale medio/alto"),
  EU01: L("Detached house", null, "獨立住宅", "一戸建て住宅", "Maison individuelle", "Casa independiente", "Casa indipendente"),
  EU02: L("Semi-detached house", null, "半獨立／雙拼住宅", "二戸一住宅", "Maison jumelée", "Casa pareada", "Casa bifamiliare"),
  EU03: L("Mid-terrace house", null, "聯排住宅中間戶", "連棟住宅の中間住戸", "Maison mitoyenne intermédiaire", "Casa adosada intermedia", "Casa a schiera centrale"),
  EU04: L("End-terrace house", null, "聯排住宅端戶", "連棟住宅の端部住戸", "Maison en bout de rangée", "Casa adosada de esquina", "Casa a schiera di testa"),
  EU05: L("Small multi-family building", null, "低層／小型多戶住宅樓", "小規模集合住宅", "Petit immeuble de plusieurs logements", "Edificio multifamiliar pequeño", "Piccolo edificio plurifamiliare"),
  EU06: L("Large apartment building", null, "中高層／大型公寓樓", "大規模集合住宅", "Grand immeuble collectif", "Edificio residencial grande", "Grande edificio residenziale"),
  CA01: L("Multi-storey detached house", null, "多層獨立住宅", "多層の一戸建て住宅", "Maison individuelle à plusieurs niveaux", "Casa independiente de varias plantas", "Casa indipendente a più piani"),
  CA02: L("Single-storey detached house", null, "單層獨立住宅", "平屋の一戸建て住宅", "Maison individuelle de plain-pied", "Casa independiente de una planta", "Casa indipendente a un piano"),
  CA03: L("Semi-detached house", null, "半獨立住宅", "二戸一住宅", "Maison jumelée", "Casa pareada", "Casa bifamiliare"),
  CA04: L("Mid-terrace house", null, "聯排住宅中間戶", "連棟住宅の中間住戸", "Maison mitoyenne intermédiaire", "Casa adosada intermedia", "Casa a schiera centrale"),
  CA05: L("End-terrace house", null, "聯排住宅端戶", "連棟住宅の端部住戸", "Maison en bout de rangée", "Casa adosada de esquina", "Casa a schiera di testa"),
  CA06: L("Stacked duplex", null, "上下疊置雙戶住宅", "上下二世帯住宅", "Deux logements superposés", "Dúplex superpuesto", "Duplex sovrapposto"),
  CA07: L("Low-rise apartment building", null, "低層公寓樓", "低層集合住宅", "Petit immeuble collectif", "Edificio residencial bajo", "Edificio residenziale basso"),
  CA08: L("Apartment building of 5 or more storeys", null, "5層及以上公寓樓", "5階建て以上の集合住宅", "Immeuble de cinq niveaux ou plus", "Edificio residencial de 5 plantas o más", "Edificio residenziale di almeno 5 piani"),
  JP01: L("Two-storey detached house", "两层一户建", "兩層一戶建", "2階建て一戸建て", "Maison individuelle à deux niveaux", "Casa independiente de dos plantas", "Casa indipendente a due piani"),
  JP02: L("Single-storey detached house", null, "單層獨棟住宅", "平屋の一戸建て", "Maison individuelle de plain-pied", "Casa independiente de una planta", "Casa indipendente a un piano"),
  JP03: L("Low-rise apartment building", null, "低層公寓樓", "低層集合住宅", "Petit immeuble collectif", "Edificio residencial bajo", "Edificio residenziale basso"),
  JP04: L("Mid-rise apartment building", null, "中層集合住宅", "中層集合住宅", "Immeuble collectif de hauteur moyenne", "Edificio residencial de altura media", "Edificio residenziale di media altezza"),
  JP05: L("High-rise apartment building", null, "高層公寓樓", "高層集合住宅", "Immeuble collectif de grande hauteur", "Torre residencial", "Torre residenziale"),
  JP01_3F: L("Urban three-storey house", null, "城市窄地三層一戶建", "都市型狭小3階建て住宅", "Maison urbaine étroite à trois niveaux", "Casa urbana de tres plantas", "Casa urbana a tre piani"),
};

export function studioTypeLabel(id: string, language: string) {
  const type = studioTypeById(id);
  if (!type) return id;
  const labels = STUDIO_TYPE_LABELS[id];
  switch (language) {
    case "zh": return labels?.zh ?? type.labelZh;
    case "zh-Hant": return labels?.zhHant ?? type.labelZh;
    case "ja": case "fr": case "es": case "it": return labels?.[language] ?? type.labelEn;
    default: return labels?.en ?? type.labelEn;
  }
}

export const studioTypesForRegion = (region: StudioRegion) => STUDIO_BUILDING_TYPES.filter((type) => type.region === region);
export const studioTypeById = (id: string) => STUDIO_BUILDING_TYPES.find((type) => type.id === id);

export const MARKET_TO_STUDIO_REGION: Record<string, StudioRegion> = { GB: "UK", EU: "EU", CA: "CA", JP: "JP" };

/**
 * Japanese detached houses and bungalows use the Studio's timber-house builder: gable (either ridge
 * direction), hip and mono-pitch, but no flat roof and no measured roof planes.
 */
export const isTimberHouse = (type: StudioBuildingType) => type.region === "JP" && ["detached", "bungalow"].includes(type.kind);

/** Roof forms the Studio geometry can draw for a building type. */
export const roofFormsFor = (type: StudioBuildingType, measured = false): StudioRoofForm[] => [
  ...(measured && type.units === 1 && !isTimberHouse(type) ? ["custom" as const] : []),
  ...(isTimberHouse(type) ? ["gable", "hip", "mono"] as const : type.region === "JP" ? ["gable", "hip", "mono", "flat"] as const : ["hip", "gable", "mono", "flat"] as const),
];

/** Whether the gable ridge can run front to back (attached rows keep it parallel to the party walls' front). */
export const ridgeChoiceFor = (type: StudioBuildingType) => isTimberHouse(type) || type.units === 1;
