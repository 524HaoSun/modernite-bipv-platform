import { randomUUID } from "node:crypto";
import {
  parseDomain,
  type Domain,
  type ControlUser,
  type Technical,
  type Catalogue,
  type Pricing,
  type Role,
} from "../../shared/control";
import { ControlStore, fail, requireRole, hasRole } from "./store";
const writers: Record<Domain, Role[]> = {
  catalogue: ["product", "super"],
  technical: ["product", "technical", "super"],
  pricing: ["pricing", "super"],
};
const reviewers: Record<Domain, Role[]> = {
  catalogue: ["product", "super"],
  technical: ["technical", "super"],
  pricing: ["pricing", "super"],
};
export function canReadDomain(user: ControlUser, domain: Domain) {
  return hasRole(user, ...writers[domain]);
}
export function submitRelease(
  store: ControlStore,
  user: ControlUser,
  input: {
    domain: Domain;
    data: unknown;
    baseId: string;
    reason: string;
    source: string;
  }
) {
  requireRole(user, ...writers[input.domain]);
  const data = parseDomain(input.domain, input.data);
  return store.transaction(() => {
    const base = store.current(input.domain);
    if (input.domain === "technical") {
      const proposed = data as Technical,
        previous = base.data as Technical;
      if (
        !hasRole(user, "technical", "super") &&
        JSON.stringify(proposed.model) !== JSON.stringify(previous.model)
      )
        fail(
          403,
          "Only technical administrators can change the calculation model"
        );
      if (
        proposed.model.tileWidthDeduction !==
          previous.model.tileWidthDeduction ||
        proposed.model.tileHeightDeduction !==
          previous.model.tileHeightDeduction
      )
        fail(
          409,
          "Tile geometry deductions require a coordinated Studio geometry migration; they cannot be changed independently"
        );
    }
    if (base.id !== input.baseId)
      fail(
        409,
        "A newer release is available. Reload and apply your changes to it."
      );
    const id = randomUUID(),
      now = new Date().toISOString();
    store.db
      .prepare(
        "INSERT INTO releases VALUES(?,?,0,'submitted',?,?,NULL,?,?,?,NULL,?)"
      )
      .run(
        id,
        input.domain,
        base.id,
        user.id,
        input.reason,
        input.source,
        now,
        JSON.stringify(data)
      );
    store.audit(user.id, "release.submitted", id, input.domain, {
      baseId: base.id,
      reason: input.reason,
    });
    return store.release(id);
  });
}
export function transition(
  store: ControlStore,
  user: ControlUser,
  id: string,
  action: "approve"
) {
  return store.transaction(() => {
    const r = store.release(id);
    const approver = store.user(user.id);
    if (!approver) fail(403, "Your role cannot perform this action");
    requireRole(approver, ...reviewers[r.domain]);
    if (r.status !== "submitted")
      fail(409, "Only submitted changes can be approved");
    if (r.author === approver.id)
      fail(403, "A different authorized person must approve this change");
    if (store.current(r.domain).id !== r.baseId)
      fail(
        409,
        "The active version changed. Submit this change again from the current version."
      );
    store.db
      .prepare(
        "UPDATE releases SET status='approved',version=?,reviewer=?,published_at=? WHERE id=?"
      )
      .run(
        store.current(r.domain).version + 1,
        approver.id,
        new Date().toISOString(),
        id
      );
    store.audit(approver.id, `release.${action}`, id, r.domain, {
      reason: r.reason,
      baseId: r.baseId,
    });
    return store.release(id);
  });
}
export function publicCatalogue(store: ControlStore) {
  const catalog = store.current("catalogue"),
    technical = store.current("technical");
  return {
    catalogueVersion: catalog.id,
    parameterVersion: technical.id,
    products: (catalog.data as Catalogue)
      .filter(p => p.active)
      .map(p => {
        const t = (technical.data as Technical).products.find(
          t => t.id === p.id
        )!;
        return {
          id: p.id,
          name: p.name,
          description: p.description,
          wp: t.wp,
          role: t.role,
          u: t.u,
          g: t.g,
          thermalBasis: t.thermalBasis,
          areaBasis: t.areaBasis,
        };
      }),
  };
}
export function quoteLines(
  store: ControlStore,
  items: { id: string; quantity: number; unit: string }[],
  priceId = store.current("pricing").id
) {
  const release = store.release(priceId);
  if (release.domain !== "pricing" || release.status !== "approved")
    fail(400, "Invalid price version");
  const prices = release.data as Pricing,
    now = new Date().toISOString(),
    catalog = store.current("catalogue").data as Catalogue;
  let currency: string | null = null,
    taxBasis: string | null = null;
  const lines = items.map(item => {
    const p = prices.find(p => p.id === item.id);
    if (!p || !catalog.find(c => c.id === item.id && c.active))
      fail(400, "Product is unavailable");
    if (p.unit !== item.unit)
      fail(400, "Quantity unit does not match the price list");
    if (
      (currency && currency !== p.currency) ||
      (taxBasis && taxBasis !== p.taxBasis)
    )
      fail(400, "A quote must use one currency and tax basis");
    currency = p.currency;
    taxBasis = p.taxBasis;
    if (
      !p.effectiveFrom ||
      p.effectiveFrom > now ||
      (p.effectiveUntil && p.effectiveUntil <= now)
    )
      fail(409, "A current approved price is required for every product");
    const cost =
      p.cost === null ? null : p.cost * (p.wastageIncluded ? 1 : 1 + p.wastage);
    let sale =
      p.method === "fixed"
        ? p.sale
        : cost === null || p.rate === null
          ? null
          : p.method === "markup"
            ? cost * (1 + p.rate)
            : cost / (1 - p.rate);
    if (p.tiers.length)
      sale =
        p.tiers.find(
          t =>
            item.quantity >= t.from && (t.to === null || item.quantity < t.to)
        )?.sale ?? null;
    if (sale === null || sale <= 0 || !Number.isFinite(sale))
      fail(409, "Price pending — request a quotation");
    if (
      p.minimumMargin !== null &&
      (cost === null || (sale - cost) / sale < p.minimumMargin)
    )
      fail(409, "This quotation needs pricing review");
    return {
      id: item.id,
      name: catalog.find(c => c.id === item.id)!.name,
      quantity: item.quantity,
      unit: p.unit,
      unitPrice: Math.round(sale * 100) / 100,
      total: Math.round(sale * item.quantity * 100) / 100,
    };
  });
  return {
    priceVersion: priceId,
    currency,
    taxBasis,
    lines,
    total: Math.round(lines.reduce((sum, l) => sum + l.total, 0) * 100) / 100,
  };
}
export function impact(data: Technical, baseline: Technical) {
  const sample = (
    d: Technical,
    wp: number,
    a: number,
    b: number,
    g: number
  ) => {
    if (g === 0) return 0;
    const m = d.model,
      eta =
        g <= m.threshold
          ? m.lowIntercept + m.lowSlope * g
          : m.highLog * Math.log(g) + m.highIntercept;
    const reference = 1000 * (m.highLog * Math.log(1000) + m.highIntercept);
    return (
      Math.max(
        0,
        10 *
          g *
          (wp / reference) *
          eta *
          (1 +
            m.gamma * (25 + a * g * 0.8 + b * g * 0.2 - m.referenceTemperature))
      ) * 0.9
    );
  };
  return data.products.map(p => {
    const old = baseline.products.find(t => t.id === p.id)!;
    return {
      id: p.id,
      points: [0, 139.999, 140, 140.001, 1000].map(g => ({
        irradiance: g,
        beforeWatts: sample(baseline, old.wp, old.a, old.b, g),
        afterWatts: sample(data, p.wp, p.a, p.b, g),
      })),
    };
  });
}
