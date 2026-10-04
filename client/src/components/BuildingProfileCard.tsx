import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Building2, Check, Footprints, Loader2, Pencil, RotateCcw, Sun } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { BuildingProfile, ProfileSource } from "../../../lib/building-profile";
import type { RoofPlane } from "../../../lib/roof-planes";
import { MARKET_TO_STUDIO_REGION, ridgeChoiceFor, roofFormsFor, studioTypeById, studioTypeLabel, studioTypesForRegion, type StudioRidge, type StudioRoofForm } from "../../../lib/studio-catalog";

type LatLng = { lat: number; lng: number };
type Language = "en" | "zh" | "zh-Hant" | "fr" | "ja" | "es" | "it";
type FieldKey = "typeId" | "widthM" | "depthM" | "floors" | "storeyHeightM" | "roofForm" | "roofPitchDeg" | "ridge" | "frontAzimuthDeg";
export type BuildingValueSource = ProfileSource | "user";

export type AppliedBuilding = {
  locationKey: string;
  typeId: string;
  widthM: number;
  depthM: number;
  floors: number;
  storeyHeightM: number;
  roofForm: StudioRoofForm;
  roofPitchDeg: number;
  roofPlanes?: RoofPlane[];
  ridge?: StudioRidge;
  chimney?: boolean;
  frontAzimuthDeg: number;
  sources: Record<FieldKey, BuildingValueSource>;
};

type Draft = Omit<AppliedBuilding, "locationKey">;

const TEXT: Record<Language, {
  title: string; loading: string; detected: string; nothing: string; error: string; type: string; width: string; depth: string; storeys: string; storeyHeight: string;
  roof: string; pitch: string; front: string; detect: string; detectBody: string; manual: string; apply: string; applied: string; reset: string; useOutline: string; edit: string; done: string; storeysShort: (n: number) => string; facing: string; street: string; earth: string; height: string; attached: (n: number) => string; planes: (n: number) => string; composite: (w: string, d: string) => string; potential: string; chimney: string; ridge: string; ridges: Record<StudioRidge, string>; potentialValue: (panels: number, kwp: string, kwh: string) => string; potentialNote: string;
  roofs: Record<StudioRoofForm, string>; sources: Record<BuildingValueSource, string>; compass: string[];
}> = {
  en: {
    title: "Building from the map", loading: "Reading the building from Google and OpenStreetMap…", detected: "Detected from map data — check and adjust anything that looks wrong.", nothing: "No building data here. Choose the building type and enter its size.", error: "Map building data is unavailable right now. Choose the building type and enter its size.",
    type: "Building type", width: "Front width", depth: "Depth", storeys: "Storeys", storeyHeight: "Storey height", roof: "Roof", pitch: "Pitch", front: "Front faces", detect: "Confirm pin & read building", detectBody: "Press “Detect building outline” on the map: building type, size and roof fill in here automatically. You can also enter them by hand.", manual: "Enter manually", apply: "Apply to Design Studio", applied: "Design Studio uses these values", reset: "Reset to detected", edit: "Adjust values", done: "Done", storeysShort: (n) => `${n} storey${n === 1 ? "" : "s"}`, facing: "front faces", useOutline: "Use outline as site area", street: "Street View", earth: "3D view", height: "Height ≈", attached: (n) => (n >= 2 ? "Attached on both sides" : "Attached on one side"), planes: (n) => `Google Solar · ${n} roof planes`, composite: (w, d) => `Joined blocks (outline ${w} × ${d} m) — modelled as one block of the same footprint area`, ridge: "Ridge", ridges: { width: "Parallel to the front", depth: "Front to back" }, chimney: "Chimney stack on the roof", potential: "Google Solar — Traditional Monocrystalline PV Benchmark", potentialValue: (p, k, e) => `traditional panels: ${p} · ${k} kWp · ≈ ${e} kWh/yr (benchmark)`, potentialNote: "External benchmark for a traditional monocrystalline PV roof — not the Modernite design. Modernite tiles, area, kWp and generation come from Design Studio and the study.",
    roofs: { hip: "Hipped", gable: "Gable", flat: "Flat", mono: "Mono-pitch", custom: "Measured multi-plane" }, sources: { osm: "OpenStreetMap", "google-maps": "Google Maps", "google-solar": "Google Solar", "google-elevation": "Google elevation", estimated: "Estimated", catalog: "Studio default", user: "Edited" }, compass: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],
  },
  zh: {
    title: "地图识别的建筑", loading: "正在从谷歌和 OpenStreetMap 读取建筑信息…", detected: "以下参数由地图数据识别，如有不符可直接修改。", nothing: "该位置没有建筑数据，请选择房型并填写尺寸。", error: "暂时无法获取地图建筑数据，请选择房型并填写尺寸。",
    type: "房型", width: "正面宽度", depth: "进深", storeys: "层数", storeyHeight: "层高", roof: "屋顶", pitch: "坡度", front: "正面朝向", detect: "确认位置并识别建筑", detectBody: "在地图上点「识别建筑轮廓」，这里会自动填入房型、尺寸和屋顶；也可以手动填写。", manual: "手动填写", apply: "应用到设计工作室", applied: "设计工作室正在使用这些参数", reset: "恢复识别值", edit: "修改参数", done: "完成", storeysShort: (n) => `${n} 层`, facing: "正面朝", useOutline: "用轮廓作为场地面积", street: "街景", earth: "三维", height: "高度约", attached: (n) => (n >= 2 ? "两侧与邻栋相连" : "一侧与邻栋相连"), planes: (n) => `谷歌 Solar · ${n} 个屋面`, composite: (w, d) => `组合形体（外轮廓 ${w} × ${d} m），按等面积单体建模`, ridge: "屋脊方向", ridges: { width: "平行于正面", depth: "垂直于正面" }, chimney: "屋顶有烟囱", potential: "Google Solar — 传统单晶硅光伏基准", potentialValue: (p, k, e) => `传统组件 ${p} 块 · ${k} kWp · 年发电约 ${e} kWh（基准）`, potentialNote: "仅作传统单晶硅屋顶光伏的外部基准，并非 Modernite 设计；Modernite 光伏瓦数量、面积、kWp 和发电量由设计工作室与本研究计算。",
    roofs: { hip: "四坡顶", gable: "双坡顶", flat: "平屋顶", mono: "单坡顶", custom: "实测多坡屋面" }, sources: { osm: "OpenStreetMap", "google-maps": "谷歌地图", "google-solar": "谷歌 Solar", "google-elevation": "谷歌高程", estimated: "推算", catalog: "Studio 默认", user: "已修改" }, compass: ["北", "东北", "东", "东南", "南", "西南", "西", "西北"],
  },
  "zh-Hant": {
    title: "地圖識別的建築", loading: "正在從 Google 和 OpenStreetMap 讀取建築資訊…", detected: "以下參數由地圖資料識別，如有不符可直接修改。", nothing: "此位置沒有建築資料，請選擇房型並填寫尺寸。", error: "暫時無法取得地圖建築資料，請選擇房型並填寫尺寸。",
    type: "房型", width: "正面寬度", depth: "進深", storeys: "層數", storeyHeight: "層高", roof: "屋頂", pitch: "坡度", front: "正面朝向", detect: "確認位置並識別建築", detectBody: "在地圖上點「識別建築輪廓」，這裡會自動填入房型、尺寸和屋頂；也可以手動填寫。", manual: "手動填寫", apply: "套用到設計工作室", applied: "設計工作室正在使用這些參數", reset: "恢復識別值", edit: "修改參數", done: "完成", storeysShort: (n) => `${n} 層`, facing: "正面朝", useOutline: "以輪廓作為場地面積", street: "街景", earth: "三維", height: "高度約", attached: (n) => (n >= 2 ? "兩側與鄰棟相連" : "一側與鄰棟相連"), planes: (n) => `Google Solar · ${n} 個屋面`, composite: (w, d) => `組合形體（外輪廓 ${w} × ${d} m），按等面積單體建模`, ridge: "屋脊方向", ridges: { width: "平行於正面", depth: "垂直於正面" }, chimney: "屋頂有煙囪", potential: "Google Solar — 傳統單晶矽光電基準", potentialValue: (p, k, e) => `傳統模組 ${p} 片 · ${k} kWp · 年發電約 ${e} kWh（基準）`, potentialNote: "僅作傳統單晶矽屋頂光電的外部基準，並非 Modernite 設計；Modernite 光電瓦數量、面積、kWp 與發電量由設計工作室與本研究計算。",
    roofs: { hip: "四坡頂", gable: "雙坡頂", flat: "平屋頂", mono: "單坡頂", custom: "實測多坡屋面" }, sources: { osm: "OpenStreetMap", "google-maps": "Google 地圖", "google-solar": "Google Solar", "google-elevation": "Google 高程", estimated: "推算", catalog: "Studio 預設", user: "已修改" }, compass: ["北", "東北", "東", "東南", "南", "西南", "西", "西北"],
  },
  fr: {
    title: "Bâtiment d’après la carte", loading: "Lecture du bâtiment depuis Google et OpenStreetMap…", detected: "Valeurs détectées à partir des données cartographiques — vérifiez et corrigez si besoin.", nothing: "Aucune donnée de bâtiment ici. Choisissez le type de bâtiment et saisissez ses dimensions.", error: "Données de bâtiment indisponibles pour le moment. Choisissez le type et saisissez les dimensions.",
    type: "Type de bâtiment", width: "Largeur de façade", depth: "Profondeur", storeys: "Niveaux", storeyHeight: "Hauteur d’étage", roof: "Toiture", pitch: "Pente", front: "Façade orientée", detect: "Confirmer et lire le bâtiment", detectBody: "Cliquez sur « Détecter le contour » sur la carte : type, dimensions et toiture se remplissent ici automatiquement. Vous pouvez aussi les saisir à la main.", manual: "Saisir manuellement", apply: "Appliquer au Studio de conception", applied: "Le Studio utilise ces valeurs", reset: "Revenir aux valeurs détectées", edit: "Ajuster les valeurs", done: "Terminé", storeysShort: (n) => `${n} niveau${n === 1 ? "" : "x"}`, facing: "façade", useOutline: "Utiliser le contour comme surface du site", street: "Street View", earth: "Vue 3D", height: "Hauteur ≈", attached: (n) => (n >= 2 ? "Mitoyen des deux côtés" : "Mitoyen d’un côté"), planes: (n) => `Google Solar · ${n} pans de toiture`, composite: (w, d) => `Volumes assemblés (contour ${w} × ${d} m) — modélisé en un volume de même emprise`, ridge: "Faîtage", ridges: { width: "Parallèle à la façade", depth: "Perpendiculaire à la façade" }, chimney: "Souche de cheminée sur le toit", potential: "Google Solar — référence PV monocristallin traditionnel", potentialValue: (p, k, e) => `panneaux traditionnels : ${p} · ${k} kWc · ≈ ${e} kWh/an (référence)`, potentialNote: "Référence externe pour une toiture PV monocristalline traditionnelle — pas la conception Modernite. Tuiles, surface, kWc et production Modernite proviennent du Studio et de l’étude.",
    roofs: { hip: "Quatre pans", gable: "Deux pans", flat: "Toit plat", mono: "Monopente", custom: "Multi-pans mesurée" }, sources: { osm: "OpenStreetMap", "google-maps": "Google Maps", "google-solar": "Google Solar", "google-elevation": "Altitude Google", estimated: "Estimé", catalog: "Valeur du Studio", user: "Modifié" }, compass: ["N", "NE", "E", "SE", "S", "SO", "O", "NO"],
  },
  ja: {
    title: "地図から読み取った建物", loading: "Google と OpenStreetMap から建物情報を取得しています…", detected: "地図データから推定した値です。違う場合は修正してください。", nothing: "この場所の建物データがありません。建物タイプを選び、寸法を入力してください。", error: "建物データを取得できません。建物タイプを選び、寸法を入力してください。",
    type: "建物タイプ", width: "間口", depth: "奥行", storeys: "階数", storeyHeight: "階高", roof: "屋根", pitch: "勾配", front: "正面の向き", detect: "位置を確定して建物を読み取る", detectBody: "地図の「建物の輪郭を検出」を押すと、建物タイプ・寸法・屋根がここに自動入力されます。手動で入力することもできます。", manual: "手動で入力", apply: "デザインスタジオに反映", applied: "デザインスタジオはこの値を使用中", reset: "推定値に戻す", edit: "値を調整", done: "完了", storeysShort: (n) => `${n} 階建て`, facing: "正面", useOutline: "輪郭を敷地面積に使う", street: "ストリートビュー", earth: "3D 表示", height: "高さ約", attached: (n) => (n >= 2 ? "両側で隣家と接続" : "片側で隣家と接続"), planes: (n) => `Google Solar · 屋根面 ${n} 面`, composite: (w, d) => `複合形状（外形 ${w} × ${d} m）— 同じ建築面積の単一ボリュームで作成`, ridge: "棟の向き", ridges: { width: "正面と平行", depth: "正面と直交" }, chimney: "屋根に煙突あり", potential: "Google Solar — 従来型単結晶シリコン PV ベンチマーク", potentialValue: (p, k, e) => `従来型パネル ${p} 枚 · ${k} kWp · 年間約 ${e} kWh（ベンチマーク）`, potentialNote: "従来型単結晶シリコン屋根 PV の外部ベンチマークで、Modernite の設計ではありません。Modernite の瓦枚数・面積・kWp・発電量はデザインスタジオと本試算で計算します。",
    roofs: { hip: "寄棟", gable: "切妻", flat: "陸屋根", mono: "片流れ", custom: "実測の複数面屋根" }, sources: { osm: "OpenStreetMap", "google-maps": "Google マップ", "google-solar": "Google Solar", "google-elevation": "Google 標高", estimated: "推定", catalog: "スタジオ既定値", user: "編集済み" }, compass: ["北", "北東", "東", "南東", "南", "南西", "西", "北西"],
  },
  es: {
    title: "Edificio según el mapa", loading: "Leyendo el edificio desde Google y OpenStreetMap…", detected: "Valores detectados con datos cartográficos: revísalos y corrige lo que no encaje.", nothing: "No hay datos del edificio aquí. Elige el tipo de edificio e introduce sus medidas.", error: "Los datos del edificio no están disponibles ahora. Elige el tipo e introduce las medidas.",
    type: "Tipo de edificio", width: "Ancho de fachada", depth: "Fondo", storeys: "Plantas", storeyHeight: "Altura de planta", roof: "Cubierta", pitch: "Pendiente", front: "Fachada orientada", detect: "Confirmar y leer el edificio", detectBody: "Pulsa «Detectar contorno» en el mapa: el tipo, las medidas y la cubierta se rellenan aquí automáticamente. También puedes introducirlos a mano.", manual: "Introducir a mano", apply: "Aplicar al Estudio de diseño", applied: "El Estudio usa estos valores", reset: "Volver a lo detectado", edit: "Ajustar valores", done: "Listo", storeysShort: (n) => `${n} planta${n === 1 ? "" : "s"}`, facing: "fachada", useOutline: "Usar el contorno como superficie del sitio", street: "Street View", earth: "Vista 3D", height: "Altura ≈", attached: (n) => (n >= 2 ? "Adosado por ambos lados" : "Adosado por un lado"), planes: (n) => `Google Solar · ${n} faldones`, composite: (w, d) => `Volúmenes unidos (contorno ${w} × ${d} m): se modela un volumen con la misma huella`, ridge: "Cumbrera", ridges: { width: "Paralela a la fachada", depth: "Perpendicular a la fachada" }, chimney: "Chimenea en la cubierta", potential: "Google Solar — referencia FV monocristalina tradicional", potentialValue: (p, k, e) => `paneles tradicionales: ${p} · ${k} kWp · ≈ ${e} kWh/año (referencia)`, potentialNote: "Referencia externa de una cubierta FV monocristalina tradicional, no el diseño Modernite. Tejas, superficie, kWp y producción Modernite proceden del Estudio y del estudio.",
    roofs: { hip: "A cuatro aguas", gable: "A dos aguas", flat: "Plana", mono: "A un agua", custom: "Multifaldón medido" }, sources: { osm: "OpenStreetMap", "google-maps": "Google Maps", "google-solar": "Google Solar", "google-elevation": "Elevación de Google", estimated: "Estimado", catalog: "Valor del Estudio", user: "Editado" }, compass: ["N", "NE", "E", "SE", "S", "SO", "O", "NO"],
  },
  it: {
    title: "Edificio dalla mappa", loading: "Lettura dell’edificio da Google e OpenStreetMap…", detected: "Valori rilevati dai dati cartografici: controllali e correggi ciò che non torna.", nothing: "Nessun dato sull’edificio qui. Scegli il tipo di edificio e inserisci le misure.", error: "Dati dell’edificio non disponibili al momento. Scegli il tipo e inserisci le misure.",
    type: "Tipo di edificio", width: "Larghezza facciata", depth: "Profondità", storeys: "Piani", storeyHeight: "Altezza interpiano", roof: "Copertura", pitch: "Pendenza", front: "Facciata rivolta a", detect: "Conferma e leggi l’edificio", detectBody: "Premi «Rileva contorno» sulla mappa: tipo, misure e copertura si compilano qui automaticamente. Puoi anche inserirli a mano.", manual: "Inserisci a mano", apply: "Applica allo Studio di progettazione", applied: "Lo Studio usa questi valori", reset: "Ripristina valori rilevati", edit: "Modifica valori", done: "Fatto", storeysShort: (n) => `${n} pian${n === 1 ? "o" : "i"}`, facing: "facciata", useOutline: "Usa il contorno come area del sito", street: "Street View", earth: "Vista 3D", height: "Altezza ≈", attached: (n) => (n >= 2 ? "In aderenza su due lati" : "In aderenza su un lato"), planes: (n) => `Google Solar · ${n} falde`, composite: (w, d) => `Volumi accostati (contorno ${w} × ${d} m): modellato come un volume di pari impronta`, ridge: "Colmo", ridges: { width: "Parallelo alla facciata", depth: "Perpendicolare alla facciata" }, chimney: "Comignolo sul tetto", potential: "Google Solar — riferimento FV monocristallino tradizionale", potentialValue: (p, k, e) => `pannelli tradizionali: ${p} · ${k} kWp · ≈ ${e} kWh/anno (riferimento)`, potentialNote: "Riferimento esterno per un tetto FV monocristallino tradizionale, non il progetto Modernite. Tegole, superficie, kWp e produzione Modernite derivano dallo Studio e dallo studio.",
    roofs: { hip: "A padiglione", gable: "A capanna", flat: "Piana", mono: "A falda unica", custom: "Multifalda rilevata" }, sources: { osm: "OpenStreetMap", "google-maps": "Google Maps", "google-solar": "Google Solar", "google-elevation": "Quota Google", estimated: "Stimato", catalog: "Valore dello Studio", user: "Modificato" }, compass: ["N", "NE", "E", "SE", "S", "SO", "O", "NO"],
  },
};

export const buildingTypeLabel = studioTypeLabel;

function draftFromProfile(profile: BuildingProfile): Draft {
  return {
    typeId: profile.buildingTypeId.value,
    widthM: profile.widthM.value,
    depthM: profile.depthM.value,
    floors: profile.floors.value,
    storeyHeightM: profile.storeyHeightM.value,
    roofForm: profile.roofForm.value,
    roofPitchDeg: profile.roofPitchDeg.value,
    roofPlanes: profile.roofPlanes,
    ridge: profile.ridge?.value,
    chimney: true,
    frontAzimuthDeg: profile.frontAzimuthDeg.value,
    sources: {
      typeId: profile.buildingTypeId.source,
      widthM: profile.widthM.source,
      depthM: profile.depthM.source,
      floors: profile.floors.source,
      storeyHeightM: profile.storeyHeightM.source,
      roofForm: profile.roofForm.source,
      roofPitchDeg: profile.roofPitchDeg.source,
      ridge: profile.ridge?.source ?? "catalog",
      frontAzimuthDeg: profile.frontAzimuthDeg.source,
    },
  };
}

export function BuildingProfileCard({ language, coordinates, marketKey, applied, requested, onApply, onOpenViewer }: {
  language: Language;
  coordinates: LatLng;
  marketKey: "GB" | "EU" | "CA" | "JP";
  applied: AppliedBuilding | null | undefined;
  /** Detection is triggered from the map's site-outline card; the query is shared through the tRPC cache. */
  requested: boolean;
  onApply: (building: AppliedBuilding | null) => void;
  onOpenViewer: (mode: "street" | "earth") => void;
}) {
  const t = TEXT[language] ?? TEXT.en;
  const region = MARKET_TO_STUDIO_REGION[marketKey] ?? "UK";
  const locationKey = `${coordinates.lat.toFixed(5)}:${coordinates.lng.toFixed(5)}:${region}`;
  const profileInput = { ...coordinates, market: marketKey };
  const query = trpc.site.buildingProfile.useQuery(profileInput, { enabled: requested, staleTime: Infinity, retry: 1 });
  const profile = query.data;
  const loading = requested && query.isFetching && !profile;
  const types = useMemo(() => studioTypesForRegion(region), [region]);
  const fallbackDraft = useMemo(() => draftFromProfile({
    region,
    detected: false,
    buildingTypeId: { value: types[0].id, source: "catalog" },
    widthM: { value: types[0].width, source: "catalog" },
    depthM: { value: types[0].depth, source: "catalog" },
    floors: { value: types[0].floors, source: "catalog" },
    storeyHeightM: { value: types[0].storeyHeight, source: "catalog" },
    roofForm: { value: types[0].roofForm, source: "catalog" },
    roofPitchDeg: { value: types[0].pitch, source: "catalog" },
    ridge: { value: types[0].ridge ?? "width", source: "catalog" },
    frontAzimuthDeg: { value: 180, source: "catalog" },
    roofSegments: [],
    sources: { osm: "not-found", googleSolar: "disabled", elevation: "disabled" },
  }), [region, types]);
  const current = applied?.locationKey === locationKey ? applied : null;
  const [draft, setDraft] = useState<Draft>(() => current ?? fallbackDraft);
  const autoApplied = useRef(Boolean(current));
  const [manual, setManual] = useState(Boolean(current));
  const [editing, setEditing] = useState(false);
  const showSummary = requested && !loading && Boolean(profile?.detected) && !editing;
  const showForm = requested ? !loading && !showSummary : manual;

  useEffect(() => {
    if (!profile || current) return;
    const detected = draftFromProfile(profile);
    setDraft(detected);
    if (profile.detected && !autoApplied.current) {
      autoApplied.current = true;
      onApply({ ...detected, locationKey });
    }
  }, [profile]);

  const isApplied = Boolean(current);
  const update = (next: Draft) => {
    setDraft(next);
    if (isApplied) onApply({ ...next, locationKey });
  };
  const setField = <K extends FieldKey>(key: K, value: Draft[K]) => update({ ...draft, [key]: value, sources: { ...draft.sources, [key]: "user" } });
  const setNumber = (key: "widthM" | "depthM" | "floors" | "storeyHeightM" | "roofPitchDeg" | "frontAzimuthDeg", raw: string) => {
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    setField(key, key === "floors" ? Math.round(value) : key === "frontAzimuthDeg" ? ((Math.round(value) % 360) + 360) % 360 : value);
  };
  const changeType = (typeId: string) => {
    const type = studioTypeById(typeId);
    if (!type) return;
    const keep = (key: FieldKey) => (draft.sources[key] ?? "catalog") !== "catalog";
    const roofForm = keep("roofForm") && roofFormsFor(type, Boolean(draft.roofPlanes?.length)).includes(draft.roofForm) ? draft.roofForm : type.roofForm;
    update({
      ...draft,
      typeId,
      widthM: keep("widthM") ? draft.widthM : type.width,
      depthM: keep("depthM") ? draft.depthM : type.depth,
      floors: keep("floors") ? draft.floors : type.floors,
      storeyHeightM: keep("storeyHeightM") ? draft.storeyHeightM : type.storeyHeight,
      roofForm,
      roofPitchDeg: keep("roofPitchDeg") ? draft.roofPitchDeg : type.pitch,
      ridge: keep("ridge") ? draft.ridge : type.ridge ?? "width",
      sources: { ...draft.sources, typeId: "user", ...(roofForm === draft.roofForm ? {} : { roofForm: "catalog" as const }) },
    });
  };
  const toggleApply = () => onApply(isApplied ? null : { ...draft, locationKey });
  const reset = () => update(profile ? draftFromProfile(profile) : fallbackDraft);

  const type = studioTypeById(draft.typeId) ?? types[0];
  const badge = (key: FieldKey) => { const source = draft.sources[key] ?? "catalog"; return <em className={`building-source is-${source}`}>{t.sources[source]}</em>; };
  const ridge = draft.ridge ?? type.ridge ?? "width";
  const ridgeAllowed = draft.roofForm === "gable" && ridgeChoiceFor(type);
  const chimneyAllowed = type.region === "UK" && type.kind !== "bungalow" && draft.roofForm !== "flat";
  const compass = t.compass[Math.round(draft.frontAzimuthDeg / 45) % 8];

  return (
    <section className="building-match building-profile" aria-live="polite">
      <header>
        <Building2 size={16} />
        <strong>{t.title}</strong>
        <span className="building-match-views">
          <button type="button" onClick={() => onOpenViewer("street")}><Footprints size={13} /> {t.street}</button>
          <button type="button" onClick={() => onOpenViewer("earth")}><Box size={13} /> {t.earth}</button>
        </span>
      </header>
      {!requested && <div className="building-detect">
        <p className="building-match-note">{t.detectBody}</p>
        <div className="building-match-actions">
          {!manual && <button type="button" className="thin" onClick={() => setManual(true)}><Pencil size={12} /> {t.manual}</button>}
        </div>
      </div>}
      {loading && <p className="building-match-note"><Loader2 size={13} className="spin" /> {t.loading}</p>}
      {requested && !loading && <p className="building-match-note">{query.isError ? t.error : profile?.detected ? t.detected : t.nothing}</p>}
      {profile?.detected && (profile.heightM || profile.attachedSides || profile.composite) ? (
        <p className="building-profile-facts">
          {profile.heightM && <span>{t.height} {profile.heightM.value} m</span>}
          {profile.attachedSides ? <span>{t.attached(profile.attachedSides)}</span> : null}
          {profile.roofSegments.length > 0 && <span>{t.planes(profile.roofSegments.length)}</span>}
          {profile.composite && <span>{t.composite(String(profile.composite.outlineWidthM), String(profile.composite.outlineDepthM))}</span>}
        </p>
      ) : null}
      {profile?.solarPotential && (
        <div className="building-solar-potential" title={t.potentialNote}>
          <Sun size={14} />
          <p><small>{t.potential}</small><b>{t.potentialValue(profile.solarPotential.panels, (profile.solarPotential.capacityKwp ?? 0).toFixed(1), profile.solarPotential.yearlyDcKwh ? new Intl.NumberFormat(language).format(profile.solarPotential.yearlyDcKwh) : "—")}</b><span>{t.potentialNote}</span></p>
        </div>
      )}
      {showSummary && (
        <div className="building-profile-summary">
          <p><b>{draft.typeId} · {buildingTypeLabel(draft.typeId, language)}</b><span>{draft.widthM} × {draft.depthM} m · {t.storeysShort(draft.floors)} · {t.roofs[draft.roofForm]}{draft.roofForm === "flat" ? "" : draft.roofForm === "custom" ? ` · ${draft.roofPlanes?.length ?? 0}` : ` ${draft.roofPitchDeg}°`}{ridgeAllowed && ridge === "depth" ? ` · ${t.ridges.depth}` : ""}{chimneyAllowed && draft.chimney !== false ? ` · ${t.chimney}` : ""} · {t.facing} {compass}</span></p>
          <div className="building-match-actions">
            {isApplied && <span className="building-profile-applied"><Check size={13} /> {t.applied}</span>}
            <button type="button" className="thin" onClick={() => setEditing(true)}><Pencil size={12} /> {t.edit}</button>
          </div>
        </div>
      )}
      {showForm && (
        <div className="building-profile-grid">
          <label className="is-wide"><span>{t.type} {badge("typeId")}</span>
            <select value={draft.typeId} onChange={(event) => changeType(event.target.value)}>
              {types.map((item) => <option key={item.id} value={item.id}>{item.id} · {buildingTypeLabel(item.id, language)}</option>)}
            </select>
          </label>
          <label><span>{t.width} {badge("widthM")}</span><input type="number" min={4} max={150} step={0.1} value={draft.widthM} onChange={(event) => setNumber("widthM", event.target.value)} /><i>m</i></label>
          <label><span>{t.depth} {badge("depthM")}</span><input type="number" min={4} max={100} step={0.1} value={draft.depthM} onChange={(event) => setNumber("depthM", event.target.value)} /><i>m</i></label>
          <label><span>{t.storeys} {badge("floors")}</span><input type="number" min={1} max={60} step={1} value={draft.floors} onChange={(event) => setNumber("floors", event.target.value)} /></label>
          <label><span>{t.storeyHeight} {badge("storeyHeightM")}</span><input type="number" min={2.5} max={5} step={0.05} value={draft.storeyHeightM} onChange={(event) => setNumber("storeyHeightM", event.target.value)} /><i>m</i></label>
          <label><span>{t.roof} {badge("roofForm")}</span>
            <select value={draft.roofForm} onChange={(event) => setField("roofForm", event.target.value as StudioRoofForm)}>
              {roofFormsFor(type, Boolean(draft.roofPlanes?.length)).map((form) => <option key={form} value={form}>{t.roofs[form]}</option>)}
            </select>
          </label>
          <label><span>{t.pitch} {badge("roofPitchDeg")}</span><input type="number" min={5} max={55} step={1} value={draft.roofPitchDeg} disabled={draft.roofForm === "flat" || draft.roofForm === "custom"} onChange={(event) => setNumber("roofPitchDeg", event.target.value)} /><i>°</i></label>
          {ridgeAllowed && <label className="is-wide"><span>{t.ridge} {badge("ridge")}</span>
            <select value={ridge} onChange={(event) => setField("ridge", event.target.value as StudioRidge)}>
              {(["width", "depth"] as const).map((value) => <option key={value} value={value}>{t.ridges[value]}</option>)}
            </select>
          </label>}
          <label className="is-wide"><span>{t.front} {badge("frontAzimuthDeg")}</span><input type="number" min={0} max={359} step={1} value={draft.frontAzimuthDeg} onChange={(event) => setNumber("frontAzimuthDeg", event.target.value)} /><i>° {compass}{profile?.roadName ? ` · ${profile.roadName}` : ""}</i></label>
          {chimneyAllowed && <label className="is-wide is-check"><input type="checkbox" checked={draft.chimney !== false} onChange={(event) => update({ ...draft, chimney: event.target.checked })} /> {t.chimney}</label>}
        </div>
      )}
      {showForm && (
        <div className="building-match-actions">
          <label className={isApplied ? "is-on" : ""}>
            <input type="checkbox" checked={isApplied} onChange={toggleApply} />
            {isApplied ? <><Check size={13} /> {t.applied}</> : t.apply}
          </label>
          {profile?.detected && <button type="button" className="thin" onClick={reset}><RotateCcw size={12} /> {t.reset}</button>}
          {editing && <button type="button" className="thin" onClick={() => setEditing(false)}><Check size={12} /> {t.done}</button>}
        </div>
      )}
    </section>
  );
}
