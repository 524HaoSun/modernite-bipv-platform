export function baseEfficiency(irradianceWm2: number): number {
  if (!Number.isFinite(irradianceWm2)) throw new Error("Irradiance must be finite");
  if (irradianceWm2 < 0) throw new Error("Irradiance cannot be negative");
  if (irradianceWm2 === 0) return 0;
  if (irradianceWm2 <= 140) return 0.2021 + 0.0000757142857 * irradianceWm2;
  return -0.02458 * Math.log(irradianceWm2) + 0.33386;
}

export const REFERENCE_EFFICIENCY_AT_1000 = baseEfficiency(1000);

export function isExtrapolatedLowLight(irradianceWm2: number): boolean {
  return irradianceWm2 > 0 && irradianceWm2 < 70;
}
