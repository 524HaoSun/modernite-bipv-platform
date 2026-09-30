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
  Gauge,
  Globe2,
  Home,
  Leaf,
  Lightbulb,
  LineChart,
  MapPinned,
  MessageCircle,
  MoveUpRight,
  Orbit,
  Pencil,
  LoaderCircle,
  Send,
  ShieldCheck,
  Sparkles,
  SunMedium,
  TrendingUp,
  Users,
  Zap,
  X,
} from "lucide-react";
import { BuildingMatchCard, type BuildingMatch } from "@/components/BuildingMatchCard";
import { GoogleSiteViewer } from "@/components/GoogleSiteViewer";
import { ProjectLocationMap, cleanAddressLabel, type Market, type MarketKey, type ProjectLocationSelection, type SiteAreaSelection } from "@/components/ProjectLocationMap";
import { EUROPEAN_MARKETS, MarketAtlas, type EuropeanMarket, type MarketAtlasCopy } from "@/components/MarketAtlas";
import { publicPath } from "@/lib/paths";
import { trpc } from "@/lib/trpc";
import type { ProjectCalculation } from "../../server/estimate-service";
import { runCustomerStudy, syntheticWeatherFor } from "../../lib/customer-study";
import type { Weather } from "../../lib/customer-energy-core";
import { expandWeather, type CompactWeather } from "../../lib/pvgis-tmy";
import { mapStudioSnapshotToSurfaces, type HomeEnergySettings, type StudioCalculationSnapshot } from "../../lib/studio-calculation";
import type { FinancialScenario, LedgerEntry, SurfaceResult } from "../../types/solar";

const CUSTOMER_STUDIO_URL = publicPath("studio.html");
const HERO_IMAGE_URL = publicPath("assets/modernite-entry-hero-a_aa79dbb7.png");
const ENTRY_REFERENCE_URL = publicPath("assets/modernite-entry-clean-bg.png");
const BUILDING_PREVIEW_URL = publicPath("assets/detached-house_f79b6b45.png");
const PROJECT_CONTEXT_STORAGE_KEY = "modernite-project-context-v1";
const STUDIO_LANGUAGE_STORAGE_KEY = "modernite-studio-language";
const SAVED_STUDY_STORAGE_KEY = "modernite-saved-study-v2";

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
  buildingMatch?: BuildingMatch | null;
  energySettings: HomeEnergySettings;
  updatedAt: number;
};

type StudioDimensions = { width: number; depth: number; floors: number; storeyHeight: number; wwr: number; units?: number };
type StudioWindow = Window & {
  ModerniteEnergyBridge?: {
    snapshot?: () => StudioCalculationSnapshot;
    dimensions?: () => StudioDimensions;
    setDimensions?: (dimensions: StudioDimensions) => void;
  };
  ModerniteEnergyApp?: {
    setSite?: (site: Record<string, unknown>) => void;
    acceptWeather?: (weather: Weather) => void;
    getOrientation?: () => number;
    setOrientation?: (azimuth: number) => void;
  };
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
    { id: "roof_south", product: "roof_tiles", profile: "windsor_black", area: 42, tilt: 31, az: 180, enabled: true, role: "none", linked: false },
    { id: "roof_east", product: "roof_tiles", profile: "windsor_black", area: 19, tilt: 31, az: 105, enabled: true, role: "none", linked: false },
    { id: "facade_south", product: "facade", profile: "facade_grey", area: 12, tilt: 90, az: 180, enabled: true, role: "none", linked: false },
    { id: "railing_west", product: "railing", profile: "railing", area: 6, tilt: 90, az: 270, enabled: true, role: "none", linked: false },
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
    project: "Project", market: "Market", location: "Location", workspace: "Project workspace", back: "Back", marketStep: "Market selection", marketTitle: "Choose the project context.", marketIntro: "Turn the globe to explore available markets. Europe opens to a country-level selection before you locate the property.", entryEyebrow: "Build a brighter tomorrow", entryTitle: "Start your building-integrated", entryEmphasis: "solar project.", entryLede: "Turn your vision into a sustainable building with integrated solar design.", start: "Start a new project", resume: "Resume project", marketContext: "Market context", siteLocation: "Site location", buildingStudy: "Building study", locationStep: "Site selection", locationTitle: "Place the project.", addressSearch: "Search an address or postcode in", locate: "Locate", projectContext: "Project context", locationEmpty: "Search an address or rotate to place a site on the map.", locationHelp: "The selected address and coordinates are handed directly to the customer Studio location controls. Returning here does not discard your active Studio session.", confirmMarket: "Confirm market", setLocation: "Set project location", openStudio: "Open Solar Studio", coverage: "Service coverage", dragHint: "Drag to rotate the globe", library: "Market library", selected: "Selected market", selectCountry: "Select a country", selectedCountry: "Selected country", countriesAvailable: "countries available", chooseMarket: "Choose an illuminated market on the globe or from the library.", chooseCountry: "Choose a country from the globe or the European library.", continue: "Continue to location", world: "World", europe: "Europe", europeDirectory: "European country library", filterCountries: "Filter countries", resetGlobe: "Reset globe view", available: "Available", selectedTag: "Selected", unavailable: "Unavailable", studyNote: "Building forms are scoped to this market. The customer product library remains unchanged.",
  },
  zh: {
    project: "项目", market: "市场", location: "位置", workspace: "项目工作区", back: "返回", marketStep: "步骤 01 · 市场", marketTitle: "选择项目区域。", marketIntro: "旋转地球探索可用市场；选择欧洲后，可在定位之前进一步选择具体国家。", entryEyebrow: "项目准备", entryTitle: "让建筑", entryEmphasis: "成为方案本身。", entryLede: "选择项目市场、定位场地，然后直接使用客户提供的建筑与产品库。", start: "开始项目", resume: "继续项目", marketContext: "市场背景", siteLocation: "场地位置", buildingStudy: "建筑研究", locationStep: "步骤 02 · 位置", locationTitle: "定位项目。", addressSearch: "在以下区域搜索地址或邮编：", locate: "定位", projectContext: "项目背景", locationEmpty: "搜索地址，或在地图上旋转并放置项目地点。", locationHelp: "所选地址和坐标会直接传递到客户 Studio 的位置控件。返回此处不会丢失当前 Studio 会话。", confirmMarket: "确认市场", setLocation: "设置项目位置", openStudio: "打开 Solar Studio", coverage: "服务范围", dragHint: "拖动以旋转地球", library: "市场目录", selected: "已选市场", selectCountry: "选择国家", selectedCountry: "已选国家", countriesAvailable: "个国家可用", chooseMarket: "在地球或目录中选择已点亮的市场。", chooseCountry: "在地球或欧洲目录中选择国家。", continue: "继续至位置", world: "世界", europe: "欧洲", europeDirectory: "欧洲国家目录", filterCountries: "筛选国家", resetGlobe: "重置地球视图", available: "可用", selectedTag: "已选", unavailable: "未开放", studyNote: "建筑形式将限定在所选市场；客户产品库保持不变。",
  },
  "zh-Hant": {
    project: "專案", market: "市場", location: "位置", workspace: "專案工作區", back: "返回", marketStep: "步驟 01 · 市場", marketTitle: "選擇專案區域。", marketIntro: "旋轉地球探索可用市場；選擇歐洲後，可在定位之前進一步選擇具體國家。", entryEyebrow: "專案準備", entryTitle: "讓建築", entryEmphasis: "成為方案本身。", entryLede: "選擇專案市場、定位場地，然後直接使用客戶提供的建築與產品庫。", start: "開始專案", resume: "繼續專案", marketContext: "市場背景", siteLocation: "場地位置", buildingStudy: "建築研究", locationStep: "步驟 02 · 位置", locationTitle: "定位專案。", addressSearch: "在以下區域搜尋地址或郵遞區號：", locate: "定位", projectContext: "專案背景", locationEmpty: "搜尋地址，或在地圖上旋轉並放置專案地點。", locationHelp: "所選地址和座標會直接傳遞到客戶 Studio 的位置控制項。返回此處不會遺失目前 Studio 工作階段。", confirmMarket: "確認市場", setLocation: "設定專案位置", openStudio: "開啟 Solar Studio", coverage: "服務範圍", dragHint: "拖曳以旋轉地球", library: "市場目錄", selected: "已選市場", selectCountry: "選擇國家", selectedCountry: "已選國家", countriesAvailable: "個國家可用", chooseMarket: "在地球或目錄中選擇已點亮的市場。", chooseCountry: "在地球或歐洲目錄中選擇國家。", continue: "繼續至位置", world: "世界", europe: "歐洲", europeDirectory: "歐洲國家目錄", filterCountries: "篩選國家", resetGlobe: "重設地球視圖", available: "可用", selectedTag: "已選", unavailable: "未開放", studyNote: "建築形式將限定在所選市場；客戶產品庫保持不變。",
  },
  fr: {
    project: "Projet", market: "Marché", location: "Localisation", workspace: "Espace projet", back: "Retour", marketStep: "Étape 01 · Marché", marketTitle: "Choisissez le contexte du projet.", marketIntro: "Faites tourner le globe pour explorer les marchés disponibles. L'Europe ouvre une sélection par pays avant la localisation du bien.", entryEyebrow: "Préparation du projet", entryTitle: "Faites du bâtiment", entryEmphasis: "le point de départ.", entryLede: "Sélectionnez le marché, localisez le site, puis travaillez avec la bibliothèque de bâtiments et de produits fournie.", start: "Démarrer un projet", resume: "Reprendre le projet", marketContext: "Contexte du marché", siteLocation: "Localisation du site", buildingStudy: "Étude du bâtiment", locationStep: "Étape 02 · Localisation", locationTitle: "Placez le projet.", addressSearch: "Rechercher une adresse ou un code postal dans", locate: "Localiser", projectContext: "Contexte du projet", locationEmpty: "Recherchez une adresse ou placez un site directement sur la carte.", locationHelp: "L'adresse et les coordonnées sélectionnées sont transmises directement aux commandes de localisation du Studio client. Revenir ici ne supprime pas votre session Studio active.", confirmMarket: "Confirmer le marché", setLocation: "Définir la localisation", openStudio: "Ouvrir Solar Studio", coverage: "Couverture du service", dragHint: "Faites glisser pour tourner le globe", library: "Bibliothèque des marchés", selected: "Marché sélectionné", selectCountry: "Sélectionner un pays", selectedCountry: "Pays sélectionné", countriesAvailable: "pays disponibles", chooseMarket: "Choisissez un marché illuminé sur le globe ou dans la bibliothèque.", chooseCountry: "Choisissez un pays sur le globe ou dans la bibliothèque européenne.", continue: "Continuer vers la localisation", world: "Monde", europe: "Europe", europeDirectory: "Bibliothèque des pays européens", filterCountries: "Filtrer les pays", resetGlobe: "Réinitialiser le globe", available: "Disponible", selectedTag: "Sélectionné", unavailable: "Indisponible", studyNote: "Les formes de bâtiment sont limitées au marché sélectionné. La bibliothèque de produits client reste inchangée.",
  },
  ja: {
    project: "プロジェクト", market: "市場", location: "所在地", workspace: "プロジェクトワークスペース", back: "戻る", marketStep: "ステップ 01 · 市場", marketTitle: "プロジェクト地域を選択。", marketIntro: "地球を回して利用可能な市場を探索します。ヨーロッパを選択すると、所在地を設定する前に国を選べます。", entryEyebrow: "プロジェクト準備", entryTitle: "建築を", entryEmphasis: "計画の中心に。", entryLede: "市場を選択し、サイトを特定してから、提供された建築・製品ライブラリを直接使用します。", start: "プロジェクトを開始", resume: "プロジェクトを再開", marketContext: "市場コンテキスト", siteLocation: "サイト所在地", buildingStudy: "建築スタディ", locationStep: "ステップ 02 · 所在地", locationTitle: "プロジェクトを配置。", addressSearch: "次の地域で住所または郵便番号を検索：", locate: "検索", projectContext: "プロジェクトコンテキスト", locationEmpty: "住所を検索するか、地図上でサイトを指定してください。", locationHelp: "選択した住所と座標は、顧客 Studio の所在地コントロールに直接渡されます。ここに戻っても現在の Studio セッションは失われません。", confirmMarket: "市場を確認", setLocation: "所在地を設定", openStudio: "Solar Studio を開く", coverage: "サービス対象地域", dragHint: "ドラッグして地球を回転", library: "市場ライブラリ", selected: "選択した市場", selectCountry: "国を選択", selectedCountry: "選択した国", countriesAvailable: "か国が利用可能", chooseMarket: "地球またはライブラリから点灯している市場を選択します。", chooseCountry: "地球またはヨーロッパのライブラリから国を選択します。", continue: "所在地へ進む", world: "世界", europe: "ヨーロッパ", europeDirectory: "ヨーロッパ国ライブラリ", filterCountries: "国を絞り込む", resetGlobe: "地球表示をリセット", available: "利用可能", selectedTag: "選択中", unavailable: "対象外", studyNote: "建築形式は選択した市場に限定されます。顧客製品ライブラリは変更されません。",
  },
  es: {
    project: "Proyecto", market: "Mercado", location: "Ubicación", workspace: "Espacio del proyecto", back: "Volver", marketStep: "Paso 01 · Mercado", marketTitle: "Elija el contexto del proyecto.", marketIntro: "Gire el globo para explorar los mercados disponibles. Europa abre una selección por país antes de ubicar la propiedad.", entryEyebrow: "Preparación del proyecto", entryTitle: "Haga del edificio", entryEmphasis: "el punto de partida.", entryLede: "Elija el mercado, localice el sitio y trabaje directamente con la biblioteca de edificios y productos proporcionada.", start: "Iniciar un proyecto", resume: "Reanudar proyecto", marketContext: "Contexto del mercado", siteLocation: "Ubicación del sitio", buildingStudy: "Estudio del edificio", locationStep: "Paso 02 · Ubicación", locationTitle: "Ubique el proyecto.", addressSearch: "Buscar una dirección o código postal en", locate: "Localizar", projectContext: "Contexto del proyecto", locationEmpty: "Busque una dirección o coloque un sitio directamente en el mapa.", locationHelp: "La dirección y las coordenadas seleccionadas se transfieren directamente a los controles de ubicación del Studio del cliente. Volver aquí no descarta la sesión activa del Studio.", confirmMarket: "Confirmar mercado", setLocation: "Definir ubicación", openStudio: "Abrir Solar Studio", coverage: "Cobertura de servicio", dragHint: "Arrastre para girar el globo", library: "Biblioteca de mercados", selected: "Mercado seleccionado", selectCountry: "Seleccione un país", selectedCountry: "País seleccionado", countriesAvailable: "países disponibles", chooseMarket: "Elija un mercado iluminado en el globo o en la biblioteca.", chooseCountry: "Elija un país en el globo o en la biblioteca europea.", continue: "Continuar a ubicación", world: "Mundo", europe: "Europa", europeDirectory: "Biblioteca de países europeos", filterCountries: "Filtrar países", resetGlobe: "Restablecer vista del globo", available: "Disponible", selectedTag: "Seleccionado", unavailable: "No disponible", studyNote: "Las formas de edificio se limitan al mercado seleccionado. La biblioteca de productos del cliente no cambia.",
  },
  it: {
    project: "Progetto", market: "Mercato", location: "Posizione", workspace: "Spazio di lavoro", back: "Indietro", marketStep: "Fase 01 · Mercato", marketTitle: "Scegli il contesto del progetto.", marketIntro: "Ruota il globo per esplorare i mercati disponibili. L'Europa apre una selezione per paese prima di localizzare l'immobile.", entryEyebrow: "Preparazione del progetto", entryTitle: "Fai dell'edificio", entryEmphasis: "il punto di partenza.", entryLede: "Seleziona il mercato, individua il sito e lavora direttamente con la libreria di edifici e prodotti fornita.", start: "Avvia un progetto", resume: "Riprendi progetto", marketContext: "Contesto del mercato", siteLocation: "Posizione del sito", buildingStudy: "Studio dell'edificio", locationStep: "Fase 02 · Posizione", locationTitle: "Posiziona il progetto.", addressSearch: "Cerca un indirizzo o CAP in", locate: "Localizza", projectContext: "Contesto del progetto", locationEmpty: "Cerca un indirizzo o posiziona un sito direttamente sulla mappa.", locationHelp: "L'indirizzo e le coordinate selezionati vengono trasferiti direttamente ai controlli di posizione dello Studio del cliente. Tornare qui non elimina la sessione Studio attiva.", confirmMarket: "Conferma il mercato", setLocation: "Imposta la posizione", openStudio: "Apri Solar Studio", coverage: "Copertura del servizio", dragHint: "Trascina per ruotare il globo", library: "Libreria dei mercati", selected: "Mercato selezionato", selectCountry: "Seleziona un paese", selectedCountry: "Paese selezionato", countriesAvailable: "paesi disponibili", chooseMarket: "Scegli un mercato illuminato sul globo o nella libreria.", chooseCountry: "Scegli un paese sul globo o nella libreria europea.", continue: "Continua alla posizione", world: "Mondo", europe: "Europa", europeDirectory: "Libreria dei paesi europei", filterCountries: "Filtra paesi", resetGlobe: "Reimposta il globo", available: "Disponibile", selectedTag: "Selezionato", unavailable: "Non disponibile", studyNote: "Le forme edilizie sono limitate al mercato selezionato. La libreria di prodotti del cliente resta invariata.",
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

const OUTER_UI_COPY = {
  en: {
    workspace: "Project workspace",
    studioProgressLabel: "Project progress: Design Studio",
    studioAriaLanguage: "Studio language",
    studioStepEyebrow: "Design Studio",
    studioTitle: "Configure your building and solar design.",
    studioIntro: "Use the Modernité Solar Studio to model your building, select products and finishes, and define the solar-ready configuration.",
    currentSite: "Current site",
    market: "Market",
    studioProgress: "Studio progress",
    activeSurfacesConfigured: (count: number) => `${count} active solar surfaces configured`,
    fallbackAddress: "30 St James's Street, London SW1A 1HF, United Kingdom",
    environmentTab: "Environment",
    environmentControls: "Environment controls",
    configurationComplete: "Configuration complete",
    nextEnergyTitle: "Next, personalise household energy.",
    nextEnergyBody: "Use the supplied Building, Products and Finishes controls to configure the project. Lighting remains available as an environment control inside the Studio; file export now belongs to the final Results stage.",
    step05: "Step 05",
    homeEnergyCta: "Tell us about home energy",
    configurationRequired: "Configuration required",
    configurationRequiredBody: "Add a supported solar product in Products; the project calculation will then become available.",
    calculationNotStarted: "Calculation not started",
    addProductBeforeEnergy: "Add at least one solar product in the supplied Products step before continuing to household energy.",
    addProductBeforeStudy: "Add at least one solar product in the supplied Products step before calculating the project study.",
    energyBack: "Back to Design Studio",
    energyEyebrow: "Household energy",
    energyTitle: "Personalise the value of your solar design.",
    energyIntro: "The Design Studio defines the building and solar surfaces. These inputs connect household demand, tariff assumptions, storage preference, and a 25-year planning view before the study is calculated.",
    configuredBuilding: "Your configured building",
    viewInStudio: "View in Design Studio",
    detachedHouse: "UK01 · Detached house",
    residential: "Residential",
    houseSurfaces: "House with 4 active surfaces",
    activeSolarSurfaces: "Active solar surfaces",
    fourOfSix: "4 of 6 surfaces",
    totalRoofArea: "Total roof area",
    buildingFootprint: "Building footprint",
    energyNoteTitle: "Your energy inputs help us calculate savings, self-consumption and payback.",
    energyNoteBody: "We combine your building design with household energy use to model real-world performance over 25 years.",
    planningInputs: "Planning inputs",
    energyCashTitle: "Home energy & cash position",
    energyFormIntro: "Complete these after configuring the customer Studio. They shape household demand, storage comparison and the 25-year planning view, not the retained building or product library.",
    electricityUse: "Electricity use",
    chooseSource: "Choose a source",
    useBill: "Use my energy bill",
    enterAnnual: "Enter annual kWh",
    notSure: "I'm not sure",
    aiEstimate: "Use a cautious AI estimate",
    annualUse: "Annual electricity use",
    householdRhythm: "Household rhythm",
    estimatedDemandOnly: "For an estimated demand only",
    peopleLiving: "People living here",
    dayQuestion: "Is someone usually home during the day?",
    occupancy: { usually: "Usually", sometimes: "Sometimes", rarely: "Rarely" },
    electricHome: "What is electric at home?",
    selectAny: "Select any that apply",
    services: { electricHeating: "Electric heating", heatPump: "Heat pump", electricHotWater: "Electric hot water", evCharger: "EV charging" },
    homeEnergyOption: "Home energy option",
    compareStorage: "Compare storage after generation",
    solarOnly: "Solar only",
    exportSurplus: "Export surplus energy",
    addBattery: "Add a battery",
    increaseOnSite: "Increase on-site use",
    usableBattery: "Usable battery",
    batteryPrice: "Battery price",
    optional: "Optional",
    cashInputs: "Optional cash-position inputs",
    installedSolarPrice: "Installed solar price",
    quoteNote: "A price enables an indicative 25-year cash-position line. It is not a quotation.",
    waitingStudio: "Waiting for Design Studio",
    calculateResults: "Calculate project results",
    planningProfile: "Your planning profile",
    livePreview: "Live preview",
    estimatedAnnualUse: "Estimated annual household use",
    homeProfile: "Home profile",
    directSolarUse: "Expected direct solar use",
    aboutPercent: (value: number) => `About ${value}%`,
    electricLoads: "Electric home loads",
    storageScenario: "Storage scenario",
    planningCostUsed: "Planning cost used",
    estimateLabel: "estimate",
    energyBill: "Energy bill",
    moderniteEstimate: "Modernité estimate",
    person: "person",
    people: "people",
    daytimePresence: "daytime presence",
    noMajorLoads: "No major electric loads selected",
    batteryConsidered: (kwh: number) => `${kwh} kWh battery considered`,
    solarOnlyBaseline: "Solar-only baseline",
    connectsTo: "These answers connect to",
    connectors: ["Direct solar coverage", "Bill saving", "Export income", "Solar vs battery", "25-year cash flow", "Result explanation"],
    calculationEyebrow: "Calculating project study",
    calculationTitle: "Preparing your personalised project outlook.",
    calculationErrorTitle: "The study needs another look.",
    calculationBody: "Applying your configured surfaces, household use, tariff assumptions, storage preference, and local climate profile.",
    calculationStages: ["Surface model", "Home demand", "Generation range", "Scenario value"],
    returnStudio: "Return to Design Studio",
    resultsBack: "Update home energy",
    resultsEyebrow: "Project study · approved empirical model",
    resultsTitle: "From configured surfaces to a complete project outlook.",
    resultsIntro: "Generation uses the approved product-specific empirical coefficients and a local regional climate profile. Household answers shape the value case, savings, export income, and storage comparison without changing the deterministic generation output.",
    studyReference: "Study reference",
  },
  zh: {
    workspace: "项目工作区",
    studioProgressLabel: "项目进度：设计工作室",
    studioAriaLanguage: "工作室语言",
    studioStepEyebrow: "设计工作室",
    studioTitle: "配置建筑与光伏设计。",
    studioIntro: "使用 Modernité Solar Studio 建模建筑、选择产品与饰面，并定义适合光伏的配置。",
    currentSite: "当前场地",
    market: "市场",
    studioProgress: "工作室进度",
    activeSurfacesConfigured: (count: number) => `已配置 ${count} 个有效光伏面`,
    fallbackAddress: "英国伦敦 SW1A 1HF，30 St James's Street",
    environmentTab: "环境",
    environmentControls: "环境控制",
    configurationComplete: "配置已完成",
    nextEnergyTitle: "下一步，完善家庭能耗。",
    nextEnergyBody: "使用已提供的建筑、产品和饰面控件配置项目。照明作为环境控制保留在 Studio 内；文件导出放在最终结果阶段。",
    step05: "步骤 05",
    homeEnergyCta: "填写家庭能耗",
    configurationRequired: "需要完成配置",
    configurationRequiredBody: "请在产品步骤中添加至少一个支持的光伏产品，之后即可进行项目计算。",
    calculationNotStarted: "计算尚未开始",
    addProductBeforeEnergy: "请先在产品步骤中添加至少一个光伏产品，再继续填写家庭能耗。",
    addProductBeforeStudy: "请先在产品步骤中添加至少一个光伏产品，再计算项目研究。",
    energyBack: "返回设计工作室",
    energyEyebrow: "家庭能耗",
    energyTitle: "个性化评估光伏设计价值。",
    energyIntro: "设计工作室定义建筑和光伏表面；这里补充家庭用电、费率假设、储能偏好和 25 年规划视图。",
    configuredBuilding: "已配置建筑",
    viewInStudio: "在设计工作室查看",
    detachedHouse: "UK01 · 独栋住宅",
    residential: "住宅",
    houseSurfaces: "含 4 个有效光伏面的住宅",
    activeSolarSurfaces: "有效光伏面",
    fourOfSix: "6 个表面中的 4 个",
    totalRoofArea: "屋顶总面积",
    buildingFootprint: "建筑占地面积",
    energyNoteTitle: "能耗输入将帮助计算节省、自用率和回本周期。",
    energyNoteBody: "我们会把建筑设计与家庭用电结合，模拟 25 年真实使用表现。",
    planningInputs: "规划输入",
    energyCashTitle: "家庭能耗与现金流",
    energyFormIntro: "请在配置客户 Studio 后完成这些信息。它们会影响家庭需求、储能对比和 25 年规划视图，不改变已保留的建筑或产品库。",
    electricityUse: "用电量",
    chooseSource: "选择来源",
    useBill: "使用电费账单",
    enterAnnual: "输入年度 kWh",
    notSure: "不确定",
    aiEstimate: "使用保守估算",
    annualUse: "年度用电量",
    householdRhythm: "家庭使用节奏",
    estimatedDemandOnly: "仅用于估算需求",
    peopleLiving: "居住人数",
    dayQuestion: "白天通常有人在家吗？",
    occupancy: { usually: "通常", sometimes: "有时", rarely: "很少" },
    electricHome: "家中有哪些电力系统？",
    selectAny: "选择所有适用项",
    services: { electricHeating: "电采暖", heatPump: "热泵", electricHotWater: "电热水", evCharger: "电动车充电" },
    homeEnergyOption: "家庭能源方案",
    compareStorage: "在发电后对比储能",
    solarOnly: "仅光伏",
    exportSurplus: "余电上网",
    addBattery: "添加电池",
    increaseOnSite: "提高本地自用",
    usableBattery: "可用电池容量",
    batteryPrice: "电池价格",
    optional: "可选",
    cashInputs: "可选现金流输入",
    installedSolarPrice: "已安装光伏价格",
    quoteNote: "价格用于生成 25 年现金流参考线，并非安装报价。",
    waitingStudio: "等待设计工作室",
    calculateResults: "计算项目结果",
    planningProfile: "规划概览",
    livePreview: "实时预览",
    estimatedAnnualUse: "预估年度家庭用电",
    homeProfile: "家庭画像",
    directSolarUse: "预计光伏直接自用",
    aboutPercent: (value: number) => `约 ${value}%`,
    electricLoads: "家庭电力负载",
    storageScenario: "储能场景",
    planningCostUsed: "采用的规划成本",
    estimateLabel: "估算",
    energyBill: "电费账单",
    moderniteEstimate: "Modernité 估算",
    person: "人",
    people: "人",
    daytimePresence: "白天在家",
    noMajorLoads: "未选择主要电力负载",
    batteryConsidered: (kwh: number) => `考虑 ${kwh} kWh 电池`,
    solarOnlyBaseline: "仅光伏基准",
    connectsTo: "这些答案会连接到",
    connectors: ["光伏直接覆盖", "电费节省", "上网收益", "光伏与电池对比", "25 年现金流", "结果解释"],
    calculationEyebrow: "正在计算项目研究",
    calculationTitle: "正在准备你的个性化项目展望。",
    calculationErrorTitle: "该研究需要再次检查。",
    calculationBody: "正在应用已配置表面、家庭用电、费率假设、储能偏好和本地气候数据。",
    calculationStages: ["表面模型", "家庭需求", "发电区间", "场景价值"],
    returnStudio: "返回设计工作室",
    resultsBack: "更新家庭能耗",
    resultsEyebrow: "项目研究 · 已批准经验模型",
    resultsTitle: "从已配置表面到完整项目展望。",
    resultsIntro: "发电量使用已批准的产品经验系数和本地区域气候曲线。家庭答案会影响价值、节省、上网收益和储能对比，但不会改变确定性的发电输出。",
    studyReference: "研究编号",
  },
  "zh-Hant": {
    workspace: "專案工作區",
    studioProgressLabel: "專案進度：設計工作室",
    studioAriaLanguage: "工作室語言",
    studioStepEyebrow: "設計工作室",
    studioTitle: "配置建築與光伏設計。",
    studioIntro: "使用 Modernité Solar Studio 建模建築、選擇產品與飾面，並定義適合光伏的配置。",
    currentSite: "目前場地",
    market: "市場",
    studioProgress: "工作室進度",
    activeSurfacesConfigured: (count: number) => `已配置 ${count} 個有效光伏面`,
    fallbackAddress: "英國倫敦 SW1A 1HF，30 St James's Street",
    environmentTab: "環境",
    environmentControls: "環境控制",
    configurationComplete: "配置已完成",
    nextEnergyTitle: "下一步，完善家庭能耗。",
    nextEnergyBody: "使用已提供的建築、產品和飾面控制項配置專案。照明作為環境控制保留在 Studio 內；檔案匯出放在最終結果階段。",
    step05: "步驟 05",
    homeEnergyCta: "填寫家庭能耗",
    configurationRequired: "需要完成配置",
    configurationRequiredBody: "請在產品步驟中新增至少一個支援的光伏產品，之後即可進行專案計算。",
    calculationNotStarted: "計算尚未開始",
    addProductBeforeEnergy: "請先在產品步驟中新增至少一個光伏產品，再繼續填寫家庭能耗。",
    addProductBeforeStudy: "請先在產品步驟中新增至少一個光伏產品，再計算專案研究。",
    energyBack: "返回設計工作室",
    energyEyebrow: "家庭能耗",
    energyTitle: "個性化評估光伏設計價值。",
    energyIntro: "設計工作室定義建築和光伏表面；這裡補充家庭用電、費率假設、儲能偏好和 25 年規劃視圖。",
    configuredBuilding: "已配置建築",
    viewInStudio: "在設計工作室查看",
    detachedHouse: "UK01 · 獨棟住宅",
    residential: "住宅",
    houseSurfaces: "含 4 個有效光伏面的住宅",
    activeSolarSurfaces: "有效光伏面",
    fourOfSix: "6 個表面中的 4 個",
    totalRoofArea: "屋頂總面積",
    buildingFootprint: "建築佔地面積",
    energyNoteTitle: "能耗輸入將幫助計算節省、自用率和回本週期。",
    energyNoteBody: "我們會把建築設計與家庭用電結合，模擬 25 年真實使用表現。",
    planningInputs: "規劃輸入",
    energyCashTitle: "家庭能耗與現金流",
    energyFormIntro: "請在配置客戶 Studio 後完成這些資訊。它們會影響家庭需求、儲能對比和 25 年規劃視圖，不改變已保留的建築或產品庫。",
    electricityUse: "用電量",
    chooseSource: "選擇來源",
    useBill: "使用電費帳單",
    enterAnnual: "輸入年度 kWh",
    notSure: "不確定",
    aiEstimate: "使用保守估算",
    annualUse: "年度用電量",
    householdRhythm: "家庭使用節奏",
    estimatedDemandOnly: "僅用於估算需求",
    peopleLiving: "居住人數",
    dayQuestion: "白天通常有人在家嗎？",
    occupancy: { usually: "通常", sometimes: "有時", rarely: "很少" },
    electricHome: "家中有哪些電力系統？",
    selectAny: "選擇所有適用項",
    services: { electricHeating: "電採暖", heatPump: "熱泵", electricHotWater: "電熱水", evCharger: "電動車充電" },
    homeEnergyOption: "家庭能源方案",
    compareStorage: "在發電後對比儲能",
    solarOnly: "僅光伏",
    exportSurplus: "餘電上網",
    addBattery: "新增電池",
    increaseOnSite: "提高本地自用",
    usableBattery: "可用電池容量",
    batteryPrice: "電池價格",
    optional: "可選",
    cashInputs: "可選現金流輸入",
    installedSolarPrice: "已安裝光伏價格",
    quoteNote: "價格用於生成 25 年現金流參考線，並非安裝報價。",
    waitingStudio: "等待設計工作室",
    calculateResults: "計算專案結果",
    planningProfile: "規劃概覽",
    livePreview: "即時預覽",
    estimatedAnnualUse: "預估年度家庭用電",
    homeProfile: "家庭畫像",
    directSolarUse: "預計光伏直接自用",
    aboutPercent: (value: number) => `約 ${value}%`,
    electricLoads: "家庭電力負載",
    storageScenario: "儲能場景",
    planningCostUsed: "採用的規劃成本",
    estimateLabel: "估算",
    energyBill: "電費帳單",
    moderniteEstimate: "Modernité 估算",
    person: "人",
    people: "人",
    daytimePresence: "白天在家",
    noMajorLoads: "未選擇主要電力負載",
    batteryConsidered: (kwh: number) => `考慮 ${kwh} kWh 電池`,
    solarOnlyBaseline: "僅光伏基準",
    connectsTo: "這些答案會連接到",
    connectors: ["光伏直接覆蓋", "電費節省", "上網收益", "光伏與電池對比", "25 年現金流", "結果解釋"],
    calculationEyebrow: "正在計算專案研究",
    calculationTitle: "正在準備你的個性化專案展望。",
    calculationErrorTitle: "該研究需要再次檢查。",
    calculationBody: "正在套用已配置表面、家庭用電、費率假設、儲能偏好和本地氣候資料。",
    calculationStages: ["表面模型", "家庭需求", "發電區間", "場景價值"],
    returnStudio: "返回設計工作室",
    resultsBack: "更新家庭能耗",
    resultsEyebrow: "專案研究 · 已批准經驗模型",
    resultsTitle: "從已配置表面到完整專案展望。",
    resultsIntro: "發電量使用已批准的產品經驗係數和本地區域氣候曲線。家庭答案會影響價值、節省、上網收益和儲能對比，但不會改變確定性的發電輸出。",
    studyReference: "研究編號",
  },
} as const;

function outerCopy(language: StudioLanguage) {
  if (language === "zh" || language === "zh-Hant") return OUTER_UI_COPY[language];
  return OUTER_UI_COPY.en;
}

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
        buildingMatch: parsed.buildingMatch ?? null,
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

export type WeatherSourceKey = "nasa-power" | "pvgis-tmy";
export type StudyRequestExtras = { timezone?: number; timezoneName?: string; buildingNorthDeg?: number; weatherSource?: WeatherSourceKey };

const WEATHER_SOURCE_STORAGE_KEY = "modernite-weather-source";
const WEATHER_SOURCE_LABELS: Record<WeatherSourceKey, { short: string; loading: string }> = {
  "nasa-power": { short: "NASA POWER", loading: "Loading NASA POWER weather…" },
  "pvgis-tmy": { short: "PVGIS TMY", loading: "Loading PVGIS weather…" },
};

function readWeatherSource(): WeatherSourceKey {
  try {
    return window.localStorage.getItem(WEATHER_SOURCE_STORAGE_KEY) === "pvgis-tmy" ? "pvgis-tmy" : "nasa-power";
  } catch {
    return "nasa-power";
  }
}

function createDemoStudy(context?: ProjectContext, snapshot: StudioCalculationSnapshot = DEMO_STUDIO_SNAPSHOT, extras: StudyRequestExtras = {}): ProjectCalculation {
  const marketKey = context?.marketKey ?? "EU";
  const location = context?.location ?? DEFAULT_PROJECT_LOCATION;
  const energySettings = { ...DEFAULT_ENERGY_SETTINGS, ...context?.energySettings };
  const timezone = extras.timezone ?? Math.round(location.coordinates.lng / 15);
  const study = runCustomerStudy({
    market: marketKey,
    address: location.label,
    coordinates: location.coordinates,
    timezone,
    snapshot,
    buildingNorthDeg: extras.buildingNorthDeg,
    energySettings,
    weather: syntheticWeatherFor(marketKey, { lat: location.coordinates.lat, lon: location.coordinates.lng, tz: timezone }),
  });
  return { ...study, caseId: "MOD-DEMO-0001", createdAt: new Date().toISOString() };
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

function EntryPage({ copy, language, onLanguageChange, onStart, onNavigate }: {
  copy: GatewayCopy;
  language: StudioLanguage;
  onLanguageChange: (language: StudioLanguage) => void;
  onStart: () => void;
  onNavigate: (route: GatewayRoute) => void;
}) {
  return (
    <section className="entry-page gateway-page">
      <div
        className="entry-background backgroundAtmosphere"
        style={{ backgroundImage: `url(${ENTRY_REFERENCE_URL})` }}
        aria-hidden="true"
      >
        <img src={ENTRY_REFERENCE_URL} alt="" />
        <span className="entry-haze entry-haze--left" />
        <span className="entry-haze entry-haze--right" />
      </div>
      <svg className="entry-solar-geometry solarGeometryBase" viewBox="0 0 900 820" aria-hidden="true">
        <defs>
          <filter id="entrySunGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <g className="solar-grid-lines">
          {[0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 180].map((angle) => <line key={angle} x1="450" y1="430" x2={450 + Math.cos((angle - 180) * Math.PI / 180) * 390} y2={430 + Math.sin((angle - 180) * Math.PI / 180) * 390} />)}
          <circle cx="450" cy="430" r="180" />
          <circle cx="450" cy="430" r="250" />
          <circle cx="450" cy="430" r="320" />
          <circle cx="450" cy="430" r="390" />
        </g>
        <g className="solar-compass-labels">
          <text x="450" y="42">N</text>
          <text x="92" y="432">W</text>
          <text x="450" y="806">S</text>
          <text x="805" y="432">E</text>
          <text x="210" y="162">60°</text>
          <text x="680" y="162">120°</text>
          <text x="180" y="586">300°</text>
        </g>
        <g className="solarGeometryHighlightedPaths">
          <path className="solar-path solar-path--summer" pathLength="1" d="M126 455 C204 196 382 118 564 170 C682 204 760 286 819 398" />
          <path className="solar-path solar-path--equinox" pathLength="1" d="M158 534 C286 338 442 294 590 326 C678 346 744 402 804 480" />
          <path className="solar-path solar-path--winter" pathLength="1" d="M236 602 C372 486 520 474 690 554" />
        </g>
        <g className="solarMarkers">
          {[[174,421],[205,366],[250,300],[316,247],[392,210],[530,176],[620,200],[682,238],[746,320],[784,390],[240,520],[330,410],[450,350],[555,342],[664,365],[330,562],[486,525],[632,540]].map(([x, y], index) => <circle key={`${x}-${y}-${index}`} cx={x} cy={y} r={index % 5 === 0 ? 5 : 3.4} />)}
        </g>
        <g className="sunMarker" filter="url(#entrySunGlow)">
          <circle cx="292" cy="270" r="18" />
          <circle cx="292" cy="270" r="34" />
          <line x1="292" y1="216" x2="292" y2="232" />
          <line x1="292" y1="308" x2="292" y2="324" />
          <line x1="238" y1="270" x2="254" y2="270" />
          <line x1="330" y1="270" x2="346" y2="270" />
        </g>
        <g className="solar-annotations">
          <text x="348" y="278">32°</text>
          <text x="348" y="304">SUN ELEVATION</text>
          <text x="348" y="326">21 JUN</text>
          <text x="740" y="228">SUMMER</text>
          <text x="740" y="250">SOLSTICE</text>
          <text x="802" y="336">EQUINOX</text>
          <text x="640" y="616">WINTER SOLSTICE</text>
        </g>
      </svg>
      <svg className="entry-wireframe-overlay wireframeOverlayLayer" viewBox="0 0 620 520" aria-hidden="true">
        <g className="wireframe-shell">
          <polygon points="118,184 348,104 550,184 326,258" />
          <polygon points="326,258 550,184 550,430 326,500" />
          <polygon points="118,184 326,258 326,500 118,410" />
          <polyline points="118,184 118,410 326,500 550,430 550,184" />
          <line x1="348" y1="104" x2="326" y2="500" />
          <line x1="205" y1="214" x2="420" y2="140" />
          <line x1="270" y1="236" x2="484" y2="162" />
          <line x1="368" y1="245" x2="368" y2="487" />
          <line x1="410" y1="230" x2="410" y2="474" />
          <line x1="454" y1="214" x2="454" y2="460" />
          <line x1="500" y1="198" x2="500" y2="446" />
        </g>
        <g className="wireframe-panels">
          {Array.from({ length: 5 }).map((_, index) => <line key={`roof-${index}`} x1={202 + index * 42} y1={214 - index * 15} x2={408 + index * 36} y2={286 - index * 12} />)}
          {Array.from({ length: 4 }).map((_, index) => <line key={`facade-${index}`} x1="342" y1={298 + index * 38} x2="532" y2={244 + index * 34} />)}
        </g>
      </svg>
      <div className="entry-copy heroTextGroup">
        <p className="eyebrow">{copy.entryEyebrow}</p>
        <h1>{copy.entryTitle}<br /><em>{copy.entryEmphasis}</em></h1>
        <p className="entry-lede">
          {copy.entryLede}
        </p>
        <div className="entry-actions ctaGroup">
          <button className="button-primary" type="button" onClick={onStart}>
            {copy.start} <ArrowRight size={18} />
          </button>
          <button className="button-quiet" type="button" onClick={() => onNavigate("studio")}>
            {copy.resume} <MoveUpRight size={15} />
          </button>
        </div>
      </div>
      <figure className="entry-visual">
        <img src={HERO_IMAGE_URL} alt="Contemporary residence with a discreet integrated solar roof in a mature garden" />
        <figcaption>Architecture, solar geometry, and digital design intelligence.</figcaption>
      </figure>
      <div className="entry-foreground foregroundFoliageBlur" aria-hidden="true" />
      <label className="entry-language-hotspot" aria-label="Select language">
        <select value={language} onChange={(event) => onLanguageChange(event.target.value as StudioLanguage)}>
          {STUDIO_LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <span className="entry-workspace-pulse" aria-hidden="true" />
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

function LocationPage({ language, market, context, copy, onLocationChange, onAreaChange, onBuildingMatchChange, onNavigate }: {
  language: StudioLanguage;
  market: Market;
  context: ProjectContext;
  copy: GatewayCopy;
  onLocationChange: (selection: ProjectLocationSelection) => void;
  onAreaChange: (selection: SiteAreaSelection | null) => void;
  onBuildingMatchChange: (match: BuildingMatch | null) => void;
  onNavigate: (route: GatewayRoute) => void;
}) {
  const [viewerMode, setViewerMode] = useState<"street" | "earth" | null>(null);
  const outlinedArea = context.siteArea ? new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(context.siteArea.areaM2) : null;
  const locationText = LOCATION_PAGE_TEXT[language];
  const locationLabel = context.location ? cleanAddressLabel(context.location.label, language) : "";
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
          onOpenStreetView={() => setViewerMode("street")}
        />
        <aside className="location-panel location-panel--site">
          <div className="location-panel-heading"><span>03</span><div><p className="mini-label">{copy.projectContext}</p><h2>{locationText.siteBrief}</h2></div></div>
          <div className="location-market-name"><small>{locationText.market}</small><strong>{market.name}</strong></div>
          <div className={`location-readout ${context.location ? "is-ready" : ""}`}>
            <MapPinned size={17} />
            <span>{locationLabel || copy.locationEmpty}</span>
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
          {context.location && <BuildingMatchCard
            key={`${context.location.coordinates.lat.toFixed(5)}:${context.location.coordinates.lng.toFixed(5)}`}
            language={language}
            coordinates={context.location.coordinates}
            match={context.buildingMatch}
            onUseOutline={(footprint) => footprint.path && footprint.footprintAreaM2 && onAreaChange({ areaM2: footprint.footprintAreaM2, path: footprint.path })}
            onMatchChange={onBuildingMatchChange}
            onOpenViewer={setViewerMode}
          />}
          <p className="location-help">{locationText.retain}</p>
          <button type="button" className="button-primary wide" onClick={() => onNavigate("studio")} disabled={!context.location}>
            {locationText.continueStudio} <ArrowRight size={16} />
          </button>
        </aside>
      </div>
      {viewerMode && context.location && <GoogleSiteViewer coordinates={context.location.coordinates} label={locationLabel} initialMode={viewerMode} onClose={() => setViewerMode(null)} />}
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

function estimateEnergyPreview(settings: HomeEnergySettings, language: StudioLanguage) {
  const text = outerCopy(language);
  const services = [
    settings.electricHeating ? text.services.electricHeating : null,
    settings.heatPump ? text.services.heatPump : null,
    settings.electricHotWater ? text.services.electricHotWater : null,
    settings.evCharger ? text.services.evCharger : null,
  ].filter(Boolean) as string[];
  const estimatedDemand = Math.max(
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
  const annualDemand = settings.demandMode === "bill" && settings.annualDemandKwh ? Math.round(settings.annualDemandKwh) : estimatedDemand;
  const directUse = settings.daytimeOccupancy === "usually" ? 46 : settings.daytimeOccupancy === "rarely" ? 30 : 38;
  const projectPrice = settings.projectPriceGbp && settings.projectPriceGbp > 0 ? settings.projectPriceGbp : 23800;
  return {
    annualDemand,
    directUse,
    projectPrice,
    source: settings.demandMode === "bill" ? text.energyBill : text.moderniteEstimate,
    profile: `${settings.householdSize} ${settings.householdSize === 1 ? text.person : text.people} · ${text.occupancy[settings.daytimeOccupancy]} ${text.daytimePresence}`,
    services: services.length ? services.join(" · ") : text.noMajorLoads,
    battery: settings.batteryMode === "solar-battery" ? text.batteryConsidered(settings.batteryCapacityKwh) : text.solarOnlyBaseline,
  };
}

function EnergyPlanningPreview({ settings, language }: { settings: HomeEnergySettings; language: StudioLanguage }) {
  const text = outerCopy(language);
  const preview = estimateEnergyPreview(settings, language);
  return (
    <aside className="energy-planning-preview" aria-label="Live planning profile">
      <div className="energy-preview-heading">
        <p className="mini-label">{text.planningProfile}</p>
        <span><i /> {text.livePreview}</span>
      </div>
      <div className="energy-preview-meter">
        <small>{text.estimatedAnnualUse}</small>
        <strong>{preview.annualDemand.toLocaleString()} <em>kWh / year</em></strong>
        <div><span style={{ width: `${Math.min(100, Math.max(18, (preview.annualDemand / 9000) * 100))}%` }} /></div>
        <p>{preview.source}</p>
      </div>
      <dl className="energy-preview-facts">
        <div><dt><Home size={14} /> {text.homeProfile}</dt><dd>{preview.profile}</dd></div>
        <div><dt><SunMedium size={14} /> {text.directSolarUse}</dt><dd>{text.aboutPercent(preview.directUse)}</dd></div>
        <div><dt><Zap size={14} /> {text.electricLoads}</dt><dd>{preview.services}</dd></div>
        <div><dt><BatteryCharging size={14} /> {text.storageScenario}</dt><dd>{preview.battery}</dd></div>
        <div><dt><TrendingUp size={14} /> {text.planningCostUsed}</dt><dd>£{Math.round(preview.projectPrice).toLocaleString()} {text.estimateLabel}</dd></div>
      </dl>
      <div className="energy-preview-connectors">
        <p className="mini-label">{text.connectsTo}</p>
        {text.connectors.map((item) => <span key={item}><Check size={12} /> {item}</span>)}
      </div>
    </aside>
  );
}

function HomeEnergyPanel({ settings, disabled, onChange, onPrepare, language }: {
  settings: HomeEnergySettings;
  disabled: boolean;
  onChange: (next: Partial<HomeEnergySettings>) => void;
  onPrepare: () => void;
  language: StudioLanguage;
}) {
  const [open, setOpen] = useState(true);
  const text = outerCopy(language);
  const setNumber = (field: "annualDemandKwh" | "householdSize" | "batteryCapacityKwh" | "projectPriceGbp" | "batteryPriceGbp", value: string) => {
    const numeric = value === "" ? null : Number(value);
    onChange({ [field]: numeric === null || Number.isNaN(numeric) ? null : numeric } as Partial<HomeEnergySettings>);
  };
  return (
    <aside className={`home-energy-panel ${open ? "is-open" : ""}`} aria-label="Household energy choices">
      <label className="home-energy-toggle">
        <input type="checkbox" checked={open} onChange={(event) => setOpen(event.target.checked)} />
        <span><Lightbulb size={16} /><i>{text.planningInputs}</i><b>{text.energyCashTitle}</b></span>
        <ChevronDown size={16} />
      </label>
      {open && <div className="home-energy-form">
        <p className="energy-intro">{text.energyFormIntro}</p>
        <section className="energy-field-group">
          <div className="energy-field-heading"><span>{text.electricityUse}</span><small>{text.chooseSource}</small></div>
          <div className="energy-choice-grid">
            <button type="button" className={settings.demandMode === "bill" ? "is-selected" : ""} onClick={() => onChange({ demandMode: "bill" })}><b>{text.useBill}</b><small>{text.enterAnnual}</small></button>
            <button type="button" className={settings.demandMode === "estimate" ? "is-selected" : ""} onClick={() => onChange({ demandMode: "estimate", annualDemandKwh: null })}><b>{text.notSure}</b><small>{text.aiEstimate}</small></button>
          </div>
          {settings.demandMode === "bill" && <label className="energy-number"><span>{text.annualUse}</span><input type="number" inputMode="numeric" min="500" max="100000" value={settings.annualDemandKwh ?? ""} onChange={(event) => setNumber("annualDemandKwh", event.target.value)} placeholder="e.g. 4,200" /><em>kWh/year</em></label>}
        </section>
        <section className="energy-field-group energy-household">
          <div className="energy-field-heading"><span>{text.householdRhythm}</span><small>{text.estimatedDemandOnly}</small></div>
          <label className="energy-number"><Users size={15} /><span>{text.peopleLiving}</span><input type="number" min="1" max="12" value={settings.householdSize} onChange={(event) => onChange({ householdSize: Math.max(1, Math.min(12, Number(event.target.value) || 1)) })} /></label>
          <div className="occupancy-choice" role="group" aria-label="Daytime occupancy"><span>{text.dayQuestion}</span>{(["usually", "sometimes", "rarely"] as const).map((option) => <button key={option} type="button" className={settings.daytimeOccupancy === option ? "is-selected" : ""} onClick={() => onChange({ daytimeOccupancy: option })}>{text.occupancy[option]}</button>)}</div>
        </section>
        <section className="energy-field-group">
          <div className="energy-field-heading"><span>{text.electricHome}</span><small>{text.selectAny}</small></div>
          <div className="energy-service-list">
            {([
              ["electricHeating", text.services.electricHeating],
              ["heatPump", text.services.heatPump],
              ["electricHotWater", text.services.electricHotWater],
              ["evCharger", text.services.evCharger],
            ] as const).map(([field, label]) => <label key={field}><input type="checkbox" checked={settings[field]} onChange={(event) => onChange({ [field]: event.target.checked })} /><span>{label}</span><Check size={13} /></label>)}
          </div>
        </section>
        <section className="energy-field-group">
          <div className="energy-field-heading"><span>{text.homeEnergyOption}</span><small>{text.compareStorage}</small></div>
          <div className="energy-choice-grid energy-choice-grid--two">
            <button type="button" className={settings.batteryMode === "solar-only" ? "is-selected" : ""} onClick={() => onChange({ batteryMode: "solar-only" })}><b>{text.solarOnly}</b><small>{text.exportSurplus}</small></button>
            <button type="button" className={settings.batteryMode === "solar-battery" ? "is-selected" : ""} onClick={() => onChange({ batteryMode: "solar-battery" })}><BatteryCharging size={15} /><b>{text.addBattery}</b><small>{text.increaseOnSite}</small></button>
          </div>
          {settings.batteryMode === "solar-battery" && <div className="energy-number-pair"><label className="energy-number"><span>{text.usableBattery}</span><input type="number" min="1" max="100" value={settings.batteryCapacityKwh} onChange={(event) => setNumber("batteryCapacityKwh", event.target.value)} /><em>kWh</em></label><label className="energy-number"><span>{text.batteryPrice}</span><input type="number" min="0" value={settings.batteryPriceGbp ?? ""} onChange={(event) => setNumber("batteryPriceGbp", event.target.value)} placeholder={text.optional} /><em>GBP</em></label></div>}
        </section>
        <details className="cash-position-options"><summary>{text.cashInputs}</summary><label className="energy-number"><span>{text.installedSolarPrice}</span><input type="number" min="0" value={settings.projectPriceGbp ?? ""} onChange={(event) => setNumber("projectPriceGbp", event.target.value)} placeholder={text.optional} /><em>GBP</em></label><small>{text.quoteNote}</small></details>
        <button type="button" className="energy-prepare-study" onClick={onPrepare} disabled={disabled}><Sparkles size={15} /> {disabled ? text.waitingStudio : text.calculateResults}<ArrowRight size={15} /></button>
      </div>}
    </aside>
  );
}

function EnergyPage({ settings, canCalculate, onChange, onPrepare, onNavigate, language }: {
  settings: HomeEnergySettings;
  canCalculate: boolean;
  onChange: (next: Partial<HomeEnergySettings>) => void;
  onPrepare: () => void;
  onNavigate: (route: GatewayRoute) => void;
  language: StudioLanguage;
}) {
  const text = outerCopy(language);
  return (
    <section className="energy-page gateway-page">
      <div className="energy-page-intro">
        <div className="energy-chapter-mark" aria-hidden="true"><span>05</span><i /></div>
        <div>
          <button className="back-link" type="button" onClick={() => onNavigate("studio")}><ArrowLeft size={15} /> {text.energyBack}</button>
          <p className="eyebrow"><Lightbulb size={14} /> {text.energyEyebrow}</p>
          <h1>{text.energyTitle}</h1>
          <p>{text.energyIntro}</p>
        </div>
      </div>
      <div className="energy-page-workbench">
        <aside className="configured-building-card">
          <div className="configured-building-card__title"><span><Home size={19} /></span><div><p className="mini-label">{text.configuredBuilding}</p><button type="button" onClick={() => onNavigate("studio")}>{text.viewInStudio} <ArrowRight size={14} /></button></div></div>
          <img src={BUILDING_PREVIEW_URL} alt="Configured detached house model preview" />
          <div className="configured-building-facts">
            <span><MapPinned size={15} /><b>{text.detachedHouse}</b><small>{language === "zh" || language === "zh-Hant" ? "英国" : "United Kingdom"}</small></span>
            <span><Home size={15} /><b>{text.residential}</b><small>{text.houseSurfaces}</small></span>
            <span><BarChart3 size={15} /><b>{text.activeSolarSurfaces}</b><small>{text.fourOfSix}</small></span>
            <span><Pencil size={15} /><b>{text.totalRoofArea}</b><small>183.6 m²</small></span>
            <span><FileText size={15} /><b>{text.buildingFootprint}</b><small>91.8 m²</small></span>
          </div>
          <div className="energy-note-card"><Lightbulb size={24} /><p><b>{text.energyNoteTitle}</b><small>{text.energyNoteBody}</small></p></div>
        </aside>
        <HomeEnergyPanel settings={settings} disabled={!canCalculate} onChange={onChange} onPrepare={onPrepare} language={language} />
        <EnergyPlanningPreview settings={settings} language={language} />
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
  onRunCalculation: (snapshot: StudioCalculationSnapshot, extras: StudyRequestExtras) => void;
}) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const weatherAbortRef = useRef<AbortController | null>(null);
  const [weatherState, setWeatherState] = useState<{ status: "idle" | "loading" | "ready" | "error"; label: string }>({ status: "idle", label: "" });
  const [weatherSource, setWeatherSource] = useState<WeatherSourceKey>(readWeatherSource);
  const [frameReady, setFrameReady] = useState(false);
  const [studyReady, setStudyReady] = useState(false);
  const [configuredSurfaceCount, setConfiguredSurfaceCount] = useState(0);
  const [configurationNotice, setConfigurationNotice] = useState<string | null>(null);
  const studioRegion = STUDIO_REGION_BY_MARKET[market.key];
  const workflow = WORKFLOW_LABELS[language];
  const bridgeCopy = STUDIO_BRIDGE_COPY[language];
  const text = outerCopy(language);
  const studioLocationLabel = context.location ? cleanAddressLabel(context.location.label, language) : "";
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
      if (name) name.textContent = text.environmentTab;
      studioTabs[3].setAttribute("aria-label", text.environmentControls);
    }
    root.dataset.hostWorkflow = "results-finalised";

    if (context.location) {
      const { label, coordinates } = context.location;
      const addressLabel = cleanAddressLabel(label, language);
      const key = `${coordinates.lat.toFixed(6)}:${coordinates.lng.toFixed(6)}:${language}:${addressLabel}:${weatherSource}`;
      if (root.dataset.hostLocation !== key) {
        const year = new Date().getUTCFullYear() - 1;
        const timezone = studioWindow.ModerniteLocationCore?.timezone?.(coordinates.lat, coordinates.lng, year);
        const query = studioDocument.querySelector<HTMLInputElement>("#mb-query");
        if (query) {
          query.value = addressLabel;
          query.dispatchEvent(new Event("change", { bubbles: true }));
        }
        const site = {
          lat: coordinates.lat,
          lon: coordinates.lng,
          tz: timezone?.tz ?? 0,
          zone: timezone?.zone ?? "",
          address: addressLabel,
          level: "address",
          year,
        };
        studioWindow.ModerniteEnergyApp?.setSite?.(site);
        studioWindow.dispatchEvent(new Event("modernite-energy-site-change"));
        root.dataset.hostLocation = key;
        weatherAbortRef.current?.abort();
        const controller = new AbortController();
        weatherAbortRef.current = controller;
        const sourceLabel = WEATHER_SOURCE_LABELS[weatherSource];
        setWeatherState({ status: "loading", label: sourceLabel.loading });
        const weatherQuery = new URLSearchParams({ lat: String(site.lat), lon: String(site.lon), tz: String(site.tz), zone: site.zone, year: String(year), address: addressLabel });
        fetch(`${APP_BASE_PATH}/api/weather/${weatherSource}?${weatherQuery}`, { signal: controller.signal })
          .then(async (response) => {
            const body = await response.json() as CompactWeather & { error?: string };
            if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
            studioWindow.ModerniteEnergyApp?.acceptWeather?.(expandWeather(body));
            studioWindow.dispatchEvent(new Event("modernite-energy-site-change"));
            setWeatherState({ status: "ready", label: String(body.source ?? sourceLabel.short) });
          })
          .catch((error: unknown) => {
            if (controller.signal.aborted) return;
            setWeatherState({ status: "error", label: `${sourceLabel.short} unavailable — Studio uses its synthetic climate (${error instanceof Error ? error.message : "error"})` });
          });
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

    const match = context.buildingMatch;
    const bridge = studioWindow.ModerniteEnergyBridge;
    if (match && bridge?.dimensions && bridge.setDimensions) {
      const buildingKey = `${studioRegion}:${match.osmId}:${match.widthM}:${match.depthM}:${match.floors ?? ""}:${match.frontAzimuthDeg}`;
      if (root.dataset.hostBuilding !== buildingKey) {
        const current = bridge.dimensions();
        const units = current.units ?? 1;
        const clampTo = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(value * 10) / 10));
        try {
          bridge.setDimensions({
            width: clampTo(match.widthM, 4 * units, 150),
            depth: clampTo(match.depthM, 4, 100),
            floors: match.floors ? Math.min(60, Math.max(1, Math.round(match.floors))) : current.floors,
            storeyHeight: current.storeyHeight,
            wwr: current.wwr,
          });
          studioWindow.ModerniteEnergyApp?.setOrientation?.(match.frontAzimuthDeg % 360);
          studioWindow.dispatchEvent(new Event("modernite-model-change"));
          root.dataset.hostBuilding = buildingKey;
        } catch (error) {
          console.warn("[studio] building match not applied", error);
        }
      }
    }
  }, [context.buildingMatch, context.location, context.siteArea, language, studioRegion, text.environmentControls, text.environmentTab, weatherSource]);

  useEffect(() => {
    if (frameReady) applyStudioContext();
  }, [applyStudioContext, frameReady]);

  const continueToEnergy = () => {
    const snapshot = getWorkflowSnapshot();
    const supportedSurfaces = mapStudioSnapshotToSurfaces(snapshot);
    setConfiguredSurfaceCount(supportedSurfaces.length);
    if (supportedSurfaces.length === 0) {
      setConfigurationNotice(text.addProductBeforeEnergy);
      return;
    }
    setConfigurationNotice(null);
    onNavigate("energy");
  };

  const studyExtras = useCallback((): StudyRequestExtras => {
    const studioWindow = frameRef.current?.contentWindow as StudioWindow | null;
    const coordinates = context.location?.coordinates;
    const zone = coordinates ? studioWindow?.ModerniteLocationCore?.timezone?.(coordinates.lat, coordinates.lng, new Date().getUTCFullYear() - 1) : undefined;
    const north = studioWindow?.ModerniteEnergyApp?.getOrientation?.();
    return { timezone: zone?.tz, timezoneName: zone?.zone, buildingNorthDeg: Number.isFinite(north) ? north : undefined, weatherSource };
  }, [context.location, weatherSource]);

  const changeWeatherSource = useCallback((next: WeatherSourceKey) => {
    try {
      window.localStorage.setItem(WEATHER_SOURCE_STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable in private browsing; the choice still applies to this session.
    }
    setWeatherSource(next);
  }, []);

  const requestCalculation = useCallback(() => {
    const snapshot = getWorkflowSnapshot();
    const supportedSurfaces = mapStudioSnapshotToSurfaces(snapshot);
    setConfiguredSurfaceCount(supportedSurfaces.length);
    if (supportedSurfaces.length === 0) {
      setConfigurationNotice(text.addProductBeforeStudy);
      onNavigate("studio");
      return;
    }
    setConfigurationNotice(null);
    onRunCalculation(snapshot, snapshot === DEMO_STUDIO_SNAPSHOT ? { timezone: studyExtras().timezone } : studyExtras());
  }, [getWorkflowSnapshot, onNavigate, onRunCalculation, studyExtras, text.addProductBeforeStudy]);

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
        <div className="studio-bridge-journey" aria-label={text.studioProgressLabel}>
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
          <span className="studio-bridge-context__site"><MapPinned size={13} /> <i>{bridgeCopy.siteContext}</i> {market.shortName}{studioLocationLabel ? ` · ${studioLocationLabel}` : ""}</span>
          <label className="studio-language-control">
            <Globe2 size={13} aria-hidden="true" />
            <span className="sr-only">{text.workspace}</span>
            <select value={language} onChange={(event) => onLanguageChange(event.target.value as StudioLanguage)} aria-label={text.studioAriaLanguage}>
              {STUDIO_LANGUAGES.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
            </select>
            <ChevronDown size={12} aria-hidden="true" />
          </label>
          <span className="gateway-status"><i /> {text.workspace}</span>
          <button type="button" className="studio-return" onClick={() => onNavigate("location")}><ArrowLeft size={14} /> {bridgeCopy.returnToSite}</button>
          <button type="button" className="studio-calculate" onClick={continueToEnergy}><ArrowRight size={14} /> {bridgeCopy.prepareStudy}</button>
        </div>
      </header>
      <section className="studio-host-intro">
        <div className="studio-host-chapter" aria-hidden="true"><span>04</span><i /></div>
        <div>
          <p className="eyebrow">{text.studioStepEyebrow}</p>
          <h1>{text.studioTitle}</h1>
          <p>{text.studioIntro}</p>
        </div>
      </section>
      <section className="studio-host-context">
        <span className="studio-site-context"><MapPinned size={22} /><small>{text.currentSite}</small><b>{context.location ? cleanAddressLabel(context.location.label, language) : text.fallbackAddress}</b>{context.location && <span className="studio-weather-row"><label className="studio-weather-select"><SunMedium size={11} aria-hidden="true" /><span className="sr-only">Weather source</span><select value={weatherSource} onChange={(event) => changeWeatherSource(event.target.value as WeatherSourceKey)} aria-label="Weather source">{(Object.keys(WEATHER_SOURCE_LABELS) as WeatherSourceKey[]).map((key) => <option key={key} value={key}>{WEATHER_SOURCE_LABELS[key].short}</option>)}</select></label>{weatherState.status !== "idle" && <em className={`studio-weather-chip is-${weatherState.status}`} title={weatherState.label}>{weatherState.status === "ready" ? weatherState.label : weatherState.status === "loading" ? WEATHER_SOURCE_LABELS[weatherSource].loading : `${WEATHER_SOURCE_LABELS[weatherSource].short} unavailable · synthetic climate`}</em>}</span>}</span>
        <span><Globe2 size={22} /><small>{text.market}</small><b>{market.name}</b></span>
        <span><Home size={22} /><small>{text.studioProgress}</small><b>{text.activeSurfacesConfigured(configuredSurfaceCount || 4)}</b><i /></span>
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
        <div className="studio-aftercare-copy"><p className="mini-label">{text.configurationComplete}</p><h2>{text.nextEnergyTitle}</h2><p>{text.nextEnergyBody}</p></div>
        <button type="button" className="studio-aftercare-action" onClick={continueToEnergy}><span><small>{text.step05}</small><b>{text.homeEnergyCta}</b></span><ArrowRight size={17} /></button>
      </div>
      {studyReady && configuredSurfaceCount === 0 && <div className="studio-configuration-notice" role="status"><CircleHelp size={15} /><span><b>{text.configurationRequired}</b><small>{text.configurationRequiredBody}</small></span></div>}
      {configurationNotice && <div className="studio-configuration-notice is-alert" role="alert"><CircleHelp size={15} /><span><b>{text.calculationNotStarted}</b><small>{configurationNotice}</small></span></div>}
    </main>
  );
}

function CalculationLoadingPage({ error, onBack, language }: { error: string | null; onBack: () => void; language: StudioLanguage }) {
  const text = outerCopy(language);
  return (
    <section className="calculation-page" aria-live="polite">
      <div className="calculation-card">
        <div className="calculation-orbit" aria-hidden="true"><Orbit size={34} /></div>
        <p className="eyebrow"><Database size={14} /> {text.calculationEyebrow}</p>
        <h1>{error ? text.calculationErrorTitle : text.calculationTitle}</h1>
        <p>{error || text.calculationBody}</p>
        {!error && <div className="calculation-stages" aria-label="Calculation stages">
          {text.calculationStages.map((stage, index) => <span key={stage} className={index === 0 ? "is-active" : ""}><i /> {stage}</span>)}
        </div>}
        {error && <button type="button" className="button-primary" onClick={onBack}>{text.returnStudio} <ArrowLeft size={16} /></button>}
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

const ORIENTATION_SERIES = [
  ["South", "south", "#07573f"],
  ["East", "east", "#4d9b71"],
  ["West", "west", "#a5c979"],
  ["North", "north", "#79aeca"],
  ["Horizontal", "horizontal", "#f1b33d"],
] as const;

function MonthlyProfileChart({ study }: { study: ProjectCalculation }) {
  const [selectedMonth, setSelectedMonth] = useState(5);
  const entries = study.result.monthlyByOrientation;
  const max = Math.max(1, ...entries.map((entry) => entry.total));
  const selected = entries[selectedMonth] ?? entries[0];
  const topOrientation = selected
    ? ORIENTATION_SERIES.slice().sort(([, a], [, b]) => selected[b] - selected[a])[0]
    : ORIENTATION_SERIES[0];

  return <section className="result-section monthly-profile-card premium-chart-card">
    <div className="result-section-heading">
      <div><p className="mini-label">Monthly generation profile</p><h2>Seasonal output by solar orientation</h2></div>
      <span className="chart-total">{Math.round(study.result.range.representative).toLocaleString()} kWh/year</span>
    </div>
    <div className="orientation-legend">{ORIENTATION_SERIES.map(([label, , color]) => <span key={label}><i style={{ backgroundColor: color }} />{label}</span>)}</div>
    <div className="monthly-chart-stage">
      <svg className="monthly-profile-chart" viewBox="0 0 760 310" role="img" aria-label="Monthly energy generation stacked by south, east, west, north, and horizontal orientation">
        <defs>
          <linearGradient id="monthlyGlow" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#fff8da" stopOpacity=".9" /><stop offset="1" stopColor="#eaf6eb" stopOpacity=".15" /></linearGradient>
        </defs>
        <rect x="34" y="24" width="690" height="218" rx="18" fill="url(#monthlyGlow)" opacity=".6" />
        {[0.25, 0.5, 0.75, 1].map((ratio) => <line key={ratio} x1="58" y1={244 - ratio * 190} x2="710" y2={244 - ratio * 190} className="chart-grid" />)}
        <line x1="58" y1="244" x2="710" y2="244" className="chart-axis" />
        {entries.map((entry, index) => {
          const x = 70 + index * 53;
          const barWidth = 33;
          let y = 244;
          return <g key={entry.month} onClick={() => setSelectedMonth(index)} className={selectedMonth === index ? "is-selected" : ""}>
            <rect x={x - 5} y="38" width={barWidth + 10} height="206" rx="17" fill={selectedMonth === index ? "rgba(255,255,255,.72)" : "transparent"} />
            {ORIENTATION_SERIES.map(([label, key, color]) => {
              const height = (entry[key] / max) * 190;
              y -= height;
              return height > 0.45 ? <rect key={label} x={x} y={y} width={barWidth} height={height} rx={y < 60 ? 5 : 2} fill={color}><title>{`${entry.monthName}: ${label} ${Math.round(entry[key])} kWh`}</title></rect> : null;
            })}
            <circle cx={x + barWidth / 2} cy={Math.max(42, y - 10)} r={selectedMonth === index ? 4.6 : 0} fill="#f0b83a" />
            <text x={x + barWidth / 2} y="268" textAnchor="middle">{entry.monthName}</text>
          </g>;
        })}
      </svg>
      {selected && <aside className="month-inspector">
        <span>{selected.monthName}</span>
        <strong>{Math.round(selected.total).toLocaleString()} kWh</strong>
        <small>Largest share: {topOrientation[0]} · {Math.round(selected[topOrientation[1]]).toLocaleString()} kWh</small>
        <em>Click any month to inspect how the stacked bar is built from orientation outputs.</em>
      </aside>}
    </div>
    <p className="result-note"><CircleHelp size={14} /> Each bar is intentionally stacked by configured surface orientation, so the user can see whether seasonal value is coming from south roof planes, east/west balancing, north surfaces, or horizontal additions.</p>
  </section>;
}

function CashPositionChart({ scenarios, scenario }: { scenarios: FinancialScenario[]; scenario: FinancialScenario }) {
  const visible = scenarios.filter((item) => item.id !== "battery-only" && item.available && item.annualCashFlows.length > 0);
  const allValues = visible.flatMap((item) => item.annualCashFlows.map((flow) => flow.cumulativeNetGbp));
  const maxAbs = Math.max(1, ...allValues.map((value) => Math.abs(value)));
  const scenarioColors: Record<string, string> = { "solar-only": "#0c6249", "solar-battery": "#d6a226", "battery-only": "#789" };
  const pathFor = (item: FinancialScenario) => item.annualCashFlows.map((flow, index) => {
    const x = 54 + (index / Math.max(1, item.annualCashFlows.length - 1)) * 646;
    const y = 164 - (flow.cumulativeNetGbp / maxAbs) * 112;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  const selectedFinal = scenario.annualCashFlows.at(-1);

  return <section className="result-section cash-position-card premium-chart-card">
    <div className="result-section-heading"><div><p className="mini-label">25-year planning view</p><h2>Cash position, break-even, and scenario spread</h2></div><span className="cash-position-stat">{scenario.breakEvenYear ? `Break-even year ${scenario.breakEvenYear}` : "No break-even in the shown horizon"}</span></div>
    {visible.length > 0 ? <>
      <svg className="cash-position-chart" viewBox="0 0 760 242" role="img" aria-label={`Twenty-five year cumulative cash position for ${scenario.title}`}>
        <defs>
          <linearGradient id="cashPositive" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#f5cf61" stopOpacity=".35" /><stop offset="1" stopColor="#f5cf61" stopOpacity="0" /></linearGradient>
        </defs>
        <rect x="36" y="26" width="690" height="168" rx="18" fill="rgba(245,250,244,.82)" />
        {[0.25, 0.5, 0.75, 1].map((ratio) => <line key={ratio} x1="54" y1={164 - ratio * 112} x2="700" y2={164 - ratio * 112} className="chart-grid" />)}
        <line x1="54" y1="164" x2="700" y2="164" className="chart-axis" />
        {visible.map((item) => <path key={`${item.id}-glow`} d={pathFor(item)} className={`cash-position-line-glow ${item.id === scenario.id ? "is-selected" : ""}`} style={{ stroke: scenarioColors[item.id] }} />)}
        {visible.map((item) => <path key={item.id} d={pathFor(item)} className={`cash-position-line ${item.id === scenario.id ? "is-selected" : ""}`} style={{ stroke: scenarioColors[item.id] }} />)}
        {visible.map((item) => {
          const breakEvenYear = item.breakEvenYear;
          if (breakEvenYear === null) return null;
          const breakFlow = item.annualCashFlows.find((flow) => flow.year === breakEvenYear);
          if (!breakFlow) return null;
          const x = 54 + ((breakEvenYear - 1) / Math.max(1, item.annualCashFlows.length - 1)) * 646;
          const y = 164 - (breakFlow.cumulativeNetGbp / maxAbs) * 112;
          return <g key={`${item.id}-break`}><circle cx={x} cy={y} r={item.id === scenario.id ? 5.5 : 4} fill={scenarioColors[item.id]} stroke="#fff" strokeWidth="2" /><text x={x + 8} y={y - 8}>Y{breakEvenYear}</text></g>;
        })}
        <text x="54" y="220">Year 1</text><text x="700" y="220" textAnchor="end">Year 25</text>
      </svg>
      <div className="cash-position-values">
        <span><i>Selected scenario</i><b>{scenario.title}</b></span>
        <span><i>Year 25 cumulative</i><b>£{Math.round(selectedFinal?.cumulativeNetGbp ?? scenario.net25YearGbp).toLocaleString()}</b></span>
        <span><i>First-year benefit</i><b>£{Math.round(scenario.firstYearBenefitGbp).toLocaleString()}</b></span>
      </div>
      <div className="cash-scenario-legend">{visible.map((item) => <span key={item.id}><i style={{ backgroundColor: scenarioColors[item.id] }} />{item.title}</span>)}</div>
    </> : <p className="result-note">{scenario.unavailableReason ?? "Enter the requested project and battery prices in Design Studio to view this comparison."}</p>}
    <p className="result-note">This is an indicative planning scenario based on the inputs supplied. It is not an installation quotation or a guaranteed return.</p>
  </section>;
}

function ScenarioComparisonPanel({ scenarios, scenario, onSelect }: { scenarios: FinancialScenario[]; scenario: FinancialScenario; onSelect: (id: string) => void }) {
  const visible = scenarios.filter((item) => item.id !== "battery-only");
  return <section className="result-section scenario-comparison-panel scenario-premium-panel"><div className="result-section-heading"><div><p className="mini-label">Solar and storage options</p><h2>Choose the planning case to inspect.</h2></div><span className="validation-status ready">25-year view</span></div><div className="scenario-options">{visible.map((item) => <button key={item.id} type="button" className={`${scenario.id === item.id ? "is-selected" : ""} ${!item.available ? "is-unavailable" : ""}`} onClick={() => onSelect(item.id)}><span>{item.id === "solar-battery" ? <BatteryCharging size={17} /> : <SunMedium size={17} />}</span><div><b>{item.title}</b><small>{item.available ? `${item.breakEvenYear ? `Break-even year ${item.breakEvenYear}` : "Planning comparison"} · £${Math.round(item.net25YearGbp).toLocaleString()} by year 25` : item.unavailableReason}</small></div></button>)}</div><p className="result-note"><ShieldCheck size={14} /> Battery value is shown as an editable planning comparison, while the generation figure stays anchored to the configured BIPV surfaces.</p></section>;
}

function EnergyFlowPanel({ study, scenario }: { study: ProjectCalculation; scenario: FinancialScenario }) {
  const firstYear = scenario.annualCashFlows[0];
  const generation = study.result.range.representative;
  const directUse = firstYear?.directUseKwh ?? generation * 0.38;
  const exported = firstYear?.exportKwh ?? Math.max(0, generation - directUse);
  const storageValue = scenario.id === "solar-battery" ? Math.max(0, generation - directUse - exported) : 0;
  const total = Math.max(1, directUse + exported + storageValue);
  const flows = [
    { label: "Used at home", value: directUse, color: "#0b6047", detail: "Offsets imported electricity" },
    { label: "Exported", value: exported, color: "#8fbf79", detail: "Sent to grid at export rate" },
    { label: "Battery shifted", value: storageValue, color: "#efba45", detail: scenario.id === "solar-battery" ? "Stored for evening use" : "Enable battery to model storage" },
  ];
  return <section className="result-section energy-flow-panel">
    <div className="result-section-heading"><div><p className="mini-label">Energy flow</p><h2>Where the generated electricity goes</h2></div><span className="chart-total">{Math.round(generation).toLocaleString()} kWh/year</span></div>
    <div className="energy-flow-visual">
      <div className="energy-flow-source"><SunMedium size={25} /><strong>{Math.round(generation).toLocaleString()}</strong><small>Generated</small></div>
      <div className="energy-flow-bars">{flows.map((flow) => <article key={flow.label} style={{ ["--flow-color" as string]: flow.color, ["--flow-width" as string]: `${Math.max(5, (flow.value / total) * 100)}%` }}><span><i /></span><div><b>{flow.label}</b><strong>{Math.round(flow.value).toLocaleString()} kWh</strong><small>{flow.detail}</small></div></article>)}</div>
    </div>
  </section>;
}

function EnergyAppliedChain({ study, scenario, onNavigate }: { study: ProjectCalculation; scenario: FinancialScenario; onNavigate: (route: GatewayRoute) => void }) {
  const firstYear = scenario.annualCashFlows[0];
  const directUse = firstYear?.directUseKwh ?? 0;
  const exported = firstYear?.exportKwh ?? 0;
  const value = (firstYear?.billSavingGbp ?? 0) + (firstYear?.exportIncomeGbp ?? 0) + (firstYear?.arbitrageIncomeGbp ?? 0);
  const directPercent = Math.round((directUse / Math.max(1, study.energy.annualDemandKwh)) * 100);
  const keptPercent = Math.round((directUse / Math.max(1, study.result.range.representative)) * 100);
  return <section className="result-section energy-applied-chain"><div className="result-section-heading"><div><p className="mini-label">Your energy answers · applied</p><h2>How household inputs shape the value case</h2></div><button type="button" onClick={() => onNavigate("energy")}><Pencil size={14} /> Edit energy inputs</button></div><div className="applied-chain-grid"><article><span><Home size={17} /></span><p>01 · Household</p><strong>{Math.round(study.energy.annualDemandKwh).toLocaleString()} kWh/year</strong><small>{study.energy.note}</small></article><i><ArrowRight size={18} /></i><article><span><SunMedium size={17} /></span><p>02 · Self-use and export</p><strong>{Math.round(directUse).toLocaleString()} used · {Math.round(exported).toLocaleString()} exported</strong><small>{directPercent}% of annual demand met directly by solar · {keptPercent}% of generation kept at home.</small></article><i><ArrowRight size={18} /></i><article className="is-highlighted"><span><TrendingUp size={17} /></span><p>03 · Estimated value</p><strong>£{Math.round(value).toLocaleString()} / year</strong><small>{scenario.breakEvenYear ? `${scenario.breakEvenYear}-year simple break-even` : "Long-term planning case"} on £{Math.round(scenario.upfrontGbp).toLocaleString()} estimated cost.</small></article></div><p className="result-note"><Gauge size={14} /> Calculation first, explanation second. The figures above are calculated from project inputs; the Design Guide explains them without changing the numbers.</p></section>;
}

function GenerationRangeCard({ study, scenario }: { study: ProjectCalculation; scenario: FinancialScenario }) {
  const range = study.result.range;
  const band = Math.max(1, range.high - range.low);
  const representativePosition = ((range.representative - range.low) / band) * 100;
  return <section className="result-section generation-range-card generation-hero-card">
    <div className="range-card-top"><div><p className="mini-label">Project study result</p><strong>{range.representative.toLocaleString()} <small>kWh / year</small></strong><p>Representative annual generation from {study.result.surfaces.length} configured BIPV surfaces.</p></div><span><i /> Customer V31 model · {study.weather.kind === "customer-synthetic" ? "synthetic climate" : study.weather.kind === "nasa-power" ? "NASA POWER weather" : "PVGIS weather"}</span></div>
    <div className="range-insight-grid">
      <div className="range-window"><div className="range-window-head"><span>Annual estimate range</span><b>{range.low.toLocaleString()} – {range.high.toLocaleString()} kWh / year</b></div><div className="range-points"><span><i>Low</i><b>{range.low.toLocaleString()}</b></span><span className="is-main"><i>Representative</i><b>{range.representative.toLocaleString()}</b></span><span><i>High</i><b>{range.high.toLocaleString()}</b></span></div><div className="range-track"><em style={{ left: "0%" }} /><strong style={{ left: `${representativePosition}%` }} /><em style={{ left: "100%" }} /></div><p>Use this range to discuss conservative, representative, and upper planning cases.</p></div>
      <div className="hero-result-metrics">
        <article><span><BarChart3 size={18} /></span><small>Configured capacity</small><b>{study.result.totalCapacityKwp.toFixed(2)} kWp</b></article>
        <article><span><Zap size={18} /></span><small>First-year value</small><b>£{Math.round(scenario.firstYearBenefitGbp).toLocaleString()}</b></article>
        <article><span><LineChart size={18} /></span><small>25-year view</small><b>£{Math.round(scenario.net25YearGbp).toLocaleString()}</b></article>
      </div>
    </div>
  </section>;
}

function ResultsPage({ study, preferredBatteryMode, onNavigate, language }: { study: ProjectCalculation; preferredBatteryMode: HomeEnergySettings["batteryMode"]; onNavigate: (route: GatewayRoute) => void; language: StudioLanguage }) {
  const text = outerCopy(language);
  const recommended = study.result.surfaces.slice().sort((a: SurfaceResult, b: SurfaceResult) => b.annualKwh - a.annualKwh)[0];
  const [scenarioId, setScenarioId] = useState(preferredBatteryMode === "solar-battery" ? "solar-battery" : "solar-only");
  const scenario = study.result.scenarios.find((item) => item.id === scenarioId) ?? study.result.scenarios[0]!;
  const demandLabel = study.energy.source === "bill" ? "Calibrated to your energy bill" : "Customer building energy model";
  const sim = study.simulation;
  const solar = study.googleSolar;
  return (
    <section className="results-page gateway-page">
      <div className="results-topline"><div><button className="back-link" type="button" onClick={() => onNavigate("energy")}><ArrowLeft size={15} /> {text.resultsBack}</button><p className="eyebrow"><Sparkles size={14} /> {text.resultsEyebrow}</p><h1>{text.resultsTitle}</h1><p>{text.resultsIntro}</p></div><div className="result-case"><span>{text.studyReference}</span><strong>{study.caseId}</strong><small>{new Date(study.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</small></div></div>
      <div className="results-layout"><main className="results-report">
        <GenerationRangeCard study={study} scenario={scenario} />
        <div className="result-main-grid">
          <section className="result-section energy-demand-card"><div><p className="mini-label">Household energy context</p><h2>{Math.round(study.energy.annualDemandKwh).toLocaleString()} kWh/year</h2><p>{demandLabel} · {study.energy.note}</p></div><button type="button" onClick={() => onNavigate("energy")}>Update household energy <ArrowRight size={14} /></button></section>
          <section className="result-section result-capacity-tile"><span><BarChart3 size={20} /></span><p className="mini-label">Configured capacity</p><h2>{study.result.totalCapacityKwp.toFixed(2)} kWp</h2><p>{study.result.surfaces.length} active solar surfaces.</p></section>
        </div>
        <EnergyAppliedChain study={study} scenario={scenario} onNavigate={onNavigate} />
        <EnergyFlowPanel study={study} scenario={scenario} />
        <MonthlyProfileChart study={study} />
        <ScenarioComparisonPanel scenarios={study.result.scenarios} scenario={scenario} onSelect={setScenarioId} />
        <CashPositionChart scenarios={study.result.scenarios} scenario={scenario} />
        <section className="result-section"><div className="result-section-heading"><div><p className="mini-label">Calculation basis</p><h2>{study.weather.kind === "nasa-power" ? "Customer V31 hourly model · NASA POWER weather" : study.weather.kind === "pvgis-tmy" ? "Customer V31 hourly model · PVGIS weather" : "Customer V31 hourly model · synthetic climate"}</h2></div><span className={`validation-status ${study.validation.status}`}>{study.weather.kind === "customer-synthetic" ? "Indicative" : "Site weather"}</span></div><div className="validation-grid"><div><span>Annual generation</span><strong>{study.validation.empiricalAnnualKwh.toLocaleString()} kWh/year</strong></div><div><span>Hourly weather</span><strong>{study.weather.source}</strong></div><div><span>Horizontal irradiation</span><strong>GHI {study.weather.annualGhiKwhM2} · DNI {study.weather.annualDniKwhM2} · DHI {study.weather.annualDhiKwhM2} kWh/m²</strong></div><div><span>Solar used on site</span><strong>{Math.round(sim.selfConsumption * 100)}% self-consumption · {Math.round(sim.selfSufficiency * 100)}% self-sufficiency</strong></div><div><span>With {sim.battery.nominalKwh} kWh battery</span><strong>{Math.round(sim.battery.selfConsumedKwh).toLocaleString()} kWh used on site</strong></div><div><span>Inverter (≤1% clipping)</span><strong>{sim.inverterKw} kW · recommended battery {sim.recommendedBatteryKwh} kWh</strong></div></div><p className="result-note">{study.validation.note}</p></section>
        {solar && <section className="result-section"><div className="result-section-heading"><div><p className="mini-label">External reference</p><h2>Google Solar roof model</h2></div><span className={`validation-status ${solar.status}`}>{solar.status === "ok" ? `${solar.imageryQuality ?? ""} imagery` : "Unavailable"}</span></div>{solar.status === "ok" ? <><div className="validation-grid"><div><span>Roof segments</span><strong>{solar.roofSegments?.length ?? 0}</strong></div><div><span>Usable panel area</span><strong>{solar.maxArrayAreaM2 ?? "—"} m²</strong></div><div><span>Peak sunshine</span><strong>{solar.maxSunshineHoursPerYear ?? "—"} h/year</strong></div></div><div className="surface-list">{(solar.roofSegments ?? []).slice(0, 6).map((segment, index) => <article className="surface-row" key={index}><div><strong>Segment {index + 1}</strong><span>{segment.pitchDeg}° pitch · {segment.azimuthDeg}° azimuth</span></div><span>{segment.areaM2} m²</span><b>{segment.sunshineMedianHoursPerYear ?? "—"} h/year</b></article>)}</div></> : null}<p className="result-note">{solar.note}{solar.distanceM !== undefined ? ` Nearest modelled building is ${solar.distanceM} m from the pin.` : ""}</p></section>}
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
    setContext((current) => ({ ...current, location, buildingMatch: null, updatedAt: Date.now() }));
  }, []);

  const updateBuildingMatch = useCallback((buildingMatch: BuildingMatch | null) => {
    setContext((current) => ({ ...current, buildingMatch, updatedAt: Date.now() }));
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

  const startCalculation = useCallback(async (studioSnapshot: StudioCalculationSnapshot, extras: StudyRequestExtras = {}) => {
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
        address: cleanAddressLabel(context.location.label, studioLanguage),
        coordinates: context.location.coordinates,
        ...extras,
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
        const demoStudy = createDemoStudy(context, studioSnapshot, extras);
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
        {route === "entry" && <EntryPage copy={copy} language={studioLanguage} onLanguageChange={setStudioLanguage} onStart={beginProject} onNavigate={navigate} />}
        {route === "market" && <MarketPage market={market} europeanCountry={context.europeanCountry} copy={copy} onMarketChange={updateMarket} onEuropeanCountryChange={updateEuropeanCountry} onNavigate={navigate} />}
        {route === "location" && <LocationPage language={studioLanguage} market={market} context={context} copy={copy} onLocationChange={updateLocation} onAreaChange={updateSiteArea} onBuildingMatchChange={updateBuildingMatch} onNavigate={navigate} />}
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
          language={studioLanguage}
        />}
        {route === "calculation" && <CalculationLoadingPage error={calculationError} onBack={() => navigate("studio")} language={studioLanguage} />}
        {route === "results" && study && <ResultsPage study={study} preferredBatteryMode={context.energySettings.batteryMode} onNavigate={navigate} language={studioLanguage} />}
        {route === "results" && !study && <CalculationLoadingPage error="No active project study is available. Return to Design Studio and prepare a new study." onBack={() => navigate("studio")} language={studioLanguage} />}
      </main>}
      {studioMounted && <StudioPage active={route === "studio"} market={market} context={context} language={studioLanguage} onLanguageChange={setStudioLanguage} onNavigate={navigate} onRunCalculation={startCalculation} />}
      {(["studio", "energy", "calculation", "results"] as GatewayRoute[]).includes(route) && <PersistentStudyAssistant route={route} study={study} />}
    </>
  );
}
