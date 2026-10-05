import type { Catalogue, Technical } from "../../shared/control";
import type { ProductRuntime, Profile } from "../../lib/customer-energy-core";
import type { StudioCalculationSnapshot } from "../../lib/studio-calculation";
import { ControlStore, fail } from "./store";
export function calculationRuntime(
  store: ControlStore,
  snapshot: StudioCalculationSnapshot,
  versions?: { catalogue: string; technical: string }
) {
  const catalog = versions
      ? store.release(versions.catalogue)
      : store.current("catalogue"),
    tech = versions
      ? store.release(versions.technical)
      : store.current("technical");
  if (
    catalog.domain !== "catalogue" ||
    tech.domain !== "technical" ||
    catalog.status !== "approved" ||
    tech.status !== "approved"
  )
    fail(400, "Invalid calculation versions");
  const c = catalog.data as Catalogue,
    t = tech.data as Technical;
  const profiles: Record<string, Profile> = {};
  for (const p of t.products) {
    const meta = c.find(m => m.id === p.id)!;
    profiles[p.id] = [meta.name, p.wp, p.a, p.b];
  }
  const surfaces = snapshot.surfaces.map(surface => {
    const p = t.products.find(p => p.id === surface.profile),
      meta = c.find(p => p.id === surface.profile);
    if (!p || !meta) fail(400, "Unknown product profile");
    if (surface.enabled !== false && !meta.active)
      fail(409, `${meta.name} is no longer available. Select another product.`);
    // Geometry supplies active area; never deduct tile borders for a second time.
    return { ...surface, role: p.role, u: p.u ?? 0, g: p.g ?? 0 };
  });
  const productRuntime: ProductRuntime = { profiles, ...t.model };
  return {
    snapshot: { ...snapshot, surfaces },
    productRuntime,
    versions: { catalogue: catalog.id, technical: tech.id },
  };
}
