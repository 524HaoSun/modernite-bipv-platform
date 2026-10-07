export type Region = "UK" | "EU" | "CA" | "JP";

export type Provenance = "measured" | "data" | "manufacturer" | "assumed" | "user";

export type SurfaceKind =
  | "roof-plane"
  | "facade"
  | "window"
  | "skylight"
  | "railing"
  | "canopy"
  | "conservatory-roof"
  | "ground";

export type Surface = {
  id: string;
  kind: SurfaceKind;
  label: string;
  areaM2: number;
  areaSource: Provenance;
  azimuthDeg: number; // 0-359, compass: N=0, E=90, S=180, W=270
  tiltDeg: number; // 0-90, 90 = vertical
  tiltSource: "archetype" | "user";
  coverage: number; // 0-1 fraction carrying product
  productId: string | null;
  finishId: string | null;
  included: boolean;
  shadingNote?: string;
  parentStructureId?: string;
};

export type WallMaterial =
  | "render"
  | "brick"
  | "siding"
  | "stone"
  | "concrete"
  | "fibre"
  | "tilewall";

export type AdditionalStructureKind = "conservatory" | "carport" | "canopy";

export type AdditionalStructure = {
  id: string;
  kind: AdditionalStructureKind;
  form?: "lean-to" | "gable-fronted";
  widthM: number;
  depthM: number;
  eavesHeightM: number;
  ridgeHeightM?: number;
  attachElevation?: "front" | "rear" | "left" | "right";
  /** Fraction of the available roof/glass surface covered by solar material. */
  solarCoverage?: number;
};

export type BuildingConfig = {
  archetypeId: string;
  use: "residential" | "office";
  storeys: number;
  storeyHeightM: number;
  widthM: number;
  depthM: number;
  roofForm: "gable" | "hip" | "mono" | "flat";
  roofPitchDeg: number;
  structures: AdditionalStructure[];
};

export type LatLng = {
  lat: number;
  lng: number;
};

export type FacadeDirection = "north" | "east" | "south" | "west";

export type FacadeStudySelection = {
  direction: FacadeDirection;
  headingDeg: number;
  selectedAt: number;
};

export type LocationInfo = {
  region: Region;
  countryCode?: string;
  countryName?: string;
  lat: number;
  lng: number;
  postcode?: string;
  label?: string;
  locality?: string;
  adminRegion?: string;
  footprint: LatLng[];
  footprintAreaM2: number;
  centroid: LatLng;
  measureMode: "traced" | "ground" | "typed";
  facadeStudy?: FacadeStudySelection;
};

export type SavedRoofArea = {
  id: string;
  name: string;
  savedAt: number;
  location: LocationInfo;
};

export type EnergyProfile = {
  demandMode: "actual" | "estimated";
  annualDemandKwh: number | null;
  demandSource: "bill" | "llm" | "deterministic";
  householdSize: number;
  daytimeOccupancy: "usually" | "sometimes" | "rarely";
  electricHeating: boolean;
  heatPump: boolean;
  electricHotWater: boolean;
  evCharger: boolean;
  importPence: number;
  exportPence: number;
  offPeakPence: number;
  offPeakHours: number;
  peakPence: number;
  peakHours: number;
};

export type CostProfile = {
  schemePriceGbp: number | null;
  conventionalMaterialGbp: number | null;
  conventionalLabourGbp: number | null;
  batteryInterest: "yes" | "maybe" | "no";
  batteryCapacityKwh: number;
  batteryPriceGbp: number | null;
  batteryUsablePercent: number;
  batteryEfficiencyPercent: number;
  importGrowthPercent: number;
  exportGrowthPercent: number;
  annualMaintenanceGbp: number;
  inverterReplacementYear: number;
  inverterReplacementGbp: number;
  batteryReplacementYear: number;
  batteryReplacementPercent: number;
};

export type SurfaceResult = {
  surfaceId: string;
  surfaceLabel: string;
  kind: SurfaceKind;
  orientationName: "south" | "east" | "west" | "north" | "horizontal";
  azimuthDeg: number;
  tiltDeg: number;
  areaM2: number;
  productName: string;
  finishName?: string;
  capacityKwp: number;
  annualKwh: number;
  monthlyKwh: number[]; // length 12
  specificYield: number; // kWh/kWp
  irradiationKwhM2: number;
  sharePercent: number;
  components?: { beam: number; diffuse: number; reflected: number };
  excluded?: string;
};

export type FinancialScenario = {
  id: "solar-only" | "battery-only" | "solar-battery";
  title: string;
  available: boolean;
  unavailableReason?: string;
  upfrontGbp: number;
  firstYearBenefitGbp: number;
  breakEvenYear: number | null;
  net25YearGbp: number;
  annualCashFlows: {
    year: number;
    solarGenerationKwh: number;
    selfConsumedKwh: number;
    directUseKwh: number;
    exportKwh: number;
    billSavingGbp: number;
    exportIncomeGbp: number;
    monetizableValueGbp: number;
    arbitrageIncomeGbp: number;
    maintenanceCostGbp: number;
    replacementCostGbp: number;
    netBenefitGbp: number;
    cumulativeNetGbp: number;
  }[];
};

export type SystemRecommendation = {
  inverterKw: number;
  inverterType: string;
  mpptArrangement: string;
  batteryCapacityKwh: number;
  installerNotes: string[];
};

export type ProductScheduleLine = {
  productId: string;
  productName: string;
  finishName: string;
  surfaceNames: string[];
  totalAreaM2: number;
  unit: "m²";
  peakPowerWpM2: number;
  totalCapacityKwp: number;
};

export type LedgerEntry = {
  id: string;
  label: string;
  value: string;
  provenance: Provenance;
  stepNumber: number;
  fieldKey: string;
  note?: string;
  /** Raw values behind `value`, so the client can render the entry in the reader's language. */
  params?: Record<string, string | number | null>;
};

export type EstimateResult = {
  caseNumber: string;
  timestamp: string;
  range: {
    low: number;
    representative: number;
    high: number;
    bandPercent: number;
  };
  totalCapacityKwp: number;
  surfaces: SurfaceResult[];
  monthlyByOrientation: {
    month: number;
    monthName: string;
    south: number;
    east: number;
    west: number;
    north: number;
    horizontal: number;
    total: number;
  }[];
  scenarios: FinancialScenario[];
  recommendedScenarioId: "solar-only" | "battery-only" | "solar-battery";
  recommendation: SystemRecommendation;
  schedule: ProductScheduleLine[];
  ledger: LedgerEntry[];
  summary: string;
  engine: {
    method: "llm-banded" | "deterministic";
    irradianceDatabase: string;
    albedo: number;
    conversionRule: string;
    guardsTriggered: string[];
  };
};

export type ArchetypeRecord = {
  id: string;
  baseModel: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  region: Region;
  labelKey: string;
  widthM: number;
  depthM: number;
  floors: number;
  storeyHeightM: number;
  baseHeightM: number;
  overhangM: number;
  roofForm: "gable" | "hip" | "mono" | "flat";
  roofPitchDeg: number;
  ridgeAxis?: "x" | "z";
  wallMaterial: WallMaterial;
  accentMaterial?: WallMaterial;
  units: number;
  targetUnit: number;
  detailPack?: "uk" | "eu" | "ca" | "jp";
};

export type ProductModel = {
  id: string;
  name: string;
  wpPerM2: number;
  colouredWpPerM2: number | null;
  appliesTo: SurfaceKind[];
  glassSizeMm?: string;
  tileSizeMm?: string;
  thicknessMm?: number;
  descriptionKey: string;
  category: "roof" | "facade" | "window" | "railing" | "structure";
  uValue?: number;
  gValue?: number;
  vltPercent?: number;
  maxGlassMm?: string;
};

export type TileColour = {
  id: string;
  name: string;
  ral: string | null;
  hex: string;
  recommendedUk?: boolean;
};
