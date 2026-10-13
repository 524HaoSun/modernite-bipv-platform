import { REGION_CONFIG } from "../data/constants";
import type { EstimateResult, LedgerEntry, ProductScheduleLine, SurfaceResult } from "../types/solar";
import * as core from "./customer-energy-core";
import { degradedGeneration } from "./degradation";
import { calculateFinancialScenarios } from "./financial";
import { compassName } from "./geometry";
import type { GoogleSolarReference } from "./google-solar";
import {
  activeSolarAreaM2,
  airConditionerProvidesCooling,
  airConditionerProvidesHeating,
  buildPlanningInput,
  estimateAnnualDemandKwh,
  heatPumpProvidesHotWater,
  heatPumpProvidesSpaceHeating,
  planningCosts,
  productForSnapshot,
  regionForMarket,
  type HomeEnergySettings,
  type StudioCalculationSnapshot,
} from "./studio-calculation";

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
  battery: {
    nominalKwh: number;
    powerKw: number;
    selfConsumedKwh: number;
    exportKwh: number;
    gridImportKwh: number;
    directSolarKwh?: number;
    storedSolarKwh?: number;
    offPeakChargeKwh?: number;
    offPeakDischargeKwh?: number;
    solarLossKwh?: number;
    gridLossKwh?: number;
    startingSolarStoredKwh?: number;
    endingSolarStoredKwh?: number;
  };
  kpis: {
    solarOnly: ScenarioKpis;
    solarBattery: ScenarioKpis;
  };
  buildingNorthDeg: number;
  demandCalibration: "bill" | "household" | "model";
  irradiationWarnings: number;
};

export type ScenarioKpis = {
  solarCoverage: number;
  pvSelfConsumption: number;
  exportRate: number;
  selfConsumedKwh: number;
  exportKwh: number;
  gridImportKwh: number;
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
  heatPumpUse?: HomeEnergySettings["heatPumpUse"];
  airConditionerUse?: HomeEnergySettings["airConditionerUse"];
  electricUnderfloorHeating?: boolean;
  electricRadiators?: boolean;
  electricWaterHeating?: boolean;
  evAnnualDistanceKm?: number;
};

export type CustomerStudy = {
  project?: StudyProject;
  result: EstimateResult;
  validation: ProjectValidation;
  energy: ProjectEnergy;
  simulation: SimulationSummary;
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
  const efficientHeating = settings ? heatPumpProvidesSpaceHeating(settings) || airConditionerProvidesHeating(settings) : false;
  const heatPumpSpaceHeating = settings ? heatPumpProvidesSpaceHeating(settings) : false;
  const airConditionerHeating = settings ? airConditionerProvidesHeating(settings) : false;
  const underfloorHeating = settings?.electricUnderfloorHeating ?? false;
  const radiatorHeating = settings?.electricRadiators ?? false;
  const heatingSystems = [efficientHeating, underfloorHeating, radiatorHeating].filter(Boolean).length;
  const heatingShare = heatingSystems ? 100 / heatingSystems : 0;
  const efficientHeatingCop = (Number(heatPumpSpaceHeating) * 3 + Number(airConditionerHeating) * 3.5)
    / Math.max(1, Number(heatPumpSpaceHeating) + Number(airConditionerHeating));
  const heatMode = efficientHeating ? "pump" : underfloorHeating || radiatorHeating ? "direct" : "gas";
  const heatPumpHotWater = settings ? heatPumpProvidesHotWater(settings) : false;
  const directHotWater = settings?.electricWaterHeating ?? false;
  const hotWaterSystems = Number(heatPumpHotWater) + Number(directHotWater);
  const hotWaterIntensity = hotWaterSystems
    ? ((heatPumpHotWater ? 12 / 3 : 0) + (directHotWater ? 12 : 0)) / hotWaterSystems
    : 12;
  return {
    ...core.defaults(building),
    north,
    heatMode,
    devices: {
      heatPump: { enabled: efficientHeating, share: efficientHeating ? heatingShare : 0, cop: efficientHeatingCop },
      underfloor: { enabled: underfloorHeating, share: underfloorHeating ? heatingShare : 0 },
      radiant: { enabled: radiatorHeating, share: radiatorHeating ? heatingShare : 0 },
      gasBoiler: { enabled: heatingSystems === 0, share: heatingSystems === 0 ? 100 : 0, efficiency: 0.9 },
      ac: { enabled: settings ? airConditionerProvidesCooling(settings) : false, cop: 3 },
      hotWater: { enabled: hotWaterSystems > 0, intensity: hotWaterIntensity },
      ev: { enabled: settings?.evCharging ?? false, distance: Math.max(0, settings?.evAnnualDistanceKm ?? 12000) },
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

function scenarioKpis(annualGeneration: number, annualDemand: number, selfConsumedKwh: number, exportKwh: number, gridImportKwh: number): ScenarioKpis {
  const generation = Math.max(0, annualGeneration);
  const demand = Math.max(0, annualDemand);
  return {
    solarCoverage: demand > 0 ? selfConsumedKwh / demand : 0,
    pvSelfConsumption: generation > 0 ? selfConsumedKwh / generation : 0,
    exportRate: generation > 0 ? exportKwh / generation : 0,
    selfConsumedKwh,
    exportKwh,
    gridImportKwh,
  };
}

function summarizeTariffDispatch(result: ReturnType<typeof core.dispatchWithGridCharging>) {
  if (result.totals) return result.totals;
  return result.rows.reduce((acc, row) => ({
    self: acc.self + row.self,
    direct: acc.direct + row.directSelf,
    storedSolar: acc.storedSolar + (row.batterySolarDischarge ?? 0),
    storedGrid: acc.storedGrid + (row.batteryGridDischarge ?? 0),
    gridCharge: acc.gridCharge + (row.gridBatteryCharge ?? 0),
    solarLoss: acc.solarLoss + (row.batterySolarLoss ?? 0),
    gridLoss: acc.gridLoss + (row.batteryGridLoss ?? 0),
    export: acc.export + row.export,
    grid: acc.grid + row.grid + (row.gridBatteryCharge ?? 0),
  }), { self: 0, direct: 0, storedSolar: 0, storedGrid: 0, gridCharge: 0, solarLoss: 0, gridLoss: 0, export: 0, grid: 0 });
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
  const bill = settings?.demandMode === "bill" && settings.annualDemandKwh && settings.annualDemandKwh > 0 ? settings.annualDemandKwh : null;
  const household = bill === null && settings ? estimateAnnualDemandKwh(settings) : null;
  const guidedDemand = bill === null && input.economicPlan?.annualDemandKwh && input.economicPlan.annualDemandKwh > 0 ? input.economicPlan.annualDemandKwh : null;
  const demandTarget = bill ?? guidedDemand ?? household;
  if (demandTarget !== null) p.annualLoadTargetKwh = demandTarget;
  const sim = core.simulate(p, surfaces, input.weather, location);
  let calibrationNote = "Annual demand is the customer building model result: hourly base load, heating and cooling (one-node RC), hot water and EV charging.";
  if (demandTarget !== null) calibrationNote = bill !== null
    ? `The hourly electricity profile is calibrated to the ${Math.round(bill).toLocaleString("en")} kWh bill while retaining the selected device-use pattern.`
    : guidedDemand !== null
      ? "Annual demand has been tailored from the household profile, configured building and project context."
      : `The hourly electricity profile is calibrated to the ${Math.round(demandTarget).toLocaleString("en")} kWh household estimate (${settings!.householdSize} people, daytime occupancy: ${settings!.daytimeOccupancy}) while retaining the selected device-use pattern.`;

  const t = sim.totals, sizing = sim.systemSizing!;
  const requestedBattery = settings?.batteryMode === "solar-battery" && settings.batteryCapacitySource === "user" ? settings.batteryCapacityKwh : 0;
  const batteryNominal = requestedBattery > 0 ? requestedBattery : Math.max(0, sizing.recommendedBatteryKWh);
  const batteryPower = Math.min(sizing.inverterKW || batteryNominal * core.SYSTEM_ASSUMPTIONS.cRate, batteryNominal * core.SYSTEM_ASSUMPTIONS.cRate);
  const effectiveEnergySettings = settings
    ? { ...settings, batteryCapacityKwh: settings.batteryMode === "solar-battery" ? batteryNominal : settings.batteryCapacityKwh, batteryCapacitySource: settings.batteryCapacitySource ?? "auto" }
    : undefined;
  const planning = buildPlanningInput({
    region,
    label: input.address,
    coordinates: input.coordinates,
    snapshot: input.snapshot,
    energySettings: effectiveEnergySettings ? { ...effectiveEnergySettings, annualDemandKwh: Math.round(t.load) } : undefined,
  });
  planning.energy.annualDemandKwh = Math.round(t.load);
  if (input.economicPlan?.importPence) planning.energy.importPence = input.economicPlan.importPence;
  if (input.economicPlan?.exportPence) planning.energy.exportPence = input.economicPlan.exportPence;
  if (input.economicPlan?.importGrowthPercent !== undefined && input.economicPlan.importGrowthPercent !== null) planning.costs.importGrowthPercent = input.economicPlan.importGrowthPercent;
  if (input.economicPlan?.exportGrowthPercent !== undefined && input.economicPlan.exportGrowthPercent !== null) planning.costs.exportGrowthPercent = input.economicPlan.exportGrowthPercent;
  if (input.economicPlan?.annualMaintenanceGbp !== undefined && input.economicPlan.annualMaintenanceGbp !== null) planning.costs.annualMaintenanceGbp = input.economicPlan.annualMaintenanceGbp;
  if (input.economicPlan?.inverterReplacementGbp !== undefined && input.economicPlan.inverterReplacementGbp !== null) planning.costs.inverterReplacementGbp = input.economicPlan.inverterReplacementGbp;
  if (input.economicPlan?.batteryReplacementPercent !== undefined && input.economicPlan.batteryReplacementPercent !== null) planning.costs.batteryReplacementPercent = input.economicPlan.batteryReplacementPercent;
  const energyRows = sim.hourly.map((row) => ({ t: row.t, pv: row.pv, load: row.load }));
  const tariffOptions = {
    collect: false,
    timezone: input.timezone,
    offPeakStartHour: planning.energy.offPeakStartHour,
    offPeakHours: planning.energy.offPeakHours,
    peakStartHour: planning.energy.peakStartHour,
    peakHours: planning.energy.peakHours,
    standardRate: planning.energy.importPence,
    offPeakRate: planning.energy.offPeakPence,
    peakRate: planning.energy.peakPence > 0 ? planning.energy.peakPence : planning.energy.importPence,
    cyclic: true,
  };
  const withBattery = core.dispatchWithGridCharging(energyRows, batteryNominal, batteryPower, tariffOptions);
  const batteryOnly = core.dispatchWithGridCharging(
    energyRows.map((row) => ({ t: row.t, pv: 0, load: row.load })),
    batteryNominal,
    batteryPower,
    { ...tariffOptions, reserveSolarCapacity: false },
  );
  const batterySums = summarizeTariffDispatch(withBattery);
  const batteryOnlySums = summarizeTariffDispatch(batteryOnly);

  const annualGeneration = t.pv;
  const annualDemand = t.load;
  const kpis = {
    solarOnly: scenarioKpis(annualGeneration, annualDemand, t.self, t.export, t.grid),
    solarBattery: scenarioKpis(annualGeneration, annualDemand, batterySums.self, batterySums.export, batterySums.grid),
  };
  const currency = REGION_CONFIG[region];
  const prices = planningCosts(region, activeSolarAreaM2(input.snapshot), effectiveEnergySettings);
  let priorSolarStorage = withBattery.storedSolar;
  let priorGridStorage = withBattery.storedGrid;
  const simulatedEnergyByYear = Array.from({ length: 25 }, (_, index) => {
    const year = index + 1;
    const generation = degradedGeneration(annualGeneration, year);
    const factor = annualGeneration > 0 ? generation / annualGeneration : 0;
    const rows = year === 1 ? energyRows : energyRows.map((row) => ({ t: row.t, pv: row.pv * factor, load: row.load }));
    const solarOnly = rows.reduce((acc, row) => {
      const direct = Math.min(row.pv, row.load);
      const hour = ((Math.floor(row.t / 3600000 + input.timezone) % 24) + 24) % 24;
      const inWindow = (start: number, duration: number) => duration > 0 && (duration >= 24 || ((hour - start + 24) % 24) < duration);
      const rate = inWindow(planning.energy.peakStartHour ?? 16, planning.energy.peakHours)
        ? (planning.energy.peakPence > 0 ? planning.energy.peakPence : planning.energy.importPence)
        : inWindow(planning.energy.offPeakStartHour ?? 0, planning.energy.offPeakHours)
          ? planning.energy.offPeakPence
          : planning.energy.importPence;
      acc.directSolarKwh += direct;
      acc.exportKwh += Math.max(0, row.pv - direct);
      acc.directSolarValue += direct * rate / currency.priceDivisor;
      return acc;
    }, { directSolarKwh: 0, storedSolarKwh: 0, exportKwh: 0, directSolarValue: 0, storedSolarValue: 0 });
    const dispatched = year === 1 ? withBattery : core.dispatchWithGridCharging(rows, batteryNominal, batteryPower, {
      ...tariffOptions,
      cyclic: false,
      initialSolarKwh: priorSolarStorage,
      initialGridKwh: priorGridStorage,
    });
    priorSolarStorage = dispatched.storedSolar;
    priorGridStorage = dispatched.storedGrid;
    const sums = year === 1 ? batterySums : summarizeTariffDispatch(dispatched);
    return {
      solarOnly,
      solarBattery: {
        directSolarKwh: sums.direct,
        storedSolarKwh: sums.storedSolar,
        exportKwh: sums.export,
        offPeakChargeKwh: sums.gridCharge,
        offPeakDischargeKwh: sums.storedGrid,
        directSolarValue: sums.directValue / currency.priceDivisor,
        storedSolarValue: sums.storedSolarValue / currency.priceDivisor,
      },
    };
  });
  const scenarios = calculateFinancialScenarios({
    annualGenerationKwh: annualGeneration,
    energy: planning.energy,
    costs: planning.costs,
    unitPriceDivisor: currency.priceDivisor,
    simulatedDirectShares: {
      solarOnly: annualGeneration ? t.self / annualGeneration : 0,
      solarBattery: annualGeneration ? batterySums.self / annualGeneration : 0,
    },
    simulatedEnergyShares: {
      solarOnly: {
        self: annualGeneration ? t.self / annualGeneration : 0,
        export: annualGeneration ? t.export / annualGeneration : 0,
      },
      solarBattery: {
        self: annualGeneration ? batterySums.self / annualGeneration : 0,
        export: annualGeneration ? batterySums.export / annualGeneration : 0,
      },
    },
    simulatedEnergyKwh: {
      solarOnly: {
        directSolarKwh: t.self,
        storedSolarKwh: 0,
        exportKwh: t.export,
        directSolarValue: simulatedEnergyByYear[0]!.solarOnly.directSolarValue,
        storedSolarValue: 0,
      },
      solarBattery: {
        directSolarKwh: batterySums.direct,
        storedSolarKwh: batterySums.storedSolar,
        exportKwh: batterySums.export,
        offPeakChargeKwh: batterySums.gridCharge,
        offPeakDischargeKwh: batterySums.storedGrid,
        directSolarValue: batterySums.directValue / currency.priceDivisor,
        storedSolarValue: batterySums.storedSolarValue / currency.priceDivisor,
      },
      batteryOnly: {
        offPeakChargeKwh: batteryOnlySums.gridCharge,
        offPeakDischargeKwh: batteryOnlySums.storedGrid,
      },
    },
    simulatedEnergyByYear: {
      solarOnly: simulatedEnergyByYear.map((year) => year.solarOnly),
      solarBattery: simulatedEnergyByYear.map((year) => year.solarBattery),
      batteryOnly: Array.from({ length: 25 }, () => ({ offPeakChargeKwh: batteryOnlySums.gridCharge, offPeakDischargeKwh: batteryOnlySums.storedGrid })),
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
    { id: "costs", label: "Planning cost", value: `${currency.currency} ${Math.round(prices.projectPrice).toLocaleString("en")} solar${prices.batteryPrice !== null ? ` + ${Math.round(prices.batteryPrice).toLocaleString("en")} battery` : ""}`, provenance: prices.projectPriceSource === "user" ? "user" : "assumed", stepNumber: 5, fieldKey: "costs", params: { currency: currency.currency, solar: Math.round(prices.projectPrice), battery: prices.batteryPrice !== null ? Math.round(prices.batteryPrice) : null, estimated: prices.projectPriceSource === "estimate" || prices.batteryPriceSource === "estimate" ? 1 : 0 }, note: prices.projectPriceSource === "estimate" ? "Indicative installed price from the active product area; enter a quote on the energy page to replace it." : undefined },
  ];
  if (input.googleSolar?.status === "ok") {
    const top = input.googleSolar.roofSegments?.[0];
    ledger.push({ id: "google-solar", label: "External roof geometry", value: `${input.googleSolar.roofSegments?.length ?? 0} roof geometry segments · reference roof area ${input.googleSolar.maxArrayAreaM2 ?? "—"} m²${top ? ` · largest ${top.areaM2} m² at ${top.pitchDeg}° pitch / ${top.azimuthDeg}° azimuth` : ""} · imagery ${input.googleSolar.imageryQuality ?? ""} ${input.googleSolar.imageryDate ?? ""}`.trim(), provenance: "data", stepNumber: 1, fieldKey: "google-solar", params: { segments: input.googleSolar.roofSegments?.length ?? 0, area: input.googleSolar.maxArrayAreaM2 ?? null, topArea: top?.areaM2 ?? null, topPitch: top?.pitchDeg ?? null, topAz: top?.azimuthDeg ?? null, quality: input.googleSolar.imageryQuality ?? null, date: input.googleSolar.imageryDate ?? null }, note: input.googleSolar.note });
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
      electricHotWater: heatPumpProvidesHotWater(settings ?? { heatPumpUse: "off" }) || (settings?.electricWaterHeating ?? false),
      evCharger: settings?.evCharging ?? false,
      heatPumpUse: settings?.heatPumpUse,
      airConditionerUse: settings?.airConditionerUse,
      electricUnderfloorHeating: settings?.electricUnderfloorHeating,
      electricRadiators: settings?.electricRadiators,
      electricWaterHeating: settings?.electricWaterHeating,
      evAnnualDistanceKm: settings?.evAnnualDistanceKm,
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
      battery: {
        nominalKwh: batteryNominal,
        powerKw: batteryPower,
        selfConsumedKwh: batterySums.self,
        exportKwh: batterySums.export,
        gridImportKwh: batterySums.grid,
        directSolarKwh: batterySums.direct,
        storedSolarKwh: batterySums.storedSolar,
        offPeakChargeKwh: batterySums.gridCharge,
        offPeakDischargeKwh: batterySums.storedGrid,
        solarLossKwh: batterySums.solarLoss,
        gridLossKwh: batterySums.gridLoss,
        startingSolarStoredKwh: withBattery.initialSolar,
        endingSolarStoredKwh: withBattery.storedSolar,
      },
      kpis,
      buildingNorthDeg: north,
      demandCalibration: bill !== null ? "bill" : household !== null ? "household" : "model",
      irradiationWarnings: sim.irradiationWarnings,
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
