import type { ProductModel, Surface } from "../types/solar";

/**
 * Modernité empirical-coefficient generation model — 22 September 2026.
 *
 * Source: “Modernite Photovoltaic Generation Final Simplified Model —
 * Empirical Coefficient Edition”. This module implements equations (1)–(7)
 * in SI units. It is intentionally independent of UI and PVGIS transport.
 */
export const REFERENCE_POWER_DENSITY_WP_M2 = 164.06737524;
export const INVERTER_AND_WIRING_FACTOR = 0.9;
export const TEMPERATURE_COEFFICIENT_PER_C = 0.00189;

export type IrradianceComponents = {
  directWm2: number;
  diffuseWm2: number;
  reflectedWm2: number;
};

export type EmpiricalCoefficients = {
  powerDensityWpM2: number;
  directRiseKPerWm2: number;
  diffuseReflectedRiseKPerWm2: number;
};

export type EmpiricalProductProfile = EmpiricalCoefficients;

/**
 * Product profiles from the customer-supplied 22 September 2026 empirical
 * model. Coloured roof values already contain the 70% rating conversion.
 */
export const EMPIRICAL_PRODUCT_PROFILES: Readonly<Record<string, EmpiricalProductProfile>> = {
  "tile-windsor:black": { powerDensityWpM2: 140.6, directRiseKPerWm2: 0.04156, diffuseReflectedRiseKPerWm2: 0.03889 },
  "tile-windsor:colour": { powerDensityWpM2: 98.42, directRiseKPerWm2: 0.03747, diffuseReflectedRiseKPerWm2: 0.03469 },
  "tile-cotswold:black": { powerDensityWpM2: 133.2, directRiseKPerWm2: 0.04194, diffuseReflectedRiseKPerWm2: 0.03927 },
  "tile-cotswold:colour": { powerDensityWpM2: 93.24, directRiseKPerWm2: 0.03775, diffuseReflectedRiseKPerWm2: 0.03497 },
  "tile-yorkshire:black": { powerDensityWpM2: 152, directRiseKPerWm2: 0.04097, diffuseReflectedRiseKPerWm2: 0.0383 },
  "tile-yorkshire:colour": { powerDensityWpM2: 106.4, directRiseKPerWm2: 0.03704, diffuseReflectedRiseKPerWm2: 0.03425 },
  "tile-highland:black": { powerDensityWpM2: 139.2, directRiseKPerWm2: 0.04163, diffuseReflectedRiseKPerWm2: 0.03896 },
  "tile-highland:colour": { powerDensityWpM2: 97.44, directRiseKPerWm2: 0.03752, diffuseReflectedRiseKPerWm2: 0.03474 },
  canopy: { powerDensityWpM2: 95, directRiseKPerWm2: 0.02365, diffuseReflectedRiseKPerWm2: 0.02236 },
  railing: { powerDensityWpM2: 105, directRiseKPerWm2: 0.0256, diffuseReflectedRiseKPerWm2: 0.02418 },
  "window-edge": { powerDensityWpM2: 100, directRiseKPerWm2: 0.03814, diffuseReflectedRiseKPerWm2: 0.03605 },
  "window-standard": { powerDensityWpM2: 100, directRiseKPerWm2: 0.0294, diffuseReflectedRiseKPerWm2: 0.02743 },
  skylight: { powerDensityWpM2: 105, directRiseKPerWm2: 0.04385, diffuseReflectedRiseKPerWm2: 0.04142 },
  "conservatory-roof": { powerDensityWpM2: 100, directRiseKPerWm2: 0.04997, diffuseReflectedRiseKPerWm2: 0.0469 },
  "facade-black": { powerDensityWpM2: 150, directRiseKPerWm2: 0.04511, diffuseReflectedRiseKPerWm2: 0.04219 },
  "facade-grey": { powerDensityWpM2: 120, directRiseKPerWm2: 0.03806, diffuseReflectedRiseKPerWm2: 0.03515 },
  "facade-light": { powerDensityWpM2: 100, directRiseKPerWm2: 0.03338, diffuseReflectedRiseKPerWm2: 0.03163 },
};

function assertFiniteNonNegative(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a finite non-negative value`);
}

/** Equation (1): product-plane global irradiance. */
export function totalIrradiance(components: IrradianceComponents): number {
  assertFiniteNonNegative(components.directWm2, "Direct irradiance");
  assertFiniteNonNegative(components.diffuseWm2, "Diffuse irradiance");
  assertFiniteNonNegative(components.reflectedWm2, "Reflected irradiance");
  return components.directWm2 + components.diffuseWm2 + components.reflectedWm2;
}

/** Equation (2): pure-black base efficiency. */
export function empiricalBaseEfficiency(irradianceWm2: number): number {
  assertFiniteNonNegative(irradianceWm2, "Irradiance");
  if (irradianceWm2 === 0) return 0;
  if (irradianceWm2 <= 140) return 0.2021 + 0.0000757142857 * irradianceWm2;
  return -0.02458 * Math.log(irradianceWm2) + 0.33386;
}

export function coefficientsFor(surface: Pick<Surface, "finishId">, product: ProductModel): EmpiricalCoefficients {
  const isRoofColour = product.category === "roof" && surface.finishId !== "black";
  const key = product.category === "roof" ? `${product.id}:${isRoofColour ? "colour" : "black"}` : product.id;
  const found = EMPIRICAL_PRODUCT_PROFILES[key];
  if (!found) throw new Error(`No empirical coefficients are available for ${product.name}`);
  const selectedRatedDensity = isRoofColour ? product.colouredWpPerM2 : product.wpPerM2;
  if (selectedRatedDensity === null || Math.abs(found.powerDensityWpM2 - selectedRatedDensity) > 1e-9) {
    throw new Error(`Empirical profile rating does not match the catalogue for ${product.name}`);
  }
  return { ...found, powerDensityWpM2: selectedRatedDensity };
}

/** Equation (4): photovoltaic layer temperature. */
export function photovoltaicLayerTemperature(airTemperatureC: number, components: IrradianceComponents, coefficients: EmpiricalCoefficients): number {
  if (!Number.isFinite(airTemperatureC)) throw new Error("Air temperature must be finite");
  return airTemperatureC
    + coefficients.directRiseKPerWm2 * components.directWm2
    + coefficients.diffuseReflectedRiseKPerWm2 * (components.diffuseWm2 + components.reflectedWm2);
}

/** Equation (5): product-scaled temperature-corrected efficiency. */
export function productEfficiency(product: ProductModel, surface: Pick<Surface, "finishId">, irradianceWm2: number, layerTemperatureC: number): number {
  if (!Number.isFinite(layerTemperatureC)) throw new Error("Photovoltaic layer temperature must be finite");
  const coefficients = coefficientsFor(surface, product);
  const efficiency = (coefficients.powerDensityWpM2 / REFERENCE_POWER_DENSITY_WP_M2)
    * empiricalBaseEfficiency(irradianceWm2)
    * (1 - TEMPERATURE_COEFFICIENT_PER_C * (layerTemperatureC - 25));
  return Math.max(0, efficiency);
}

export type GenerationStep = {
  globalIrradianceWm2: number;
  layerTemperatureC: number;
  efficiency: number;
  dcPowerW: number;
  acEnergyKwh: number;
};

/** Equations (6) and (7) for one product surface and one calculation interval. */
export function calculateGenerationStep(input: {
  surface: Pick<Surface, "areaM2" | "coverage" | "finishId">;
  product: ProductModel;
  airTemperatureC: number;
  irradiance: IrradianceComponents;
  durationHours: number;
}): GenerationStep {
  assertFiniteNonNegative(input.surface.areaM2, "Surface area");
  assertFiniteNonNegative(input.surface.coverage, "Surface coverage");
  if (input.surface.coverage > 1) throw new Error("Surface coverage cannot exceed 1");
  assertFiniteNonNegative(input.durationHours, "Interval duration");

  const globalIrradianceWm2 = totalIrradiance(input.irradiance);
  if (globalIrradianceWm2 === 0 || input.durationHours === 0) {
    return { globalIrradianceWm2, layerTemperatureC: input.airTemperatureC, efficiency: 0, dcPowerW: 0, acEnergyKwh: 0 };
  }
  const coefficients = coefficientsFor(input.surface, input.product);
  const layerTemperatureC = photovoltaicLayerTemperature(input.airTemperatureC, input.irradiance, coefficients);
  const efficiency = productEfficiency(input.product, input.surface, globalIrradianceWm2, layerTemperatureC);
  const dcPowerW = input.surface.areaM2 * input.surface.coverage * globalIrradianceWm2 * efficiency;
  const acEnergyKwh = INVERTER_AND_WIRING_FACTOR * dcPowerW * input.durationHours / 1000;
  return { globalIrradianceWm2, layerTemperatureC, efficiency, dcPowerW, acEnergyKwh };
}
