import { REFERENCE_TEMPERATURE_C, TEMPERATURE_COEFFICIENT_PER_C } from "../data/constants";
import { baseEfficiency } from "./efficiency";

export const FULL_COUPLED_MODEL_ENABLED = false;

export function noctCellTemperature(airTemperatureC: number, irradianceWm2: number): number {
  if (irradianceWm2 < 0) throw new Error("Irradiance cannot be negative");
  return airTemperatureC + (irradianceWm2 / 800) * 25;
}

export function temperatureFactor(pvTemperatureC: number): number {
  return 1 + TEMPERATURE_COEFFICIENT_PER_C * (pvTemperatureC - REFERENCE_TEMPERATURE_C);
}

export function referencePowerDensityWm2(irradianceWm2: number, pvTemperatureC: number): number {
  return irradianceWm2 * baseEfficiency(irradianceWm2) * temperatureFactor(pvTemperatureC);
}

export function coupledCellTemperature(input: {
  exteriorHeatTransfer: number;
  interiorHeatTransfer: number;
  exteriorTemperatureC: number;
  interiorTemperatureC: number;
  irradianceWm2: number;
  absorptance: number;
  electricalEfficiency: number;
}): number {
  const { exteriorHeatTransfer, interiorHeatTransfer, exteriorTemperatureC, interiorTemperatureC, irradianceWm2, absorptance, electricalEfficiency } = input;
  const numerator = exteriorHeatTransfer * exteriorTemperatureC
    + interiorHeatTransfer * interiorTemperatureC
    + irradianceWm2 * (absorptance - electricalEfficiency + electricalEfficiency * TEMPERATURE_COEFFICIENT_PER_C * REFERENCE_TEMPERATURE_C);
  const denominator = exteriorHeatTransfer + interiorHeatTransfer + irradianceWm2 * electricalEfficiency * TEMPERATURE_COEFFICIENT_PER_C;
  return numerator / denominator;
}
