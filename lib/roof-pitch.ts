/**
 * The configurator treats roof and facade surfaces separately.
 * 70° is deliberately the upper roof-slope limit; vertical (90°) solar
 * belongs to the facade library rather than to a building roof.
 */
export const MIN_ROOF_PITCH_DEG = 0;
export const MAX_ROOF_PITCH_DEG = 70;

export function clampRoofPitch(value: number): number {
  if (!Number.isFinite(value)) return MIN_ROOF_PITCH_DEG;
  return Math.min(MAX_ROOF_PITCH_DEG, Math.max(MIN_ROOF_PITCH_DEG, value));
}
