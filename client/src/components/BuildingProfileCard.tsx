import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Building2, Check, Footprints, Loader2, RotateCcw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { BuildingProfile, ProfileSource } from "../../../lib/building-profile";
import { MARKET_TO_STUDIO_REGION, roofFormsFor, studioTypeById, studioTypesForRegion, type StudioRoofForm } from "../../../lib/studio-catalog";

type LatLng = { lat: number; lng: number };
type Language = "en" | "zh" | "zh-Hant" | "fr" | "ja" | "es" | "it";
type FieldKey = "typeId" | "widthM" | "depthM" | "floors" | "storeyHeightM" | "roofForm" | "roofPitchDeg" | "frontAzimuthDeg";
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
  frontAzimuthDeg: number;
  sources: Record<FieldKey, BuildingValueSource>;
};

type Draft = Omit<AppliedBuilding, "locationKey">;

const TEXT: Record<Language, {
  title: string; loading: string; detected: string; nothing: string; error: string; type: string; width: string; depth: string; storeys: string; storeyHeight: string;
  roof: string; pitch: string; front: string; apply: string; applied: string; reset: string; useOutline: string; street: string; earth: string; height: string; attached: (n: number) => string; planes: (n: number) => string;
  roofs: Record<StudioRoofForm, string>; sources: Record<BuildingValueSource, string>; compass: string[];
}> = {
  en: {
    title: "Building from the map", loading: "Reading the building from Google and OpenStreetMap…", detected: "Detected from map data — check and adjust anything that looks wrong.", nothing: "No building data here. Choose the building type and enter its size.", error: "Map building data is unavailable right now. Choose the building type and enter its size.",
    type: "Building type", width: "Front width", depth: "Depth", storeys: "Storeys", storeyHeight: "Storey height", roof: "Roof", pitch: "Pitch", front: "Front faces", apply: "Apply to Design Studio", applied: "Design Studio uses these values", reset: "Reset to detected", useOutline: "Use outline as site area", street: "Street View", earth: "3D view", height: "Height ≈", attached: (n) => (n >= 2 ? "Attached on both sides" : "Attached on one side"), planes: (n) => `Google Solar · ${n} roof planes`,
    roofs: { hip: "Hipped", gable: "Gable", flat: "Flat", mono: "Mono-pitch" }, sources: { osm: "OpenStreetMap", "google-solar": "Google Solar", "google-elevation": "Google elevation", estimated: "Estimated", catalog: "Studio default", user: "Edited" }, compass: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],
  },
  zh: {
    title: "地图识别的建筑", loading: "正在从谷歌和 OpenStreetMap 读取建筑信息…", detected: "以下参数由地图数据识别，如有不符可直接修改。", nothing: "该位置没有建筑数据，请选择房型并填写尺寸。", error: "暂时无法获取地图建筑数据，请选择房型并填写尺寸。",
    type: "房型", width: "正面宽度", depth: "进深", storeys: "层数", storeyHeight: "层高", roof: "屋顶", pitch: "坡度", front: "正面朝向", apply: "应用到设计工作室", applied: "设计工作室正在使用这些参数", reset: "恢复识别值", useOutline: "用轮廓作为场地面积", street: "街景", earth: "三维", height: "高度约", attached: (n) => (n >= 2 ? "两侧与邻栋相连" : "一侧与邻栋相连"), planes: (n) => `谷歌 Solar · ${n} 个屋面`,
    roofs: { hip: "四坡顶", gable: "双坡顶", flat: "平屋顶", mono: "单坡顶" }, sources: { osm: "OpenStreetMap", "google-solar": "谷歌 Solar", "google-elevation": "谷歌高程", estimated: "推算", catalog: "Studio 默认", user: "已修改" }, compass: ["北", "东北", "东", "东南", "南", "西南", "西", "西北"],
  },
  "zh-Hant": {
    title: "地圖識別的建築", loading: "正在從 Google 和 OpenStreetMap 讀取建築資訊…", detected: "以下參數由地圖資料識別，如有不符可直接修改。", nothing: "此位置沒有建築資料，請選擇房型並填寫尺寸。", error: "暫時無法取得地圖建築資料，請選擇房型並填寫尺寸。",
    type: "房型", width: "正面寬度", depth: "進深", storeys: "層數", storeyHeight: "層高", roof: "屋頂", pitch: "坡度", front: "正面朝向", apply: "套用到設計工作室", applied: "設計工作室正在使用這些參數", reset: "恢復識別值", useOutline: "以輪廓作為場地面積", street: "街景", earth: "三維", height: "高度約", attached: (n) => (n >= 2 ? "兩側與鄰棟相連" : "一側與鄰棟相連"), planes: (n) => `Google Solar · ${n} 個屋面`,
    roofs: { hip: "四坡頂", gable: "雙坡頂", flat: "平屋頂", mono: "單坡頂" }, sources: { osm: "OpenStreetMap", "google-solar": "Google Solar", "google-elevation": "Google 高程", estimated: "推算", catalog: "Studio 預設", user: "已修改" }, compass: ["北", "東北", "東", "東南", "南", "西南", "西", "西北"],
  },
  fr: {
    title: "Bâtiment d’après la carte", loading: "Lecture du bâtiment depuis Google et OpenStreetMap…", detected: "Valeurs détectées à partir des données cartographiques — vérifiez et corrigez si besoin.", nothing: "Aucune donnée de bâtiment ici. Choisissez le type de bâtiment et saisissez ses dimensions.", error: "Données de bâtiment indisponibles pour le moment. Choisissez le type et saisissez les dimensions.",
    type: "Type de bâtiment", width: "Largeur de façade", depth: "Profondeur", storeys: "Niveaux", storeyHeight: "Hauteur d’étage", roof: "Toiture", pitch: "Pente", front: "Façade orientée", apply: "Appliquer au Studio de conception", applied: "Le Studio utilise ces valeurs", reset: "Revenir aux valeurs détectées", useOutline: "Utiliser le contour comme surface du site", street: "Street View", earth: "Vue 3D", height: "Hauteur ≈", attached: (n) => (n >= 2 ? "Mitoyen des deux côtés" : "Mitoyen d’un côté"), planes: (n) => `Google Solar · ${n} pans de toiture`,
    roofs: { hip: "Quatre pans", gable: "Deux pans", flat: "Toit plat", mono: "Monopente" }, sources: { osm: "OpenStreetMap", "google-solar": "Google Solar", "google-elevation": "Altitude Google", estimated: "Estimé", catalog: "Valeur du Studio", user: "Modifié" }, compass: ["N", "NE", "E", "SE", "S", "SO", "O", "NO"],
  },
  ja: {
    title: "地図から読み取った建物", loading: "Google と OpenStreetMap から建物情報を取得しています…", detected: "地図データから推定した値です。違う場合は修正してください。", nothing: "この場所の建物データがありません。建物タイプを選び、寸法を入力してください。", error: "建物データを取得できません。建物タイプを選び、寸法を入力してください。",
    type: "建物タイプ", width: "間口", depth: "奥行", storeys: "階数", storeyHeight: "階高", roof: "屋根", pitch: "勾配", front: "正面の向き", apply: "デザインスタジオに反映", applied: "デザインスタジオはこの値を使用中", reset: "推定値に戻す", useOutline: "輪郭を敷地面積に使う", street: "ストリートビュー", earth: "3D 表示", height: "高さ約", attached: (n) => (n >= 2 ? "両側で隣家と接続" : "片側で隣家と接続"), planes: (n) => `Google Solar · 屋根面 ${n} 面`,
    roofs: { hip: "寄棟", gable: "切妻", flat: "陸屋根", mono: "片流れ" }, sources: { osm: "OpenStreetMap", "google-solar": "Google Solar", "google-elevation": "Google 標高", estimated: "推定", catalog: "スタジオ既定値", user: "編集済み" }, compass: ["北", "北東", "東", "南東", "南", "南西", "西", "北西"],
  },
  es: {
    title: "Edificio según el mapa", loading: "Leyendo el edificio desde Google y OpenStreetMap…", detected: "Valores detectados con datos cartográficos: revísalos y corrige lo que no encaje.", nothing: "No hay datos del edificio aquí. Elige el tipo de edificio e introduce sus medidas.", error: "Los datos del edificio no están disponibles ahora. Elige el tipo e introduce las medidas.",
    type: "Tipo de edificio", width: "Ancho de fachada", depth: "Fondo", storeys: "Plantas", storeyHeight: "Altura de planta", roof: "Cubierta", pitch: "Pendiente", front: "Fachada orientada", apply: "Aplicar al Estudio de diseño", applied: "El Estudio usa estos valores", reset: "Volver a lo detectado", useOutline: "Usar el contorno como superficie del sitio", street: "Street View", earth: "Vista 3D", height: "Altura ≈", attached: (n) => (n >= 2 ? "Adosado por ambos lados" : "Adosado por un lado"), planes: (n) => `Google Solar · ${n} faldones`,
    roofs: { hip: "A cuatro aguas", gable: "A dos aguas", flat: "Plana", mono: "A un agua" }, sources: { osm: "OpenStreetMap", "google-solar": "Google Solar", "google-elevation": "Elevación de Google", estimated: "Estimado", catalog: "Valor del Estudio", user: "Editado" }, compass: ["N", "NE", "E", "SE", "S", "SO", "O", "NO"],
  },
  it: {
    title: "Edificio dalla mappa", loading: "Lettura dell’edificio da Google e OpenStreetMap…", detected: "Valori rilevati dai dati cartografici: controllali e correggi ciò che non torna.", nothing: "Nessun dato sull’edificio qui. Scegli il tipo di edificio e inserisci le misure.", error: "Dati dell’edificio non disponibili al momento. Scegli il tipo e inserisci le misure.",
    type: "Tipo di edificio", width: "Larghezza facciata", depth: "Profondità", storeys: "Piani", storeyHeight: "Altezza interpiano", roof: "Copertura", pitch: "Pendenza", front: "Facciata rivolta a", apply: "Applica allo Studio di progettazione", applied: "Lo Studio usa questi valori", reset: "Ripristina valori rilevati", useOutline: "Usa il contorno come area del sito", street: "Street View", earth: "Vista 3D", height: "Altezza ≈", attached: (n) => (n >= 2 ? "In aderenza su due lati" : "In aderenza su un lato"), planes: (n) => `Google Solar · ${n} falde`,
    roofs: { hip: "A padiglione", gable: "A capanna", flat: "Piana", mono: "A falda unica" }, sources: { osm: "OpenStreetMap", "google-solar": "Google Solar", "google-elevation": "Quota Google", estimated: "Stimato", catalog: "Valore dello Studio", user: "Modificato" }, compass: ["N", "NE", "E", "SE", "S", "SO", "O", "NO"],
  },
};

export const buildingTypeLabel = (id: string, language: string) => {
  const type = studioTypeById(id);
  if (!type) return id;
  return language === "zh" || language === "zh-Hant" ? type.labelZh : type.labelEn;
};

function draftFromProfile(profile: BuildingProfile): Draft {
  return {
    typeId: profile.buildingTypeId.value,
    widthM: profile.widthM.value,
    depthM: profile.depthM.value,
    floors: profile.floors.value,
    storeyHeightM: profile.storeyHeightM.value,
    roofForm: profile.roofForm.value,
    roofPitchDeg: profile.roofPitchDeg.value,
    frontAzimuthDeg: profile.frontAzimuthDeg.value,
    sources: {
      typeId: profile.buildingTypeId.source,
      widthM: profile.widthM.source,
      depthM: profile.depthM.source,
      floors: profile.floors.source,
      storeyHeightM: profile.storeyHeightM.source,
      roofForm: profile.roofForm.source,
      roofPitchDeg: profile.roofPitchDeg.source,
      frontAzimuthDeg: profile.frontAzimuthDeg.source,
    },
  };
}

export function BuildingProfileCard({ language, coordinates, marketKey, applied, onApply, onUseOutline, onOpenViewer }: {
  language: Language;
  coordinates: LatLng;
  marketKey: "GB" | "EU" | "CA" | "JP";
  applied: AppliedBuilding | null | undefined;
  onApply: (building: AppliedBuilding | null) => void;
  onUseOutline: (path: LatLng[], areaM2: number) => void;
  onOpenViewer: (mode: "street" | "earth") => void;
}) {
  const t = TEXT[language] ?? TEXT.en;
  const region = MARKET_TO_STUDIO_REGION[marketKey] ?? "UK";
  const locationKey = `${coordinates.lat.toFixed(5)}:${coordinates.lng.toFixed(5)}:${region}`;
  const query = trpc.site.buildingProfile.useQuery({ ...coordinates, market: marketKey }, { staleTime: Infinity, retry: 1 });
  const profile = query.data;
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
    frontAzimuthDeg: { value: 180, source: "catalog" },
    roofSegments: [],
    sources: { osm: "not-found", googleSolar: "disabled", elevation: "disabled" },
  }), [region, types]);
  const current = applied?.locationKey === locationKey ? applied : null;
  const [draft, setDraft] = useState<Draft>(() => current ?? fallbackDraft);
  const autoApplied = useRef(Boolean(current));

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
    const keep = (key: FieldKey) => draft.sources[key] !== "catalog";
    const roofForm = keep("roofForm") && roofFormsFor(type).includes(draft.roofForm) ? draft.roofForm : type.roofForm;
    update({
      ...draft,
      typeId,
      widthM: keep("widthM") ? draft.widthM : type.width,
      depthM: keep("depthM") ? draft.depthM : type.depth,
      floors: keep("floors") ? draft.floors : type.floors,
      storeyHeightM: keep("storeyHeightM") ? draft.storeyHeightM : type.storeyHeight,
      roofForm,
      roofPitchDeg: keep("roofPitchDeg") ? draft.roofPitchDeg : type.pitch,
      sources: { ...draft.sources, typeId: "user", ...(roofForm === draft.roofForm ? {} : { roofForm: "catalog" as const }) },
    });
  };
  const toggleApply = () => onApply(isApplied ? null : { ...draft, locationKey });
  const reset = () => update(profile ? draftFromProfile(profile) : fallbackDraft);

  const type = studioTypeById(draft.typeId) ?? types[0];
  const badge = (key: FieldKey) => <em className={`building-source is-${draft.sources[key]}`}>{t.sources[draft.sources[key]]}</em>;
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
      {query.isLoading && <p className="building-match-note"><Loader2 size={13} className="spin" /> {t.loading}</p>}
      {!query.isLoading && <p className="building-match-note">{query.isError ? t.error : profile?.detected ? t.detected : t.nothing}</p>}
      {profile?.detected && (profile.heightM || profile.attachedSides) ? (
        <p className="building-profile-facts">
          {profile.heightM && <span>{t.height} {profile.heightM.value} m</span>}
          {profile.attachedSides ? <span>{t.attached(profile.attachedSides)}</span> : null}
          {profile.roofSegments.length > 0 && <span>{t.planes(profile.roofSegments.length)}</span>}
        </p>
      ) : null}
      {!query.isLoading && (
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
              {roofFormsFor(type).map((form) => <option key={form} value={form}>{t.roofs[form]}</option>)}
            </select>
          </label>
          <label><span>{t.pitch} {badge("roofPitchDeg")}</span><input type="number" min={5} max={55} step={1} value={draft.roofPitchDeg} disabled={draft.roofForm === "flat"} onChange={(event) => setNumber("roofPitchDeg", event.target.value)} /><i>°</i></label>
          <label className="is-wide"><span>{t.front} {badge("frontAzimuthDeg")}</span><input type="number" min={0} max={359} step={1} value={draft.frontAzimuthDeg} onChange={(event) => setNumber("frontAzimuthDeg", event.target.value)} /><i>° {compass}{profile?.roadName ? ` · ${profile.roadName}` : ""}</i></label>
        </div>
      )}
      {!query.isLoading && (
        <div className="building-match-actions">
          <label className={isApplied ? "is-on" : ""}>
            <input type="checkbox" checked={isApplied} onChange={toggleApply} />
            {isApplied ? <><Check size={13} /> {t.applied}</> : t.apply}
          </label>
          {profile?.detected && <button type="button" className="thin" onClick={reset}><RotateCcw size={12} /> {t.reset}</button>}
          {profile?.path && profile.footprintAreaM2 && <button type="button" className="thin" onClick={() => onUseOutline(profile.path!, profile.footprintAreaM2!)}>{t.useOutline}</button>}
        </div>
      )}
    </section>
  );
}
