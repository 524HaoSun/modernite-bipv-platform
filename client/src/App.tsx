import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Link2,
  Loader2,
  Maximize2,
  Minimize2,
  BarChart3,
  BatteryCharging,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Cpu,
  Compass,
  Database,
  Download,
  FileText,
  Gauge,
  Globe2,
  Home,
  Layers3,
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
import { BuildingProfileCard, buildingTypeLabel, type AppliedBuilding } from "@/components/BuildingProfileCard";
import { studioDimensions } from "../../lib/building-profile";
import { MARKET_TO_STUDIO_REGION, studioTypeById } from "../../lib/studio-catalog";
import { resultsCopy } from "@/lib/results-copy";
import { regionName } from "@/lib/region-names";
import { WORKFLOW_LABELS } from "@/lib/workflow-labels";
import { PageIntro } from "@/components/PageIntro";
import { AdvisorHeaderButton, ModerniteAdvisor } from "@/components/ModerniteAdvisor";
import { ProjectLocationMap, cleanAddressLabel, geocodeLanguage, pointInPath, useMapsKey, usePrewarmLocationMap, type AddressMatch, type BuildingPicker, type MapBuildingCandidate, type Market, type MarketKey, type ProjectLocationSelection, type SiteAreaSelection, type SiteDetection, type SunHeatmap } from "@/components/ProjectLocationMap";
import { AddressGate } from "@/components/AddressGate";
import { StudioTour } from "@/components/StudioTour";
import { STUDIO_GUIDE_COPY } from "@/lib/studio-guide-copy";
import { shareCopy } from "@/lib/share-copy";
import { googleNearbyAddresses } from "@/lib/google-maps";
import type { MarketAtlasCopy } from "@/components/MarketAtlas";
import { EUROPEAN_MARKETS, type EuropeanMarket } from "@/lib/european-markets";

const MarketAtlas = lazy(() => import("@/components/MarketAtlas").then((module) => ({ default: module.MarketAtlas })));
const GoogleSiteViewer = lazy(() => import("@/components/GoogleSiteViewer").then((module) => ({ default: module.GoogleSiteViewer })));
const ResultsPage = lazy(() => import("@/components/ResultsReport").then((module) => ({ default: module.ResultsPage })));
import { publicPath } from "@/lib/paths";
import { trpc } from "@/lib/trpc";
import type { ProjectCalculation } from "../../server/estimate-service";
import { runCustomerStudy, syntheticWeatherFor } from "../../lib/customer-study";
import type { Weather } from "../../lib/customer-energy-core";
import { expandWeather, type CompactWeather } from "../../lib/pvgis-tmy";
import { estimateAnnualDemandKwh, mapStudioSnapshotToSurfaces, planningCosts, regionForMarket, type HomeEnergySettings, type StudioCalculationSnapshot } from "../../lib/studio-calculation";
import { REGION_CONFIG } from "../../data/constants";
import type { FinancialScenario, LedgerEntry, SurfaceResult } from "../../types/solar";

const CUSTOMER_STUDIO_URL = publicPath("studio.html?embed=modernite");
const STUDIO_ADVISOR_PATH = publicPath("api/studio-advisor");
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
  building?: AppliedBuilding | null;
  energySettings: HomeEnergySettings;
  updatedAt: number;
};

type StudioDimensions = { width: number; depth: number; floors: number; storeyHeight: number; wwr: number; units?: number; roofForm?: string; pitch?: number };
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
  projectPriceGbp: null,
  batteryPriceGbp: null,
};

function withoutLegacyPriceDefaults(settings: Partial<HomeEnergySettings> | undefined): Partial<HomeEnergySettings> {
  if (!settings || settings.projectPriceGbp !== 16000 || settings.batteryPriceGbp !== 5800) return settings ?? {};
  return { ...settings, projectPriceGbp: null, batteryPriceGbp: null };
}

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
const STUDIO_TOUR_STORAGE_KEY = "modernite-studio-tour-v1";
const DETECTED_SOURCES = new Set(["osm", "google-solar", "google-elevation", "estimated"]);
function isDetectedBuilding(building: AppliedBuilding) {
  return Object.values(building.sources).some((source) => DETECTED_SOURCES.has(source));
}
/** The sample address only seeds demo studies; the location step asks for a real address instead. */
function isSampleLocation(location: ProjectLocationSelection | null | undefined) {
  return !location || (Math.abs(location.coordinates.lat - DEFAULT_PROJECT_LOCATION.coordinates.lat) < 1e-6 && Math.abs(location.coordinates.lng - DEFAULT_PROJECT_LOCATION.coordinates.lng) < 1e-6);
}
/** Drops a stored outline that does not belong to the stored pin (older builds kept a sample outline). */
function siteAreaNear(area: SiteAreaSelection | null | undefined, location: ProjectLocationSelection | null | undefined): SiteAreaSelection | null {
  if (!area?.path?.length || !location) return null;
  const lat = area.path.reduce((sum, point) => sum + point.lat, 0) / area.path.length;
  const lng = area.path.reduce((sum, point) => sum + point.lng, 0) / area.path.length;
  const dy = (lat - location.coordinates.lat) * 111_320;
  const dx = (lng - location.coordinates.lng) * 111_320 * Math.cos((lat * Math.PI) / 180);
  return Math.hypot(dx, dy) <= 300 ? area : null;
}
const DEMO_STUDIO_SNAPSHOT: StudioCalculationSnapshot = {
  building: { id: "UK01", width: 10.8, depth: 8.5, floors: 2, storeyHeight: 2.95, usage: "residential" },
  surfaces: [
    { id: "roof_south", product: "roof_tiles", profile: "windsor_black", area: 42, tilt: 31, az: 180, enabled: true, role: "none", linked: false },
    { id: "roof_east", product: "roof_tiles", profile: "windsor_black", area: 19, tilt: 31, az: 105, enabled: true, role: "none", linked: false },
    { id: "facade_south", product: "facade", profile: "facade_grey", area: 12, tilt: 90, az: 180, enabled: true, role: "none", linked: false },
    { id: "railing_west", product: "railing", profile: "railing", area: 6, tilt: 90, az: 270, enabled: true, role: "none", linked: false },
  ],
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
    project: "Project", market: "Market", location: "Location", workspace: "Project workspace", back: "Back", marketStep: "Market selection", marketTitle: "Choose the project context.", marketIntro: "Turn the globe to explore available markets. Europe opens to a country-level selection before you locate the property.", entryEyebrow: "Build a brighter tomorrow", entryTitle: "Start your building-integrated", entryEmphasis: "solar project.", entryLede: "Turn your vision into a sustainable building with integrated solar design.", start: "Start a new project", resume: "Resume project", marketContext: "Market context", siteLocation: "Site location", buildingStudy: "Building study", locationStep: "Site selection", locationTitle: "Place the project.", addressSearch: "Search an address or postcode in", locate: "Locate", projectContext: "Project context", locationEmpty: "Search an address or rotate to place a site on the map.", locationHelp: "The selected address and coordinates are handed directly to the customer Studio location controls. Returning here does not discard your active Studio session.", confirmMarket: "Confirm market", setLocation: "Set project location", openStudio: "Open Solar Studio", coverage: "Service coverage", dragHint: "Drag to rotate the globe", library: "Market library", selected: "Selected market", selectCountry: "Select a country", selectedCountry: "Selected country", countriesAvailable: "countries available", chooseMarket: "Choose an illuminated market on the globe or from the library.", chooseCountry: "Choose a country from the globe or the European library.", continue: "Continue to location", world: "World", europe: "Europe", europeDirectory: "European country library", filterCountries: "Filter countries", resetGlobe: "Reset globe view", marketsAria: "Available markets", globeAria: "Interactive market globe — drag to rotate", selectAria: (n) => `Select ${n}`, available: "Available", selectedTag: "Selected", unavailable: "Unavailable", studyNote: "Building forms are scoped to this market. The customer product library remains unchanged.",
  },
  zh: {
    project: "项目", market: "市场", location: "位置", workspace: "项目工作区", back: "返回", marketStep: "步骤 01 · 市场", marketTitle: "选择项目区域。", marketIntro: "旋转地球探索可用市场；选择欧洲后，可在定位之前进一步选择具体国家。", entryEyebrow: "项目准备", entryTitle: "让建筑", entryEmphasis: "成为方案本身。", entryLede: "选择项目市场、定位场地，然后直接使用客户提供的建筑与产品库。", start: "开始项目", resume: "继续项目", marketContext: "市场背景", siteLocation: "场地位置", buildingStudy: "建筑研究", locationStep: "步骤 02 · 位置", locationTitle: "定位项目。", addressSearch: "在以下区域搜索地址或邮编：", locate: "定位", projectContext: "项目背景", locationEmpty: "搜索地址，或在地图上旋转并放置项目地点。", locationHelp: "所选地址和坐标会直接传递到客户 Studio 的位置控件。返回此处不会丢失当前 Studio 会话。", confirmMarket: "确认市场", setLocation: "设置项目位置", openStudio: "打开 Solar Studio", coverage: "服务范围", dragHint: "拖动以旋转地球", library: "市场目录", selected: "已选市场", selectCountry: "选择国家", selectedCountry: "已选国家", countriesAvailable: "个国家可用", chooseMarket: "在地球或目录中选择已点亮的市场。", chooseCountry: "在地球或欧洲目录中选择国家。", continue: "继续至位置", world: "世界", europe: "欧洲", europeDirectory: "欧洲国家目录", filterCountries: "筛选国家", resetGlobe: "重置地球视图", marketsAria: "可选市场", globeAria: "可旋转的市场地球", selectAria: (n) => `选择${n}`, available: "可用", selectedTag: "已选", unavailable: "未开放", studyNote: "建筑形式将限定在所选市场；客户产品库保持不变。",
  },
  "zh-Hant": {
    project: "專案", market: "市場", location: "位置", workspace: "專案工作區", back: "返回", marketStep: "步驟 01 · 市場", marketTitle: "選擇專案區域。", marketIntro: "旋轉地球探索可用市場；選擇歐洲後，可在定位之前進一步選擇具體國家。", entryEyebrow: "專案準備", entryTitle: "讓建築", entryEmphasis: "成為方案本身。", entryLede: "選擇專案市場、定位場地，然後直接使用客戶提供的建築與產品庫。", start: "開始專案", resume: "繼續專案", marketContext: "市場背景", siteLocation: "場地位置", buildingStudy: "建築研究", locationStep: "步驟 02 · 位置", locationTitle: "定位專案。", addressSearch: "在以下區域搜尋地址或郵遞區號：", locate: "定位", projectContext: "專案背景", locationEmpty: "搜尋地址，或在地圖上旋轉並放置專案地點。", locationHelp: "所選地址和座標會直接傳遞到客戶 Studio 的位置控制項。返回此處不會遺失目前 Studio 工作階段。", confirmMarket: "確認市場", setLocation: "設定專案位置", openStudio: "開啟 Solar Studio", coverage: "服務範圍", dragHint: "拖曳以旋轉地球", library: "市場目錄", selected: "已選市場", selectCountry: "選擇國家", selectedCountry: "已選國家", countriesAvailable: "個國家可用", chooseMarket: "在地球或目錄中選擇已點亮的市場。", chooseCountry: "在地球或歐洲目錄中選擇國家。", continue: "繼續至位置", world: "世界", europe: "歐洲", europeDirectory: "歐洲國家目錄", filterCountries: "篩選國家", resetGlobe: "重設地球視圖", marketsAria: "可選市場", globeAria: "可旋轉的市場地球", selectAria: (n) => `選擇${n}`, available: "可用", selectedTag: "已選", unavailable: "未開放", studyNote: "建築形式將限定在所選市場；客戶產品庫保持不變。",
  },
  fr: {
    project: "Projet", market: "Marché", location: "Localisation", workspace: "Espace projet", back: "Retour", marketStep: "Étape 01 · Marché", marketTitle: "Choisissez le contexte du projet.", marketIntro: "Faites tourner le globe pour explorer les marchés disponibles. L'Europe ouvre une sélection par pays avant la localisation du bien.", entryEyebrow: "Préparation du projet", entryTitle: "Faites du bâtiment", entryEmphasis: "le point de départ.", entryLede: "Sélectionnez le marché, localisez le site, puis travaillez avec la bibliothèque de bâtiments et de produits fournie.", start: "Démarrer un projet", resume: "Reprendre le projet", marketContext: "Contexte du marché", siteLocation: "Localisation du site", buildingStudy: "Étude du bâtiment", locationStep: "Étape 02 · Localisation", locationTitle: "Placez le projet.", addressSearch: "Rechercher une adresse ou un code postal dans", locate: "Localiser", projectContext: "Contexte du projet", locationEmpty: "Recherchez une adresse ou placez un site directement sur la carte.", locationHelp: "L'adresse et les coordonnées sélectionnées sont transmises directement aux commandes de localisation du Studio client. Revenir ici ne supprime pas votre session Studio active.", confirmMarket: "Confirmer le marché", setLocation: "Définir la localisation", openStudio: "Ouvrir Solar Studio", coverage: "Couverture du service", dragHint: "Faites glisser pour tourner le globe", library: "Bibliothèque des marchés", selected: "Marché sélectionné", selectCountry: "Sélectionner un pays", selectedCountry: "Pays sélectionné", countriesAvailable: "pays disponibles", chooseMarket: "Choisissez un marché illuminé sur le globe ou dans la bibliothèque.", chooseCountry: "Choisissez un pays sur le globe ou dans la bibliothèque européenne.", continue: "Continuer vers la localisation", world: "Monde", europe: "Europe", europeDirectory: "Bibliothèque des pays européens", filterCountries: "Filtrer les pays", resetGlobe: "Réinitialiser le globe", marketsAria: "Marchés disponibles", globeAria: "Globe interactif des marchés — faites-le glisser pour le tourner", selectAria: (n) => `Sélectionner ${n}`, available: "Disponible", selectedTag: "Sélectionné", unavailable: "Indisponible", studyNote: "Les formes de bâtiment sont limitées au marché sélectionné. La bibliothèque de produits client reste inchangée.",
  },
  ja: {
    project: "プロジェクト", market: "市場", location: "所在地", workspace: "プロジェクトワークスペース", back: "戻る", marketStep: "ステップ 01 · 市場", marketTitle: "プロジェクト地域を選択。", marketIntro: "地球を回して利用可能な市場を探索します。ヨーロッパを選択すると、所在地を設定する前に国を選べます。", entryEyebrow: "プロジェクト準備", entryTitle: "建築を", entryEmphasis: "計画の中心に。", entryLede: "市場を選択し、サイトを特定してから、提供された建築・製品ライブラリを直接使用します。", start: "プロジェクトを開始", resume: "プロジェクトを再開", marketContext: "市場コンテキスト", siteLocation: "サイト所在地", buildingStudy: "建築スタディ", locationStep: "ステップ 02 · 所在地", locationTitle: "プロジェクトを配置。", addressSearch: "次の地域で住所または郵便番号を検索：", locate: "検索", projectContext: "プロジェクトコンテキスト", locationEmpty: "住所を検索するか、地図上でサイトを指定してください。", locationHelp: "選択した住所と座標は、顧客 Studio の所在地コントロールに直接渡されます。ここに戻っても現在の Studio セッションは失われません。", confirmMarket: "市場を確認", setLocation: "所在地を設定", openStudio: "Solar Studio を開く", coverage: "サービス対象地域", dragHint: "ドラッグして地球を回転", library: "市場ライブラリ", selected: "選択した市場", selectCountry: "国を選択", selectedCountry: "選択した国", countriesAvailable: "か国が利用可能", chooseMarket: "地球またはライブラリから点灯している市場を選択します。", chooseCountry: "地球またはヨーロッパのライブラリから国を選択します。", continue: "所在地へ進む", world: "世界", europe: "ヨーロッパ", europeDirectory: "ヨーロッパ国ライブラリ", filterCountries: "国を絞り込む", resetGlobe: "地球表示をリセット", marketsAria: "利用可能な市場", globeAria: "市場の地球儀（ドラッグで回転）", selectAria: (n) => `${n}を選択`, available: "利用可能", selectedTag: "選択中", unavailable: "対象外", studyNote: "建築形式は選択した市場に限定されます。顧客製品ライブラリは変更されません。",
  },
  es: {
    project: "Proyecto", market: "Mercado", location: "Ubicación", workspace: "Espacio del proyecto", back: "Volver", marketStep: "Paso 01 · Mercado", marketTitle: "Elija el contexto del proyecto.", marketIntro: "Gire el globo para explorar los mercados disponibles. Europa abre una selección por país antes de ubicar la propiedad.", entryEyebrow: "Preparación del proyecto", entryTitle: "Haga del edificio", entryEmphasis: "el punto de partida.", entryLede: "Elija el mercado, localice el sitio y trabaje directamente con la biblioteca de edificios y productos proporcionada.", start: "Iniciar un proyecto", resume: "Reanudar proyecto", marketContext: "Contexto del mercado", siteLocation: "Ubicación del sitio", buildingStudy: "Estudio del edificio", locationStep: "Paso 02 · Ubicación", locationTitle: "Ubique el proyecto.", addressSearch: "Buscar una dirección o código postal en", locate: "Localizar", projectContext: "Contexto del proyecto", locationEmpty: "Busque una dirección o coloque un sitio directamente en el mapa.", locationHelp: "La dirección y las coordenadas seleccionadas se transfieren directamente a los controles de ubicación del Studio del cliente. Volver aquí no descarta la sesión activa del Studio.", confirmMarket: "Confirmar mercado", setLocation: "Definir ubicación", openStudio: "Abrir Solar Studio", coverage: "Cobertura de servicio", dragHint: "Arrastre para girar el globo", library: "Biblioteca de mercados", selected: "Mercado seleccionado", selectCountry: "Seleccione un país", selectedCountry: "País seleccionado", countriesAvailable: "países disponibles", chooseMarket: "Elija un mercado iluminado en el globo o en la biblioteca.", chooseCountry: "Elija un país en el globo o en la biblioteca europea.", continue: "Continuar a ubicación", world: "Mundo", europe: "Europa", europeDirectory: "Biblioteca de países europeos", filterCountries: "Filtrar países", resetGlobe: "Restablecer vista del globo", marketsAria: "Mercados disponibles", globeAria: "Globo interactivo de mercados: arrástralo para girarlo", selectAria: (n) => `Seleccionar ${n}`, available: "Disponible", selectedTag: "Seleccionado", unavailable: "No disponible", studyNote: "Las formas de edificio se limitan al mercado seleccionado. La biblioteca de productos del cliente no cambia.",
  },
  it: {
    project: "Progetto", market: "Mercato", location: "Posizione", workspace: "Spazio di lavoro", back: "Indietro", marketStep: "Fase 01 · Mercato", marketTitle: "Scegli il contesto del progetto.", marketIntro: "Ruota il globo per esplorare i mercati disponibili. L'Europa apre una selezione per paese prima di localizzare l'immobile.", entryEyebrow: "Preparazione del progetto", entryTitle: "Fai dell'edificio", entryEmphasis: "il punto di partenza.", entryLede: "Seleziona il mercato, individua il sito e lavora direttamente con la libreria di edifici e prodotti fornita.", start: "Avvia un progetto", resume: "Riprendi progetto", marketContext: "Contesto del mercato", siteLocation: "Posizione del sito", buildingStudy: "Studio dell'edificio", locationStep: "Fase 02 · Posizione", locationTitle: "Posiziona il progetto.", addressSearch: "Cerca un indirizzo o CAP in", locate: "Localizza", projectContext: "Contesto del progetto", locationEmpty: "Cerca un indirizzo o posiziona un sito direttamente sulla mappa.", locationHelp: "L'indirizzo e le coordinate selezionati vengono trasferiti direttamente ai controlli di posizione dello Studio del cliente. Tornare qui non elimina la sessione Studio attiva.", confirmMarket: "Conferma il mercato", setLocation: "Imposta la posizione", openStudio: "Apri Solar Studio", coverage: "Copertura del servizio", dragHint: "Trascina per ruotare il globo", library: "Libreria dei mercati", selected: "Mercato selezionato", selectCountry: "Seleziona un paese", selectedCountry: "Paese selezionato", countriesAvailable: "paesi disponibili", chooseMarket: "Scegli un mercato illuminato sul globo o nella libreria.", chooseCountry: "Scegli un paese sul globo o nella libreria europea.", continue: "Continua alla posizione", world: "Mondo", europe: "Europa", europeDirectory: "Libreria dei paesi europei", filterCountries: "Filtra paesi", resetGlobe: "Reimposta il globo", marketsAria: "Mercati disponibili", globeAria: "Globo interattivo dei mercati: trascina per ruotarlo", selectAria: (n) => `Seleziona ${n}`, available: "Disponibile", selectedTag: "Selezionato", unavailable: "Non disponibile", studyNote: "Le forme edilizie sono limitate al mercato selezionato. La libreria di prodotti del cliente resta invariata.",
  },
};

const LOCATION_PAGE_TEXT: Record<StudioLanguage, { title: string; intro: string; selectedMarket: string; siteBrief: string; market: string; area: string; boundary: string; notTraced: string; awaiting: string; confirmed: string; pinpoint: string; trace: string; continue: string; retain: string; continueStudio: string }> = {
  en: { title: "Find the building, outline the site.", intro: "Enter a postcode or address, then tap your building on the satellite view. Its outline and dimensions are detected automatically; trace by hand only where nothing is found.", selectedMarket: "Selected market", siteBrief: "Site brief", market: "Market", area: "Site area", boundary: "Boundary", notTraced: "Not set", awaiting: "Waiting", confirmed: "Market confirmed", pinpoint: "Pin the exact site", trace: "Detect or trace the site outline", continue: "Continue to Design Studio", retain: "Address, coordinates, and your traced site area remain available when you return to update the brief.", continueStudio: "Continue to Design Studio" },
  zh: { title: "定位建筑，确定场地范围。", intro: "输入邮编或地址，再在卫星图上点选你的建筑；轮廓和尺寸会自动识别，识别不到时再手动勾画。", selectedMarket: "已选市场", siteBrief: "场地摘要", market: "市场", area: "场地面积", boundary: "边界", notTraced: "尚未确定", awaiting: "等待识别", confirmed: "已确认市场", pinpoint: "标记精确场地", trace: "识别或勾画场地范围", continue: "进入设计工作室", retain: "地址、坐标和已勾画的场地面积会在返回更新摘要时保留。", continueStudio: "进入设计工作室" },
  "zh-Hant": { title: "定位建築，確定場地範圍。", intro: "輸入郵遞區號或地址，再在衛星圖上點選你的建築；輪廓和尺寸會自動識別，識別不到時再手動勾畫。", selectedMarket: "已選市場", siteBrief: "場地摘要", market: "市場", area: "場地面積", boundary: "邊界", notTraced: "尚未確定", awaiting: "等待識別", confirmed: "已確認市場", pinpoint: "標記精確場地", trace: "識別或勾畫場地範圍", continue: "進入設計工作室", retain: "地址、座標和已勾畫的場地面積會在返回更新摘要時保留。", continueStudio: "進入設計工作室" },
  fr: { title: "Repérez le bâtiment, délimitez le site.", intro: "Saisissez un code postal ou une adresse, puis touchez votre bâtiment sur la vue satellite. Contour et dimensions sont détectés automatiquement ; ne tracez à la main que si rien n’est trouvé.", selectedMarket: "Marché sélectionné", siteBrief: "Brief du site", market: "Marché", area: "Surface du site", boundary: "Limite", notTraced: "Non défini", awaiting: "En attente", confirmed: "Marché confirmé", pinpoint: "Repérer le site exact", trace: "Détecter ou tracer l’emprise du site", continue: "Continuer vers le Studio de conception", retain: "L’adresse, les coordonnées et la zone du site tracée restent disponibles lorsque vous revenez mettre à jour le brief.", continueStudio: "Continuer vers le Studio de conception" },
  ja: { title: "建物を特定し、敷地範囲を決める。", intro: "郵便番号または住所を入力し、衛星画像で建物をタップします。輪郭と寸法は自動検出され、見つからない場合だけ手動でトレースします。", selectedMarket: "選択した市場", siteBrief: "敷地概要", market: "市場", area: "敷地面積", boundary: "境界", notTraced: "未設定", awaiting: "検出待ち", confirmed: "市場を確認済み", pinpoint: "正確な敷地を指定", trace: "敷地範囲を検出またはトレース", continue: "デザインスタジオへ進む", retain: "住所、座標、描画した敷地面積は、概要を更新するために戻った際も保持されます。", continueStudio: "デザインスタジオへ進む" },
  es: { title: "Localiza el edificio y delimita el sitio.", intro: "Introduce un código postal o una dirección y toca tu edificio en la vista satélite. El contorno y las medidas se detectan solos; traza a mano solo si no se encuentra nada.", selectedMarket: "Mercado seleccionado", siteBrief: "Resumen del sitio", market: "Mercado", area: "Superficie del sitio", boundary: "Límite", notTraced: "Sin definir", awaiting: "En espera", confirmed: "Mercado confirmado", pinpoint: "Ubicar el sitio exacto", trace: "Detectar o trazar el contorno del sitio", continue: "Continuar al Estudio de diseño", retain: "La dirección, las coordenadas y el área trazada seguirán disponibles al volver para actualizar el resumen.", continueStudio: "Continuar al Estudio de diseño" },
  it: { title: "Individua l’edificio, delimita il sito.", intro: "Inserisci un CAP o un indirizzo, poi tocca il tuo edificio nella vista satellitare. Contorno e misure vengono rilevati automaticamente; traccia a mano solo se non viene trovato nulla.", selectedMarket: "Mercato selezionato", siteBrief: "Sintesi del sito", market: "Mercato", area: "Superficie del sito", boundary: "Perimetro", notTraced: "Non definito", awaiting: "In attesa", confirmed: "Mercato confermato", pinpoint: "Individua il sito esatto", trace: "Rileva o traccia il perimetro del sito", continue: "Continua allo Studio di progettazione", retain: "Indirizzo, coordinate e area tracciata restano disponibili quando torni per aggiornare la sintesi.", continueStudio: "Continua allo Studio di progettazione" },
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
    office: "Office",
    solarArea: "Solar surface area",
    buildingSize: "Size",
    storeys: (n: number) => `${n} storeys`,
    noSurfaces: "No solar products placed yet",
    residential: "Residential",
    activeSolarSurfaces: "Active solar surfaces",
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
    sizingAtEnd: "Inverter and battery sizes are matched once, when you confirm the calculation, using your final design and demand.",
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
    office: "办公",
    solarArea: "光伏面积",
    buildingSize: "尺寸",
    storeys: (n: number) => `${n} 层`,
    noSurfaces: "尚未放置光伏产品",
    residential: "住宅",
    activeSolarSurfaces: "有效光伏面",
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
    sizingAtEnd: "逆变器和电池容量会在你确认计算时，按最终设计和用电情况一次性匹配。",
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
    office: "辦公",
    solarArea: "光電面積",
    buildingSize: "尺寸",
    storeys: (n: number) => `${n} 層`,
    noSurfaces: "尚未放置光電產品",
    residential: "住宅",
    activeSolarSurfaces: "有效光伏面",
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
    sizingAtEnd: "逆變器與電池容量會在你確認計算時，依最終設計與用電情況一次匹配。",
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
  },
  fr: {
    workspace: "Espace projet",
    studioProgressLabel: "Avancement du projet : Design Studio",
    studioAriaLanguage: "Langue du Studio",
    studioStepEyebrow: "Design Studio",
    studioTitle: "Configurez votre bâtiment et votre conception solaire.",
    studioIntro: "Utilisez le Modernité Solar Studio pour modéliser le bâtiment, choisir produits et finitions, et définir la configuration solaire.",
    currentSite: "Site actuel",
    market: "Marché",
    studioProgress: "Avancement du Studio",
    activeSurfacesConfigured: (count: number) => `${count} surfaces solaires actives configurées`,
    fallbackAddress: "30 St James's Street, London SW1A 1HF, United Kingdom",
    configurationComplete: "Configuration terminée",
    nextEnergyTitle: "Ensuite, personnalisez l'énergie du foyer.",
    nextEnergyBody: "Configurez le projet avec les outils Bâtiment, Produits et Finitions. L'éclairage reste disponible dans le Studio ; l'export des fichiers se fait à l'étape Résultats.",
    step05: "Étape 05",
    homeEnergyCta: "Parlez-nous de l'énergie du foyer",
    configurationRequired: "Configuration requise",
    configurationRequiredBody: "Ajoutez un produit solaire compatible dans Produits ; le calcul du projet deviendra alors disponible.",
    calculationNotStarted: "Calcul non lancé",
    addProductBeforeEnergy: "Ajoutez au moins un produit solaire à l'étape Produits avant de passer à l'énergie du foyer.",
    addProductBeforeStudy: "Ajoutez au moins un produit solaire à l'étape Produits avant de calculer l'étude.",
    energyBack: "Retour au Design Studio",
    energyEyebrow: "Énergie du foyer",
    energyTitle: "Personnalisez la valeur de votre conception solaire.",
    energyIntro: "Le Design Studio définit le bâtiment et les surfaces solaires. Ces données relient la consommation du foyer, les tarifs, le stockage et la vision à 25 ans avant le calcul.",
    configuredBuilding: "Votre bâtiment configuré",
    viewInStudio: "Voir dans le Design Studio",
    office: "Bureaux",
    solarArea: "Surface solaire",
    buildingSize: "Dimensions",
    storeys: (n: number) => `${n} niveaux`,
    noSurfaces: "Aucun produit solaire placé",
    residential: "Résidentiel",
    activeSolarSurfaces: "Surfaces solaires actives",
    buildingFootprint: "Emprise au sol",
    energyNoteTitle: "Vos données énergie permettent de calculer économies, autoconsommation et retour sur investissement.",
    energyNoteBody: "Nous combinons la conception du bâtiment et la consommation du foyer pour modéliser la performance réelle sur 25 ans.",
    planningInputs: "Données de planification",
    energyCashTitle: "Énergie du foyer et trésorerie",
    energyFormIntro: "À compléter après la configuration du Studio. Ces réponses influencent la demande, la comparaison du stockage et la vision à 25 ans, pas le bâtiment ni la bibliothèque produits.",
    electricityUse: "Consommation électrique",
    chooseSource: "Choisissez une source",
    useBill: "Utiliser ma facture",
    enterAnnual: "Saisir les kWh annuels",
    notSure: "Je ne sais pas",
    aiEstimate: "Utiliser une estimation IA prudente",
    annualUse: "Consommation annuelle",
    householdRhythm: "Rythme du foyer",
    estimatedDemandOnly: "Uniquement pour une demande estimée",
    peopleLiving: "Nombre d'occupants",
    dayQuestion: "Quelqu'un est-il généralement présent en journée ?",
    occupancy: { usually: "Souvent", sometimes: "Parfois", rarely: "Rarement" },
    electricHome: "Qu'est-ce qui est électrique chez vous ?",
    selectAny: "Sélectionnez tout ce qui s'applique",
    services: { electricHeating: "Chauffage électrique", heatPump: "Pompe à chaleur", electricHotWater: "Eau chaude électrique", evCharger: "Recharge VE" },
    homeEnergyOption: "Option énergie",
    compareStorage: "Comparer le stockage après la production",
    solarOnly: "Solaire seul",
    exportSurplus: "Injecter le surplus",
    addBattery: "Ajouter une batterie",
    increaseOnSite: "Augmenter l'autoconsommation",
    usableBattery: "Capacité utile",
    batteryPrice: "Prix de la batterie",
    optional: "Facultatif",
    cashInputs: "Données de trésorerie facultatives",
    installedSolarPrice: "Prix du solaire installé",
    quoteNote: "Un prix permet d'afficher une trésorerie indicative sur 25 ans. Ce n'est pas un devis.",
    waitingStudio: "En attente du Design Studio",
    calculateResults: "Calculer les résultats",
    sizingAtEnd: "L’onduleur et la batterie sont dimensionnés une seule fois, lors de la confirmation du calcul, d’après la conception et la demande définitives.",
    planningProfile: "Votre profil de planification",
    livePreview: "Aperçu en direct",
    estimatedAnnualUse: "Consommation annuelle estimée",
    homeProfile: "Profil du foyer",
    directSolarUse: "Autoconsommation directe attendue",
    aboutPercent: (value: number) => `Environ ${value} %`,
    electricLoads: "Charges électriques",
    storageScenario: "Scénario de stockage",
    planningCostUsed: "Coût de planification retenu",
    estimateLabel: "estimation",
    energyBill: "Facture d'énergie",
    moderniteEstimate: "Estimation Modernité",
    person: "personne",
    people: "personnes",
    daytimePresence: "présence en journée",
    noMajorLoads: "Aucune charge électrique importante",
    batteryConsidered: (kwh: number) => `Batterie de ${kwh} kWh envisagée`,
    solarOnlyBaseline: "Référence solaire seul",
    connectsTo: "Ces réponses alimentent",
    connectors: ["Couverture solaire directe", "Économies sur facture", "Revenus d'injection", "Solaire ou batterie", "Trésorerie sur 25 ans", "Explication des résultats"],
    calculationEyebrow: "Calcul de l'étude",
    calculationTitle: "Préparation de votre étude personnalisée.",
    calculationErrorTitle: "L'étude doit être revue.",
    calculationBody: "Application des surfaces configurées, de la consommation du foyer, des tarifs, du stockage et du climat local.",
    calculationStages: ["Modèle des surfaces", "Demande du foyer", "Fourchette de production", "Valeur des scénarios"],
    returnStudio: "Retour au Design Studio",
  },
  ja: {
    workspace: "プロジェクトワークスペース",
    studioProgressLabel: "進捗：デザインスタジオ",
    studioAriaLanguage: "スタジオの言語",
    studioStepEyebrow: "デザインスタジオ",
    studioTitle: "建物と太陽光デザインを設定します。",
    studioIntro: "Modernité Solar Studio で建物をモデル化し、製品と仕上げを選び、太陽光構成を決定します。",
    currentSite: "現在の敷地",
    market: "市場",
    studioProgress: "スタジオの進捗",
    activeSurfacesConfigured: (count: number) => `太陽光面 ${count} 面を設定済み`,
    fallbackAddress: "30 St James's Street, London SW1A 1HF, United Kingdom",
    configurationComplete: "設定完了",
    nextEnergyTitle: "次に、家庭のエネルギーを設定します。",
    nextEnergyBody: "建物・製品・仕上げのツールでプロジェクトを設定してください。照明はスタジオ内で引き続き利用でき、ファイル出力は結果ステップで行います。",
    step05: "ステップ 05",
    homeEnergyCta: "家庭のエネルギーを入力",
    configurationRequired: "設定が必要です",
    configurationRequiredBody: "製品ステップで対応する太陽光製品を追加すると、計算が利用できます。",
    calculationNotStarted: "未計算",
    addProductBeforeEnergy: "家庭のエネルギーに進む前に、製品ステップで太陽光製品を 1 つ以上追加してください。",
    addProductBeforeStudy: "検討を計算する前に、製品ステップで太陽光製品を 1 つ以上追加してください。",
    energyBack: "デザインスタジオに戻る",
    energyEyebrow: "家庭のエネルギー",
    energyTitle: "太陽光デザインの価値をパーソナライズ。",
    energyIntro: "建物と太陽光面はデザインスタジオで決まります。ここでの入力は、計算前に家庭の需要・料金・蓄電の希望・25 年計画を結び付けます。",
    configuredBuilding: "設定した建物",
    viewInStudio: "デザインスタジオで表示",
    office: "オフィス",
    solarArea: "太陽光面積",
    buildingSize: "寸法",
    storeys: (n: number) => `${n} 階`,
    noSurfaces: "太陽光製品は未配置です",
    residential: "住宅",
    activeSolarSurfaces: "太陽光面",
    buildingFootprint: "建築面積",
    energyNoteTitle: "エネルギー入力から、節約額・自家消費・回収期間を計算します。",
    energyNoteBody: "建物デザインと家庭の電力使用を組み合わせ、25 年間の実性能をモデル化します。",
    planningInputs: "計画入力",
    energyCashTitle: "家庭のエネルギーと収支",
    energyFormIntro: "スタジオ設定後に入力してください。家庭の需要・蓄電比較・25 年計画に影響し、建物や製品ライブラリは変わりません。",
    electricityUse: "電力使用量",
    chooseSource: "入力方法を選択",
    useBill: "電気料金明細を使う",
    enterAnnual: "年間 kWh を入力",
    notSure: "わからない",
    aiEstimate: "控えめな AI 推定を使う",
    annualUse: "年間電力使用量",
    householdRhythm: "生活リズム",
    estimatedDemandOnly: "推定需要の場合のみ",
    peopleLiving: "居住人数",
    dayQuestion: "日中は誰かが在宅していますか？",
    occupancy: { usually: "たいてい", sometimes: "ときどき", rarely: "ほとんどない" },
    electricHome: "電気で動かしているものは？",
    selectAny: "該当するものをすべて選択",
    services: { electricHeating: "電気暖房", heatPump: "ヒートポンプ", electricHotWater: "電気給湯", evCharger: "EV 充電" },
    homeEnergyOption: "エネルギーオプション",
    compareStorage: "発電後に蓄電を比較",
    solarOnly: "太陽光のみ",
    exportSurplus: "余剰電力を売電",
    addBattery: "蓄電池を追加",
    increaseOnSite: "自家消費を増やす",
    usableBattery: "実効容量",
    batteryPrice: "蓄電池価格",
    optional: "任意",
    cashInputs: "任意の収支入力",
    installedSolarPrice: "太陽光の設置価格",
    quoteNote: "価格を入力すると 25 年の参考収支を表示します。見積りではありません。",
    waitingStudio: "デザインスタジオを待機中",
    calculateResults: "検討結果を計算",
    sizingAtEnd: "インバーターと蓄電池の容量は、計算を確定したときに最終設計と需要から一度だけ選定します。",
    planningProfile: "計画プロファイル",
    livePreview: "ライブプレビュー",
    estimatedAnnualUse: "推定年間使用量",
    homeProfile: "世帯プロファイル",
    directSolarUse: "想定自家消費",
    aboutPercent: (value: number) => `約 ${value}%`,
    electricLoads: "電気負荷",
    storageScenario: "蓄電シナリオ",
    planningCostUsed: "計画費用",
    estimateLabel: "推定",
    energyBill: "電気料金明細",
    moderniteEstimate: "Modernité 推定",
    person: "人",
    people: "人",
    daytimePresence: "日中在宅",
    noMajorLoads: "主な電気負荷なし",
    batteryConsidered: (kwh: number) => `${kwh} kWh 蓄電池を検討`,
    solarOnlyBaseline: "太陽光のみの基準",
    connectsTo: "この回答が反映される項目",
    connectors: ["太陽光の直接充足", "電気代削減", "売電収入", "太陽光と蓄電池", "25 年収支", "結果の解説"],
    calculationEyebrow: "検討を計算中",
    calculationTitle: "パーソナライズした検討を準備しています。",
    calculationErrorTitle: "検討の見直しが必要です。",
    calculationBody: "設定した面、家庭の使用量、料金、蓄電の希望、地域の気候を適用しています。",
    calculationStages: ["面モデル", "家庭の需要", "発電レンジ", "シナリオ価値"],
    returnStudio: "デザインスタジオに戻る",
  },
  es: {
    workspace: "Espacio del proyecto",
    studioProgressLabel: "Progreso del proyecto: Design Studio",
    studioAriaLanguage: "Idioma del Studio",
    studioStepEyebrow: "Design Studio",
    studioTitle: "Configure su edificio y su diseño solar.",
    studioIntro: "Use Modernité Solar Studio para modelar el edificio, elegir productos y acabados y definir la configuración solar.",
    currentSite: "Emplazamiento actual",
    market: "Mercado",
    studioProgress: "Progreso del Studio",
    activeSurfacesConfigured: (count: number) => `${count} superficies solares activas configuradas`,
    fallbackAddress: "30 St James's Street, London SW1A 1HF, United Kingdom",
    configurationComplete: "Configuración completa",
    nextEnergyTitle: "Ahora, personalice la energía del hogar.",
    nextEnergyBody: "Configure el proyecto con las herramientas Edificio, Productos y Acabados. La iluminación sigue disponible en el Studio; la exportación de archivos se hace en Resultados.",
    step05: "Paso 05",
    homeEnergyCta: "Cuéntenos sobre la energía del hogar",
    configurationRequired: "Configuración necesaria",
    configurationRequiredBody: "Añada un producto solar compatible en Productos; después podrá calcular el proyecto.",
    calculationNotStarted: "Cálculo no iniciado",
    addProductBeforeEnergy: "Añada al menos un producto solar en Productos antes de continuar a la energía del hogar.",
    addProductBeforeStudy: "Añada al menos un producto solar en Productos antes de calcular el estudio.",
    energyBack: "Volver a Design Studio",
    energyEyebrow: "Energía del hogar",
    energyTitle: "Personalice el valor de su diseño solar.",
    energyIntro: "Design Studio define el edificio y las superficies solares. Estos datos conectan la demanda del hogar, las tarifas, el almacenamiento y la visión a 25 años antes del cálculo.",
    configuredBuilding: "Su edificio configurado",
    viewInStudio: "Ver en Design Studio",
    office: "Oficinas",
    solarArea: "Superficie solar",
    buildingSize: "Dimensiones",
    storeys: (n: number) => `${n} plantas`,
    noSurfaces: "Aún no hay productos solares",
    residential: "Residencial",
    activeSolarSurfaces: "Superficies solares activas",
    buildingFootprint: "Superficie en planta",
    energyNoteTitle: "Sus datos de energía permiten calcular ahorro, autoconsumo y retorno.",
    energyNoteBody: "Combinamos el diseño del edificio con el consumo del hogar para modelar el rendimiento real durante 25 años.",
    planningInputs: "Datos de planificación",
    energyCashTitle: "Energía del hogar y caja",
    energyFormIntro: "Complételos tras configurar el Studio. Influyen en la demanda, la comparación de almacenamiento y la visión a 25 años, no en el edificio ni en la biblioteca de productos.",
    electricityUse: "Consumo eléctrico",
    chooseSource: "Elija una fuente",
    useBill: "Usar mi factura",
    enterAnnual: "Introducir kWh anuales",
    notSure: "No estoy seguro",
    aiEstimate: "Usar una estimación prudente con IA",
    annualUse: "Consumo anual",
    householdRhythm: "Ritmo del hogar",
    estimatedDemandOnly: "Solo para demanda estimada",
    peopleLiving: "Personas en la vivienda",
    dayQuestion: "¿Suele haber alguien en casa durante el día?",
    occupancy: { usually: "Normalmente", sometimes: "A veces", rarely: "Rara vez" },
    electricHome: "¿Qué es eléctrico en casa?",
    selectAny: "Seleccione lo que corresponda",
    services: { electricHeating: "Calefacción eléctrica", heatPump: "Bomba de calor", electricHotWater: "Agua caliente eléctrica", evCharger: "Recarga de VE" },
    homeEnergyOption: "Opción energética",
    compareStorage: "Comparar almacenamiento tras la generación",
    solarOnly: "Solo solar",
    exportSurplus: "Verter el excedente",
    addBattery: "Añadir batería",
    increaseOnSite: "Aumentar el autoconsumo",
    usableBattery: "Batería útil",
    batteryPrice: "Precio de la batería",
    optional: "Opcional",
    cashInputs: "Datos de caja opcionales",
    installedSolarPrice: "Precio del solar instalado",
    quoteNote: "Un precio permite mostrar una línea de caja orientativa a 25 años. No es un presupuesto.",
    waitingStudio: "Esperando a Design Studio",
    calculateResults: "Calcular resultados",
    sizingAtEnd: "El inversor y la batería se dimensionan una sola vez, al confirmar el cálculo, con el diseño y la demanda definitivos.",
    planningProfile: "Su perfil de planificación",
    livePreview: "Vista previa",
    estimatedAnnualUse: "Consumo anual estimado",
    homeProfile: "Perfil del hogar",
    directSolarUse: "Autoconsumo directo esperado",
    aboutPercent: (value: number) => `Aprox. ${value} %`,
    electricLoads: "Cargas eléctricas",
    storageScenario: "Escenario de almacenamiento",
    planningCostUsed: "Coste de planificación",
    estimateLabel: "estimación",
    energyBill: "Factura de energía",
    moderniteEstimate: "Estimación Modernité",
    person: "persona",
    people: "personas",
    daytimePresence: "presencia diurna",
    noMajorLoads: "Sin cargas eléctricas importantes",
    batteryConsidered: (kwh: number) => `Batería de ${kwh} kWh considerada`,
    solarOnlyBaseline: "Referencia solo solar",
    connectsTo: "Estas respuestas alimentan",
    connectors: ["Cobertura solar directa", "Ahorro en factura", "Ingresos por excedentes", "Solar o batería", "Caja a 25 años", "Explicación del resultado"],
    calculationEyebrow: "Calculando el estudio",
    calculationTitle: "Preparando su estudio personalizado.",
    calculationErrorTitle: "El estudio necesita revisión.",
    calculationBody: "Aplicando las superficies configuradas, el consumo del hogar, las tarifas, el almacenamiento y el clima local.",
    calculationStages: ["Modelo de superficies", "Demanda del hogar", "Rango de generación", "Valor de escenarios"],
    returnStudio: "Volver a Design Studio",
  },
  it: {
    workspace: "Area di progetto",
    studioProgressLabel: "Avanzamento: Design Studio",
    studioAriaLanguage: "Lingua dello Studio",
    studioStepEyebrow: "Design Studio",
    studioTitle: "Configura l'edificio e il progetto solare.",
    studioIntro: "Usa Modernité Solar Studio per modellare l'edificio, scegliere prodotti e finiture e definire la configurazione solare.",
    currentSite: "Sito attuale",
    market: "Mercato",
    studioProgress: "Avanzamento dello Studio",
    activeSurfacesConfigured: (count: number) => `${count} superfici solari attive configurate`,
    fallbackAddress: "30 St James's Street, London SW1A 1HF, United Kingdom",
    configurationComplete: "Configurazione completata",
    nextEnergyTitle: "Ora personalizza l'energia domestica.",
    nextEnergyBody: "Configura il progetto con gli strumenti Edificio, Prodotti e Finiture. L'illuminazione resta disponibile nello Studio; l'esportazione dei file avviene nella fase Risultati.",
    step05: "Fase 05",
    homeEnergyCta: "Raccontaci i consumi di casa",
    configurationRequired: "Configurazione necessaria",
    configurationRequiredBody: "Aggiungi un prodotto solare compatibile in Prodotti; poi il calcolo sarà disponibile.",
    calculationNotStarted: "Calcolo non avviato",
    addProductBeforeEnergy: "Aggiungi almeno un prodotto solare in Prodotti prima di passare all'energia domestica.",
    addProductBeforeStudy: "Aggiungi almeno un prodotto solare in Prodotti prima di calcolare lo studio.",
    energyBack: "Torna al Design Studio",
    energyEyebrow: "Energia domestica",
    energyTitle: "Personalizza il valore del tuo progetto solare.",
    energyIntro: "Il Design Studio definisce edificio e superfici solari. Questi dati collegano consumi domestici, tariffe, accumulo e visione a 25 anni prima del calcolo.",
    configuredBuilding: "Il tuo edificio configurato",
    viewInStudio: "Apri nel Design Studio",
    office: "Uffici",
    solarArea: "Superficie solare",
    buildingSize: "Dimensioni",
    storeys: (n: number) => `${n} piani`,
    noSurfaces: "Nessun prodotto solare posizionato",
    residential: "Residenziale",
    activeSolarSurfaces: "Superfici solari attive",
    buildingFootprint: "Impronta a terra",
    energyNoteTitle: "I tuoi dati energetici servono a calcolare risparmio, autoconsumo e rientro.",
    energyNoteBody: "Combiniamo il progetto dell'edificio con i consumi domestici per modellare le prestazioni reali in 25 anni.",
    planningInputs: "Dati di pianificazione",
    energyCashTitle: "Energia domestica e flussi di cassa",
    energyFormIntro: "Completa dopo aver configurato lo Studio. Influenzano domanda, confronto dell'accumulo e visione a 25 anni, non l'edificio o la libreria prodotti.",
    electricityUse: "Consumo elettrico",
    chooseSource: "Scegli una fonte",
    useBill: "Usa la mia bolletta",
    enterAnnual: "Inserisci i kWh annui",
    notSure: "Non sono sicuro",
    aiEstimate: "Usa una stima IA prudente",
    annualUse: "Consumo annuo",
    householdRhythm: "Abitudini domestiche",
    estimatedDemandOnly: "Solo per la domanda stimata",
    peopleLiving: "Persone residenti",
    dayQuestion: "Di giorno c'è di solito qualcuno in casa?",
    occupancy: { usually: "Di solito", sometimes: "A volte", rarely: "Raramente" },
    electricHome: "Cosa è elettrico in casa?",
    selectAny: "Seleziona tutte le voci pertinenti",
    services: { electricHeating: "Riscaldamento elettrico", heatPump: "Pompa di calore", electricHotWater: "Acqua calda elettrica", evCharger: "Ricarica VE" },
    homeEnergyOption: "Opzione energetica",
    compareStorage: "Confronta l'accumulo dopo la produzione",
    solarOnly: "Solo solare",
    exportSurplus: "Immetti il surplus",
    addBattery: "Aggiungi una batteria",
    increaseOnSite: "Aumenta l'autoconsumo",
    usableBattery: "Capacità utile",
    batteryPrice: "Prezzo della batteria",
    optional: "Facoltativo",
    cashInputs: "Dati di cassa facoltativi",
    installedSolarPrice: "Prezzo del solare installato",
    quoteNote: "Un prezzo abilita una linea di cassa indicativa a 25 anni. Non è un preventivo.",
    waitingStudio: "In attesa del Design Studio",
    calculateResults: "Calcola i risultati",
    sizingAtEnd: "Inverter e batteria vengono dimensionati una sola volta, alla conferma del calcolo, in base a progetto e consumi definitivi.",
    planningProfile: "Il tuo profilo di pianificazione",
    livePreview: "Anteprima",
    estimatedAnnualUse: "Consumo annuo stimato",
    homeProfile: "Profilo domestico",
    directSolarUse: "Autoconsumo diretto atteso",
    aboutPercent: (value: number) => `Circa ${value}%`,
    electricLoads: "Carichi elettrici",
    storageScenario: "Scenario di accumulo",
    planningCostUsed: "Costo di pianificazione",
    estimateLabel: "stima",
    energyBill: "Bolletta",
    moderniteEstimate: "Stima Modernité",
    person: "persona",
    people: "persone",
    daytimePresence: "presenza diurna",
    noMajorLoads: "Nessun carico elettrico rilevante",
    batteryConsidered: (kwh: number) => `Batteria da ${kwh} kWh considerata`,
    solarOnlyBaseline: "Riferimento solo solare",
    connectsTo: "Queste risposte alimentano",
    connectors: ["Copertura solare diretta", "Risparmio in bolletta", "Ricavi da immissione", "Solare o batteria", "Cassa a 25 anni", "Spiegazione del risultato"],
    calculationEyebrow: "Calcolo dello studio",
    calculationTitle: "Stiamo preparando il tuo studio personalizzato.",
    calculationErrorTitle: "Lo studio va rivisto.",
    calculationBody: "Applicazione di superfici configurate, consumi domestici, tariffe, accumulo e clima locale.",
    calculationStages: ["Modello superfici", "Domanda domestica", "Intervallo di produzione", "Valore degli scenari"],
    returnStudio: "Torna al Design Studio",
  },
} as const;

const MISC_COPY: Record<StudioLanguage, { heroCaption: string; weatherLoading: (source: string) => string; weatherUnavailable: (source: string) => string; noLocation: string; aborted: string; addProduct: string; noStudy: string; homeAria: string; progressAria: string; languageAria: string; heroAlt: string; buildingAlt: string; planningAria: string; energyAria: string; occupancyAria: string; demandExample: string; perYear: string; weatherSource: string; nextStepAria: string; stagesAria: string }> = {
  en: { heroCaption: "Architecture, solar geometry, and digital design intelligence.", weatherLoading: (s) => `Loading ${s} weather…`, weatherUnavailable: (s) => `${s} unavailable · synthetic climate`, noLocation: "Choose a project location before preparing a project study.", aborted: "The project-study request ended before it completed. Your Design Studio choices remain unchanged; wait a moment and try again.", addProduct: "Add at least one supported solar product in the Products step before calculating the project study.", noStudy: "No active project study is available. Return to Design Studio and prepare a new study.", homeAria: "Return to project start", progressAria: "Project setup progress", languageAria: "Interface language", heroAlt: "Contemporary residence with a discreet integrated solar roof in a mature garden", buildingAlt: "Preview of the configured building", planningAria: "Live planning profile", energyAria: "Household energy choices", occupancyAria: "Daytime occupancy", demandExample: "e.g. 4,200", perYear: "kWh/year", weatherSource: "Weather source", nextStepAria: "Next project step", stagesAria: "Calculation stages" },
  zh: { heroCaption: "建筑、太阳几何与数字化设计智能。", weatherLoading: (s) => `正在加载 ${s} 气象…`, weatherUnavailable: (s) => `${s} 不可用 · 使用合成气候`, noLocation: "请先选择项目位置，再准备项目研究。", aborted: "项目研究请求在完成前中断。设计工作室中的选择未改变，请稍候重试。", addProduct: "计算项目研究前，请在“产品”步骤中至少添加一个支持的光伏产品。", noStudy: "当前没有项目研究。请返回设计工作室准备新的研究。", homeAria: "返回项目起点", progressAria: "项目进度", languageAria: "界面语言", heroAlt: "绿植环绕、屋顶低调集成光伏的现代住宅", buildingAlt: "已配置建筑的预览", planningAria: "实时规划概览", energyAria: "家庭能源选项", occupancyAria: "白天在家情况", demandExample: "例如 4,200", perYear: "kWh/年", weatherSource: "气象数据源", nextStepAria: "项目下一步", stagesAria: "计算阶段" },
  "zh-Hant": { heroCaption: "建築、太陽幾何與數位設計智慧。", weatherLoading: (s) => `正在載入 ${s} 氣象…`, weatherUnavailable: (s) => `${s} 無法使用 · 使用合成氣候`, noLocation: "請先選擇專案位置，再準備專案研究。", aborted: "專案研究請求在完成前中斷。設計工作室中的選擇未改變，請稍候重試。", addProduct: "計算專案研究前，請在「產品」步驟中至少加入一個支援的光電產品。", noStudy: "目前沒有專案研究。請返回設計工作室準備新的研究。", homeAria: "返回專案起點", progressAria: "專案進度", languageAria: "介面語言", heroAlt: "綠植環繞、屋頂低調整合光電的現代住宅", buildingAlt: "已配置建築的預覽", planningAria: "即時規劃概覽", energyAria: "家庭能源選項", occupancyAria: "白天在家情況", demandExample: "例如 4,200", perYear: "kWh/年", weatherSource: "氣象資料來源", nextStepAria: "專案下一步", stagesAria: "計算階段" },
  fr: { heroCaption: "Architecture, géométrie solaire et intelligence de conception numérique.", weatherLoading: (s) => `Chargement de la météo ${s}…`, weatherUnavailable: (s) => `${s} indisponible · climat synthétique`, noLocation: "Choisissez l'emplacement du projet avant de préparer l'étude.", aborted: "La demande d'étude s'est interrompue. Vos choix dans le Design Studio sont conservés ; réessayez dans un instant.", addProduct: "Ajoutez au moins un produit solaire compatible à l'étape Produits avant de calculer l'étude.", noStudy: "Aucune étude active. Retournez au Design Studio pour en préparer une.", homeAria: "Revenir au début du projet", progressAria: "Progression du projet", languageAria: "Langue de l’interface", heroAlt: "Résidence contemporaine avec une toiture solaire intégrée et discrète dans un jardin arboré", buildingAlt: "Aperçu du bâtiment configuré", planningAria: "Profil de planification en direct", energyAria: "Choix énergétiques du foyer", occupancyAria: "Présence en journée", demandExample: "ex. 4 200", perYear: "kWh/an", weatherSource: "Source météo", nextStepAria: "Étape suivante du projet", stagesAria: "Étapes du calcul" },
  ja: { heroCaption: "建築、太陽の幾何学、デジタルデザインの知性。", weatherLoading: (s) => `${s} 気象を読み込み中…`, weatherUnavailable: (s) => `${s} 利用不可 · 合成気候`, noLocation: "検討を作成する前にプロジェクトの場所を選択してください。", aborted: "検討リクエストが完了前に終了しました。デザインスタジオの設定はそのままです。少し待って再試行してください。", addProduct: "検討を計算する前に、製品ステップで対応する太陽光製品を 1 つ以上追加してください。", noStudy: "有効な検討がありません。デザインスタジオに戻って検討を作成してください。", homeAria: "プロジェクトの最初に戻る", progressAria: "プロジェクトの進捗", languageAria: "表示言語", heroAlt: "成熟した庭に囲まれ、屋根に太陽光を控えめに統合した現代住宅", buildingAlt: "設定した建物のプレビュー", planningAria: "リアルタイム計画プロファイル", energyAria: "家庭のエネルギー選択", occupancyAria: "日中の在宅状況", demandExample: "例：4,200", perYear: "kWh/年", weatherSource: "気象データ", nextStepAria: "次のステップ", stagesAria: "計算の段階" },
  es: { heroCaption: "Arquitectura, geometría solar e inteligencia de diseño digital.", weatherLoading: (s) => `Cargando meteo ${s}…`, weatherUnavailable: (s) => `${s} no disponible · clima sintético`, noLocation: "Elija la ubicación del proyecto antes de preparar el estudio.", aborted: "La solicitud del estudio terminó antes de completarse. Sus elecciones en Design Studio se mantienen; vuelva a intentarlo en un momento.", addProduct: "Añada al menos un producto solar compatible en Productos antes de calcular el estudio.", noStudy: "No hay un estudio activo. Vuelva a Design Studio y prepare uno nuevo.", homeAria: "Volver al inicio del proyecto", progressAria: "Progreso del proyecto", languageAria: "Idioma de la interfaz", heroAlt: "Residencia contemporánea con cubierta solar integrada y discreta en un jardín maduro", buildingAlt: "Vista previa del edificio configurado", planningAria: "Perfil de planificación en directo", energyAria: "Opciones energéticas del hogar", occupancyAria: "Presencia durante el día", demandExample: "p. ej. 4.200", perYear: "kWh/año", weatherSource: "Fuente meteorológica", nextStepAria: "Siguiente paso del proyecto", stagesAria: "Etapas del cálculo" },
  it: { heroCaption: "Architettura, geometria solare e intelligenza progettuale digitale.", weatherLoading: (s) => `Caricamento meteo ${s}…`, weatherUnavailable: (s) => `${s} non disponibile · clima sintetico`, noLocation: "Scegli la posizione del progetto prima di preparare lo studio.", aborted: "La richiesta dello studio si è interrotta. Le scelte nel Design Studio restano invariate; riprova tra poco.", addProduct: "Aggiungi almeno un prodotto solare compatibile in Prodotti prima di calcolare lo studio.", noStudy: "Nessuno studio attivo. Torna al Design Studio e preparane uno nuovo.", homeAria: "Torna all’inizio del progetto", progressAria: "Avanzamento del progetto", languageAria: "Lingua dell’interfaccia", heroAlt: "Residenza contemporanea con tetto solare integrato e discreto in un giardino maturo", buildingAlt: "Anteprima dell’edificio configurato", planningAria: "Profilo di pianificazione in tempo reale", energyAria: "Scelte energetiche della casa", occupancyAria: "Presenza durante il giorno", demandExample: "es. 4.200", perYear: "kWh/anno", weatherSource: "Fonte meteo", nextStepAria: "Prossimo passo del progetto", stagesAria: "Fasi del calcolo" },
};

function outerCopy(language: StudioLanguage) {
  return OUTER_UI_COPY[language] ?? OUTER_UI_COPY.en;
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
        siteArea: siteAreaNear(parsed.siteArea, parsed.location ?? DEFAULT_PROJECT_LOCATION),
        building: parsed.building ?? null,
        energySettings: { ...DEFAULT_ENERGY_SETTINGS, ...withoutLegacyPriceDefaults(parsed.energySettings) },
        updatedAt: parsed.updatedAt ?? Date.now(),
      };
    }
  } catch {
    // Start with a clean, versioned local project context.
  }
  return { version: 3, marketKey: "EU", europeanCountry: DEFAULT_EUROPEAN_COUNTRY, location: DEFAULT_PROJECT_LOCATION, siteArea: null, energySettings: DEFAULT_ENERGY_SETTINGS, updatedAt: Date.now() };
}

function loadStudioLanguage(): StudioLanguage {
  const requested = new URLSearchParams(window.location.search).get("lang");
  if (STUDIO_LANGUAGES.some((language) => language.value === requested)) return requested as StudioLanguage;
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
const WEATHER_SOURCE_LABELS: Record<WeatherSourceKey, { short: string }> = {
  "nasa-power": { short: "NASA POWER" },
  "pvgis-tmy": { short: "PVGIS TMY" },
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
  const applied = context?.building;
  if (snapshot === DEMO_STUDIO_SNAPSHOT && applied) {
    const units = studioTypeById(applied.typeId)?.units || 1;
    snapshot = { ...snapshot, building: { ...snapshot.building, id: applied.typeId, width: applied.widthM * units, depth: applied.depthM, floors: applied.floors, storeyHeight: applied.storeyHeightM } };
    extras = { buildingNorthDeg: applied.frontAzimuthDeg, ...extras };
  }
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
      <button type="button" className="brand-lockup" onClick={() => onNavigate("entry")} aria-label={MISC_COPY[language].homeAria}>
        <span className="brand-mark"><Leaf size={16} strokeWidth={2.2} /></span>
        <span>
          <strong>MODERNITÉ</strong>
          <small>BUILDING INTEGRATED SOLAR</small>
        </span>
      </button>
      <nav className="journey-rail" aria-label={MISC_COPY[language].progressAria}>
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
          <select value={language} onChange={(event) => onLanguageChange(event.target.value as StudioLanguage)} aria-label={MISC_COPY[language].languageAria}>
            {STUDIO_LANGUAGES.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
          </select>
          <ChevronDown size={12} aria-hidden="true" />
        </label>
        <AdvisorHeaderButton language={language} />
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
        <img src={HERO_IMAGE_URL} alt={MISC_COPY[language].heroAlt} />
        <figcaption>{MISC_COPY[language].heroCaption}</figcaption>
      </figure>
      <div className="entry-foreground foregroundFoliageBlur" aria-hidden="true" />
      <label className="entry-language-hotspot" aria-label={MISC_COPY[language].languageAria}>
        <select value={language} onChange={(event) => onLanguageChange(event.target.value as StudioLanguage)}>
          {STUDIO_LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <span className="entry-workspace-pulse" aria-hidden="true" />
    </section>
  );
}

function MarketPage({ language, market, europeanCountry, copy, onMarketChange, onEuropeanCountryChange, onNavigate }: {
  language: StudioLanguage;
  market: Market;
  europeanCountry: EuropeanMarket | null;
  copy: GatewayCopy;
  onMarketChange: (market: Market) => void;
  onEuropeanCountryChange: (country: EuropeanMarket | null) => void;
  onNavigate: (route: GatewayRoute) => void;
}) {
  usePrewarmLocationMap(language, market);
  return (
    <section className="market-page gateway-page">
      <PageIntro chapter={2} eyebrow={WORKFLOW_LABELS[language].market} icon={<Globe2 size={14} />} title={copy.marketTitle} lede={copy.marketIntro} />
      <Suspense fallback={<div className="market-globe-workbench is-loading" />}><MarketAtlas language={language} market={market} europeanCountry={europeanCountry} copy={copy} onMarketChange={onMarketChange} onEuropeanCountryChange={onEuropeanCountryChange} onContinue={() => onNavigate("location")} /></Suspense>
    </section>
  );
}

function LocationPage({ language, market, context, copy, onLocationChange, onAreaChange, onBuildingChange, onNavigate }: {
  language: StudioLanguage;
  market: Market;
  context: ProjectContext;
  copy: GatewayCopy;
  onLocationChange: (selection: ProjectLocationSelection) => void;
  onAreaChange: (selection: SiteAreaSelection | null) => void;
  onBuildingChange: (building: AppliedBuilding | null) => void;
  onNavigate: (route: GatewayRoute) => void;
}) {
  const [viewerMode, setViewerMode] = useState<"street" | "earth" | null>(null);
  const location = isSampleLocation(context.location) ? null : context.location;
  const coordinates = location?.coordinates ?? null;
  const keyFor = (point: { lat: number; lng: number }) => `${point.lat.toFixed(5)}:${point.lng.toFixed(5)}:${context.marketKey}`;
  const locationKey = coordinates ? keyFor(coordinates) : "";
  const profileInput = { lat: coordinates?.lat ?? 0, lng: coordinates?.lng ?? 0, market: context.marketKey };
  const utils = trpc.useUtils();
  const [detectKey, setDetectKey] = useState("");
  const [addressSearch, setAddressSearch] = useState(!location);
  const [anchor, setAnchor] = useState<{ point: { lat: number; lng: number }; label: string } | null>(() => (location ? { point: location.coordinates, label: location.label } : null));
  const { key: mapsKey } = useMapsKey();
  const nearbyQuery = trpc.site.nearbyBuildings.useQuery({ lat: anchor?.point.lat ?? 0, lng: anchor?.point.lng ?? 0 }, { enabled: Boolean(anchor) && !addressSearch, staleTime: Infinity, retry: 1 });
  const [nearbyAddresses, setNearbyAddresses] = useState<AddressMatch[]>([]);
  useEffect(() => {
    if (!anchor || !mapsKey || addressSearch) return;
    let cancelled = false;
    setNearbyAddresses([]);
    googleNearbyAddresses(mapsKey, anchor.point, geocodeLanguage(language, market))
      .then((matches) => !cancelled && setNearbyAddresses(matches))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [anchor, mapsKey, addressSearch, language, market]);
  const candidates = useMemo<MapBuildingCandidate[]>(() => (nearbyQuery.data ?? []).map((building) => ({
    id: building.id,
    path: building.path,
    center: building.center,
    areaM2: building.areaM2,
    label: nearbyAddresses.find((match) => pointInPath(match.coordinates, building.path))?.label ?? building.address,
  })), [nearbyQuery.data, nearbyAddresses]);
  const selectedCandidate = coordinates && context.siteArea ? candidates.find((candidate) => pointInPath(coordinates, candidate.path)) ?? null : null;
  const pickBuilding = (candidate: MapBuildingCandidate, exactLabel?: string) => {
    const label = exactLabel ?? (candidate.label?.includes(",") ? candidate.label : candidate.label ? `${candidate.label}, ${anchor?.label ?? ""}` : anchor?.label ?? "");
    onLocationChange({ label, coordinates: candidate.center });
    onAreaChange({ path: candidate.path, areaM2: candidate.areaM2, source: "detected" });
    setDetectKey(keyFor(candidate.center));
  };
  const chooseAddress = (match: AddressMatch) => {
    setAddressSearch(false);
    setAnchor({ point: match.coordinates, label: match.label });
    onLocationChange({ label: match.label, coordinates: match.coordinates });
    if (match.precise) setDetectKey(keyFor(match.coordinates));
  };
  const buildingPicker: BuildingPicker = {
    loading: Boolean(anchor) && nearbyQuery.isLoading,
    candidates,
    selectedId: selectedCandidate?.id ?? null,
    onPick: (candidate) => pickBuilding(candidate),
  };
  const detectRequested = Boolean(coordinates) && (detectKey === locationKey || Boolean(utils.site.buildingProfile.getData(profileInput)));
  const profileQuery = trpc.site.buildingProfile.useQuery(profileInput, { enabled: detectRequested, staleTime: Infinity, retry: 1 });
  const profile = detectRequested ? profileQuery.data : undefined;
  const detectedOutline = useMemo<SiteAreaSelection | null>(
    () => (profile?.path && profile.path.length >= 3 && profile.footprintAreaM2 ? { path: profile.path, areaM2: profile.footprintAreaM2, source: "detected" } : null),
    [profile],
  );
  useEffect(() => {
    if (detectedOutline && !context.siteArea) onAreaChange(detectedOutline);
  }, [detectedOutline]);
  useEffect(() => {
    if (location && !anchor) setAnchor({ point: location.coordinates, label: location.label });
  }, [location, anchor]);
  const siteDetection: SiteDetection = {
    state: !detectRequested ? "idle" : profileQuery.isError ? "error" : !profile ? "loading" : detectedOutline ? "found" : "missing",
    onDetect: () => {
      setDetectKey(locationKey);
      if (profileQuery.isError) void profileQuery.refetch();
    },
    onUseDetected: detectedOutline ? () => onAreaChange(detectedOutline) : undefined,
  };
  const [sunVisible, setSunVisible] = useState(false);
  const sunQuery = trpc.site.solarHeatmap.useQuery({ lat: coordinates?.lat ?? 0, lng: coordinates?.lng ?? 0 }, { enabled: sunVisible && Boolean(coordinates), staleTime: Infinity, retry: 1 });
  const sunData = sunQuery.data?.status === "ok" ? sunQuery.data : undefined;
  const sunHeatmap: SunHeatmap = {
    state: !sunVisible ? "idle" : sunQuery.isLoading ? "loading" : sunData ? "ready" : "none",
    visible: sunVisible,
    data: sunData,
    onToggle: () => setSunVisible((visible) => !visible),
  };
  const outlinedArea = context.siteArea ? new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(context.siteArea.areaM2) : null;
  const locationText = LOCATION_PAGE_TEXT[language];
  const locationLabel = location ? cleanAddressLabel(location.label, language) : "";
  return (
    <section className="location-page gateway-page">
      <PageIntro chapter={3} eyebrow={WORKFLOW_LABELS[language].location} icon={<MapPinned size={14} />} title={locationText.title} lede={locationText.intro} />
      {addressSearch ? <AddressGate
        language={language}
        market={market}
        placeholder={`${copy.addressSearch} ${regionName(market.shortName, language, market.name)}`}
        onSelect={chooseAddress}
        onBrowseMap={() => setAddressSearch(false)}
      /> : <div className="location-workbench">
        <ProjectLocationMap
          language={language}
          market={market}
          placeholder={`${copy.addressSearch} ${regionName(market.shortName, language, market.name)}`}
          searchLabel={copy.addressSearch}
          locateLabel={copy.locate}
          initialLocation={location}
          initialArea={context.siteArea}
          onLocationChange={onLocationChange}
          onAreaChange={onAreaChange}
          onOpenStreetView={() => setViewerMode("street")}
          siteDetection={siteDetection}
          buildingPicker={buildingPicker}
          onChangeAddress={() => setAddressSearch(true)}
          sunHeatmap={sunHeatmap}
        />
        <aside className="location-panel location-panel--site">
          <div className="location-panel-heading"><span>03</span><div><p className="mini-label">{copy.projectContext}</p><h2>{locationText.siteBrief}</h2></div></div>
          <div className="location-market-name"><small>{locationText.market}</small><strong>{regionName(market.shortName, language, market.name)}</strong></div>
          <div className={`location-readout ${location ? "is-ready" : ""}`}>
            <MapPinned size={17} />
            <span>{locationLabel || copy.locationEmpty}</span>
          </div>
          <div className="site-brief-metrics">
            <div><span>{locationText.area}</span><strong>{outlinedArea ? `${outlinedArea} m²` : locationText.notTraced}</strong></div>
            <div><span>{locationText.boundary}</span><strong>{context.siteArea ? `${context.siteArea.path.length} ${language === "zh" || language === "zh-Hant" || language === "ja" ? "" : language === "fr" ? "sommets" : language === "es" ? "vértices" : language === "it" ? "vertici" : "vertices"}` : locationText.awaiting}</strong></div>
          </div>
          <div className="location-steps location-steps--site">
            <span><b>1</b><i className="is-complete" /> {locationText.confirmed}</span>
            <span><b>2</b><i className={location ? "is-complete" : ""} /> {locationText.pinpoint}</span>
            <span><b>3</b><i className={context.siteArea ? "is-complete" : ""} /> {locationText.trace}</span>
            <span><b>4</b><i /> {locationText.continue}</span>
          </div>
          {location && <BuildingProfileCard
            key={`${location.coordinates.lat.toFixed(5)}:${location.coordinates.lng.toFixed(5)}:${context.marketKey}`}
            language={language}
            coordinates={location.coordinates}
            marketKey={context.marketKey}
            applied={context.building}
            requested={detectRequested}
            onApply={onBuildingChange}
            onOpenViewer={setViewerMode}
          />}
          <p className="location-help">{locationText.retain}</p>
          <button type="button" className="button-primary wide" onClick={() => onNavigate("studio")} disabled={!location}>
            {locationText.continueStudio} <ArrowRight size={16} />
          </button>
        </aside>
      </div>}
      {viewerMode && location && <Suspense fallback={null}><GoogleSiteViewer coordinates={location.coordinates} label={locationLabel} language={language} initialMode={viewerMode} onClose={() => setViewerMode(null)} /></Suspense>}
    </section>
  );
}

function estimateEnergyPreview(settings: HomeEnergySettings, language: StudioLanguage, marketKey: MarketKey, solarAreaM2: number) {
  const text = outerCopy(language);
  const services = [
    settings.electricHeating ? text.services.electricHeating : null,
    settings.heatPump ? text.services.heatPump : null,
    settings.electricHotWater ? text.services.electricHotWater : null,
    settings.evCharger ? text.services.evCharger : null,
  ].filter(Boolean) as string[];
  const estimatedDemand = estimateAnnualDemandKwh(settings);
  const annualDemand = settings.demandMode === "bill" && settings.annualDemandKwh ? Math.round(settings.annualDemandKwh) : estimatedDemand;
  const directUse = settings.daytimeOccupancy === "usually" ? 46 : settings.daytimeOccupancy === "rarely" ? 30 : 38;
  const region = regionForMarket(marketKey);
  const costs = planningCosts(region, solarAreaM2, settings);
  const money = new Intl.NumberFormat(language, { style: "currency", currency: REGION_CONFIG[region].currency, maximumFractionDigits: 0 });
  return {
    annualDemand,
    directUse,
    cost: `${money.format(costs.projectPrice)}${costs.batteryPrice !== null ? ` + ${money.format(costs.batteryPrice)}` : ""}`,
    costEstimated: costs.projectPriceSource === "estimate" || costs.batteryPriceSource === "estimate",
    source: settings.demandMode === "bill" ? text.energyBill : text.moderniteEstimate,
    profile: `${settings.householdSize} ${settings.householdSize === 1 ? text.person : text.people} · ${text.occupancy[settings.daytimeOccupancy]} ${text.daytimePresence}`,
    services: services.length ? services.join(" · ") : text.noMajorLoads,
    battery: settings.batteryMode === "solar-battery" ? text.batteryConsidered(settings.batteryCapacityKwh) : text.solarOnlyBaseline,
  };
}

function EnergyPlanningPreview({ settings, language, marketKey, solarAreaM2 }: { settings: HomeEnergySettings; language: StudioLanguage; marketKey: MarketKey; solarAreaM2: number }) {
  const text = outerCopy(language);
  const preview = estimateEnergyPreview(settings, language, marketKey, solarAreaM2);
  return (
    <aside className="energy-planning-preview" aria-label={MISC_COPY[language].planningAria}>
      <div className="energy-preview-heading">
        <p className="mini-label">{text.planningProfile}</p>
        <span><i /> {text.livePreview}</span>
      </div>
      <div className="energy-preview-meter">
        <small>{text.estimatedAnnualUse}</small>
        <strong>{preview.annualDemand.toLocaleString()} <em>{MISC_COPY[language].perYear}</em></strong>
        <div><span style={{ width: `${Math.min(100, Math.max(18, (preview.annualDemand / 9000) * 100))}%` }} /></div>
        <p>{preview.source}</p>
      </div>
      <dl className="energy-preview-facts">
        <div><dt><Home size={14} /> {text.homeProfile}</dt><dd>{preview.profile}</dd></div>
        <div><dt><SunMedium size={14} /> {text.directSolarUse}</dt><dd>{text.aboutPercent(preview.directUse)}</dd></div>
        <div><dt><Zap size={14} /> {text.electricLoads}</dt><dd>{preview.services}</dd></div>
        <div><dt><BatteryCharging size={14} /> {text.storageScenario}</dt><dd>{preview.battery}</dd></div>
        <div><dt><TrendingUp size={14} /> {text.planningCostUsed}</dt><dd>{preview.cost}{preview.costEstimated ? ` ${text.estimateLabel}` : ""}</dd></div>
      </dl>
      <div className="energy-preview-connectors">
        <p className="mini-label">{text.connectsTo}</p>
        {text.connectors.map((item) => <span key={item}><Check size={12} /> {item}</span>)}
      </div>
    </aside>
  );
}

function HomeEnergyPanel({ settings, disabled, onChange, onPrepare, language, currency }: {
  currency: string;
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
    <aside className={`home-energy-panel ${open ? "is-open" : ""}`} aria-label={MISC_COPY[language].energyAria}>
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
          {settings.demandMode === "bill" && <label className="energy-number"><span>{text.annualUse}</span><input type="number" inputMode="numeric" min="500" max="100000" value={settings.annualDemandKwh ?? ""} onChange={(event) => setNumber("annualDemandKwh", event.target.value)} placeholder={MISC_COPY[language].demandExample} /><em>{MISC_COPY[language].perYear}</em></label>}
        </section>
        <section className="energy-field-group energy-household">
          <div className="energy-field-heading"><span>{text.householdRhythm}</span><small>{text.estimatedDemandOnly}</small></div>
          <label className="energy-number"><Users size={15} /><span>{text.peopleLiving}</span><input type="number" min="1" max="12" value={settings.householdSize} onChange={(event) => onChange({ householdSize: Math.max(1, Math.min(12, Number(event.target.value) || 1)) })} /></label>
          <div className="occupancy-choice" role="group" aria-label={MISC_COPY[language].occupancyAria}><span>{text.dayQuestion}</span>{(["usually", "sometimes", "rarely"] as const).map((option) => <button key={option} type="button" className={settings.daytimeOccupancy === option ? "is-selected" : ""} onClick={() => onChange({ daytimeOccupancy: option })}>{text.occupancy[option]}</button>)}</div>
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
          <p className="energy-sizing-note"><Cpu size={13} /> {text.sizingAtEnd}</p>
          {settings.batteryMode === "solar-battery" && <div className="energy-number-pair"><label className="energy-number"><span>{text.usableBattery}</span><input type="number" min="1" max="100" value={settings.batteryCapacityKwh} onChange={(event) => setNumber("batteryCapacityKwh", event.target.value)} /><em>kWh</em></label><label className="energy-number"><span>{text.batteryPrice}</span><input type="number" min="0" value={settings.batteryPriceGbp ?? ""} onChange={(event) => setNumber("batteryPriceGbp", event.target.value)} placeholder={text.optional} /><em>{currency}</em></label></div>}
        </section>
        <details className="cash-position-options"><summary>{text.cashInputs}</summary><label className="energy-number"><span>{text.installedSolarPrice}</span><input type="number" min="0" value={settings.projectPriceGbp ?? ""} onChange={(event) => setNumber("projectPriceGbp", event.target.value)} placeholder={text.optional} /><em>{currency}</em></label><small>{text.quoteNote}</small></details>
        <button type="button" className="energy-prepare-study" onClick={onPrepare} disabled={disabled}><Sparkles size={15} /> {disabled ? text.waitingStudio : text.calculateResults}<ArrowRight size={15} /></button>
      </div>}
    </aside>
  );
}

type StudioFacts = { typeId: string; width: number; depth: number; floors: number; usage: "office" | "residential"; surfaces: number; solarAreaM2: number };

function useStudioFacts(enabled: boolean) {
  const [facts, setFacts] = useState<StudioFacts | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const read = () => {
      try {
        const frame = document.querySelector<HTMLIFrameElement>("iframe.customer-studio-frame");
        const bridge = (frame?.contentWindow as StudioWindow | null)?.ModerniteEnergyBridge;
        const snapshot = bridge?.snapshot?.();
        if (!snapshot) return;
        const dims = bridge?.dimensions?.();
        const active = snapshot.surfaces.filter((surface) => surface.enabled !== false && surface.area > 0);
        const next: StudioFacts = {
          typeId: snapshot.building.id,
          width: dims?.width ?? snapshot.building.width ?? 0,
          depth: dims?.depth ?? snapshot.building.depth ?? 0,
          floors: dims?.floors ?? snapshot.building.floors ?? 0,
          usage: snapshot.building.usage === "office" ? "office" : "residential",
          surfaces: active.length,
          solarAreaM2: active.reduce((sum, surface) => sum + surface.area, 0),
        };
        setFacts((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
      } catch {
        /* Studio still loading */
      }
    };
    read();
    const timer = window.setInterval(read, 2000);
    return () => window.clearInterval(timer);
  }, [enabled]);
  return facts;
}

function EnergyPage({ settings, canCalculate, onChange, onPrepare, onNavigate, language, marketKey }: {
  settings: HomeEnergySettings;
  canCalculate: boolean;
  onChange: (next: Partial<HomeEnergySettings>) => void;
  onPrepare: () => void;
  onNavigate: (route: GatewayRoute) => void;
  language: StudioLanguage;
  marketKey: MarketKey;
}) {
  const text = outerCopy(language);
  const facts = useStudioFacts(true);
  const regionName = resultsCopy(language).regions[MARKET_TO_STUDIO_REGION[marketKey] ?? "UK"];
  const one = (value: number) => value.toLocaleString(language, { maximumFractionDigits: 1 });
  return (
    <section className="energy-page gateway-page">
      <PageIntro chapter={5} eyebrow={WORKFLOW_LABELS[language].energy} icon={<Lightbulb size={14} />} title={text.energyTitle} lede={text.energyIntro} />
      <div className="energy-page-workbench">
        <aside className="configured-building-card">
          <div className="configured-building-card__title"><span><Home size={19} /></span><div><p className="mini-label">{text.configuredBuilding}</p><button type="button" onClick={() => onNavigate("studio")}>{text.viewInStudio} <ArrowRight size={14} /></button></div></div>
          <img src={BUILDING_PREVIEW_URL} alt={MISC_COPY[language].buildingAlt} />
          <div className="configured-building-facts">
            <span><MapPinned size={15} /><b>{facts ? `${facts.typeId} · ${buildingTypeLabel(facts.typeId, language)}` : "—"}</b><small>{regionName}</small></span>
            <span><Home size={15} /><b>{facts?.usage === "office" ? text.office : text.residential}</b><small>{facts ? `${text.buildingSize} ${one(facts.width)} × ${one(facts.depth)} m · ${text.storeys(facts.floors)}` : "—"}</small></span>
            <span><BarChart3 size={15} /><b>{text.activeSolarSurfaces}</b><small>{facts?.surfaces ? facts.surfaces : text.noSurfaces}</small></span>
            <span><Pencil size={15} /><b>{text.solarArea}</b><small>{facts ? `${one(facts.solarAreaM2)} m²` : "—"}</small></span>
            <span><FileText size={15} /><b>{text.buildingFootprint}</b><small>{facts ? `${one(facts.width * facts.depth)} m²` : "—"}</small></span>
          </div>
          <div className="energy-note-card"><Lightbulb size={24} /><p><b>{text.energyNoteTitle}</b><small>{text.energyNoteBody}</small></p></div>
        </aside>
        <HomeEnergyPanel settings={settings} disabled={!canCalculate} onChange={onChange} onPrepare={onPrepare} language={language} currency={REGION_CONFIG[regionForMarket(marketKey)].currency} />
        <EnergyPlanningPreview settings={settings} language={language} marketKey={marketKey} solarAreaM2={facts?.solarAreaM2 ?? 0} />
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
  const pendingWeatherRef = useRef<{ key: string; site: { lat: number; lon: number; tz: number; zone: string; year: number }; addressLabel: string } | null>(null);
  const weatherLoadingKeyRef = useRef<string | null>(null);
  const [weatherState, setWeatherState] = useState<{ status: "idle" | "loading" | "ready" | "error"; label: string }>({ status: "idle", label: "" });
  const [weatherSource, setWeatherSource] = useState<WeatherSourceKey>(readWeatherSource);
  const [frameReady, setFrameReady] = useState(false);
  const [studyReady, setStudyReady] = useState(false);
  const [configuredSurfaceCount, setConfiguredSurfaceCount] = useState(0);
  const [configurationNotice, setConfigurationNotice] = useState<string | null>(null);
  const [studioTab, setStudioTab] = useState(0);
  const [realSurfaceCount, setRealSurfaceCount] = useState(0);
  const [tourOpen, setTourOpen] = useState(false);
  const guideRef = useRef<HTMLOListElement | null>(null);
  const guide = STUDIO_GUIDE_COPY[language];
  const [focusMode, setFocusMode] = useState(false);
  const toggleFocus = useCallback(() => {
    const root = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    const doc = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
    if (!focusMode) {
      setFocusMode(true);
      if (root.requestFullscreen) void root.requestFullscreen().catch(() => undefined);
      else root.webkitRequestFullscreen?.();
    } else {
      setFocusMode(false);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      else if (doc.webkitFullscreenElement) doc.webkitExitFullscreen?.();
    }
  }, [focusMode]);
  useEffect(() => {
    const sync = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element };
      if (!document.fullscreenElement && !doc.webkitFullscreenElement) setFocusMode(false);
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);
  useEffect(() => {
    if (!active && focusMode) {
      setFocusMode(false);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    }
  }, [active, focusMode]);
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
      marketLock.textContent = ".region-tabs, #open-catalog, #catalog-dialog, #modernite-building-controls .mb-block:has(#mb-query) { display: none !important; }";
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
    workflowStyle.textContent = ".language-switch, #language-select, #download-dialog > p:nth-of-type(2) { display: none !important; }";

    const advisorEndpoint = studioDocument.querySelector<HTMLInputElement>("#advisor-endpoint");
    if (advisorEndpoint && root.dataset.hostAdvisor !== "online") {
      const advisorMode = studioDocument.querySelector<HTMLSelectElement>("#advisor-mode");
      const advisorConsent = studioDocument.querySelector<HTMLInputElement>("#advisor-consent");
      advisorEndpoint.value = new URL(STUDIO_ADVISOR_PATH, window.location.origin).href;
      if (advisorConsent) advisorConsent.checked = true;
      if (advisorMode && advisorMode.value !== "online") {
        advisorMode.value = "online";
        advisorMode.dispatchEvent(new Event("change", { bubbles: true }));
      }
      root.dataset.hostAdvisor = "online";
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
        pendingWeatherRef.current = { key, site, addressLabel };
        setWeatherState({ status: "idle", label: "" });
      }
    }

    if (context.siteArea && !context.building) {
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

    const building = context.building;
    const bridge = studioWindow.ModerniteEnergyBridge;
    const buildingType = building ? studioTypeById(building.typeId) : undefined;
    if (building && buildingType && buildingType.region === studioRegion && bridge?.dimensions && bridge.setDimensions) {
      const buildingKey = JSON.stringify([building.typeId, building.widthM, building.depthM, building.floors, building.storeyHeightM, building.roofForm, building.roofPitchDeg, building.roofForm === "custom" ? building.roofPlanes : null, building.frontAzimuthDeg]);
      if (root.dataset.hostBuilding !== buildingKey) {
        const houseSelect = studioDocument.querySelector<HTMLSelectElement>("#house-select");
        if (houseSelect && houseSelect.value !== building.typeId && Array.from(houseSelect.options).some((option) => option.value === building.typeId)) {
          houseSelect.value = building.typeId;
          houseSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
        const dimensions = studioDimensions(buildingType, building, bridge.dimensions().wwr ?? 0.2);
        try {
          try {
            bridge.setDimensions(dimensions);
          } catch (error) {
            console.warn("[studio] roof override rejected, keeping the building type's roof", error);
            const { roofForm: _roofForm, pitch: _pitch, roofPlanes: _roofPlanes, ...plain } = dimensions as typeof dimensions & { roofPlanes?: unknown };
            bridge.setDimensions(plain);
          }
          studioWindow.ModerniteEnergyApp?.setOrientation?.(building.frontAzimuthDeg % 360);
          studioWindow.dispatchEvent(new Event("modernite-model-change"));
          root.dataset.hostBuilding = buildingKey;
          if (isDetectedBuilding(building) && root.dataset.hostGuideAdvanced !== building.locationKey) {
            root.dataset.hostGuideAdvanced = building.locationKey;
            studioDocument.querySelectorAll<HTMLButtonElement>("nav.studio-tabs .studio-tab")[1]?.click();
          }
        } catch (error) {
          console.warn("[studio] building parameters not applied", error);
        }
      }
    }
    const firstSection = studioDocument.querySelector("section.section");
    let banner = studioDocument.querySelector<HTMLParagraphElement>("#host-detected-banner");
    if (building && isDetectedBuilding(building) && firstSection) {
      if (!banner) {
        banner = studioDocument.createElement("p");
        banner.id = "host-detected-banner";
        banner.style.cssText = "margin:4px 0 14px;padding:10px 12px;border:1px solid #cfe3cf;border-radius:10px;color:#24523c;background:#eef6ee;font-size:12px;line-height:1.55";
        (firstSection.querySelector(".section-title") ?? firstSection.firstElementChild)?.after(banner);
      }
      banner.textContent = `✓ ${STUDIO_GUIDE_COPY[language].detectedBanner}`;
    } else {
      banner?.remove();
    }
  }, [context.building, context.location, context.siteArea, language, studioRegion, weatherSource]);

  const loadStudioWeather = useCallback(() => {
    const pending = pendingWeatherRef.current;
    const studioWindow = frameRef.current?.contentWindow as StudioWindow | null;
    if (!pending || !studioWindow || weatherLoadingKeyRef.current === pending.key) return;
    weatherLoadingKeyRef.current = pending.key;
    weatherAbortRef.current?.abort();
    const controller = new AbortController();
    weatherAbortRef.current = controller;
    const { site, addressLabel } = pending;
    const sourceLabel = WEATHER_SOURCE_LABELS[weatherSource];
    setWeatherState({ status: "loading", label: MISC_COPY[language].weatherLoading(sourceLabel.short) });
    const weatherQuery = new URLSearchParams({ lat: String(site.lat), lon: String(site.lon), tz: String(site.tz), zone: site.zone, year: String(site.year), address: addressLabel });
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
        weatherLoadingKeyRef.current = null;
        setWeatherState({ status: "error", label: `${sourceLabel.short} unavailable — Studio uses its synthetic climate (${error instanceof Error ? error.message : "error"})` });
      });
  }, [language, weatherSource]);

  useEffect(() => {
    if (frameReady) applyStudioContext();
  }, [applyStudioContext, frameReady]);

  useEffect(() => {
    const studioWindow = frameReady ? frameRef.current?.contentWindow : null;
    if (!studioWindow) return;
    studioWindow.addEventListener("modernite-weather-needed", loadStudioWeather);
    return () => studioWindow.removeEventListener("modernite-weather-needed", loadStudioWeather);
  }, [frameReady, loadStudioWeather]);

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
      setRealSurfaceCount(snapshot ? mapStudioSnapshotToSurfaces(snapshot).length : 0);
      const tabs = Array.from(frame?.contentDocument?.querySelectorAll<HTMLButtonElement>("nav.studio-tabs .studio-tab") ?? []);
      const current = tabs.findIndex((tab) => tab.getAttribute("aria-pressed") === "true");
      if (current >= 0) setStudioTab(current);
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

  const tourSiteKey = context.location ? `${context.location.coordinates.lat.toFixed(5)}:${context.location.coordinates.lng.toFixed(5)}` : "sample";
  useEffect(() => {
    if (!active || !frameReady) return;
    try {
      if (window.sessionStorage.getItem(STUDIO_TOUR_STORAGE_KEY) === tourSiteKey) return;
    } catch {
      // Storage unavailable: show the guide anyway.
    }
    const timer = window.setTimeout(() => setTourOpen(true), 900);
    return () => window.clearTimeout(timer);
  }, [active, frameReady, tourSiteKey]);

  const closeTour = useCallback(() => {
    setTourOpen(false);
    try {
      window.sessionStorage.setItem(STUDIO_TOUR_STORAGE_KEY, tourSiteKey);
    } catch {
      // Private browsing: the guide simply shows again next time.
    }
  }, [tourSiteKey]);

  const continueRef = useRef(continueToEnergy);
  continueRef.current = continueToEnergy;
  useEffect(() => {
    if (!frameReady) return;
    const studioDocument = frameRef.current?.contentDocument;
    const actions = studioDocument?.getElementById("generate-report")?.parentElement;
    const tabs = Array.from(studioDocument?.querySelectorAll<HTMLButtonElement>("nav.studio-tabs .studio-tab") ?? []);
    if (!studioDocument || !actions || tabs.length === 0) return;
    if (!studioDocument.querySelector("style[data-host-next-step]")) {
      const style = studioDocument.createElement("style");
      style.dataset.hostNextStep = "true";
      style.textContent = "#host-next-step{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:44px;border:1px solid #2f6b4f;border-radius:7px;color:#24523c;background:#eef6ee;font-family:inherit;font-size:14px;font-weight:650;line-height:1.2;cursor:pointer}#host-next-step:hover{background:#e1efe2}#host-next-step.is-final{min-height:48px;border-color:#1f5a3f;color:#fff;background:linear-gradient(120deg,#2f6b4f,#1f4f38);box-shadow:0 6px 18px #1f4f3833;animation:host-next-pulse 2.4s ease-in-out infinite}#host-next-step.is-final:hover{background:#1f4f38}@keyframes host-next-pulse{50%{box-shadow:0 0 0 6px #2f6b4f22,0 6px 18px #1f4f3833}}@media (prefers-reduced-motion:reduce){#host-next-step.is-final{animation:none}}";
      studioDocument.head.append(style);
    }
    let button = studioDocument.getElementById("host-next-step") as HTMLButtonElement | null;
    if (!button) {
      button = studioDocument.createElement("button");
      button.type = "button";
      button.id = "host-next-step";
      button.dataset.noI18n = "";
    }
    if (button.parentElement !== actions || actions.lastElementChild !== button) actions.append(button);
    const last = studioTab >= tabs.length - 1;
    const target = last ? null : tabs[studioTab + 1];
    const label = last ? guide.steps[3] : target?.querySelector(".tab-name")?.textContent?.trim() || "";
    button.textContent = `${guide.tour.next} · ${label} →`;
    button.classList.toggle("is-final", last);
    button.onclick = () => {
      if (target) {
        target.click();
        setStudioTab(studioTab + 1);
      } else {
        continueRef.current();
      }
    };
  }, [frameReady, studioTab, guide, language]);

  const openStudioTab = (index: number) => {
    frameRef.current?.contentDocument?.querySelectorAll<HTMLButtonElement>("nav.studio-tabs .studio-tab")[index]?.click();
    setStudioTab(index);
    frameRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  const appliedBuilding = context.building;
  const buildingSummary = appliedBuilding ? `${appliedBuilding.typeId} · ${appliedBuilding.widthM} × ${appliedBuilding.depthM} m` : "";
  const guideSteps = [
    { title: guide.steps[0], status: appliedBuilding ? (isDetectedBuilding(appliedBuilding) ? guide.building.detected(buildingSummary) : buildingSummary) : guide.building.manual, done: Boolean(appliedBuilding), current: studioTab === 0, onClick: () => openStudioTab(0) },
    { title: guide.steps[1], status: realSurfaceCount ? guide.products.done(realSurfaceCount) : guide.products.todo, done: realSurfaceCount > 0, current: studioTab === 1, onClick: () => openStudioTab(1) },
    { title: guide.steps[2], status: guide.finishes, done: false, optional: true, current: studioTab === 2 || studioTab === 3, onClick: () => openStudioTab(2) },
    { title: guide.steps[3], status: guide.energy, done: false, current: false, onClick: continueToEnergy, next: true, ready: realSurfaceCount > 0 },
  ];
  const guideStep = (index: number) => () => guideRef.current?.children[index] ?? null;
  const tourTargets = [() => guideRef.current, guideStep(0), guideStep(1), () => frameRef.current, guideStep(3)];

  return (
    <main className={`customer-studio-shell is-workspace ${active ? "is-active" : ""} ${focusMode ? "is-focus" : ""}`} aria-hidden={!active}>
      <header className="studio-bridge-bar">
        <button type="button" className="studio-bridge-brand" onClick={() => onNavigate("location")} aria-label={bridgeCopy.returnToSite}>
          <span className="brand-mark"><Leaf size={16} strokeWidth={2.2} /></span>
          <span><strong>MODERNITÉ</strong><small>BUILDING INTEGRATED SOLAR</small></span>
        </button>
        <div className="studio-bridge-journey" aria-label={text.studioProgressLabel}>
          {studioJourney.map((step, index) => <div className="studio-bridge-journey__segment" key={step.id}>
            <span className={`${step.complete ? "is-complete" : ""} ${step.id === "studio" ? "is-current" : ""}`} title={step.id === "studio" ? bridgeCopy.facets : undefined}>
              <i>{step.complete ? <Check size={10} /> : `0${index + 1}`}</i>
              <b>{step.label}</b>
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
          <AdvisorHeaderButton language={language} />
          <button type="button" className="studio-return" onClick={() => onNavigate("location")}><ArrowLeft size={14} /> {bridgeCopy.returnToSite}</button>
          <button type="button" className="studio-calculate" onClick={continueToEnergy}><ArrowRight size={14} /> {bridgeCopy.prepareStudy}</button>
        </div>
      </header>
      <PageIntro chapter={4} eyebrow={WORKFLOW_LABELS[language].studio} icon={<Layers3 size={14} />} title={text.studioTitle} lede={text.studioIntro} className="studio-page-intro" />
      <section className="studio-host-context studio-guide">
        <span className="studio-site-context"><MapPinned size={22} /><small>{text.currentSite}</small><b>{context.location ? cleanAddressLabel(context.location.label, language) : text.fallbackAddress}</b>{context.location && <span className="studio-weather-row"><label className="studio-weather-select"><SunMedium size={11} aria-hidden="true" /><span className="sr-only">{MISC_COPY[language].weatherSource}</span><select value={weatherSource} onChange={(event) => changeWeatherSource(event.target.value as WeatherSourceKey)} aria-label={MISC_COPY[language].weatherSource}>{(Object.keys(WEATHER_SOURCE_LABELS) as WeatherSourceKey[]).map((key) => <option key={key} value={key}>{WEATHER_SOURCE_LABELS[key].short}</option>)}</select></label>{weatherState.status !== "idle" && <em className={`studio-weather-chip is-${weatherState.status}`} title={weatherState.label}>{weatherState.status === "ready" ? weatherState.label : weatherState.status === "loading" ? MISC_COPY[language].weatherLoading(WEATHER_SOURCE_LABELS[weatherSource].short) : MISC_COPY[language].weatherUnavailable(WEATHER_SOURCE_LABELS[weatherSource].short)}</em>}</span>}</span>
        <ol className="studio-guide-steps" ref={guideRef} aria-label={text.studioProgressLabel}>
          {guideSteps.map((step, index) => <li key={step.title}>
            <button type="button" className={`${step.done ? "is-done" : ""} ${step.current ? "is-current" : ""} ${step.next ? "is-next" : ""} ${step.ready ? "is-ready" : ""}`} onClick={step.onClick}>
              <em>{step.done ? <Check size={12} /> : index + 1}</em>
              <strong>{step.title}{step.optional && <u>{guide.optional}</u>}</strong>
              <small>{step.status}</small>
              {step.next && <ArrowRight size={15} className="studio-guide-arrow" />}
            </button>
          </li>)}
        </ol>
        <div className="studio-guide-tools">
          <button type="button" className="studio-tour-button" onClick={() => setTourOpen(true)}><CircleHelp size={15} /> {guide.tutorial}</button>
          <button type="button" className="studio-tour-button studio-fullscreen-button" onClick={toggleFocus}><Maximize2 size={15} /> {guide.fullscreen}</button>
        </div>
      </section>
      <div className="customer-studio-stage">
        {focusMode && <div className="studio-focus-bar">
          <button type="button" onClick={toggleFocus}><Minimize2 size={14} /> {guide.exitFullscreen}</button>
          <button type="button" className="is-primary" onClick={() => { toggleFocus(); continueToEnergy(); }}>{guide.steps[3]} <ArrowRight size={14} /></button>
        </div>}
        {!frameReady && <div className="studio-opening-notice" aria-live="polite"><LoaderCircle size={15} /><span><b>{bridgeCopy.openingStudio}</b><small>{bridgeCopy.runtimeNotice}</small></span></div>}
        <iframe
          ref={frameRef}
          title="Modernité Solar Studio"
          className="customer-studio-frame"
          src={CUSTOMER_STUDIO_URL}
          allow="clipboard-read; clipboard-write; fullscreen"
          onLoad={() => {
            setFrameReady(true);
            window.setTimeout(applyStudioContext, 200);
          }}
        />
      </div>
      <div className="studio-aftercare" aria-label={MISC_COPY[language].nextStepAria}>
        <div className="studio-aftercare-copy"><p className="mini-label">{text.configurationComplete}</p><h2>{text.nextEnergyTitle}</h2><p>{text.nextEnergyBody}</p></div>
        <button type="button" className="studio-aftercare-action" onClick={continueToEnergy}><span><small>{text.step05}</small><b>{text.homeEnergyCta}</b></span><ArrowRight size={17} /></button>
      </div>
      {studyReady && configuredSurfaceCount === 0 && <div className="studio-configuration-notice" role="status"><CircleHelp size={15} /><span><b>{text.configurationRequired}</b><small>{text.configurationRequiredBody}</small></span></div>}
      {tourOpen && active && <StudioTour copy={guide.tour} targets={tourTargets} onClose={closeTour} />}
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
        {!error && <div className="calculation-stages" aria-label={MISC_COPY[language].stagesAria}>
          {text.calculationStages.map((stage, index) => <span key={stage} className={index === 0 ? "is-active" : ""}><i /> {stage}</span>)}
        </div>}
        {error && <button type="button" className="button-primary" onClick={onBack}>{text.returnStudio} <ArrowLeft size={16} /></button>}
      </div>
    </section>
  );
}

const SHARED_PROJECT_PATH = /^\/p\/([A-Za-z0-9]{10})\/?$/;

function sharedProjectId() {
  const path = APP_BASE_PATH && window.location.pathname.startsWith(APP_BASE_PATH) ? window.location.pathname.slice(APP_BASE_PATH.length) : window.location.pathname;
  return path.match(SHARED_PROJECT_PATH)?.[1] ?? null;
}

function SharedProjectPage({ id, language, copy, onLanguageChange, onContinue }: {
  id: string;
  language: StudioLanguage;
  copy: GatewayCopy;
  onLanguageChange: (language: StudioLanguage) => void;
  onContinue: (study: ProjectCalculation | null, context: ProjectContext | null, route: GatewayRoute) => void;
}) {
  const query = trpc.sharedProject.get.useQuery({ id }, { retry: 1, staleTime: Infinity });
  const printing = new URLSearchParams(window.location.search).get("print") === "1";
  const c = shareCopy(language);
  const study = (query.data?.study ?? null) as ProjectCalculation | null;
  const context = (query.data?.context ?? null) as ProjectContext | null;
  useEffect(() => {
    document.documentElement.classList.toggle("is-print-render", printing);
  }, [printing]);
  const continueTo = (route: GatewayRoute) => onContinue(study, context, route);
  return (
    <main className="gateway-shell gateway-shell--results shared-project">
      {!printing && <GatewayHeader route="results" language={language} copy={copy} canOpenStudio={Boolean(study)} onLanguageChange={onLanguageChange} onNavigate={continueTo} />}
      {!printing && study && <div className="shared-project-banner"><span><Link2 size={14} /> {c.sharedBanner}</span><button type="button" className="button-secondary" onClick={() => continueTo("results")}>{c.continueHere} <ArrowRight size={14} /></button></div>}
      {query.isLoading && <section className="results-page gateway-page shared-project-state"><Loader2 size={18} className="spin" /> {c.loading}</section>}
      {query.isError && <section className="results-page gateway-page shared-project-state"><p>{c.missing}</p><button type="button" className="button-primary" onClick={() => continueTo("entry")}>{c.backHome}</button></section>}
      {study && <Suspense fallback={<section className="results-page gateway-page" />}><ResultsPage
        study={study}
        preferredBatteryMode={context?.energySettings?.batteryMode ?? "solar-only"}
        onNavigate={continueTo}
        language={language}
        marketKey={context?.marketKey ?? (study.project?.market as MarketKey | undefined) ?? "GB"}
        share={{ sharedId: id }}
      /></Suspense>}
    </main>
  );
}

export default function App() {
  const [sharedId, setSharedId] = useState(sharedProjectId);
  const [route, setRoute] = useState<GatewayRoute>(() => routeFromPath(window.location.pathname));
  const [context, setContext] = useState<ProjectContext>(loadContext);
  const [studioLanguage, setStudioLanguage] = useState<StudioLanguage>(loadStudioLanguage);
  const [studioMounted, setStudioMounted] = useState(() => (["studio", "energy", "calculation", "results"] as GatewayRoute[]).includes(route));
  const [study, setStudy] = useState<ProjectCalculation | null>(() => loadSavedStudy() ?? createDemoStudy(loadContext()));
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
    setStudy((current) => (current && !current.caseId.startsWith("MOD-DEMO") ? current : createDemoStudy(context)));
  }, [context.marketKey, context.location, context.building]);

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
    setContext((current) => {
      const changed = current.marketKey !== next.key;
      return {
        version: 3,
        siteArea: changed ? null : current.siteArea ?? null,
        building: changed ? null : current.building ?? null,
        marketKey: next.key,
        europeanCountry: next.key === "EU" ? current.europeanCountry ?? DEFAULT_EUROPEAN_COUNTRY : null,
        location: changed ? DEFAULT_PROJECT_LOCATION : current.location ?? DEFAULT_PROJECT_LOCATION,
        energySettings: current.energySettings,
        updatedAt: Date.now(),
      };
    });
  }, []);

  const updateLocation = useCallback((location: ProjectLocationSelection) => {
    setContext((current) => {
      const key = (point?: { lat: number; lng: number }) => (point ? `${point.lat.toFixed(6)},${point.lng.toFixed(6)}` : "");
      const moved = key(current.location?.coordinates) !== key(location.coordinates);
      return { ...current, location, building: moved ? null : current.building, siteArea: moved ? null : current.siteArea, updatedAt: Date.now() };
    });
  }, []);

  const updateBuilding = useCallback((building: AppliedBuilding | null) => {
    setContext((current) => ({ ...current, building, updatedAt: Date.now() }));
  }, []);

  const updateSiteArea = useCallback((siteArea: SiteAreaSelection | null) => {
    setContext((current) => ({ ...current, siteArea, updatedAt: Date.now() }));
  }, []);

  const updateEnergySettings = useCallback((next: Partial<HomeEnergySettings>) => {
    setContext((current) => ({ ...current, energySettings: { ...current.energySettings, ...next }, updatedAt: Date.now() }));
  }, []);

  const updateEuropeanCountry = useCallback((europeanCountry: EuropeanMarket | null) => {
    setContext((current) => {
      const changed = Boolean(europeanCountry) && (current.marketKey !== "EU" || current.europeanCountry?.shortName !== europeanCountry?.shortName);
      return {
        ...current,
        marketKey: europeanCountry ? "EU" : current.marketKey,
        europeanCountry,
        location: changed ? DEFAULT_PROJECT_LOCATION : current.location ?? DEFAULT_PROJECT_LOCATION,
        siteArea: changed ? null : current.siteArea ?? null,
        building: changed ? null : current.building ?? null,
        updatedAt: Date.now(),
      };
    });
  }, []);

  const beginProject = useCallback(() => {
    setCalculationError(null);
    const nextContext: ProjectContext = {
      version: 3,
      marketKey: "EU",
      europeanCountry: DEFAULT_EUROPEAN_COUNTRY,
      location: DEFAULT_PROJECT_LOCATION,
      siteArea: null,
      energySettings: DEFAULT_ENERGY_SETTINGS,
      updatedAt: Date.now(),
    };
    setContext(nextContext);
    setStudy(createDemoStudy(nextContext));
    navigate("market");
  }, [navigate]);

  const startCalculation = useCallback(async (studioSnapshot: StudioCalculationSnapshot, extras: StudyRequestExtras = {}) => {
    if (!context.location) {
      setCalculationError(MISC_COPY[studioLanguage].noLocation);
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
        setCalculationError(MISC_COPY[studioLanguage].aborted);
      } else if (/too_small|expected array to have|at least one supported solar product/i.test(message)) {
        setCalculationError(MISC_COPY[studioLanguage].addProduct);
      } else {
        const demoStudy = createDemoStudy(context, studioSnapshot, extras);
        setStudy(demoStudy);
        setCalculationError(null);
        navigate("results");
      }
    }
  }, [context, navigate, runCalculation, studioLanguage]);

  const advisorCaseId = study && !study.caseId.startsWith("MOD-DEMO") ? study.caseId : undefined;
  const getAdvisorContext = useCallback(() => {
    const lines = [`Current step: ${route}`, `Market: ${market.name} (${context.marketKey})`];
    if (context.location) lines.push(`Site: ${cleanAddressLabel(context.location.label, "en")} (${context.location.coordinates.lat.toFixed(5)}, ${context.location.coordinates.lng.toFixed(5)})`);
    else lines.push("Site: not chosen yet");
    if (context.siteArea) lines.push(`Traced site area: ${context.siteArea.areaM2.toFixed(1)} m²`);
    const building = context.building;
    lines.push(building
      ? `Building applied from the site step: ${building.typeId}, ${building.widthM.toFixed(1)} × ${building.depthM.toFixed(1)} m, ${building.floors} storeys of ${building.storeyHeightM} m, ${building.roofForm} roof ${building.roofPitchDeg}°, front faces ${building.frontAzimuthDeg}°`
      : "Building: not read from map data; the Design Studio uses its own building settings");
    lines.push(`Home energy inputs: ${JSON.stringify(context.energySettings)}`);
    try {
      const studio = (document.querySelector<HTMLIFrameElement>("iframe.customer-studio-frame")?.contentWindow as (Window & { ModerniteAdvisorCore?: { context: () => string } }) | null)?.ModerniteAdvisorCore?.context();
      if (studio) lines.push("", "Design Studio configuration:", studio);
    } catch {
      /* Studio not loaded */
    }
    if (study && advisorCaseId) lines.push("", `A project study has been calculated (reference ${study.caseId}); annual generation ≈ ${Math.round(study.result.range.representative)} kWh from ${study.result.totalCapacityKwp.toFixed(2)} kWp.`);
    else lines.push("", "No project study has been calculated yet; inverter and battery sizing happens when the customer confirms the calculation.");
    return lines.join("\n");
  }, [advisorCaseId, context, market.name, route, study]);

  const saveSharedProject = trpc.sharedProject.save.useMutation();
  const createShare = useCallback(async () => {
    if (!study) throw new Error("No study");
    const { id } = await saveSharedProject.mutateAsync({ language: studioLanguage, payload: { study: study as unknown as Record<string, unknown>, context: context as unknown as Record<string, unknown> } });
    return id;
  }, [context, saveSharedProject, study, studioLanguage]);
  const continueFromShared = useCallback((sharedStudy: ProjectCalculation | null, sharedContext: ProjectContext | null, nextRoute: GatewayRoute) => {
    if (sharedStudy) setStudy(sharedStudy);
    if (sharedContext && markets.some((item) => item.key === sharedContext.marketKey)) setContext({ ...sharedContext, version: 3, updatedAt: Date.now() });
    setSharedId(null);
    window.history.replaceState({}, "", routePath(nextRoute));
    navigate(nextRoute);
  }, [navigate]);

  if (sharedId) return <SharedProjectPage id={sharedId} language={studioLanguage} copy={copy} onLanguageChange={setStudioLanguage} onContinue={continueFromShared} />;

  const showGateway = route !== "studio";
  return (
    <>
      {showGateway && <main className={`gateway-shell gateway-shell--${route}`}>
        <GatewayHeader route={route} language={studioLanguage} copy={copy} canOpenStudio={Boolean(context.location)} onLanguageChange={setStudioLanguage} onNavigate={navigate} />
        {route === "entry" && <EntryPage copy={copy} language={studioLanguage} onLanguageChange={setStudioLanguage} onStart={beginProject} onNavigate={navigate} />}
        {route === "market" && <MarketPage language={studioLanguage} market={market} europeanCountry={context.europeanCountry} copy={copy} onMarketChange={updateMarket} onEuropeanCountryChange={updateEuropeanCountry} onNavigate={navigate} />}
        {route === "location" && <LocationPage language={studioLanguage} market={market} context={context} copy={copy} onLocationChange={updateLocation} onAreaChange={updateSiteArea} onBuildingChange={updateBuilding} onNavigate={navigate} />}
        {route === "energy" && <EnergyPage
          settings={context.energySettings}
          canCalculate={Boolean(context.location)}
          onChange={updateEnergySettings}
          onPrepare={() => {
            if (!context.location) {
              setCalculationError(MISC_COPY[studioLanguage].noLocation);
              navigate("location");
              return;
            }
            window.dispatchEvent(new Event("modernite:study-request"));
          }}
          onNavigate={navigate}
          language={studioLanguage}
          marketKey={context.marketKey}
        />}
        {route === "calculation" && <CalculationLoadingPage error={calculationError} onBack={() => navigate("studio")} language={studioLanguage} />}
        {route === "results" && study && <Suspense fallback={<section className="results-page gateway-page" />}><ResultsPage study={study} preferredBatteryMode={context.energySettings.batteryMode} onNavigate={navigate} language={studioLanguage} marketKey={context.marketKey} share={{ onCreate: createShare }} /></Suspense>}
        {route === "results" && !study && <CalculationLoadingPage error={MISC_COPY[studioLanguage].noStudy} onBack={() => navigate("studio")} language={studioLanguage} />}
      </main>}
      <ModerniteAdvisor language={studioLanguage} route={route} getContext={getAdvisorContext} caseId={advisorCaseId} />
      {studioMounted && <StudioPage active={route === "studio"} market={market} context={context} language={studioLanguage} onLanguageChange={setStudioLanguage} onNavigate={navigate} onRunCalculation={startCalculation} />}
    </>
  );
}
