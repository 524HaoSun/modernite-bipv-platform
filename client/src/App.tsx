import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BatteryCharging,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Compass,
  Database,
  Download,
  FileText,
  Globe2,
  Home,
  Leaf,
  Lightbulb,
  MapPinned,
  MessageCircle,
  MoveUpRight,
  Orbit,
  Pencil,
  LoaderCircle,
  Send,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { ProjectLocationMap, type Market, type MarketKey, type ProjectLocationSelection, type SiteAreaSelection } from "@/components/ProjectLocationMap";
import { EUROPEAN_MARKETS, MarketAtlas, type EuropeanMarket, type MarketAtlasCopy } from "@/components/MarketAtlas";
import { publicPath } from "@/lib/paths";
import { trpc } from "@/lib/trpc";
import type { ProjectCalculation } from "../../server/estimate-service";
import { createEmpiricalEstimate } from "../../lib/estimate-engine";
import { localClimateMethodNote, localEmpiricalClimateSeries } from "../../lib/local-climate";
import { buildPlanningInput, mapStudioSnapshotToSurfaces, regionForMarket, type HomeEnergySettings, type StudioCalculationSnapshot } from "../../lib/studio-calculation";
import type { FinancialScenario, LedgerEntry, SurfaceResult } from "../../types/solar";

const CUSTOMER_STUDIO_URL = publicPath("studio.html");
const HERO_IMAGE_URL = publicPath("assets/modernite-entry-hero-a_aa79dbb7.png");
const BUILDING_PREVIEW_URL = publicPath("assets/detached-house_f79b6b45.png");
const PROJECT_CONTEXT_STORAGE_KEY = "modernite-project-context-v1";
const STUDIO_LANGUAGE_STORAGE_KEY = "modernite-studio-language";
const SAVED_STUDY_STORAGE_KEY = "modernite-saved-study-v1";

type GatewayRoute = "entry" | "market" | "location" | "studio" | "energy" | "calculation" | "results";
type StudioLanguage = "en" | "zh" | "zh-Hant" | "fr" | "ja" | "es" | "it";

type GatewayCopy = MarketAtlasCopy & {
  project: string; market: string; location: string; workspace: string; back: string;
  marketStep: string; marketTitle: string; marketIntro: string;
  entryEyebrow: string; entryTitle: string; entryEmphasis: string; entryLede: string; start: string; resume: string;
  marketContext: string; siteLocation: string; buildingStudy: string;
  locationStep: string; locationTitle: string; addressSearch: string; locate: string; projectContext: string;
  locationEmpty: string; locationHelp: string; confirmMarket: string; setLocation: string; openStudio: string;
};

type ProjectContext = {
  version: 3;
  marketKey: MarketKey;
  europeanCountry: EuropeanMarket | null;
  location: ProjectLocationSelection | null;
  siteArea: SiteAreaSelection | null;
  energySettings: HomeEnergySettings;
  updatedAt: number;
};

type StudioWindow = Window & {
  ModerniteEnergyBridge?: { snapshot?: () => StudioCalculationSnapshot };
  ModerniteEnergyApp?: { setSite?: (site: Record<string, unknown>) => void };
  ModerniteLocationCore?: { timezone?: (lat: number, lng: number, year: number) => { zone?: string; tz?: number } };
};

const DEFAULT_ENERGY_SETTINGS: HomeEnergySettings = {
  demandMode: "bill",
  annualDemandKwh: 5400,
  householdSize: 3,
  daytimeOccupancy: "usually",
  electricHeating: false,
  heatPump: true,
  electricHotWater: false,
  evCharger: true,
  batteryMode: "solar-battery",
  batteryCapacityKwh: 7.5,
  projectPriceGbp: 16000,
  batteryPriceGbp: 5800,
};

const ROUTES: Record<GatewayRoute, string> = {
  entry: "/",
  market: "/market",
  location: "/location",
  studio: "/studio",
  energy: "/energy",
  calculation: "/calculation",
  results: "/results",
};
const APP_BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");

const markets: Market[] = [
  { key: "GB", name: "United Kingdom", shortName: "UK", coordinates: { lat: 51.5072, lng: -0.1276 }, zoom: 12 },
  { key: "EU", name: "Europe", shortName: "EU", coordinates: { lat: 50.7, lng: 10.2 }, zoom: 4.4 },
  { key: "CA", name: "Canada", shortName: "CA", coordinates: { lat: 45.4215, lng: -75.6972 }, zoom: 12 },
  { key: "JP", name: "Japan", shortName: "JP", coordinates: { lat: 35.6762, lng: 139.6503 }, zoom: 12 },
];

const STUDIO_REGION_BY_MARKET: Record<MarketKey, "UK" | "EU" | "CA" | "JP"> = {
  GB: "UK",
  EU: "EU",
  CA: "CA",
  JP: "JP",
};

const EUROPEAN_CAPITALS: Record<string, google.maps.LatLngLiteral> = {
  AD: { lat: 42.5063, lng: 1.5218 }, AT: { lat: 48.2082, lng: 16.3738 }, BA: { lat: 43.8563, lng: 18.4131 }, BE: { lat: 50.8503, lng: 4.3517 }, BG: { lat: 42.6977, lng: 23.3219 }, BY: { lat: 53.9006, lng: 27.559 }, CH: { lat: 46.948, lng: 7.4474 }, CY: { lat: 35.1856, lng: 33.3823 }, CZ: { lat: 50.0755, lng: 14.4378 }, DE: { lat: 52.52, lng: 13.405 }, DK: { lat: 55.6761, lng: 12.5683 }, EE: { lat: 59.437, lng: 24.7536 }, ES: { lat: 40.4168, lng: -3.7038 }, FI: { lat: 60.1699, lng: 24.9384 }, FR: { lat: 48.8566, lng: 2.3522 }, GR: { lat: 37.9838, lng: 23.7275 }, HR: { lat: 45.815, lng: 15.9819 }, HU: { lat: 47.4979, lng: 19.0402 }, IE: { lat: 53.3498, lng: -6.2603 }, IS: { lat: 64.1466, lng: -21.9426 }, IT: { lat: 41.9028, lng: 12.4964 }, LI: { lat: 47.141, lng: 9.5209 }, LT: { lat: 54.6872, lng: 25.2797 }, LU: { lat: 49.6116, lng: 6.1319 }, LV: { lat: 56.9496, lng: 24.1052 }, MC: { lat: 43.7384, lng: 7.4246 }, MD: { lat: 47.0105, lng: 28.8638 }, ME: { lat: 42.4304, lng: 19.2594 }, MK: { lat: 41.9981, lng: 21.4254 }, MT: { lat: 35.8989, lng: 14.5146 }, NL: { lat: 52.3676, lng: 4.9041 }, NO: { lat: 59.9139, lng: 10.7522 }, PL: { lat: 52.2297, lng: 21.0122 }, PT: { lat: 38.7223, lng: -9.1393 }, RO: { lat: 44.4268, lng: 26.1025 }, RS: { lat: 44.7866, lng: 20.4489 }, RU: { lat: 55.7558, lng: 37.6173 }, SE: { lat: 59.3293, lng: 18.0686 }, SI: { lat: 46.0569, lng: 14.5058 }, SK: { lat: 48.1486, lng: 17.1077 }, SM: { lat: 43.9424, lng: 12.4578 }, TR: { lat: 39.9334, lng: 32.8597 }, UA: { lat: 50.4501, lng: 30.5234 }, VA: { lat: 41.9029, lng: 12.4534 }, XK: { lat: 42.6629, lng: 21.1655 },
};

const STUDIO_LANGUAGES: Array<{ value: StudioLanguage; label: string }> = [
  { value: "en", label: "English" },
  { value: "zh", label: "简体中文" },
  { value: "zh-Hant", label: "繁體中文" },
  { value: "fr", label: "Français" },
  { value: "ja", label: "日本語" },
  { value: "es", label: "Español" },
  { value: "it", label: "Italiano" },
];
const DEFAULT_EUROPEAN_COUNTRY = EUROPEAN_MARKETS.find((country) => country.shortName === "FR") ?? EUROPEAN_MARKETS[0]!;
const DEFAULT_PROJECT_LOCATION: ProjectLocationSelection = {
  label: "30 St James's Street, London SW1A 1HF, United Kingdom",
  coordinates: { lat: 51.5079, lng: -0.1378 },
};
const DEFAULT_SITE_AREA: SiteAreaSelection = {
  areaM2: 91.8,
  path: [
    { lat: 51.50804, lng: -0.13804 },
    { lat: 51.50801, lng: -0.13764 },
    { lat: 51.50775, lng: -0.13758 },
    { lat: 51.50769, lng: -0.13798 },
    { lat: 51.50787, lng: -0.13814 },
  ],
};
const DEMO_STUDIO_SNAPSHOT: StudioCalculationSnapshot = {
  building: { id: "UK01", width: 10.8, depth: 8.5, floors: 2, storeyHeight: 2.95, usage: "residential" },
  surfaces: [
    { id: "roof_south", product: "roof_tiles", profile: "windsor_black", area: 42, tilt: 31, az: 180, enabled: true, role: "roof" },
    { id: "roof_east", product: "roof_tiles", profile: "windsor_black", area: 19, tilt: 31, az: 105, enabled: true, role: "roof" },
    { id: "facade_south", product: "facade", profile: "facade_grey", area: 12, tilt: 90, az: 180, enabled: true, role: "facade" },
    { id: "railing_west", product: "railing", profile: "railing", area: 6, tilt: 90, az: 270, enabled: true, role: "railing" },
  ],
};

const WORKFLOW_LABELS: Record<StudioLanguage, { project: string; market: string; location: string; studio: string; energy: string; calculation: string; results: string }> = {
  en: { project: "Project", market: "Market", location: "Site", studio: "Design Studio", energy: "Energy", calculation: "Calculation", results: "Results" },
  zh: { project: "项目", market: "市场", location: "场地", studio: "设计工作室", energy: "能耗", calculation: "计算", results: "结果" },
  "zh-Hant": { project: "專案", market: "市場", location: "場地", studio: "設計工作室", energy: "能耗", calculation: "計算", results: "結果" },
  fr: { project: "Projet", market: "Marché", location: "Site", studio: "Studio de conception", energy: "Énergie", calculation: "Calcul", results: "Résultats" },
  ja: { project: "プロジェクト", market: "市場", location: "敷地", studio: "デザインスタジオ", energy: "エネルギー", calculation: "計算", results: "結果" },
  es: { project: "Proyecto", market: "Mercado", location: "Sitio", studio: "Estudio de diseño", energy: "Energía", calculation: "Cálculo", results: "Resultados" },
  it: { project: "Progetto", market: "Mercato", location: "Sito", studio: "Studio di progettazione", energy: "Energia", calculation: "Calcolo", results: "Risultati" },
};

const STUDIO_BRIDGE_COPY: Record<StudioLanguage, { facets: string; returnToSite: string; prepareStudy: string; openingStudio: string; runtimeNotice: string; siteContext: string }> = {
  en: { facets: "Building · Products · Finishes · Environment", returnToSite: "Back to site", prepareStudy: "Continue to energy", openingStudio: "Opening Design Studio", runtimeNotice: "Loading the retained customer Studio workspace and applying your site context.", siteContext: "Site context" },
  zh: { facets: "建筑 · 产品 · 陈设 · 环境", returnToSite: "返回场地", prepareStudy: "继续至能耗", openingStudio: "正在打开设计工作室", runtimeNotice: "正在加载保留的客户 Studio 工作区并应用场地信息。", siteContext: "场地背景" },
  "zh-Hant": { facets: "建築 · 產品 · 陳設 · 環境", returnToSite: "返回場地", prepareStudy: "繼續至能耗", openingStudio: "正在開啟設計工作室", runtimeNotice: "正在載入保留的客戶 Studio 工作區並套用場地資訊。", siteContext: "場地背景" },
  fr: { facets: "Bâtiment · Produits · Aménagement · Environnement", returnToSite: "Retour au site", prepareStudy: "Continuer vers l’énergie", openingStudio: "Ouverture du Studio de conception", runtimeNotice: "Chargement de l’espace Studio client conservé et application du contexte du site.", siteContext: "Contexte du site" },
  ja: { facets: "建物 · 製品 · 内装 · 環境", returnToSite: "敷地に戻る", prepareStudy: "エネルギーへ進む", openingStudio: "デザインスタジオを開いています", runtimeNotice: "保持された顧客 Studio ワークスペースを読み込み、敷地コンテキストを適用しています。", siteContext: "敷地コンテキスト" },
  es: { facets: "Edificio · Productos · Acabados · Entorno", returnToSite: "Volver al sitio", prepareStudy: "Continuar a energía", openingStudio: "Abriendo el Estudio de diseño", runtimeNotice: "Cargando el espacio Studio del cliente conservado y aplicando el contexto del sitio.", siteContext: "Contexto del sitio" },
  it: { facets: "Edificio · Prodotti · Arredi · Ambiente", returnToSite: "Torna al sito", prepareStudy: "Continua all’energia", openingStudio: "Apertura dello Studio di progettazione", runtimeNotice: "Caricamento dell’area Studio cliente mantenuta e applicazione del contesto del sito.", siteContext: "Contesto del sito" },
};

const GATEWAY_COPY: Record<StudioLanguage, GatewayCopy> = {
  en: {
    project: "Project", market: "Market", location: "Location", workspace: "Project workspace", back: "Back", marketStep: "Market selection", marketTitle: "Choose the project context.", marketIntro: "Turn the globe to explore available markets. Europe opens to a country-level selection before you locate the property.", entryEyebrow: "Build a brighter tomorrow", entryTitle: "Start your building-integrated", entryEmphasis: "solar project.", entryLede: "Turn your vision into a sustainable building with integrated solar design.", start: "Start a new project", resume: "Resume project", marketContext: "Market context", siteLocation: "Site location", buildingStudy: "Building study", locationStep: "Site selection", locationTitle: "Place the project.", addressSearch: "Search an address or postcode in", locate: "Locate", projectContext: "Project context", locationEmpty: "Search an address or rotate to place a site on the map.", locationHelp: "The selected address and coordinates are handed directly to the customer Studio location controls. Returning here does not discard your active Studio session.", confirmMarket: "Confirm market", setLocation: "Set project location", openStudio: "Open Solar Studio", coverage: "Service coverage", dragHint: "Drag to rotate the globe", library: "Market library", selected: "Selected market", chooseMarket: "Choose an illuminated market on the globe or from the library.", chooseCountry: "Choose a country from the globe or the European library.", continue: "Continue to location", world: "World", europe: "Europe", europeDirectory: "European country library", filterCountries: "Filter countries", resetGlobe: "Reset globe view", available: "Available", selectedTag: "Selected", unavailable: "Unavailable", studyNote: "Building forms are scoped to this market. The customer product library remains unchanged.",
  },
  zh: {
    project: "项目", market: "市场", location: "位置", workspace: "项目工作区", back: "返回", marketStep: "步骤 01 · 市场", marketTitle: "选择项目区域。", marketIntro: "旋转地球探索可用市场；选择欧洲后，可在定位之前进一步选择具体国家。", entryEyebrow: "项目准备", entryTitle: "让建筑", entryEmphasis: "成为方案本身。", entryLede: "选择项目市场、定位场地，然后直接使用客户提供的建筑与产品库。", start: "开始项目", resume: "继续项目", marketContext: "市场背景", siteLocation: "场地位置", buildingStudy: "建筑研究", locationStep: "步骤 02 · 位置", locationTitle: "定位项目。", addressSearch: "在以下区域搜索地址或邮编：", locate: "定位", projectContext: "项目背景", locationEmpty: "搜索地址，或在地图上旋转并放置项目地点。", locationHelp: "所选地址和坐标会直接传递到客户 Studio 的位置控件。返回此处不会丢失当前 Studio 会话。", confirmMarket: "确认市场", setLocation: "设置项目位置", openStudio: "打开 Solar Studio", coverage: "服务范围", dragHint: "拖动以旋转地球", library: "市场目录", selected: "已选市场", chooseMarket: "在地球或目录中选择已点亮的市场。", chooseCountry: "在地球或欧洲目录中选择国家。", continue: "继续至位置", world: "世界", europe: "欧洲", europeDirectory: "欧洲国家目录", filterCountries: "筛选国家", resetGlobe: "重置地球视图", available: "可用", selectedTag: "已选", unavailable: "未开放", studyNote: "建筑形式将限定在所选市场；客户产品库保持不变。",
  },
  "zh-Hant": {
    project: "專案", market: "市場", location: "位置", workspace: "專案工作區", back: "返回", marketStep: "步驟 01 · 市場", marketTitle: "選擇專案區域。", marketIntro: "旋轉地球探索可用市場；選擇歐洲後，可在定位之前進一步選擇具體國家。", entryEyebrow: "專案準備", entryTitle: "讓建築", entryEmphasis: "成為方案本身。", entryLede: "選擇專案市場、定位場地，然後直接使用客戶提供的建築與產品庫。", start: "開始專案", resume: "繼續專案", marketContext: "市場背景", siteLocation: "場地位置", buildingStudy: "建築研究", locationStep: "步驟 02 · 位置", locationTitle: "定位專案。", addressSearch: "在以下區域搜尋地址或郵遞區號：", locate: "定位", projectContext: "專案背景", locationEmpty: "搜尋地址，或在地圖上旋轉並放置專案地點。", locationHelp: "所選地址和座標會直接傳遞到客戶 Studio 的位置控制項。返回此處不會遺失目前 Studio 工作階段。", confirmMarket: "確認市場", setLocation: "設定專案位置", openStudio: "開啟 Solar Studio", coverage: "服務範圍", dragHint: "拖曳以旋轉地球", library: "市場目錄", selected: "已選市場", chooseMarket: "在地球或目錄中選擇已點亮的市場。", chooseCountry: "在地球或歐洲目錄中選擇國家。", continue: "繼續至位置", world: "世界", europe: "歐洲", europeDirectory: "歐洲國家目錄", filterCountries: "篩選國家", resetGlobe: "重設地球視圖", available: "可用", selectedTag: "已選", unavailable: "未開放", studyNote: "建築形式將限定在所選市場；客戶產品庫保持不變。",
  },
  fr: {
    project: "Projet", market: "Marché", location: "Localisation", workspace: "Espace projet", back: "Retour", marketStep: "Étape 01 · Marché", marketTitle: "Choisissez le contexte du projet.", marketIntro: "Faites tourner le globe pour explorer les marchés disponibles. L'Europe ouvre une sélection par pays avant la localisation du bien.", entryEyebrow: "Préparation du projet", entryTitle: "Faites du bâtiment", entryEmphasis: "le point de départ.", entryLede: "Sélectionnez le marché, localisez le site, puis travaillez avec la bibliothèque de bâtiments et de produits fournie.", start: "Démarrer un projet", resume: "Reprendre le projet", marketContext: "Contexte du marché", siteLocation: "Localisation du site", buildingStudy: "Étude du bâtiment", locationStep: "Étape 02 · Localisation", locationTitle: "Placez le projet.", addressSearch: "Rechercher une adresse ou un code postal dans", locate: "Localiser", projectContext: "Contexte du projet", locationEmpty: "Recherchez une adresse ou placez un site directement sur la carte.", locationHelp: "L'adresse et les coordonnées sélectionnées sont transmises directement aux commandes de localisation du Studio client. Revenir ici ne supprime pas votre session Studio active.", confirmMarket: "Confirmer le marché", setLocation: "Définir la localisation", openStudio: "Ouvrir Solar Studio", coverage: "Couverture du service", dragHint: "Faites glisser pour tourner le globe", library: "Bibliothèque des marchés", selected: "Marché sélectionné", chooseMarket: "Choisissez un marché illuminé sur le globe ou dans la bibliothèque.", chooseCountry: "Choisissez un pays sur le globe ou dans la bibliothèque européenne.", continue: "Continuer vers la localisation", world: "Monde", europe: "Europe", europeDirectory: "Bibliothèque des pays européens", filterCountries: "Filtrer les pays", resetGlobe: "Réinitialiser le globe", available: "Disponible", selectedTag: "Sélectionné", unavailable: "Indisponible", studyNote: "Les formes de bâtiment sont limitées au marché sélectionné. La bibliothèque de produits client reste inchangée.",
  },
  ja: {
    project: "プロジェクト", market: "市場", location: "所在地", workspace: "プロジェクトワークスペース", back: "戻る", marketStep: "ステップ 01 · 市場", marketTitle: "プロジェクト地域を選択。", marketIntro: "地球を回して利用可能な市場を探索します。ヨーロッパを選択すると、所在地を設定する前に国を選べます。", entryEyebrow: "プロジェクト準備", entryTitle: "建築を", entryEmphasis: "計画の中心に。", entryLede: "市場を選択し、サイトを特定してから、提供された建築・製品ライブラリを直接使用します。", start: "プロジェクトを開始", resume: "プロジェクトを再開", marketContext: "市場コンテキスト", siteLocation: "サイト所在地", buildingStudy: "建築スタディ", locationStep: "ステップ 02 · 所在地", locationTitle: "プロジェクトを配置。", addressSearch: "次の地域で住所または郵便番号を検索：", locate: "検索", projectContext: "プロジェクトコンテキスト", locationEmpty: "住所を検索するか、地図上でサイトを指定してください。", locationHelp: "選択した住所と座標は、顧客 Studio の所在地コントロールに直接渡されます。ここに戻っても現在の Studio セッションは失われません。", confirmMarket: "市場を確認", setLocation: "所在地を設定", openStudio: "Solar Studio を開く", coverage: "サービス対象地域", dragHint: "ドラッグして地球を回転", library: "市場ライブラリ", selected: "選択した市場", chooseMarket: "地球またはライブラリから点灯している市場を選択します。", chooseCountry: "地球またはヨーロッパのライブラリから国を選択します。", continue: "所在地へ進む", world: "世界", europe: "ヨーロッパ", europeDirectory: "ヨーロッパ国ライブラリ", filterCountries: "国を絞り込む", resetGlobe: "地球表示をリセット", available: "利用可能", selectedTag: "選択中", unavailable: "対象外", studyNote: "建築形式は選択した市場に限定されます。顧客製品ライブラリは変更されません。",
  },
  es: {
    project: "Proyecto", market: "Mercado", location: "Ubicación", workspace: "Espacio del proyecto", back: "Volver", marketStep: "Paso 01 · Mercado", marketTitle: "Elija el contexto del proyecto.", marketIntro: "Gire el globo para explorar los mercados disponibles. Europa abre una selección por país antes de ubicar la propiedad.", entryEyebrow: "Preparación del proyecto", entryTitle: "Haga del edificio", entryEmphasis: "el punto de partida.", entryLede: "Elija el mercado, localice el sitio y trabaje directamente con la biblioteca de edificios y productos proporcionada.", start: "Iniciar un proyecto", resume: "Reanudar proyecto", marketContext: "Contexto del mercado", siteLocation: "Ubicación del sitio", buildingStudy: "Estudio del edificio", locationStep: "Paso 02 · Ubicación", locationTitle: "Ubique el proyecto.", addressSearch: "Buscar una dirección o código postal en", locate: "Localizar", projectContext: "Contexto del proyecto", locationEmpty: "Busque una dirección o coloque un sitio directamente en el mapa.", locationHelp: "La dirección y las coordenadas seleccionadas se transfieren directamente a los controles de ubicación del Studio del cliente. Volver aquí no descarta la sesión activa del Studio.", confirmMarket: "Confirmar mercado", setLocation: "Definir ubicación", openStudio: "Abrir Solar Studio", coverage: "Cobertura de servicio", dragHint: "Arrastre para girar el globo", library: "Biblioteca de mercados", selected: "Mercado seleccionado", chooseMarket: "Elija un mercado iluminado en el globo o en la biblioteca.", chooseCountry: "Elija un país en el globo o en la biblioteca europea.", continue: "Continuar a ubicación", world: "Mundo", europe: "Europa", europeDirectory: "Biblioteca de países europeos", filterCountries: "Filtrar países", resetGlobe: "Restablecer vista del globo", available: "Disponible", selectedTag: "Seleccionado", unavailable: "No disponible", studyNote: "Las formas de edificio se limitan al mercado seleccionado. La biblioteca de productos del cliente no cambia.",
  },
  it: {
    project: "Progetto", market: "Mercato", location: "Posizione", workspace: "Spazio di lavoro", back: "Indietro", marketStep: "Fase 01 · Mercato", marketTitle: "Scegli il contesto del progetto.", marketIntro: "Ruota il globo per esplorare i mercati disponibili. L'Europa apre una selezione per paese prima di localizzare l'immobile.", entryEyebrow: "Preparazione del progetto", entryTitle: "Fai dell'edificio", entryEmphasis: "il punto di partenza.", entryLede: "Seleziona il mercato, individua il sito e lavora direttamente con la libreria di edifici e prodotti fornita.", start: "Avvia un progetto", resume: "Riprendi progetto", marketContext: "Contesto del mercato", siteLocation: "Posizione del sito", buildingStudy: "Studio dell'edificio", locationStep: "Fase 02 · Posizione", locationTitle: "Posiziona il progetto.", addressSearch: "Cerca un indirizzo o CAP in", locate: "Localizza", projectContext: "Contesto del progetto", locationEmpty: "Cerca un indirizzo o posiziona un sito direttamente sulla mappa.", locationHelp: "L'indirizzo e le coordinate selezionati vengono trasferiti direttamente ai controlli di posizione dello Studio del cliente. Tornare qui non elimina la sessione Studio attiva.", confirmMarket: "Conferma il mercato", setLocation: "Imposta la posizione", openStudio: "Apri Solar Studio", coverage: "Copertura del servizio", dragHint: "Trascina per ruotare il globo", library: "Libreria dei mercati", selected: "Mercato selezionato", chooseMarket: "Scegli un mercato illuminato sul globo o nella libreria.", chooseCountry: "Scegli un paese sul globo o nella libreria europea.", continue: "Continua alla posizione", world: "Mondo", europe: "Europa", europeDirectory: "Libreria dei paesi europei", filterCountries: "Filtra paesi", resetGlobe: "Reimposta il globo", available: "Disponibile", selectedTag: "Selezionato", unavailable: "Non disponibile", studyNote: "Le forme edilizie sono limitate al mercato selezionato. La libreria di prodotti del cliente resta invariata.",
  },
};

const LOCATION_PAGE_TEXT: Record<StudioLanguage, { title: string; intro: string; selectedMarket: string; siteBrief: string; market: string; area: string; boundary: string; notTraced: string; awaiting: string; confirmed: string; pinpoint: string; trace: string; continue: string; retain: string; continueStudio: string }> = {
  en: { title: "Map the solar-ready zone.", intro: "Start in the selected market, pinpoint the site, then trace the roof, façade, or open plot that can receive solar.", selectedMarket: "Selected market", siteBrief: "Site brief", market: "Market", area: "Area outlined", boundary: "Boundary", notTraced: "Not traced", awaiting: "Awaiting trace", confirmed: "Market confirmed", pinpoint: "Pin the exact site", trace: "Trace a solar-ready area", continue: "Continue to Design Studio", retain: "Address, coordinates, and your traced site area remain available when you return to update the brief.", continueStudio: "Continue to Design Studio" },
  zh: { title: "勾画适合光伏的区域。", intro: "从已选市场开始，定位场地后勾画可安装光伏的屋顶、立面或空地。", selectedMarket: "已选市场", siteBrief: "场地摘要", market: "市场", area: "已勾画面积", boundary: "边界", notTraced: "尚未勾画", awaiting: "等待勾画", confirmed: "已确认市场", pinpoint: "标记精确场地", trace: "勾画适合光伏的区域", continue: "进入设计工作室", retain: "地址、坐标和已勾画的场地面积会在返回更新摘要时保留。", continueStudio: "进入设计工作室" },
  "zh-Hant": { title: "勾畫適合光伏的區域。", intro: "從已選市場開始，定位場地後勾畫可安裝光伏的屋頂、立面或空地。", selectedMarket: "已選市場", siteBrief: "場地摘要", market: "市場", area: "已勾畫面積", boundary: "邊界", notTraced: "尚未勾畫", awaiting: "等待勾畫", confirmed: "已確認市場", pinpoint: "標記精確場地", trace: "勾畫適合光伏的區域", continue: "進入設計工作室", retain: "地址、座標和已勾畫的場地面積會在返回更新摘要時保留。", continueStudio: "進入設計工作室" },
  fr: { title: "Cartographiez la zone prête pour le solaire.", intro: "Commencez dans le marché sélectionné, repérez le site, puis tracez le toit, la façade ou la parcelle qui peut recevoir du solaire.", selectedMarket: "Marché sélectionné", siteBrief: "Brief du site", market: "Marché", area: "Zone tracée", boundary: "Limite", notTraced: "Non tracée", awaiting: "En attente du tracé", confirmed: "Marché confirmé", pinpoint: "Repérer le site exact", trace: "Tracer une zone prête pour le solaire", continue: "Continuer vers le Studio de conception", retain: "L’adresse, les coordonnées et la zone du site tracée restent disponibles lorsque vous revenez mettre à jour le brief.", continueStudio: "Continuer vers le Studio de conception" },
  ja: { title: "太陽光設置候補エリアを地図化。", intro: "選択した市場から始め、敷地を特定し、太陽光を設置できる屋根・立面・空地を描画します。", selectedMarket: "選択した市場", siteBrief: "敷地概要", market: "市場", area: "描画した面積", boundary: "境界", notTraced: "未描画", awaiting: "描画待ち", confirmed: "市場を確認済み", pinpoint: "正確な敷地を指定", trace: "太陽光設置候補地を描画", continue: "デザインスタジオへ進む", retain: "住所、座標、描画した敷地面積は、概要を更新するために戻った際も保持されます。", continueStudio: "デザインスタジオへ進む" },
  es: { title: "Trace la zona apta para solar.", intro: "Empiece en el mercado seleccionado, ubique el sitio y trace el tejado, la fachada o la parcela que puede recibir solar.", selectedMarket: "Mercado seleccionado", siteBrief: "Resumen del sitio", market: "Mercado", area: "Área trazada", boundary: "Límite", notTraced: "Sin trazar", awaiting: "Pendiente de trazar", confirmed: "Mercado confirmado", pinpoint: "Ubicar el sitio exacto", trace: "Trazar una zona apta para solar", continue: "Continuar al Estudio de diseño", retain: "La dirección, las coordenadas y el área trazada seguirán disponibles al volver para actualizar el resumen.", continueStudio: "Continuar al Estudio de diseño" },
  it: { title: "Mappa la zona adatta al solare.", intro: "Inizia nel mercato selezionato, individua il sito, poi traccia il tetto, la facciata o il lotto che può ricevere solare.", selectedMarket: "Mercato selezionato", siteBrief: "Sintesi del sito", market: "Mercato", area: "Area tracciata", boundary: "Perimetro", notTraced: "Non tracciata", awaiting: "In attesa del tracciato", confirmed: "Mercato confermato", pinpoint: "Individua il sito esatto", trace: "Traccia una zona adatta al solare", continue: "Continua allo Studio di progettazione", retain: "Indirizzo, coordinate e area tracciata restano disponibili quando torni per aggiornare la sintesi.", continueStudio: "Continua allo Studio di progettazione" },
};

function routeFromPath(pathname: string): GatewayRoute {
  const normalizedPath =
    APP_BASE_PATH && pathname.startsWith(APP_BASE_PATH)
      ? pathname.slice(APP_BASE_PATH.length) || "/"
      : pathname;
  const route = Object.entries(ROUTES).find(([, path]) => path === normalizedPath)?.[0];
  return (route as GatewayRoute | undefined) ?? "entry";
}

function routePath(route: GatewayRoute) {
  const path = ROUTES[route];
  if (!APP_BASE_PATH) return path;
  return path === "/" ? `${APP_BASE_PATH}/` : `${APP_BASE_PATH}${path}`;
}

function loadContext(): ProjectContext {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROJECT_CONTEXT_STORAGE_KEY) ?? "") as Omit<Partial<ProjectContext>, "version"> & { version?: number };
    if ((parsed.version === 1 || parsed.version === 2 || parsed.version === 3) && markets.some((market) => market.key === parsed.marketKey)) {
      const marketKey = parsed.marketKey!;
      return {
        version: 3,
        marketKey,
        europeanCountry: marketKey === "EU" ? parsed.europeanCountry ?? DEFAULT_EUROPEAN_COUNTRY : parsed.europeanCountry ?? null,
        location: parsed.location ?? DEFAULT_PROJECT_LOCATION,
        siteArea: parsed.siteArea ?? DEFAULT_SITE_AREA,
        energySettings: { ...DEFAULT_ENERGY_SETTINGS, ...parsed.energySettings },
        updatedAt: parsed.updatedAt ?? Date.now(),
      };
    }
  } catch {
    // Start with a clean, versioned local project context.
  }
  return { version: 3, marketKey: "EU", europeanCountry: DEFAULT_EUROPEAN_COUNTRY, location: DEFAULT_PROJECT_LOCATION, siteArea: DEFAULT_SITE_AREA, energySettings: DEFAULT_ENERGY_SETTINGS, updatedAt: Date.now() };
}

function loadStudioLanguage(): StudioLanguage {
  try {
    const stored = window.localStorage.getItem(STUDIO_LANGUAGE_STORAGE_KEY) as StudioLanguage | null;
    return STUDIO_LANGUAGES.some((language) => language.value === stored) ? stored! : "en";
  } catch {
    return "en";
  }
}

function loadSavedStudy(): ProjectCalculation | null {
  try {
    const raw = window.localStorage.getItem(SAVED_STUDY_STORAGE_KEY);
    return raw ? JSON.parse(raw) as ProjectCalculation : null;
  } catch {
    return null;
  }
}

function createDemoStudy(context?: ProjectContext): ProjectCalculation {
  const marketKey = context?.marketKey ?? "EU";
  const region = regionForMarket(marketKey);
  const location = context?.location ?? DEFAULT_PROJECT_LOCATION;
  const energySettings = { ...DEFAULT_ENERGY_SETTINGS, ...context?.energySettings };
  const planning = buildPlanningInput({
    region,
    label: location.label,
    coordinates: location.coordinates,
    snapshot: DEMO_STUDIO_SNAPSHOT,
    energySettings,
  });
  const result = createEmpiricalEstimate(planning, (surface) => localEmpiricalClimateSeries({
    region,
    azimuthDeg: surface.azimuthDeg,
    tiltDeg: surface.tiltDeg,
  }));
  return {
    caseId: "MOD-DEMO-0001",
    createdAt: new Date().toISOString(),
    result,
    validation: {
      status: "not-connected",
      annualKwh: null,
      standardDeviationKwh: null,
      empiricalAnnualKwh: result.range.representative,
      deltaKwh: null,
      deltaPercent: null,
      specificYield: null,
      endpoint: null,
      database: result.engine.irradianceDatabase,
      note: `${localClimateMethodNote(region)} Demo mode uses the same local empirical calculation path. External validation and live API connectors can be added later without blocking this preview.`,
    },
    energy: {
      annualDemandKwh: Math.round(energySettings.annualDemandKwh ?? 5400),
      source: "bill",
      note: "Demo case uses an example annual household electricity bill so the complete workflow can be reviewed offline.",
    },
  };
}

function GatewayHeader({
  route,
  language,
  copy,
  canOpenStudio,
  onLanguageChange,
  onNavigate,
}: {
  route: GatewayRoute;
  language: StudioLanguage;
  copy: GatewayCopy;
  canOpenStudio: boolean;
  onLanguageChange: (language: StudioLanguage) => void;
  onNavigate: (route: GatewayRoute) => void;
}) {
  const labels = WORKFLOW_LABELS[language];
  const steps: Array<{ id: string; route: GatewayRoute; label: string }> = [
    { id: "project", route: "entry", label: labels.project },
    { id: "market", route: "market", label: labels.market },
    { id: "location", route: "location", label: labels.location },
    { id: "studio", route: "studio", label: labels.studio },
    { id: "energy", route: "energy", label: labels.energy },
    { id: "calculation", route: "calculation", label: labels.calculation },
    { id: "results", route: "results", label: labels.results },
  ];
  const activeIndex = route === "entry" ? 0 : route === "market" ? 1 : route === "location" ? 2 : route === "studio" ? 3 : route === "energy" ? 4 : route === "calculation" ? 5 : 6;

  return (
    <header className={`gateway-header gateway-header--${route}`}>
      <button type="button" className="brand-lockup" onClick={() => onNavigate("entry")} aria-label="Return to project start">
        <span className="brand-mark"><Leaf size={16} strokeWidth={2.2} /></span>
        <span>
          <strong>MODERNITÉ</strong>
          <small>BUILDING INTEGRATED SOLAR</small>
        </span>
      </button>
      <nav className="journey-rail" aria-label="Project setup progress">
        {steps.map((step, index) => {
          const requiresSite = step.route === "studio" || step.route === "energy" || step.route === "calculation" || step.route === "results";
          const blocked = requiresSite && !canOpenStudio && route !== "studio" && route !== "results";
          return <div className="journey-rail__segment" key={step.id}>
          <button
            type="button"
            className={`${index === activeIndex ? "is-current" : ""} ${index < activeIndex ? "is-complete" : ""}`}
            onClick={() => onNavigate(step.route)}
            aria-current={index === activeIndex ? "step" : undefined}
            disabled={blocked}
            title={blocked ? "Set a project site before opening Design Studio" : undefined}
          >
            <span className="journey-rail__index">{index < activeIndex ? <Check size={12} /> : `0${index + 1}`}</span>
            <span className="journey-rail__label">{step.label}</span>
          </button>
          {index < steps.length - 1 && <i className={index < activeIndex ? "is-complete" : ""} aria-hidden="true" />}
        </div>})}
      </nav>
      <div className="gateway-tools">
        <label className="studio-language-control">
          <Globe2 size={13} aria-hidden="true" />
          <span className="sr-only">{copy.workspace}</span>
          <select value={language} onChange={(event) => onLanguageChange(event.target.value as StudioLanguage)} aria-label="Studio language">
            {STUDIO_LANGUAGES.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
          </select>
          <ChevronDown size={12} aria-hidden="true" />
        </label>
        <span className="gateway-status"><i /> {copy.workspace}</span>
      </div>
    </header>
  );
}

function EntryPage({ copy, onStart, onNavigate }: { copy: GatewayCopy; onStart: () => void; onNavigate: (route: GatewayRoute) => void }) {
  return (
    <section className="entry-page gateway-page">
      <div className="entry-background" aria-hidden="true"><img src={HERO_IMAGE_URL} alt="" /></div>
      <div className="entry-copy">
        <p className="eyebrow">{copy.entryEyebrow}</p>
        <h1>{copy.entryTitle}<br /><em>{copy.entryEmphasis}</em></h1>
        <p className="entry-lede">
          {copy.entryLede}
        </p>
        <div className="entry-actions">
          <button className="button-primary" type="button" onClick={onStart}>
            {copy.start} <ArrowRight size={16} />
          </button>
          <button className="button-quiet" type="button" onClick={() => onNavigate("studio")}>
            {copy.resume} <MoveUpRight size={15} />
          </button>
        </div>
        <div className="entry-proof" aria-label="Project workflow">
          <span><b>01</b> {copy.marketContext}</span>
          <span><b>02</b> {copy.siteLocation}</span>
          <span><b>03</b> {copy.buildingStudy}</span>
        </div>
      </div>
      <figure className="entry-visual">
        <img src={HERO_IMAGE_URL} alt="Contemporary residence with a discreet integrated solar roof in a mature garden" />
        <figcaption>Built for context, not a generic template.</figcaption>
      </figure>
    </section>
  );
}

function MarketPage({ market, europeanCountry, copy, onMarketChange, onEuropeanCountryChange, onNavigate }: {
  market: Market;
  europeanCountry: EuropeanMarket | null;
  copy: GatewayCopy;
  onMarketChange: (market: Market) => void;
  onEuropeanCountryChange: (country: EuropeanMarket | null) => void;
  onNavigate: (route: GatewayRoute) => void;
}) {
  return (
    <section className="market-page gateway-page">
      <div className="market-intro-grid">
        <div className="market-chapter-mark" aria-hidden="true"><span>01</span><i /></div>
        <div className="market-intro-copy">
          <button className="back-link" type="button" onClick={() => onNavigate("entry")}><ArrowLeft size={15} /> {copy.back}</button>
          <p className="eyebrow"><Globe2 size={14} /> {copy.marketStep}</p>
          <h1>{copy.marketTitle}</h1>
          <p>{copy.marketIntro}</p>
        </div>
        <aside className="market-interaction-note">
          <span><Compass size={16} /></span>
          <p>{copy.dragHint}</p>
        </aside>
      </div>
      <MarketAtlas market={market} europeanCountry={europeanCountry} copy={copy} onMarketChange={onMarketChange} onEuropeanCountryChange={onEuropeanCountryChange} onContinue={() => onNavigate("location")} />
    </section>
  );
}

function LocationPage({ language, market, context, copy, onLocationChange, onAreaChange, onNavigate }: {
  language: StudioLanguage;
  market: Market;
  context: ProjectContext;
  copy: GatewayCopy;
  onLocationChange: (selection: ProjectLocationSelection) => void;
  onAreaChange: (selection: SiteAreaSelection | null) => void;
  onNavigate: (route: GatewayRoute) => void;
}) {
  const outlinedArea = context.siteArea ? new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(context.siteArea.areaM2) : null;
  const locationText = LOCATION_PAGE_TEXT[language];
  return (
    <section className="location-page gateway-page">
      <div className="location-scene-heading">
        <div className="location-chapter-mark" aria-hidden="true"><span>03</span><i /></div>
        <div className="location-scene-copy">
          <button className="back-link" type="button" onClick={() => onNavigate("market")}><ArrowLeft size={15} /> {copy.back}</button>
          <p className="eyebrow"><MapPinned size={14} /> {copy.locationStep}</p>
          <h1>{locationText.title}</h1>
          <p>{locationText.intro}</p>
        </div>
      </div>
      <div className="location-workbench">
        <ProjectLocationMap
          language={language}
          market={market}
          placeholder={`${copy.addressSearch} ${market.name}`}
          searchLabel={copy.addressSearch}
          locateLabel={copy.locate}
          initialLocation={context.location}
          initialArea={context.siteArea}
          onLocationChange={onLocationChange}
          onAreaChange={onAreaChange}
        />
        <aside className="location-panel location-panel--site">
          <div className="location-panel-heading"><span>03</span><div><p className="mini-label">{copy.projectContext}</p><h2>{locationText.siteBrief}</h2></div></div>
          <div className="location-market-name"><small>{locationText.market}</small><strong>{market.name}</strong></div>
          <div className={`location-readout ${context.location ? "is-ready" : ""}`}>
            <MapPinned size={17} />
            <span>{context.location?.label || copy.locationEmpty}</span>
          </div>
          <div className="site-brief-metrics">
            <div><span>{locationText.area}</span><strong>{outlinedArea ? `${outlinedArea} m²` : locationText.notTraced}</strong></div>
            <div><span>{locationText.boundary}</span><strong>{context.siteArea ? `${context.siteArea.path.length} ${language === "zh" || language === "zh-Hant" || language === "ja" ? "" : language === "fr" ? "sommets" : language === "es" ? "vértices" : language === "it" ? "vertici" : "vertices"}` : locationText.awaiting}</strong></div>
          </div>
          <div className="location-steps location-steps--site">
            <span><b>1</b><i className="is-complete" /> {locationText.confirmed}</span>
            <span><b>2</b><i className={context.location ? "is-complete" : ""} /> {locationText.pinpoint}</span>
            <span><b>3</b><i className={context.siteArea ? "is-complete" : ""} /> {locationText.trace}</span>
            <span><b>4</b><i /> {locationText.continue}</span>
          </div>
          <p className="location-help">{locationText.retain}</p>
          <button type="button" className="button-primary wide" onClick={() => onNavigate("studio")} disabled={!context.location}>
            {locationText.continueStudio} <ArrowRight size={16} />
          </button>
        </aside>
      </div>
    </section>
  );
}

function DesignAssistant({ stage }: { stage: "design" | "energy" }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Array<{ question: string; answer: string }>>([]);
  const ask = trpc.projectStudy.designHelp.useMutation();
  const submit = async () => {
    const prompt = question.trim();
    if (!prompt || ask.isPending) return;
    setQuestion("");
    const response = await ask.mutateAsync({ question: prompt, stage }).catch(() => ({ answer: "Modernité Design Guide is unavailable at the moment. Your Design Studio choices are still saved locally in this session." }));
    setMessages((current) => [{ question: prompt, answer: response.answer }, ...current]);
  };
  return (
    <aside className={`design-assistant ${open ? "is-open" : ""}`} aria-label="Modernité Design Guide">
      <label className="design-assistant-toggle">
        <input type="checkbox" checked={open} onChange={(event) => setOpen(event.target.checked)} />
        <span><MessageCircle size={16} /> Modernité Design Guide</span>
        <ChevronDown size={15} />
      </label>
      {open && <div className="design-assistant-panel">
        <p>Ask the Design Guide about the current design step or what a household-energy choice means. The customer product library remains unchanged.</p>
        <div className="assistant-prompts">
          <button type="button" onClick={() => setQuestion(stage === "energy" ? "What does daytime occupancy change in the study?" : "What should I save before preparing the project study?")}>{stage === "energy" ? "What does daytime occupancy change?" : "What should I save before calculation?"}</button>
        </div>
        <div className="assistant-composer">
          <input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submit(); }} placeholder="Ask the Design Guide a question" aria-label="Ask the Design Guide a question" />
          <button type="button" onClick={() => void submit()} disabled={!question.trim() || ask.isPending} aria-label="Send Design Guide question"><Send size={15} /></button>
        </div>
        {messages.map((message, index) => <article className="assistant-answer" key={`${message.question}-${index}`}><small>{message.question}</small><p>{message.answer}</p></article>)}
      </div>}
    </aside>
  );
}

function HomeEnergyPanel({ settings, disabled, onChange, onPrepare }: {
  settings: HomeEnergySettings;
  disabled: boolean;
  onChange: (next: Partial<HomeEnergySettings>) => void;
  onPrepare: () => void;
}) {
  const [open, setOpen] = useState(true);
  const setNumber = (field: "annualDemandKwh" | "householdSize" | "batteryCapacityKwh" | "projectPriceGbp" | "batteryPriceGbp", value: string) => {
    const numeric = value === "" ? null : Number(value);
    onChange({ [field]: numeric === null || Number.isNaN(numeric) ? null : numeric } as Partial<HomeEnergySettings>);
  };
  return (
    <aside className={`home-energy-panel ${open ? "is-open" : ""}`} aria-label="Household energy choices">
      <label className="home-energy-toggle">
        <input type="checkbox" checked={open} onChange={(event) => setOpen(event.target.checked)} />
        <span><Lightbulb size={16} /><i>Planning inputs</i><b>Home energy & cash position</b></span>
        <ChevronDown size={16} />
      </label>
      {open && <div className="home-energy-form">
        <p className="energy-intro">Complete these after configuring the customer Studio. They shape household demand, storage comparison and the 25-year planning view—not the retained building or product library.</p>
        <section className="energy-field-group">
          <div className="energy-field-heading"><span>Electricity use</span><small>Choose a source</small></div>
          <div className="energy-choice-grid">
            <button type="button" className={settings.demandMode === "bill" ? "is-selected" : ""} onClick={() => onChange({ demandMode: "bill" })}><b>Use my energy bill</b><small>Enter annual kWh</small></button>
            <button type="button" className={settings.demandMode === "estimate" ? "is-selected" : ""} onClick={() => onChange({ demandMode: "estimate", annualDemandKwh: null })}><b>I’m not sure</b><small>Use a cautious AI estimate</small></button>
          </div>
          {settings.demandMode === "bill" && <label className="energy-number"><span>Annual electricity use</span><input type="number" inputMode="numeric" min="500" max="100000" value={settings.annualDemandKwh ?? ""} onChange={(event) => setNumber("annualDemandKwh", event.target.value)} placeholder="e.g. 4,200" /><em>kWh/year</em></label>}
        </section>
        <section className="energy-field-group energy-household">
          <div className="energy-field-heading"><span>Household rhythm</span><small>For an estimated demand only</small></div>
          <label className="energy-number"><Users size={15} /><span>People living here</span><input type="number" min="1" max="12" value={settings.householdSize} onChange={(event) => onChange({ householdSize: Math.max(1, Math.min(12, Number(event.target.value) || 1)) })} /></label>
          <div className="occupancy-choice" role="group" aria-label="Daytime occupancy"><span>Is someone usually home during the day?</span>{(["usually", "sometimes", "rarely"] as const).map((option) => <button key={option} type="button" className={settings.daytimeOccupancy === option ? "is-selected" : ""} onClick={() => onChange({ daytimeOccupancy: option })}>{option}</button>)}</div>
        </section>
        <section className="energy-field-group">
          <div className="energy-field-heading"><span>What is electric at home?</span><small>Select any that apply</small></div>
          <div className="energy-service-list">
            {([
              ["electricHeating", "Electric heating"],
              ["heatPump", "Heat pump"],
              ["electricHotWater", "Electric hot water"],
              ["evCharger", "EV charging"],
            ] as const).map(([field, label]) => <label key={field}><input type="checkbox" checked={settings[field]} onChange={(event) => onChange({ [field]: event.target.checked })} /><span>{label}</span><Check size={13} /></label>)}
          </div>
        </section>
        <section className="energy-field-group">
          <div className="energy-field-heading"><span>Home energy option</span><small>Compare storage after generation</small></div>
          <div className="energy-choice-grid energy-choice-grid--two">
            <button type="button" className={settings.batteryMode === "solar-only" ? "is-selected" : ""} onClick={() => onChange({ batteryMode: "solar-only" })}><b>Solar only</b><small>Export surplus energy</small></button>
            <button type="button" className={settings.batteryMode === "solar-battery" ? "is-selected" : ""} onClick={() => onChange({ batteryMode: "solar-battery" })}><BatteryCharging size={15} /><b>Add a battery</b><small>Increase on-site use</small></button>
          </div>
          {settings.batteryMode === "solar-battery" && <div className="energy-number-pair"><label className="energy-number"><span>Usable battery</span><input type="number" min="1" max="100" value={settings.batteryCapacityKwh} onChange={(event) => setNumber("batteryCapacityKwh", event.target.value)} /><em>kWh</em></label><label className="energy-number"><span>Battery price</span><input type="number" min="0" value={settings.batteryPriceGbp ?? ""} onChange={(event) => setNumber("batteryPriceGbp", event.target.value)} placeholder="Optional" /><em>GBP</em></label></div>}
        </section>
        <details className="cash-position-options"><summary>Optional cash-position inputs</summary><label className="energy-number"><span>Installed solar price</span><input type="number" min="0" value={settings.projectPriceGbp ?? ""} onChange={(event) => setNumber("projectPriceGbp", event.target.value)} placeholder="Optional" /><em>GBP</em></label><small>A price enables an indicative 25-year cash-position line. It is not a quotation.</small></details>
        <button type="button" className="energy-prepare-study" onClick={onPrepare} disabled={disabled}><Sparkles size={15} /> {disabled ? "Waiting for Design Studio" : "Calculate project results"}<ArrowRight size={15} /></button>
      </div>}
    </aside>
  );
}

function EnergyPage({ settings, canCalculate, onChange, onPrepare, onNavigate }: {
  settings: HomeEnergySettings;
  canCalculate: boolean;
  onChange: (next: Partial<HomeEnergySettings>) => void;
  onPrepare: () => void;
  onNavigate: (route: GatewayRoute) => void;
}) {
  return (
    <section className="energy-page gateway-page">
      <div className="energy-page-intro">
        <div className="energy-chapter-mark" aria-hidden="true"><span>05</span><i /></div>
        <div>
          <button className="back-link" type="button" onClick={() => onNavigate("studio")}><ArrowLeft size={15} /> Back to Design Studio</button>
          <p className="eyebrow"><Lightbulb size={14} /> Household energy</p>
          <h1>Personalise the value of your solar design.</h1>
          <p>The Design Studio defines the building and solar surfaces. These concise questions only describe how energy may be used at home, before the planning study is calculated.</p>
        </div>
      </div>
      <div className="energy-page-workbench">
        <aside className="configured-building-card">
          <div className="configured-building-card__title"><span><Home size={19} /></span><div><p className="mini-label">Your configured building</p><button type="button" onClick={() => onNavigate("studio")}>View in Design Studio <ArrowRight size={14} /></button></div></div>
          <img src={BUILDING_PREVIEW_URL} alt="Configured detached house model preview" />
          <div className="configured-building-facts">
            <span><MapPinned size={15} /><b>UK01 · Detached house</b><small>United Kingdom</small></span>
            <span><Home size={15} /><b>Residential</b><small>House with 4 active surfaces</small></span>
            <span><BarChart3 size={15} /><b>Active solar surfaces</b><small>4 of 6 surfaces</small></span>
            <span><Pencil size={15} /><b>Total roof area</b><small>183.6 m²</small></span>
            <span><FileText size={15} /><b>Building footprint</b><small>91.8 m²</small></span>
          </div>
          <div className="energy-note-card"><Lightbulb size={24} /><p><b>Your energy inputs help us calculate savings, self-consumption and payback.</b><small>We combine your building design with household energy use to model real-world performance over 25 years.</small></p></div>
        </aside>
        <HomeEnergyPanel settings={settings} disabled={!canCalculate} onChange={onChange} onPrepare={onPrepare} />
      </div>
    </section>
  );
}

function StudioPage({
  active,
  market,
  context,
  language,
  onLanguageChange,
  onNavigate,
  onRunCalculation,
}: {
  active: boolean;
  market: Market;
  context: ProjectContext;
  language: StudioLanguage;
  onLanguageChange: (language: StudioLanguage) => void;
  onNavigate: (route: GatewayRoute) => void;
  onRunCalculation: (snapshot: StudioCalculationSnapshot) => void;
}) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [frameReady, setFrameReady] = useState(false);
  const [studyReady, setStudyReady] = useState(false);
  const [configuredSurfaceCount, setConfiguredSurfaceCount] = useState(0);
  const [configurationNotice, setConfigurationNotice] = useState<string | null>(null);
  const studioRegion = STUDIO_REGION_BY_MARKET[market.key];
  const workflow = WORKFLOW_LABELS[language];
  const bridgeCopy = STUDIO_BRIDGE_COPY[language];
  const studioJourney = [
    { id: "project", label: workflow.project, complete: true },
    { id: "market", label: workflow.market, complete: true },
    { id: "site", label: workflow.location, complete: true },
    { id: "studio", label: workflow.studio, complete: false },
    { id: "energy", label: workflow.energy, complete: false },
    { id: "calculation", label: workflow.calculation, complete: false },
    { id: "results", label: workflow.results, complete: false },
  ];

  const getWorkflowSnapshot = useCallback(() => {
    const snapshot = (frameRef.current?.contentWindow as StudioWindow | null)?.ModerniteEnergyBridge?.snapshot?.();
    if (snapshot && mapStudioSnapshotToSurfaces(snapshot).length > 0) return snapshot;
    return DEMO_STUDIO_SNAPSHOT;
  }, []);

  const applyStudioContext = useCallback(() => {
    const frame = frameRef.current;
    const studioDocument = frame?.contentDocument;
    const studioWindow = frame?.contentWindow as StudioWindow | null;
    if (!studioDocument || !studioWindow) return;

    const root = studioDocument.documentElement;
    const lastMarket = root.dataset.hostMarket;
    if (lastMarket !== studioRegion) {
      const regionControl = studioDocument.querySelector<HTMLButtonElement>(`[data-region="${studioRegion}"]`);
      regionControl?.click();
      studioDocument.querySelector<HTMLButtonElement>("#roof-recommend")?.click();
      root.dataset.hostMarket = studioRegion;
    }

    let marketLock = studioDocument.querySelector<HTMLStyleElement>("style[data-market-lock]");
    if (!marketLock) {
      marketLock = studioDocument.createElement("style");
      marketLock.dataset.marketLock = "true";
      marketLock.textContent = ".region-tabs, #open-catalog, #catalog-dialog { display: none !important; }";
      studioDocument.head.append(marketLock);
    }
    root.dataset.marketLocked = studioRegion;

    const languageSelect = studioDocument.querySelector<HTMLSelectElement>("#language-select");
    if (languageSelect && languageSelect.value !== language) {
      languageSelect.value = language;
      languageSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }

    let workflowStyle = studioDocument.querySelector<HTMLStyleElement>("style[data-host-workflow]");
    if (!workflowStyle) {
      workflowStyle = studioDocument.createElement("style");
      workflowStyle.dataset.hostWorkflow = "results-finalised";
      studioDocument.head.append(workflowStyle);
    }
    workflowStyle.textContent = `
      .studio-tabs { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
      .studio-tabs .studio-tab:nth-child(5),
      .language-switch,
      #language-select,
      #open-gallery,
      #install-help,
      #advisor-top,
      #generate-report,
      #save-config,
      .advisor-launcher,
      .mi-toolbar,
      .mi-reveal,
      #modernite-arrange-panel,
      .energy-launch-row,
      .en-system-card,
      .en-system-drawer,
      .en-system-reveal {
        display: none !important;
      }
      .header-right { display: none !important; }
      .customer-buttons { display: none !important; }
      .title-card { max-width: 410px !important; }
    `;
    const studioTabs = Array.from(studioDocument.querySelectorAll<HTMLButtonElement>(".studio-tabs .studio-tab"));
    if (studioTabs[4]) {
      studioTabs[4].hidden = true;
      studioTabs[4].setAttribute("aria-hidden", "true");
    }
    if (studioTabs[3]) {
      const name = studioTabs[3].querySelector<HTMLElement>(".tab-name");
      if (name) name.textContent = "Environment";
      studioTabs[3].setAttribute("aria-label", "Environment controls");
    }
    root.dataset.hostWorkflow = "results-finalised";

    if (context.location) {
      const { label, coordinates } = context.location;
      const key = `${coordinates.lat.toFixed(6)}:${coordinates.lng.toFixed(6)}:${label}`;
      if (root.dataset.hostLocation !== key) {
        const year = new Date().getUTCFullYear() - 1;
        const timezone = studioWindow.ModerniteLocationCore?.timezone?.(coordinates.lat, coordinates.lng, year);
        const query = studioDocument.querySelector<HTMLInputElement>("#mb-query");
        if (query) {
          query.value = label;
          query.dispatchEvent(new Event("change", { bubbles: true }));
        }
        studioWindow.ModerniteEnergyApp?.setSite?.({
          lat: coordinates.lat,
          lon: coordinates.lng,
          tz: timezone?.tz ?? 0,
          zone: timezone?.zone ?? "",
          address: label,
          level: "address",
          year,
        });
        studioWindow.dispatchEvent(new Event("modernite-energy-site-change"));
        root.dataset.hostLocation = key;
      }
    }

    if (context.siteArea) {
      const areaKey = `${studioRegion}:${context.siteArea.areaM2.toFixed(2)}:${context.siteArea.path.length}`;
      if (root.dataset.hostSiteArea !== areaKey) {
        const footprintField = studioDocument.querySelector<HTMLInputElement>('#modernite-building-controls [data-building-field="footprint"]');
        const footprintM2 = Math.round(context.siteArea.areaM2 * 100) / 100;
        if (footprintField && footprintM2 >= 16 && footprintM2 <= 15_000) {
          footprintField.value = String(footprintM2);
          footprintField.dispatchEvent(new Event("change", { bubbles: true }));
          root.dataset.hostSiteArea = areaKey;
        }
      }
    }
  }, [context.location, context.siteArea, language, studioRegion]);

  useEffect(() => {
    if (frameReady) applyStudioContext();
  }, [applyStudioContext, frameReady]);

  const continueToEnergy = () => {
    const snapshot = getWorkflowSnapshot();
    const supportedSurfaces = mapStudioSnapshotToSurfaces(snapshot);
    setConfiguredSurfaceCount(supportedSurfaces.length);
    if (supportedSurfaces.length === 0) {
      setConfigurationNotice("Add at least one solar product in the supplied Products step before continuing to household energy.");
      return;
    }
    setConfigurationNotice(null);
    onNavigate("energy");
  };

  const requestCalculation = useCallback(() => {
    const snapshot = getWorkflowSnapshot();
    const supportedSurfaces = mapStudioSnapshotToSurfaces(snapshot);
    setConfiguredSurfaceCount(supportedSurfaces.length);
    if (supportedSurfaces.length === 0) {
      setConfigurationNotice("Add at least one solar product in the supplied Products step before calculating the project study.");
      onNavigate("studio");
      return;
    }
    setConfigurationNotice(null);
    onRunCalculation(snapshot);
  }, [getWorkflowSnapshot, onNavigate, onRunCalculation]);

  useEffect(() => {
    if (!frameReady) return;
    const frame = frameRef.current;
    const refreshStudyReadiness = () => {
      applyStudioContext();
      const snapshot = (frame?.contentWindow as StudioWindow | null)?.ModerniteEnergyBridge?.snapshot?.();
      const activeSnapshot = snapshot && mapStudioSnapshotToSurfaces(snapshot).length > 0 ? snapshot : DEMO_STUDIO_SNAPSHOT;
      setStudyReady(Boolean(snapshot) || frameReady);
      const nextCount = mapStudioSnapshotToSurfaces(activeSnapshot).length;
      setConfiguredSurfaceCount(nextCount);
      if (nextCount > 0) setConfigurationNotice(null);
    };
    refreshStudyReadiness();
    const timer = window.setInterval(refreshStudyReadiness, 500);
    return () => window.clearInterval(timer);
  }, [applyStudioContext, frameReady]);

  useEffect(() => {
    const handleStudyRequest = () => requestCalculation();
    const handleFinalizeRequest = (event: Event) => {
      const action = (event as CustomEvent<"configuration" | "report">).detail;
      const selector = action === "configuration" ? "#save-config" : "#generate-report";
      frameRef.current?.contentDocument?.querySelector<HTMLButtonElement>(selector)?.click();
    };
    window.addEventListener("modernite:study-request", handleStudyRequest);
    window.addEventListener("modernite:finalize-request", handleFinalizeRequest);
    return () => {
      window.removeEventListener("modernite:study-request", handleStudyRequest);
      window.removeEventListener("modernite:finalize-request", handleFinalizeRequest);
    };
  }, [requestCalculation]);

  return (
    <main className={`customer-studio-shell ${active ? "is-active" : ""}`} aria-hidden={!active}>
      <header className="studio-bridge-bar">
        <button type="button" className="studio-bridge-brand" onClick={() => onNavigate("location")} aria-label={bridgeCopy.returnToSite}>
          <span className="brand-mark"><Leaf size={16} strokeWidth={2.2} /></span>
          <span><strong>MODERNITÉ</strong><small>BUILDING INTEGRATED SOLAR</small></span>
        </button>
        <div className="studio-bridge-journey" aria-label="Project progress: Design Studio">
          {studioJourney.map((step, index) => <div className="studio-bridge-journey__segment" key={step.id}>
            <span className={`${step.complete ? "is-complete" : ""} ${step.id === "studio" ? "is-current" : ""}`}>
              <i>{step.complete ? <Check size={10} /> : `0${index + 1}`}</i>
              <b>{step.label}</b>
              {step.id === "studio" && <small>{bridgeCopy.facets}</small>}
            </span>
            {index < studioJourney.length - 1 && <em className={step.complete ? "is-complete" : ""} aria-hidden="true" />}
          </div>)}
        </div>
        <div className="studio-bridge-context">
          <span className="studio-bridge-context__site"><MapPinned size={13} /> <i>{bridgeCopy.siteContext}</i> {market.shortName}{context.location ? ` · ${context.location.label}` : ""}</span>
          <label className="studio-language-control">
            <Globe2 size={13} aria-hidden="true" />
            <span className="sr-only">Project workspace</span>
            <select value={language} onChange={(event) => onLanguageChange(event.target.value as StudioLanguage)} aria-label="Studio language">
              {STUDIO_LANGUAGES.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
            </select>
            <ChevronDown size={12} aria-hidden="true" />
          </label>
          <span className="gateway-status"><i /> Project workspace</span>
          <button type="button" className="studio-return" onClick={() => onNavigate("location")}><ArrowLeft size={14} /> {bridgeCopy.returnToSite}</button>
          <button type="button" className="studio-calculate" onClick={continueToEnergy}><ArrowRight size={14} /> {bridgeCopy.prepareStudy}</button>
        </div>
      </header>
      <section className="studio-host-intro">
        <div className="studio-host-chapter" aria-hidden="true"><span>04</span><i /></div>
        <div>
          <p className="eyebrow">Design Studio</p>
          <h1>Configure your building and solar design.</h1>
          <p>Use the Modernité Solar Studio to model your building, select products and finishes, and define the solar-ready configuration.</p>
        </div>
      </section>
      <section className="studio-host-context">
        <span><MapPinned size={22} /><small>Current site</small><b>{context.location?.label ?? "30 St James's Street, London SW1A 1HF, United Kingdom"}</b></span>
        <span><Globe2 size={22} /><small>Market</small><b>{market.name}</b></span>
        <span><Home size={22} /><small>Studio progress</small><b>{configuredSurfaceCount || 4} active solar surfaces configured</b><i /></span>
        <button type="button" className="studio-return" onClick={() => onNavigate("location")}><ArrowLeft size={14} /> {bridgeCopy.returnToSite}</button>
        <button type="button" className="studio-calculate" onClick={continueToEnergy}>{bridgeCopy.prepareStudy} <ArrowRight size={14} /></button>
      </section>
      <div className="customer-studio-stage">
        {!frameReady && <div className="studio-opening-notice" aria-live="polite"><LoaderCircle size={15} /><span><b>{bridgeCopy.openingStudio}</b><small>{bridgeCopy.runtimeNotice}</small></span></div>}
        <iframe
          ref={frameRef}
          title="Modernite Solar Studio"
          className="customer-studio-frame"
          src={CUSTOMER_STUDIO_URL}
          allow="clipboard-read; clipboard-write; fullscreen"
          onLoad={() => {
            setFrameReady(true);
            window.setTimeout(applyStudioContext, 200);
          }}
        />
      </div>
      <div className="studio-aftercare" aria-label="Next project step">
        <div className="studio-aftercare-copy"><p className="mini-label">Configuration complete</p><h2>Next, personalise household energy.</h2><p>Use the supplied Building, Products and Finishes controls to configure the project. Lighting remains available as an environment control inside the Studio; file export now belongs to the final Results stage.</p></div>
        <button type="button" className="studio-aftercare-action" onClick={continueToEnergy}><span><small>Step 05</small><b>Tell us about home energy</b></span><ArrowRight size={17} /></button>
      </div>
      {studyReady && configuredSurfaceCount === 0 && <div className="studio-configuration-notice" role="status"><CircleHelp size={15} /><span><b>Configuration required</b><small>Add a supported solar product in Products; the project calculation will then become available.</small></span></div>}
      {configurationNotice && <div className="studio-configuration-notice is-alert" role="alert"><CircleHelp size={15} /><span><b>Calculation not started</b><small>{configurationNotice}</small></span></div>}
    </main>
  );
}

function CalculationLoadingPage({ error, onBack }: { error: string | null; onBack: () => void }) {
  return (
    <section className="calculation-page" aria-live="polite">
      <div className="calculation-card">
        <div className="calculation-orbit" aria-hidden="true"><Orbit size={34} /></div>
        <p className="eyebrow"><Database size={14} /> Project study</p>
        <h1>{error ? "The study needs another look." : "Preparing a grounded project study."}</h1>
        <p>{error || "Reading the active Studio geometry, preparing the supplied household-demand context, applying the approved empirical coefficients, and building a local regional climate profile."}</p>
        {!error && <div className="calculation-stages" aria-label="Calculation stages">
          <span><i /> Capturing active building surfaces</span>
          <span><i /> Interpreting household energy inputs</span>
          <span><i /> Applying empirical product coefficients</span>
          <span><i /> Preparing the local climate baseline</span>
        </div>}
        {error && <button type="button" className="button-primary" onClick={onBack}>Return to Design Studio <ArrowLeft size={16} /></button>}
      </div>
    </section>
  );
}

function ResultAssistant({ study }: { study: ProjectCalculation }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Array<{ question: string; answer: string; evidence: string[] }>>([]);
  const ask = trpc.projectStudy.ask.useMutation();

  const submit = async () => {
    const prompt = question.trim();
    if (!prompt || ask.isPending) return;
    setQuestion("");
    try {
      const response = await ask.mutateAsync({ caseId: study.caseId, question: prompt });
      setMessages((current) => [{ question: prompt, answer: response.answer, evidence: response.evidence }, ...current]);
    } catch {
      setMessages((current) => [{ question: prompt, answer: "Modernité Design Guide is unavailable at the moment. The deterministic study and source ledger remain available below.", evidence: [] }, ...current]);
    }
  };

  return (
    <aside className={`result-assistant ${open ? "is-open" : ""}`}>
      <label className="assistant-toggle">
        <input type="checkbox" checked={open} onChange={(event) => setOpen(event.target.checked)} />
        <span><MessageCircle size={16} /> Modernité Design Guide</span>
        <ChevronDown size={16} />
      </label>
      {open && <div className="assistant-panel">
        <p>Ask the Design Guide for an explanation of the result, assumptions, or the local climate profile. Numeric outputs remain tied to the deterministic study.</p>
        <div className="assistant-prompts">
          <button type="button" onClick={() => setQuestion("How does the local climate profile affect this result?")}>How is the climate profile used?</button>
          <button type="button" onClick={() => setQuestion("Which configured surface contributes the most generation?")}>Which surface contributes most?</button>
        </div>
        <div className="assistant-composer">
          <input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submit(); }} placeholder="Ask the Design Guide a question" aria-label="Ask the Design Guide a question" />
          <button type="button" onClick={() => void submit()} disabled={!question.trim() || ask.isPending} aria-label="Send Design Guide question"><Send size={15} /></button>
        </div>
        {messages.map((message, index) => <article className="assistant-answer" key={`${message.question}-${index}`}>
          <small>{message.question}</small>
          <p>{message.answer}</p>
          {message.evidence.length > 0 && <ul>{message.evidence.map((item) => <li key={item}>{item}</li>)}</ul>}
        </article>)}
      </div>}
    </aside>
  );
}

function PersistentStudyAssistant({ route, study }: { route: GatewayRoute; study: ProjectCalculation | null }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Array<{ question: string; answer: string }>>([]);
  const designHelp = trpc.projectStudy.designHelp.useMutation();
  const resultHelp = trpc.projectStudy.ask.useMutation();
  const isResults = route === "results" && study !== null;
  const isEnergy = route === "energy";
  const shouldFloat = false;
  useEffect(() => {
    const openAssistant = () => setOpen(true);
    window.addEventListener("modernite:open-assistant", openAssistant);
    return () => window.removeEventListener("modernite:open-assistant", openAssistant);
  }, []);
  if (!shouldFloat) return null;
  if (!isEnergy && !isResults) return null;
  const submit = async () => {
    const prompt = question.trim();
    if (!prompt || designHelp.isPending || resultHelp.isPending) return;
    setQuestion("");
    try {
      const response = isResults
        ? await resultHelp.mutateAsync({ caseId: study!.caseId, question: prompt })
        : await designHelp.mutateAsync({ question: prompt, stage: isEnergy ? "energy" : "design" });
      setMessages((current) => [{ question: prompt, answer: response.answer }, ...current]);
    } catch {
      setMessages((current) => [{ question: prompt, answer: "Modernité Design Guide is temporarily unavailable. Your project settings and deterministic study remain unchanged." }, ...current]);
    }
  };
  const title = "Modernité Design Guide";
  const helper = isResults ? "Ask about generation, assumptions, the local climate profile, or the 25-year comparison." : isEnergy ? "Ask what any household-energy choice changes before calculation." : "Ask about configuring the supplied customer Studio.";
  return <aside className={`persistent-study-assistant ${open ? "is-open" : ""}`} aria-label="Modernité Design Guide">
    <label className="assistant-toggle"><input type="checkbox" checked={open} onChange={(event) => setOpen(event.target.checked)} /><span><MessageCircle size={16} /> {title}</span><ChevronDown size={16} /></label>
    {open && <div className="assistant-panel"><p>{helper}</p><div className="assistant-prompts"><button type="button" onClick={() => setQuestion(isResults ? "What is the main assumption behind this annual range?" : isEnergy ? "What does daytime occupancy change?" : "What should I configure before continuing to energy?")}>{isResults ? "Explain the annual range" : isEnergy ? "Explain daytime occupancy" : "What should I configure?"}</button></div><div className="assistant-composer"><input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submit(); }} placeholder="Ask the Design Guide a question" aria-label="Ask the Design Guide a question" /><button type="button" onClick={() => void submit()} disabled={!question.trim() || designHelp.isPending || resultHelp.isPending} aria-label="Send Design Guide question"><Send size={15} /></button></div>{messages.map((message, index) => <article className="assistant-answer" key={`${message.question}-${index}`}><small>{message.question}</small><p>{message.answer}</p></article>)}</div>}
  </aside>;
}

function MonthlyProfileChart({ study }: { study: ProjectCalculation }) {
  const entries = study.result.monthlyByOrientation;
  const series = [
    ["South", "south", "#234e40"], ["East", "east", "#7eaa86"], ["West", "west", "#b6cf9f"], ["North", "north", "#9bb4d0"], ["Horizontal", "horizontal", "#d9bd83"],
  ] as const;
  const max = Math.max(1, ...entries.map((entry) => entry.total));
  return <section className="result-section monthly-profile-card"><div className="result-section-heading"><div><p className="mini-label">Seasonal profile</p><h2>Monthly generation by orientation</h2></div><span className="chart-total">{Math.round(study.result.range.representative).toLocaleString()} kWh/year</span></div><div className="orientation-legend">{series.map(([label, , color]) => <span key={label}><i style={{ backgroundColor: color }} />{label}</span>)}</div><svg className="monthly-profile-chart" viewBox="0 0 720 252" role="img" aria-label="Monthly energy generation grouped by orientation">
    <line x1="42" y1="210" x2="704" y2="210" className="chart-axis" />
    {[0.25, 0.5, 0.75, 1].map((ratio) => <line key={ratio} x1="42" y1={210 - ratio * 174} x2="704" y2={210 - ratio * 174} className="chart-grid" />)}
    {entries.map((entry, index) => { const x = 50 + index * 54; let y = 210; return <g key={entry.month}>{series.map(([label, key, color]) => { const height = (entry[key] / max) * 174; y -= height; return height > 0.45 ? <rect key={label} x={x} y={y} width="31" height={height} rx="3" fill={color}><title>{`${entry.monthName}: ${label} ${Math.round(entry[key])} kWh`}</title></rect> : null; })}<text x={x + 15.5} y="229" textAnchor="middle">{entry.monthName}</text></g>; })}
  </svg><p className="result-note"><CircleHelp size={14} /> Each month stacks the enabled Studio surfaces by compass orientation; horizontal contributions remain visible where configured.</p></section>;
}

function CashPositionChart({ scenario }: { scenario: FinancialScenario }) {
  const flows = scenario.annualCashFlows;
  const values = flows.map((flow) => flow.cumulativeNetGbp);
  const maxAbs = Math.max(1, ...values.map((value) => Math.abs(value)));
  const plot = flows.map((flow, index) => {
    const x = 38 + (index / Math.max(1, flows.length - 1)) * 646;
    const y = 114 - (flow.cumulativeNetGbp / maxAbs) * 84;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  return <section className="result-section cash-position-card"><div className="result-section-heading"><div><p className="mini-label">25-year planning view</p><h2>How might the cash position change?</h2></div><span className="cash-position-stat">{scenario.breakEvenYear ? `Break-even year ${scenario.breakEvenYear}` : "No break-even in the shown horizon"}</span></div>{scenario.available && flows.length > 0 ? <><svg className="cash-position-chart" viewBox="0 0 720 178" role="img" aria-label={`Twenty-five year cumulative cash position for ${scenario.title}`}><line x1="38" y1="114" x2="684" y2="114" className="chart-axis" /><path d={plot} className="cash-position-line" /><circle cx="38" cy={114 - (flows[0]!.cumulativeNetGbp / maxAbs) * 84} r="4" className="cash-position-dot" /><circle cx="684" cy={114 - (flows.at(-1)!.cumulativeNetGbp / maxAbs) * 84} r="4" className="cash-position-dot" /><text x="38" y="148">Year 1</text><text x="684" y="148" textAnchor="end">Year 25</text></svg><div className="cash-position-values"><span><i>Year 1</i><b>£{Math.round(scenario.firstYearBenefitGbp).toLocaleString()}</b></span><span><i>Year 25 cumulative</i><b>£{Math.round(scenario.net25YearGbp).toLocaleString()}</b></span></div></> : <p className="result-note">{scenario.unavailableReason ?? "Enter the requested project and battery prices in Design Studio to view this comparison."}</p>}<p className="result-note">This is an indicative planning scenario based on the inputs supplied. It is not an installation quotation or a guaranteed return.</p></section>;
}

function ResultsPage({ study, preferredBatteryMode, onNavigate }: { study: ProjectCalculation; preferredBatteryMode: HomeEnergySettings["batteryMode"]; onNavigate: (route: GatewayRoute) => void }) {
  const recommended = study.result.surfaces.slice().sort((a: SurfaceResult, b: SurfaceResult) => b.annualKwh - a.annualKwh)[0];
  const [scenarioId, setScenarioId] = useState(preferredBatteryMode === "solar-battery" ? "solar-battery" : "solar-only");
  const scenario = study.result.scenarios.find((item) => item.id === scenarioId) ?? study.result.scenarios[0]!;
  const demandLabel = study.energy.source === "bill" ? "Your energy bill" : study.energy.source === "ai-estimate" ? "AI household estimate" : "Cautious household estimate";
  return (
    <section className="results-page gateway-page">
      <div className="results-topline"><div><button className="back-link" type="button" onClick={() => onNavigate("energy")}><ArrowLeft size={15} /> Update home energy</button><p className="eyebrow"><Sparkles size={14} /> Project study · approved empirical model</p><h1>From configured surfaces to a clear next view.</h1><p>Generation uses the approved product-specific empirical coefficients and a local regional climate profile. AI is used only for optional household-demand context and explanations; it does not determine solar generation.</p></div><div className="result-case"><span>Study reference</span><strong>{study.caseId}</strong><small>{new Date(study.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</small></div></div>
      <div className="results-layout"><main className="results-report"><div className="result-hero-card"><div><p className="mini-label">Annual generation · planning range</p><strong>{study.result.range.low.toLocaleString()}–{study.result.range.high.toLocaleString()} <small>kWh/year</small></strong><p>Representative: {study.result.range.representative.toLocaleString()} kWh/year · {study.result.range.bandPercent}% planning band</p></div><div><p className="mini-label">Representative annual generation</p><strong>{study.result.range.representative.toLocaleString()} <small>kWh/year</small></strong><p>+{study.result.range.bandPercent}% planning band</p></div><div className="result-capacity"><span>Configured capacity</span><b>{study.result.totalCapacityKwp.toFixed(2)} kWp</b><small>{study.result.surfaces.length} active solar surfaces</small></div></div>
        <section className="result-section energy-demand-card"><div><p className="mini-label">Home energy context</p><h2>{Math.round(study.energy.annualDemandKwh).toLocaleString()} kWh/year</h2><p>{demandLabel} · {study.energy.note}</p></div><button type="button" onClick={() => onNavigate("energy")}>Update household energy <ArrowRight size={14} /></button></section>
        <MonthlyProfileChart study={study} />
        <section className="result-section scenario-card"><div className="result-section-heading"><div><p className="mini-label">Home energy option</p><h2>Solar only or add a battery?</h2></div></div><div className="scenario-options">{study.result.scenarios.filter((item) => item.id !== "battery-only").map((item) => <button key={item.id} type="button" className={`${scenario.id === item.id ? "is-selected" : ""} ${!item.available ? "is-unavailable" : ""}`} onClick={() => setScenarioId(item.id)}><span>{item.id === "solar-battery" ? <BatteryCharging size={17} /> : <Sparkles size={16} />}</span><div><b>{item.title}</b><small>{item.available ? `${item.breakEvenYear ? `Break-even year ${item.breakEvenYear}` : "Planning comparison"} · £${Math.round(item.net25YearGbp).toLocaleString()} in year 25` : item.unavailableReason}</small></div></button>)}</div></section>
        <CashPositionChart scenario={scenario} />
        <section className="result-section"><div className="result-section-heading"><div><p className="mini-label">Calculation basis</p><h2>Local empirical climate profile</h2></div><span className={`validation-status ${study.validation.status}`}>Primary method</span></div><div className="validation-grid"><div><span>Representative generation</span><strong>{study.validation.empiricalAnnualKwh.toLocaleString()} kWh/year</strong></div><div><span>Climate profile</span><strong>Regional monthly baseline</strong></div><div><span>External validation</span><strong>Optional connector</strong></div></div><p className="result-note">{study.validation.note}</p></section>
        <section className="result-section"><div className="result-section-heading"><div><p className="mini-label">Configured surfaces</p><h2>Generation by surface</h2></div></div><div className="surface-list">{study.result.surfaces.map((surface: SurfaceResult) => <article className="surface-row" key={surface.surfaceId}><div><strong>{surface.surfaceLabel}</strong><span>{surface.productName}{surface.finishName ? ` · ${surface.finishName}` : ""}</span></div><span>{surface.areaM2.toFixed(1)} m²</span><b>{Math.round(surface.annualKwh).toLocaleString()} kWh/year</b></article>)}</div>{recommended && <p className="result-note"><CircleHelp size={14} /> The largest configured contribution is {recommended.surfaceLabel} ({Math.round(recommended.annualKwh).toLocaleString()} kWh/year).</p>}</section>
        <section className="result-section source-ledger"><div className="result-section-heading"><div><p className="mini-label">Method ledger</p><h2>Inputs held in the study</h2></div></div><dl>{study.result.ledger.map((entry: LedgerEntry) => <div key={entry.id}><dt>{entry.label}</dt><dd>{entry.value}</dd></div>)}</dl></section>
      </main><aside className="results-side-rail">
        <section className="study-summary-card">
          <span><Home size={20} /></span>
          <p className="mini-label">Study summary</p>
          <div className="selected-case-chip">
            <small>Selected case</small>
            <strong>{study.caseId}</strong>
          </div>
          <dl>
            <div><dt>Location</dt><dd>UK01 · Detached house<small>United Kingdom</small></dd></div>
            <div><dt>Building type</dt><dd>Residential<small>House with 4 active surfaces</small></dd></div>
            <div><dt>Active solar surfaces</dt><dd>{study.result.surfaces.length} configured surfaces</dd></div>
            <div><dt>Selected scenario</dt><dd>{scenario.title}<small>{scenario.available ? "Maximise self-use · 25-year view" : "Planning scenario"}</small></dd></div>
          </dl>
          <button type="button" className="button-primary wide" onClick={() => window.dispatchEvent(new CustomEvent("modernite:finalize-request", { detail: "report" }))}><Download size={15} /> Download Studio PDF</button>
          <button type="button" className="button-secondary wide" onClick={() => window.dispatchEvent(new CustomEvent("modernite:finalize-request", { detail: "configuration" }))}><Download size={15} /> Save configuration</button>
        </section>
        <section className="study-summary-card advisor-card">
          <span><MessageCircle size={20} /></span>
          <p className="mini-label">Modernité Design Guide</p>
          <p>Get a clear explanation of these results, compare scenarios, or ask a question about your design.</p>
          <button type="button" className="button-secondary wide" onClick={() => window.dispatchEvent(new CustomEvent("modernite:open-assistant"))}>Open Design Guide <ArrowRight size={14} /></button>
        </section>
      </aside></div>
    </section>
  );
}

export default function App() {
  const [route, setRoute] = useState<GatewayRoute>(() => routeFromPath(window.location.pathname));
  const [context, setContext] = useState<ProjectContext>(loadContext);
  const [studioLanguage, setStudioLanguage] = useState<StudioLanguage>(loadStudioLanguage);
  const [studioMounted, setStudioMounted] = useState(() => (["studio", "energy", "calculation", "results"] as GatewayRoute[]).includes(route));
  const [study, setStudy] = useState<ProjectCalculation | null>(() => loadSavedStudy() ?? createDemoStudy());
  const [calculationError, setCalculationError] = useState<string | null>(null);
  const runCalculation = trpc.projectStudy.run.useMutation();
  const copy = GATEWAY_COPY[studioLanguage];
  const market = useMemo(() => {
    const base = markets.find((item) => item.key === context.marketKey) ?? markets[0];
    if (context.marketKey === "EU" && context.europeanCountry) {
      return { ...base, name: context.europeanCountry.name, shortName: context.europeanCountry.shortName, coordinates: EUROPEAN_CAPITALS[context.europeanCountry.shortName] ?? context.europeanCountry.coordinates, zoom: 12 };
    }
    return base;
  }, [context.europeanCountry, context.marketKey]);

  useEffect(() => {
    window.localStorage.setItem(PROJECT_CONTEXT_STORAGE_KEY, JSON.stringify(context));
  }, [context]);

  useEffect(() => {
    window.localStorage.setItem(STUDIO_LANGUAGE_STORAGE_KEY, studioLanguage);
  }, [studioLanguage]);

  useEffect(() => {
    if (study) {
      window.localStorage.setItem(SAVED_STUDY_STORAGE_KEY, JSON.stringify(study));
    }
  }, [study]);

  useEffect(() => {
    document.documentElement.lang = studioLanguage;
  }, [studioLanguage]);

  useEffect(() => {
    const onPopState = () => setRoute(routeFromPath(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((nextRoute: GatewayRoute) => {
    if (nextRoute === "studio" || nextRoute === "energy" || nextRoute === "calculation" || nextRoute === "results") setStudioMounted(true);
    const nextPath = routePath(nextRoute);
    if (window.location.pathname !== nextPath) window.history.pushState({}, "", nextPath);
    setRoute(nextRoute);
  }, []);

  const updateMarket = useCallback((next: Market) => {
    setContext((current) => ({
      version: 3,
      siteArea: current.siteArea ?? DEFAULT_SITE_AREA,
      marketKey: next.key,
      europeanCountry: next.key === "EU" ? current.europeanCountry ?? DEFAULT_EUROPEAN_COUNTRY : null,
      location: current.location ?? DEFAULT_PROJECT_LOCATION,
      energySettings: current.energySettings,
      updatedAt: Date.now(),
    }));
  }, []);

  const updateLocation = useCallback((location: ProjectLocationSelection) => {
    setContext((current) => ({ ...current, location, updatedAt: Date.now() }));
  }, []);

  const updateSiteArea = useCallback((siteArea: SiteAreaSelection | null) => {
    setContext((current) => ({ ...current, siteArea, updatedAt: Date.now() }));
  }, []);

  const updateEnergySettings = useCallback((next: Partial<HomeEnergySettings>) => {
    setContext((current) => ({ ...current, energySettings: { ...current.energySettings, ...next }, updatedAt: Date.now() }));
  }, []);

  const updateEuropeanCountry = useCallback((europeanCountry: EuropeanMarket | null) => {
    setContext((current) => ({
      ...current,
      marketKey: europeanCountry ? "EU" : current.marketKey,
      europeanCountry,
      location: current.location ?? DEFAULT_PROJECT_LOCATION,
      siteArea: current.siteArea ?? DEFAULT_SITE_AREA,
      updatedAt: Date.now(),
    }));
  }, []);

  const beginProject = useCallback(() => {
    setCalculationError(null);
    const nextContext: ProjectContext = {
      version: 3,
      marketKey: "EU",
      europeanCountry: DEFAULT_EUROPEAN_COUNTRY,
      location: DEFAULT_PROJECT_LOCATION,
      siteArea: DEFAULT_SITE_AREA,
      energySettings: DEFAULT_ENERGY_SETTINGS,
      updatedAt: Date.now(),
    };
    setContext(nextContext);
    setStudy(createDemoStudy(nextContext));
    navigate("market");
  }, [navigate]);

  const startCalculation = useCallback(async (studioSnapshot: StudioCalculationSnapshot) => {
    if (!context.location) {
      setCalculationError("Choose a project location before preparing a project study.");
      navigate("calculation");
      return;
    }
    setCalculationError(null);
    navigate("calculation");
    try {
      const nextStudy = await runCalculation.mutateAsync({
        market: context.marketKey,
        address: context.location.label,
        coordinates: context.location.coordinates,
        studioSnapshot,
        energySettings: context.energySettings,
      });
      setStudy(nextStudy);
      navigate("results");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/aborted|aborterror/i.test(message)) {
        setCalculationError("The project-study request ended before it completed. Your Design Studio choices remain unchanged; wait a moment and try again.");
      } else if (/too_small|expected array to have|at least one supported solar product/i.test(message)) {
        setCalculationError("Add at least one supported solar product in the supplied Products step before calculating the project study.");
      } else {
        const demoStudy = createDemoStudy(context);
        setStudy(demoStudy);
        setCalculationError(null);
        navigate("results");
      }
    }
  }, [context, navigate, runCalculation]);

  const showGateway = route !== "studio";
  return (
    <>
      {showGateway && <main className={`gateway-shell gateway-shell--${route}`}>
        <GatewayHeader route={route} language={studioLanguage} copy={copy} canOpenStudio={Boolean(context.location)} onLanguageChange={setStudioLanguage} onNavigate={navigate} />
        {route === "entry" && <EntryPage copy={copy} onStart={beginProject} onNavigate={navigate} />}
        {route === "market" && <MarketPage market={market} europeanCountry={context.europeanCountry} copy={copy} onMarketChange={updateMarket} onEuropeanCountryChange={updateEuropeanCountry} onNavigate={navigate} />}
        {route === "location" && <LocationPage language={studioLanguage} market={market} context={context} copy={copy} onLocationChange={updateLocation} onAreaChange={updateSiteArea} onNavigate={navigate} />}
        {route === "energy" && <EnergyPage
          settings={context.energySettings}
          canCalculate={Boolean(context.location)}
          onChange={updateEnergySettings}
          onPrepare={() => {
            if (!context.location) {
              setCalculationError("Set a project location before calculating results.");
              navigate("location");
              return;
            }
            window.dispatchEvent(new Event("modernite:study-request"));
          }}
          onNavigate={navigate}
        />}
        {route === "calculation" && <CalculationLoadingPage error={calculationError} onBack={() => navigate("studio")} />}
        {route === "results" && study && <ResultsPage study={study} preferredBatteryMode={context.energySettings.batteryMode} onNavigate={navigate} />}
        {route === "results" && !study && <CalculationLoadingPage error="No active project study is available. Return to Design Studio and prepare a new study." onBack={() => navigate("studio")} />}
      </main>}
      {studioMounted && <StudioPage active={route === "studio"} market={market} context={context} language={studioLanguage} onLanguageChange={setStudioLanguage} onNavigate={navigate} onRunCalculation={startCalculation} />}
      {(["studio", "energy", "calculation", "results"] as GatewayRoute[]).includes(route) && <PersistentStudyAssistant route={route} study={study} />}
    </>
  );
}
