import { getProduct, getTileColour } from "../data/catalogue";
import { GROUND_ALBEDO, REGION_CONFIG } from "../data/constants";
import type { BuildingConfig, CostProfile, EnergyProfile, EstimateResult, LedgerEntry, LocationInfo, Surface, SurfaceResult } from "../types/solar";
import { deriveCapacity, deriveSurfaceCapacity, powerDensityForSurface } from "./capacity";
import { degradationFactor } from "./degradation";
import { calculateGenerationStep } from "./empirical-generation";
import { calculateFinancialScenarios } from "./financial";
import { compassName, surfaceAreaFromPlan } from "./geometry";
import { demonstrationIrradianceSeries, type IrradianceSeries } from "./pvgis";

export function orientationForSurface(azimuthDeg: number, tiltDeg: number): "south" | "east" | "west" | "north" | "horizontal" {
  return tiltDeg < 10 ? "horizontal" : compassName(azimuthDeg);
}

export function calculateSurfaceResult(surface: Surface, irradiation: IrradianceSeries): SurfaceResult {
  const product = surface.productId ? getProduct(surface.productId) : undefined;
  if (!product) throw new Error(`Surface ${surface.label} is missing a product`);
  const { capacityKwp, wpPerM2 } = deriveSurfaceCapacity(surface);
  const monthlyKwh = irradiation.monthly.map((month) => {
    // Monthly irradiation is converted to a representative hourly irradiance.
    // The empirical coefficients then solve equations (1)–(7) over that interval.
    const hours = 30 * 24;
    const directWm2 = (month.beamKwhM2 / hours) * 1000;
    const diffuseWm2 = (month.diffuseKwhM2 / hours) * 1000;
    const reflectedWm2 = (month.reflectedKwhM2 / hours) * 1000;
    const step = calculateGenerationStep({
      surface,
      product,
      airTemperatureC: month.averageAirTemperatureC,
      irradiance: { directWm2, diffuseWm2, reflectedWm2 },
      durationHours: hours,
    });
    return step.acEnergyKwh * degradationFactor(1);
  });
  const annualKwh = monthlyKwh.reduce((sum, value) => sum + value, 0);
  return {
    surfaceId: surface.id, surfaceLabel: surface.label, kind: surface.kind, orientationName: orientationForSurface(surface.azimuthDeg, surface.tiltDeg), azimuthDeg: surface.azimuthDeg, tiltDeg: surface.tiltDeg, areaM2: surface.areaM2, productName: product.name, finishName: surface.finishId ? getTileColour(surface.finishId)?.name : undefined,
    capacityKwp, annualKwh, monthlyKwh, specificYield: capacityKwp > 0 ? annualKwh / capacityKwp : 0,
    irradiationKwhM2: irradiation.monthly.reduce((sum, month) => sum + month.irradiationKwhM2, 0), sharePercent: 0,
    components: {
      beam: irradiation.monthly.reduce((sum, month) => sum + month.beamKwhM2, 0),
      diffuse: irradiation.monthly.reduce((sum, month) => sum + month.diffuseKwhM2, 0),
      reflected: irradiation.monthly.reduce((sum, month) => sum + month.reflectedKwhM2, 0),
    },
  };
}

export function canonicalSurfaces(): Surface[] {
  return [
    { id: "roof-south", kind: "roof-plane", label: "South roof", areaM2: 31.2, areaSource: "measured", azimuthDeg: 180, tiltDeg: 31, tiltSource: "archetype", coverage: 1, productId: "tile-windsor", finishId: "graphite-grey", included: true },
    { id: "roof-north", kind: "roof-plane", label: "North roof", areaM2: 31.2, areaSource: "measured", azimuthDeg: 0, tiltDeg: 31, tiltSource: "archetype", coverage: 1, productId: "tile-windsor", finishId: "graphite-grey", included: true },
    { id: "facade-north", kind: "facade", label: "North façade", areaM2: 12, areaSource: "assumed", azimuthDeg: 0, tiltDeg: 90, tiltSource: "archetype", coverage: 0.3, productId: null, finishId: null, included: false },
    { id: "facade-east", kind: "facade", label: "East façade", areaM2: 12, areaSource: "assumed", azimuthDeg: 90, tiltDeg: 90, tiltSource: "archetype", coverage: 0.3, productId: null, finishId: null, included: false },
    { id: "facade-south", kind: "facade", label: "South façade", areaM2: 15.4, areaSource: "assumed", azimuthDeg: 180, tiltDeg: 90, tiltSource: "archetype", coverage: 0.3, productId: null, finishId: null, included: false },
    { id: "facade-west", kind: "facade", label: "West façade", areaM2: 12, areaSource: "assumed", azimuthDeg: 270, tiltDeg: 90, tiltSource: "archetype", coverage: 0.3, productId: null, finishId: null, included: false },
    { id: "window-south", kind: "window", label: "South-facing solar glass", areaM2: 8, areaSource: "assumed", azimuthDeg: 180, tiltDeg: 90, tiltSource: "archetype", coverage: 1, productId: null, finishId: null, included: false },
    { id: "railing-south", kind: "railing", label: "Balcony solar railing", areaM2: 5, areaSource: "assumed", azimuthDeg: 180, tiltDeg: 90, tiltSource: "archetype", coverage: 1, productId: null, finishId: null, included: false },
    { id: "structure-canopy", kind: "canopy", label: "Additional solar structure", areaM2: 10, areaSource: "assumed", azimuthDeg: 180, tiltDeg: 8, tiltSource: "archetype", coverage: 1, productId: null, finishId: null, included: false },
  ];
}

type EstimateInput = { location: LocationInfo; building: BuildingConfig; surfaces: Surface[]; energy: EnergyProfile; costs: CostProfile };

export function createEmpiricalEstimate(input: EstimateInput, irradianceForSurface: (surface: Surface) => IrradianceSeries): EstimateResult {
  const modelledSurfaces = input.surfaces
    .filter((surface) => powerDensityForSurface(surface) > 0)
    .map((surface) => ({ surface, irradiation: irradianceForSurface(surface) }));
  const successfulSurfaces = modelledSurfaces.map(({ surface, irradiation }) => calculateSurfaceResult(surface, irradiation));
  const climateProfile = modelledSurfaces[0]?.irradiation;
  const representative = successfulSurfaces.reduce((sum, surface) => sum + surface.annualKwh, 0);
  const total = representative || 1;
  successfulSurfaces.forEach((surface) => { surface.sharePercent = Math.round((surface.annualKwh / total) * 100); });
  const userArea = input.surfaces.some((surface) => surface.areaSource === "user");
  const bandPercent = input.energy.demandSource === "llm" ? 15 : userArea ? 12 : 8;
  const monthlyByOrientation = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const values = { south: 0, east: 0, west: 0, north: 0, horizontal: 0 };
    successfulSurfaces.forEach((surface) => { values[surface.orientationName] += surface.monthlyKwh[index] ?? 0; });
    return { month, monthName: new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(2025, index, 1)), ...values, total: Object.values(values).reduce((sum, value) => sum + value, 0) };
  });
  const currencyConfig = REGION_CONFIG[input.location.region];
  const scenarios = calculateFinancialScenarios({ annualGenerationKwh: representative, energy: input.energy, costs: input.costs, unitPriceDivisor: currencyConfig.priceDivisor });
  const bestScenario = scenarios.filter((scenario) => scenario.available).sort((a, b) => b.net25YearGbp - a.net25YearGbp)[0] ?? scenarios[0];
  const capacity = deriveCapacity(input.surfaces);
  const verticalCapacity = input.surfaces.filter((surface) => surface.tiltDeg >= 80).reduce((sum, surface) => sum + deriveSurfaceCapacity(surface).capacityKwp, 0);
  const standardSizes = [3, 3.6, 4, 5, 6, 8, 10, 12, 15, 17, 20, 25, 30];
  const dcRatio = verticalCapacity > capacity / 2 ? 0.75 : 0.88;
  const inverterKw = standardSizes.find((size) => size >= capacity * dcRatio) ?? 30;
  const azimuthRange = Math.max(...input.surfaces.map((surface) => surface.azimuthDeg)) - Math.min(...input.surfaces.map((surface) => surface.azimuthDeg));
  const ledger: LedgerEntry[] = [
    { id: "footprint", label: "Footprint area", value: `${input.location.footprintAreaM2.toFixed(1)} m²`, provenance: "measured", stepNumber: 1, fieldKey: "footprint" },
    { id: "irradiance", label: "Climate input", value: climateProfile?.database ?? "Local empirical climate profile unavailable", provenance: "data", stepNumber: 1, fieldKey: "irradiance" },
    { id: "capacity", label: "Product capacity", value: `${capacity.toFixed(2)} kWp`, provenance: "manufacturer", stepNumber: 3, fieldKey: "capacity" },
    { id: "temperature", label: "Temperature model", value: "Empirical direct + diffuse temperature rise", provenance: "assumed", stepNumber: 5, fieldKey: "temperature" },
    { id: "albedo", label: "Generation model", value: "Empirical coefficients · 90% AC factor", provenance: "assumed", stepNumber: 4, fieldKey: "generation" },
    { id: "conversion", label: "Product configuration", value: "Rated density and selected finish", provenance: "manufacturer", stepNumber: 4, fieldKey: "product" },
  ];
  return {
    caseNumber: `MOD-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-DEMO`, timestamp: new Date().toISOString(),
    range: { low: Math.round(representative * (1 - bandPercent / 100)), representative: Math.round(representative), high: Math.round(representative * (1 + bandPercent / 100)), bandPercent },
    totalCapacityKwp: capacity, surfaces: successfulSurfaces, monthlyByOrientation, scenarios, recommendedScenarioId: bestScenario.id,
    recommendation: { inverterKw, inverterType: `${inverterKw} kW inverter class`, mpptArrangement: azimuthRange > 45 ? "Separate MPPT inputs per orientation group are recommended." : "A shared MPPT arrangement is appropriate for the selected orientations.", batteryCapacityKwh: 5, installerNotes: ["CdTe string design must be confirmed by the installer.", "A site survey must confirm shading, structure and electrical connection."] },
    schedule: successfulSurfaces.reduce<EstimateResult["schedule"]>((lines, surface) => { const existing = lines.find((line) => line.productId === input.surfaces.find((candidate) => candidate.id === surface.surfaceId)?.productId && line.finishName === (surface.finishName ?? "Standard")); const source = input.surfaces.find((candidate) => candidate.id === surface.surfaceId)!; const line = existing ?? { productId: source.productId!, productName: surface.productName, finishName: surface.finishName ?? "Standard", surfaceNames: [], totalAreaM2: 0, unit: "m²" as const, peakPowerWpM2: powerDensityForSurface(source), totalCapacityKwp: 0 }; line.surfaceNames.push(surface.surfaceLabel); line.totalAreaM2 += surface.areaM2 * source.coverage; line.totalCapacityKwp += surface.capacityKwp; if (!existing) lines.push(line); return lines; }, []),
    ledger, summary: "This project study applies the customer-supplied empirical product coefficients to a local regional climate profile. An external validation provider may be connected later without changing the primary calculation.", engine: { method: "deterministic", irradianceDatabase: climateProfile?.database ?? currencyConfig.irradianceDatabase, albedo: GROUND_ALBEDO, conversionRule: "Empirical coefficients (2026-09-22)", guardsTriggered: climateProfile?.source === "local-empirical-climate" ? ["local-empirical-climate"] : [] },
  };
}

export function createDemonstrationEstimate(input: EstimateInput): EstimateResult {
  const result = createEmpiricalEstimate(input, (surface) => demonstrationIrradianceSeries(input.location.region, surface.azimuthDeg, surface.tiltDeg));
  result.ledger = result.ledger.map((entry) => entry.id === "irradiance"
    ? { ...entry, value: `${REGION_CONFIG[input.location.region].irradianceDatabase} demonstration fixture`, note: "Preview-mode fixture only" }
    : entry);
  result.summary = "This demonstration report uses a labelled preview irradiance fixture. Run the local empirical climate calculation before relying on the figures.";
  result.engine.guardsTriggered = ["demonstration-fixture"];
  return result;
}

export { surfaceAreaFromPlan };
