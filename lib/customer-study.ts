import { REGION_CONFIG } from "../data/constants";
import type { EstimateResult, LedgerEntry, ProductScheduleLine, SurfaceResult } from "../types/solar";
import * as core from "./customer-energy-core";
import { calculateFinancialScenarios } from "./financial";
import { compassName } from "./geometry";
import type { GoogleSolarReference } from "./google-solar";
import { activeAreaByFamily, buildPlanningInput, estimateAnnualDemandKwh, planningCosts, productForSnapshot, regionForMarket, type HomeEnergySettings, type StudioCalculationSnapshot } from "./studio-calculation";

export type Market = "GB" | "EU" | "CA" | "JP";

export type WeatherKind = "nasa-power" | "pvgis-tmy" | "customer-synthetic";

export type WeatherProvenance = {
  kind: WeatherKind;
  name: string;
  source: string;
  sourceURL?: string;
  annualGhiKwhM2: number;
  annualDniKwhM2: number;
  annualDhiKwhM2: number;
  meanAirTemperatureC: number;
  hours: number;
};

export type ProjectValidation = {
  status: WeatherKind;
  empiricalAnnualKwh: number;
  database: string;
  note: string;
};

export type SimulationSummary = {
  annualGenerationKwh: number;
  annualLoadKwh: number;
  selfConsumedKwh: number;
  gridImportKwh: number;
  exportKwh: number;
  selfConsumption: number;
  selfSufficiency: number;
  heatingSystem: "gas" | "pump" | "direct";
  gasKwh: number;
  heatDemandKwh: number;
  peakAcKw: number;
  inverterKw: number;
  clippingKwh: number;
  recommendedBatteryKwh: number;
  battery: { nominalKwh: number; powerKw: number; selfConsumedKwh: number; exportKwh: number; gridImportKwh: number };
  /** Hourly energy balance per scenario; `balance` is the one selected on the energy page. */
  balances: Record<BalanceScenario, EnergyBalance>;
  balance: EnergyBalance;
  batteryCapacityAuto: boolean;
  buildingNorthDeg: number;
  demandCalibration: "bill" | "household" | "model";
  irradiationWarnings: number;
};

export type BalanceScenario = "solar-only" | "solar-battery";

/** Annual totals of the hourly dispatch PV → load → battery → export / grid import. */
export type EnergyBalance = {
  scenario: BalanceScenario;
  batteryKwh: number;
  generationKwh: number;
  loadKwh: number;
  directKwh: number;
  /** PV-origin battery discharge delivered to the home (the battery only charges from PV surplus). */
  batteryToLoadKwh: number;
  pvUsedKwh: number;
  exportKwh: number;
  importKwh: number;
  /** pvUsedKwh ÷ loadKwh. */
  coverage: number;
  /** pvUsedKwh ÷ generationKwh. */
  selfConsumptionRate: number;
  /** exportKwh ÷ generationKwh. */
  exportRate: number;
};

export function energyBalance(scenario: BalanceScenario, batteryKwh: number, rows: Array<Record<string, number>>): EnergyBalance {
  const sum = (key: string) => rows.reduce((total, row) => total + (row[key] ?? 0), 0);
  const generationKwh = sum("pv"), loadKwh = sum("load"), directKwh = sum("directSelf"), batteryToLoadKwh = sum("batteryDischarge");
  const pvUsedKwh = directKwh + batteryToLoadKwh, exportKwh = sum("export"), importKwh = sum("grid");
  return {
    scenario, batteryKwh, generationKwh, loadKwh, directKwh, batteryToLoadKwh, pvUsedKwh, exportKwh, importKwh,
    coverage: loadKwh ? pvUsedKwh / loadKwh : 0,
    selfConsumptionRate: generationKwh ? pvUsedKwh / generationKwh : 0,
    exportRate: generationKwh ? exportKwh / generationKwh : 0,
  };
}

export type StudyEconomics = {
  pvProductPrice: number;
  conventionalPrice: number;
  pvSpecificPrice: number;
  incrementalPrice: number;
  batteryPrice: number | null;
  projectPriceSource: "user" | "estimate";
  conventionalPriceSource: "user" | "estimate";
};

export type ProjectEnergy = {
  annualDemandKwh: number;
  source: "bill" | "household" | "customer-model";
  note: string;
};

export type CustomerEconomicsPlan = {
  annualDemandKwh?: number | null;
  importPence?: number | null;
  exportPence?: number | null;
  importGrowthPercent?: number | null;
  exportGrowthPercent?: number | null;
  annualMaintenanceGbp?: number | null;
  inverterReplacementGbp?: number | null;
  batteryReplacementPercent?: number | null;
};

export type StudyProject = {
  market: Market;
  region: "UK" | "EU" | "CA" | "JP";
  currency: string;
  address: string;
  coordinates: { lat: number; lng: number };
  buildingTypeId: string;
  building: { width: number; depth: number; floors: number; storeyHeight: number; usage: "office" | "residential" };
  frontAzimuthDeg: number;
  heatMode: "gas" | "pump" | "direct";
  electricHotWater: boolean;
  evCharger: boolean;
};

export type CustomerStudy = {
  project?: StudyProject;
  result: EstimateResult;
  validation: ProjectValidation;
  energy: ProjectEnergy;
  simulation: SimulationSummary;
  economics: StudyEconomics;
  weather: WeatherProvenance;
  googleSolar: GoogleSolarReference | null;
};

export type CustomerStudyInput = {
  productRuntime?: core.ProductRuntime;
  market: Market;
  address: string;
  coordinates: { lat: number; lng: number };
  timezone: number;
  snapshot: StudioCalculationSnapshot;
  buildingNorthDeg?: number;
  energySettings?: HomeEnergySettings;
  economicPlan?: CustomerEconomicsPlan | null;
  weather: core.Weather;
  googleSolar?: GoogleSolarReference | null;
};

const DEFAULT_BUILDING = { width: 8, depth: 8, floors: 2, storeyHeight: 2.95 };

function surfacesFromSnapshot(snapshot: StudioCalculationSnapshot): core.Surface[] {
  return snapshot.surfaces
    .filter((surface) => surface.enabled !== false && surface.area > 0 && core.PROFILES[surface.profile])
    .map((surface) => {
      const role = surface.role ?? "none";
      return {
        id: surface.id,
        product: surface.product,
        profile: surface.profile,
        area: surface.area,
        tilt: surface.tilt,
        az: surface.az,
        enabled: true,
        role,
        linked: surface.linked ?? true,
        u: surface.u ?? (role === "skylight" ? 0.5 : role === "window" ? 0.4 : 0),
        g: surface.g ?? (role === "skylight" ? 0.11 : role === "window" ? 0.12 : 0),
      };
    });
}

function buildingFromSnapshot(snapshot: StudioCalculationSnapshot): core.Building {
  const b = snapshot.building;
  return {
    width: b.width ?? DEFAULT_BUILDING.width,
    depth: b.depth ?? DEFAULT_BUILDING.depth,
    floors: Math.max(1, Math.round(b.floors ?? DEFAULT_BUILDING.floors)),
    storeyHeight: b.storeyHeight ?? DEFAULT_BUILDING.storeyHeight,
    wwr: b.wwr,
    glazedArea: b.glazedArea,
    usage: b.usage === "office" ? "office" : "residential",
  };
}

function parametersFor(building: core.Building, settings: HomeEnergySettings | undefined, north: number): core.Parameters {
  const heatMode = settings?.heatPump ? "pump" : settings?.electricHeating ? "direct" : "gas";
  return {
    ...core.defaults(building),
    north,
    heatMode,
    devices: {
      hotWater: { enabled: settings?.electricHotWater ?? false },
      ev: { enabled: settings?.evCharger ?? false },
    },
    inverterMode: "auto",
    batteryEnabled: false,
  };
}

function prettySurfaceLabel(id: string, profileName: string) {
  const [product, rest] = id.split(":");
  const where = rest ? rest.replaceAll("_", " ") : "";
  return `${profileName}${where && product === "roof_tiles" ? ` · ${where}` : ""}`;
}

function weatherProvenance(weather: core.Weather): WeatherProvenance {
  const rows = weather.rows;
  const total = (key: "ghi" | "dni" | "dhi") => rows.reduce((sum, row) => sum + row[key], 0) / 1000;
  return {
    kind: weather.synthetic ? "customer-synthetic" : String(weather.source ?? "").startsWith("NASA POWER") ? "nasa-power" : "pvgis-tmy",
    name: weather.name,
    source: weather.source ?? (weather.synthetic ? "Synthetic regional climate" : "Hourly weather"),
    sourceURL: weather.sourceURL,
    annualGhiKwhM2: Math.round(total("ghi")),
    annualDniKwhM2: Math.round(total("dni")),
    annualDhiKwhM2: Math.round(total("dhi")),
    meanAirTemperatureC: Math.round((rows.reduce((sum, row) => sum + row.ta, 0) / rows.length) * 10) / 10,
    hours: rows.length,
  };
}

export function runCustomerStudy(input: CustomerStudyInput): CustomerStudy {
  const region = regionForMarket(input.market);
  const surfaces = surfacesFromSnapshot(input.snapshot);
  if (!surfaces.length) throw new Error("Add at least one supported solar product in Solar Studio before running the project calculation.");
  const building = buildingFromSnapshot(input.snapshot);
  const north = Number.isFinite(input.buildingNorthDeg) ? (input.buildingNorthDeg as number) : 180;
  const location: core.Location = { lat: input.coordinates.lat, lon: input.coordinates.lng, tz: input.timezone };
  const settings = input.energySettings;
  const p = parametersFor(building, settings, north);
  p.productRuntime = input.productRuntime;
  const profiles = input.productRuntime?.profiles ?? core.PROFILES;

  let sim = core.simulate(p, surfaces, input.weather, location);
  const bill = settings?.demandMode === "bill" && settings.annualDemandKwh && settings.annualDemandKwh > 0 ? settings.annualDemandKwh : null;
  const household = bill === null && settings ? estimateAnnualDemandKwh(settings) : null;
  const guidedDemand = bill === null && input.economicPlan?.annualDemandKwh && input.economicPlan.annualDemandKwh > 0 ? input.economicPlan.annualDemandKwh : null;
  const demandTarget = bill ?? guidedDemand ?? household;
  let calibrationNote = "Annual demand is the customer building model result: hourly base load, heating and cooling (one-node RC), hot water and EV charging.";
  if (demandTarget !== null && sim.totals.base > 0) {
    const nonBase = sim.totals.load - sim.totals.base;
    const scale = Math.max(0, demandTarget - nonBase) / sim.totals.base;
    p.base = p.base * scale;
    sim = core.simulate(p, surfaces, input.weather, location);
    calibrationNote = bill !== null
      ? bill < nonBase
        ? `The bill (${Math.round(bill).toLocaleString("en")} kWh) is below the modelled heating/EV load; base appliance load was set to zero.`
        : `Base appliance load calibrated so the modelled annual demand matches the ${Math.round(bill).toLocaleString("en")} kWh bill.`
      : guidedDemand !== null
        ? "Annual demand has been tailored from the household profile, configured building and project context."
        : `Base appliance load calibrated so the modelled annual demand matches the ${Math.round(demandTarget).toLocaleString("en")} kWh household estimate (${settings!.householdSize} people, daytime occupancy: ${settings!.daytimeOccupancy}).`;
  }

  const t = sim.totals, sizing = sim.systemSizing!;
  const batteryAuto = settings?.batteryCapacityAuto !== false;
  const manualBattery = !batteryAuto && settings?.batteryCapacityKwh && settings.batteryCapacityKwh > 0 ? settings.batteryCapacityKwh : 0;
  const batteryNominal = manualBattery > 0 ? manualBattery : sizing.recommendedBatteryKWh > 0 ? sizing.recommendedBatteryKWh : 5;
  const batteryPower = Math.min(sizing.inverterKW || batteryNominal * core.SYSTEM_ASSUMPTIONS.cRate, batteryNominal * core.SYSTEM_ASSUMPTIONS.cRate);
  const withBattery = core.dispatch(sim.hourly, batteryNominal, batteryPower, true);
  const balances: Record<BalanceScenario, EnergyBalance> = {
    "solar-only": energyBalance("solar-only", 0, core.dispatch(sim.hourly, 0, 0, true).rows),
    "solar-battery": energyBalance("solar-battery", batteryNominal, withBattery.rows),
  };
  const activeScenario: BalanceScenario = settings?.batteryMode === "solar-battery" ? "solar-battery" : "solar-only";
  const effectiveSettings = settings ? { ...settings, batteryCapacityKwh: batteryNominal } : undefined;

  const annualGeneration = t.pv;
  const annualDemand = t.load;
  const planning = buildPlanningInput({
    region,
    label: input.address,
    coordinates: input.coordinates,
    snapshot: input.snapshot,
    energySettings: effectiveSettings ? { ...effectiveSettings, annualDemandKwh: Math.round(annualDemand) } : undefined,
    capacityKwp: sim.kwp,
  });
  planning.energy.annualDemandKwh = Math.round(annualDemand);
  if (input.economicPlan?.importPence) planning.energy.importPence = input.economicPlan.importPence;
  if (input.economicPlan?.exportPence) planning.energy.exportPence = input.economicPlan.exportPence;
  if (input.economicPlan?.importGrowthPercent !== undefined && input.economicPlan.importGrowthPercent !== null) planning.costs.importGrowthPercent = input.economicPlan.importGrowthPercent;
  if (input.economicPlan?.exportGrowthPercent !== undefined && input.economicPlan.exportGrowthPercent !== null) planning.costs.exportGrowthPercent = input.economicPlan.exportGrowthPercent;
  if (input.economicPlan?.annualMaintenanceGbp !== undefined && input.economicPlan.annualMaintenanceGbp !== null) planning.costs.annualMaintenanceGbp = input.economicPlan.annualMaintenanceGbp;
  if (input.economicPlan?.inverterReplacementGbp !== undefined && input.economicPlan.inverterReplacementGbp !== null) planning.costs.inverterReplacementGbp = input.economicPlan.inverterReplacementGbp;
  if (input.economicPlan?.batteryReplacementPercent !== undefined && input.economicPlan.batteryReplacementPercent !== null) planning.costs.batteryReplacementPercent = input.economicPlan.batteryReplacementPercent;
  const currency = REGION_CONFIG[region];
  const prices = planningCosts(region, activeAreaByFamily(input.snapshot), effectiveSettings, sim.kwp);
  const scenarios = calculateFinancialScenarios({
    annualGenerationKwh: annualGeneration,
    energy: planning.energy,
    costs: planning.costs,
    unitPriceDivisor: currency.priceDivisor,
    simulatedDirectShares: {
      solarOnly: balances["solar-only"].selfConsumptionRate,
      solarBattery: balances["solar-battery"].selfConsumptionRate,
    },
  });
  const bestScenario = scenarios.filter((scenario) => scenario.available).sort((a, b) => b.net25YearGbp - a.net25YearGbp)[0] ?? scenarios[0];

  const snapshotById = new Map(input.snapshot.surfaces.map((surface) => [surface.id, surface]));
  const surfaceResults: SurfaceResult[] = sim.products.map((product) => {
    const source = snapshotById.get(product.id)!;
    const coreSurface = surfaces.find((surface) => surface.id === product.id)!;
    const mapping = productForSnapshot(source);
    const profile = profiles[product.profile];
    const azimuthDeg = (coreSurface.az + (coreSurface.linked ? north : 0) + 360) % 360;
    const orientationName = coreSurface.tilt < 10 ? "horizontal" : compassName(azimuthDeg);
    return {
      surfaceId: product.id,
      surfaceLabel: prettySurfaceLabel(product.id, profile[0]),
      kind: mapping?.kind ?? "roof-plane",
      orientationName,
      azimuthDeg: Math.round(azimuthDeg * 10) / 10,
      tiltDeg: Math.round(coreSurface.tilt * 10) / 10,
      areaM2: product.area,
      productName: profile[0],
      capacityKwp: product.kwp,
      annualKwh: product.ac,
      monthlyKwh: product.monthlyAc,
      specificYield: product.kwp > 0 ? product.ac / product.kwp : 0,
      irradiationKwhM2: product.poa,
      sharePercent: annualGeneration ? Math.round((product.ac / annualGeneration) * 100) : 0,
    };
  });

  const monthlyByOrientation = Array.from({ length: 12 }, (_, index) => {
    const values = { south: 0, east: 0, west: 0, north: 0, horizontal: 0 };
    surfaceResults.forEach((surface) => { values[surface.orientationName] += surface.monthlyKwh[index] ?? 0; });
    return { month: index + 1, monthName: new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(2025, index, 1)), ...values, total: Object.values(values).reduce((sum, value) => sum + value, 0) };
  });

  const schedule = surfaceResults.reduce<ProductScheduleLine[]>((lines, surface) => {
    const product = sim.products.find((item) => item.id === surface.surfaceId)!;
    const existing = lines.find((line) => line.productId === product.profile);
    const line = existing ?? { productId: product.profile, productName: surface.productName, finishName: "Standard", surfaceNames: [], totalAreaM2: 0, unit: "m²" as const, peakPowerWpM2: profiles[product.profile][1], totalCapacityKwp: 0 };
    line.surfaceNames.push(surface.surfaceLabel);
    line.totalAreaM2 += surface.areaM2;
    line.totalCapacityKwp += surface.capacityKwp;
    if (!existing) lines.push(line);
    return lines;
  }, []);

  const weather = weatherProvenance(input.weather);
  const synthetic = weather.kind === "customer-synthetic";
  const bandPercent = synthetic ? 15 : 8;
  const azimuths = surfaceResults.map((surface) => surface.azimuthDeg);
  const azimuthRange = azimuths.length ? Math.max(...azimuths) - Math.min(...azimuths) : 0;
  const heatingLabel = p.heatMode === "pump" ? "Heat pump (COP 3)" : p.heatMode === "direct" ? "Direct electric heating" : "Gas boiler (90% efficiency)";

  const ledger: LedgerEntry[] = [
    { id: "location", label: "Site", value: `${input.address} (${input.coordinates.lat.toFixed(4)}, ${input.coordinates.lng.toFixed(4)}, UTC${input.timezone >= 0 ? "+" : ""}${input.timezone})`, provenance: "user", stepNumber: 1, fieldKey: "location", params: { address: input.address, lat: Math.round(input.coordinates.lat * 1e4) / 1e4, lng: Math.round(input.coordinates.lng * 1e4) / 1e4, tz: input.timezone } },
    { id: "irradiance", label: "Hourly weather", value: `${weather.source} · GHI ${weather.annualGhiKwhM2} / DNI ${weather.annualDniKwhM2} / DHI ${weather.annualDhiKwhM2} kWh/m² · mean ${weather.meanAirTemperatureC} °C`, provenance: "data", stepNumber: 1, fieldKey: "irradiance", params: { kind: weather.kind, source: weather.source, name: weather.name ?? null, ghi: weather.annualGhiKwhM2, dni: weather.annualDniKwhM2, dhi: weather.annualDhiKwhM2, temp: weather.meanAirTemperatureC }, note: synthetic ? "Synthetic regional climate — site weather (NASA POWER / PVGIS) was not available." : weather.kind === "nasa-power" ? "Historical year from NASA POWER, as used by the customer Studio (not a typical year)." : undefined },
    { id: "generation", label: "Generation model", value: "Hourly model: solar position → isotropic plane-of-array (beam / sky diffuse / ground reflected, albedo 0.2) → empirical cell temperature and efficiency → 90% AC factor", provenance: "manufacturer", stepNumber: 2, fieldKey: "generation" },
    { id: "capacity", label: "Product capacity", value: `${sim.kwp.toFixed(2)} kWp across ${surfaceResults.length} surfaces`, provenance: "manufacturer", stepNumber: 3, fieldKey: "capacity", params: { kwp: Math.round(sim.kwp * 100) / 100, surfaces: surfaceResults.length } },
    { id: "orientation", label: "Building orientation", value: `Studio model rotated ${north}° (front façade azimuth)`, provenance: "user", stepNumber: 3, fieldKey: "orientation", params: { deg: north } },
    { id: "building", label: "Building energy model", value: `${building.width} × ${building.depth} m, ${building.floors} storeys · one-node hourly RC model · ${heatingLabel}`, provenance: "assumed", stepNumber: 4, fieldKey: "building", params: { width: building.width, depth: building.depth, floors: building.floors, heat: p.heatMode } },
    { id: "demand", label: "Annual electricity demand", value: `${Math.round(annualDemand).toLocaleString("en")} kWh`, provenance: demandTarget !== null ? "user" : "assumed", stepNumber: 4, fieldKey: "demand", params: { kwh: Math.round(annualDemand) }, note: calibrationNote },
    { id: "inverter", label: "Inverter sizing", value: `${sizing.inverterKW} kW AC · DC/AC ${sizing.dcAcRatio.toFixed(2)} · clipping ${(sizing.clippingFraction * 100).toFixed(2)}%`, provenance: "assumed", stepNumber: 5, fieldKey: "inverter", params: { kw: sizing.inverterKW, ratio: Math.round(sizing.dcAcRatio * 100) / 100, clipping: Math.round(sizing.clippingFraction * 10000) / 100 } },
    { id: "battery", label: "Battery comparison", value: `${batteryNominal} kWh / ${batteryPower.toFixed(2)} kW AC-coupled (90% usable, 90% round trip) · recommended ${sizing.recommendedBatteryKWh} kWh`, provenance: "assumed", stepNumber: 5, fieldKey: "battery", params: { kwh: batteryNominal, kw: Math.round(batteryPower * 100) / 100, recommended: sizing.recommendedBatteryKWh } },
    { id: "costs", label: "BIPV incremental investment", value: `${currency.currency} ${Math.round(prices.incrementalPrice).toLocaleString("en")} = PV products ${Math.round(prices.pvProductPrice).toLocaleString("en")} − conventional products ${Math.round(prices.conventionalPrice).toLocaleString("en")} + PV-specific ${Math.round(prices.pvSpecificPrice).toLocaleString("en")}${prices.batteryPrice !== null ? ` · battery ${Math.round(prices.batteryPrice).toLocaleString("en")}` : ""}`, provenance: prices.projectPriceSource === "user" ? "user" : "assumed", stepNumber: 5, fieldKey: "costs", params: { currency: currency.currency, incremental: Math.round(prices.incrementalPrice), pv: Math.round(prices.pvProductPrice), conventional: Math.round(prices.conventionalPrice), specific: Math.round(prices.pvSpecificPrice), battery: prices.batteryPrice !== null ? Math.round(prices.batteryPrice) : null, estimated: prices.projectPriceSource === "estimate" || prices.conventionalPriceSource === "estimate" || prices.batteryPriceSource === "estimate" ? 1 : 0 }, note: "Common roofing works (labour, installation, scaffolding) occur with conventional tiles too and are excluded. Product prices are indicative unless quotes are entered on the energy page." },
  ];
  if (input.googleSolar?.status === "ok") {
    const top = input.googleSolar.roofSegments?.[0];
    ledger.push({ id: "google-solar", label: "Google Solar roof reference", value: `${input.googleSolar.roofSegments?.length ?? 0} roof segments · usable array ${input.googleSolar.maxArrayAreaM2 ?? "—"} m²${top ? ` · largest ${top.areaM2} m² at ${top.pitchDeg}° pitch / ${top.azimuthDeg}° azimuth` : ""} · imagery ${input.googleSolar.imageryQuality ?? ""} ${input.googleSolar.imageryDate ?? ""}`.trim(), provenance: "data", stepNumber: 1, fieldKey: "google-solar", params: { segments: input.googleSolar.roofSegments?.length ?? 0, area: input.googleSolar.maxArrayAreaM2 ?? null, topArea: top?.areaM2 ?? null, topPitch: top?.pitchDeg ?? null, topAz: top?.azimuthDeg ?? null, quality: input.googleSolar.imageryQuality ?? null, date: input.googleSolar.imageryDate ?? null }, note: input.googleSolar.note });
  }

  const result: EstimateResult = {
    caseNumber: `MOD-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`,
    timestamp: new Date().toISOString(),
    range: { low: Math.round(annualGeneration * (1 - bandPercent / 100)), representative: Math.round(annualGeneration), high: Math.round(annualGeneration * (1 + bandPercent / 100)), bandPercent },
    totalCapacityKwp: sim.kwp,
    surfaces: surfaceResults,
    monthlyByOrientation,
    scenarios,
    recommendedScenarioId: bestScenario.id,
    recommendation: {
      inverterKw: sizing.inverterKW,
      inverterType: `${sizing.inverterKW} kW AC-coupled inverter (≤1% clipping, DC/AC ≤ 1.3)`,
      mpptArrangement: azimuthRange > 45 ? "Separate MPPT inputs per orientation group are recommended." : "A shared MPPT arrangement is appropriate for the selected orientations.",
      batteryCapacityKwh: sizing.recommendedBatteryKWh,
      installerNotes: ["CdTe string design must be confirmed by the installer.", "A site survey must confirm shading, structure and electrical connection."],
    },
    schedule,
    ledger,
    summary: synthetic
      ? "This study runs the hourly model on the built-in synthetic regional climate because site weather was unavailable. Re-run when NASA POWER or PVGIS is reachable."
      : weather.kind === "nasa-power"
        ? `This study runs the hourly model on the NASA POWER ${input.weather.year ?? ""} hourly year for the selected site.`
        : "This study runs the hourly model on a PVGIS typical meteorological year for the selected site.",
    engine: {
      method: "deterministic",
      irradianceDatabase: weather.source,
      albedo: p.albedo,
      conversionRule: "Hourly empirical model (2026-09-22 coefficients)",
      guardsTriggered: [...(synthetic ? ["customer-synthetic-climate"] : []), ...(sim.irradiationWarnings > 0 ? ["irradiation-consistency"] : [])],
    },
  };

  return {
    project: {
      market: input.market,
      region,
      currency: currency.currency,
      address: input.address,
      coordinates: input.coordinates,
      buildingTypeId: input.snapshot.building.id,
      building: { width: building.width, depth: building.depth, floors: building.floors, storeyHeight: building.storeyHeight ?? DEFAULT_BUILDING.storeyHeight, usage: building.usage === "office" ? "office" : "residential" },
      frontAzimuthDeg: north,
      heatMode: p.heatMode as StudyProject["heatMode"],
      electricHotWater: settings?.electricHotWater ?? false,
      evCharger: settings?.evCharger ?? false,
    },
    result,
    validation: {
      status: weather.kind,
      empiricalAnnualKwh: Math.round(annualGeneration),
      database: weather.source,
      note: synthetic
        ? "NASA POWER and PVGIS could not be reached, so the customer's built-in synthetic regional climate was used. Figures are indicative only."
        : `Hourly ${weather.source} weather for the site (${weather.hours} hours). The hourly model is the only generation calculation.`,
    },
    energy: {
      annualDemandKwh: Math.round(annualDemand),
      source: bill !== null ? "bill" : household !== null ? "household" : "customer-model",
      note: calibrationNote,
    },
    simulation: {
      annualGenerationKwh: annualGeneration,
      annualLoadKwh: annualDemand,
      selfConsumedKwh: t.self,
      gridImportKwh: t.grid,
      exportKwh: t.export,
      selfConsumption: sim.selfConsumption,
      selfSufficiency: sim.selfSufficiency,
      heatingSystem: p.heatMode as SimulationSummary["heatingSystem"],
      gasKwh: t.gas,
      heatDemandKwh: t.heat,
      peakAcKw: sim.peak,
      inverterKw: sizing.inverterKW,
      clippingKwh: sizing.clippingKWh,
      recommendedBatteryKwh: sizing.recommendedBatteryKWh,
      battery: { nominalKwh: batteryNominal, powerKw: batteryPower, selfConsumedKwh: balances["solar-battery"].pvUsedKwh, exportKwh: balances["solar-battery"].exportKwh, gridImportKwh: balances["solar-battery"].importKwh },
      balances,
      balance: balances[activeScenario],
      batteryCapacityAuto: manualBattery === 0,
      buildingNorthDeg: north,
      demandCalibration: bill !== null ? "bill" : household !== null ? "household" : "model",
      irradiationWarnings: sim.irradiationWarnings,
    },
    economics: {
      pvProductPrice: prices.pvProductPrice,
      conventionalPrice: prices.conventionalPrice,
      pvSpecificPrice: prices.pvSpecificPrice,
      incrementalPrice: prices.incrementalPrice,
      batteryPrice: prices.batteryPrice,
      projectPriceSource: prices.projectPriceSource,
      conventionalPriceSource: prices.conventionalPriceSource,
    },
    weather,
    googleSolar: input.googleSolar ?? null,
  };
}

/** Offline study on the customer's built-in synthetic climate (demo and PVGIS outage fallback). */
export function syntheticWeatherFor(market: Market, location: core.Location): core.Weather {
  const key = regionForMarket(market) as core.ClimateKey;
  return { ...core.synthetic(key, location), source: `Synthetic regional climate (${core.CLIMATES[key].name})` };
}
