import { getProduct } from "../data/catalogue";
import type { Surface } from "../types/solar";

export type CapacityLine = { surfaceId: string; capacityKwp: number; wpPerM2: number };

export function powerDensityForSurface(surface: Surface): number {
  if (!surface.productId || !surface.included || surface.coverage <= 0 || surface.areaM2 <= 0) return 0;
  if (surface.kind === "conservatory-roof" && /side wall/i.test(surface.label)) return 0;
  const product = getProduct(surface.productId);
  if (!product) throw new Error(`Unknown product: ${surface.productId}`);
  const hasColourReduction = product.category === "roof" && surface.finishId !== "black";
  return hasColourReduction ? product.colouredWpPerM2 ?? product.wpPerM2 : product.wpPerM2;
}

export function deriveSurfaceCapacity(surface: Surface): CapacityLine {
  const wpPerM2 = powerDensityForSurface(surface);
  return { surfaceId: surface.id, wpPerM2, capacityKwp: (surface.areaM2 * surface.coverage * wpPerM2) / 1000 };
}

export function deriveCapacity(surfaces: Surface[]): number {
  return surfaces.reduce((sum, surface) => sum + deriveSurfaceCapacity(surface).capacityKwp, 0);
}

export function activeSurfaceArea(surfaces: Surface[]): number {
  return surfaces.reduce((sum, surface) => sum + (powerDensityForSurface(surface) > 0 ? surface.areaM2 * surface.coverage : 0), 0);
}

export function capacityMatchesSubmitted(submittedKwp: number, surfaces: Surface[], tolerance = 0.001): boolean {
  const derived = deriveCapacity(surfaces);
  if (derived === 0) return submittedKwp === 0;
  return Math.abs(submittedKwp - derived) / derived <= tolerance;
}
