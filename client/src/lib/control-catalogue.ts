/** Public product catalogue from the administration SSOT (`/api/control/catalogue`). */

export type PublicCatalogueProduct = {
  id: string;
  name: string;
  description: string;
  wp: number;
  role: string;
  u: number | null;
  g: number | null;
  thermalBasis: string;
  areaBasis: string;
};

export type PublicCatalogue = {
  catalogueVersion: string;
  parameterVersion: string;
  products: PublicCatalogueProduct[];
};

type StudioProfile = [string, number, number, number];

export type StudioEnergyCore = {
  PROFILES: Record<string, StudioProfile>;
};

let cached: PublicCatalogue | null = null;
let inflight: Promise<PublicCatalogue | null> | null = null;

export async function fetchPublicCatalogue(force = false): Promise<PublicCatalogue | null> {
  if (!force && cached) return cached;
  if (!force && inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/api/control/catalogue", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return cached;
      const body = (await res.json()) as PublicCatalogue;
      if (!body?.products || !Array.isArray(body.products)) return cached;
      cached = body;
      return body;
    } catch {
      return cached;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * Push admin-published names and Wp/m² into the embedded Studio energy core so
 * on-screen product labels match the same catalogue used for server calculations.
 * Coefficients a/b stay server-side for formal studies; Studio local demos keep theirs.
 */
export function applyCatalogueToStudio(
  energyCore: StudioEnergyCore | null | undefined,
  catalogue: PublicCatalogue | null | undefined,
): { updated: number; inactiveBlocked: string[] } {
  if (!energyCore?.PROFILES || !catalogue?.products?.length) {
    return { updated: 0, inactiveBlocked: [] };
  }
  const active = new Map(catalogue.products.map(product => [product.id, product]));
  let updated = 0;
  const inactiveBlocked: string[] = [];
  for (const [id, profile] of Object.entries(energyCore.PROFILES)) {
    const published = active.get(id);
    if (!published) {
      inactiveBlocked.push(id);
      continue;
    }
    if (profile[0] !== published.name || profile[1] !== published.wp) {
      profile[0] = published.name;
      profile[1] = published.wp;
      updated += 1;
    }
  }
  return { updated, inactiveBlocked };
}
