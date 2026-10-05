import { z } from "zod";

export const roles = [
  "customer",
  "dealer",
  "sales",
  "product",
  "technical",
  "pricing",
  "super",
] as const;
export type Role = (typeof roles)[number];
export const domains = ["catalogue", "technical", "pricing"] as const;
export type Domain = (typeof domains)[number];
export const profileIds = [
  "windsor_black",
  "windsor_colour",
  "cotswold_black",
  "cotswold_colour",
  "yorkshire_black",
  "yorkshire_colour",
  "highland_black",
  "highland_colour",
  "canopy",
  "railing",
  "edge",
  "standard",
  "skylight",
  "sunroom",
  "facade_black",
  "facade_grey",
  "facade_lt",
] as const;
const n = (min: number, max: number) => z.number().finite().min(min).max(max);
const complete = <T extends { id: string }>(items: T[]) =>
  items.length === profileIds.length &&
  new Set(items.map(p => p.id)).size === profileIds.length;
export const catalogueSchema = z
  .array(
    z.object({
      id: z.enum(profileIds),
      name: z.string().trim().min(2).max(100),
      active: z.boolean(),
      frameColour: z.string().trim().min(2).max(100).default("Graphite Grey"),
      description: z.string().max(2000),
    })
  )
  .refine(complete, "Include each of the 17 product groups once");
export const technicalSchema = z.object({
  products: z
    .array(
      z
        .object({
          id: z.enum(profileIds),
          wp: n(1, 500),
          a: n(0, 0.2),
          b: n(0, 0.2),
          role: z.enum(["none", "window", "skylight"]),
          u: n(0.01, 10).nullable(),
          g: n(0, 1).nullable(),
          thermalBasis: z.enum([
            "not_applicable",
            "unconfirmed",
            "glass",
            "whole_assembly",
          ]),
          areaBasis: z.enum(["unconfirmed", "overall", "active"]),
        })
        .superRefine((p, ctx) => {
          if (
            p.role === "none"
              ? p.u !== null ||
                p.g !== null ||
                p.thermalBasis !== "not_applicable"
              : p.u === null ||
                p.g === null ||
                p.thermalBasis === "not_applicable"
          )
            ctx.addIssue({
              code: "custom",
              message: "Thermal applicability, U, g and basis must agree",
            });
        })
    )
    .refine(complete, "Include each of the 17 product groups once"),
  model: z
    .object({
      gamma: n(-0.02, 0),
      referenceTemperature: n(0, 50),
      threshold: n(1, 500),
      lowIntercept: n(0, 1),
      lowSlope: n(-0.01, 0.01),
      highLog: n(-1, 0),
      highIntercept: n(0.01, 2),
      tileWidthDeduction: n(0, 0.2),
      tileHeightDeduction: n(0, 0.2),
    })
    .superRefine((m, ctx) => {
      const ref = 1000 * (m.highLog * Math.log(1000) + m.highIntercept);
      if (ref <= 0 || ref > 1000)
        ctx.addIssue({
          code: "custom",
          message:
            "The model must produce a valid reference efficiency at 1000 W/m²",
        });
    }),
});
export const priceSchema = z
  .object({
    id: z.enum(profileIds),
    currency: z.enum(["GBP", "EUR", "CAD", "JPY"]),
    unit: z.enum(["m2", "piece", "set", "metre"]),
    taxBasis: z.enum(["excluding_tax", "including_tax"]),
    cost: n(0.01, 1e7).nullable(),
    method: z.enum(["fixed", "markup", "margin"]),
    rate: n(0, 5).nullable(),
    sale: n(0.01, 1e7).nullable(),
    minimumMargin: n(0, 0.99).nullable(),
    maxDiscount: n(0, 0.99),
    wastage: n(0, 1),
    wastageIncluded: z.boolean(),
    effectiveFrom: z.string().datetime().nullable(),
    effectiveUntil: z.string().datetime().nullable(),
    bom: z
      .array(
        z.object({
          label: z.string().min(1).max(100),
          quantity: n(0.001, 1e6),
          unitCost: n(0, 1e7),
        })
      )
      .max(100),
    tiers: z
      .array(
        z.object({
          from: n(0, 1e9),
          to: n(0.001, 1e9).nullable(),
          sale: n(0.01, 1e7),
        })
      )
      .max(50),
  })
  .superRefine((p, ctx) => {
    const error = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    if (p.method === "margin" && p.rate !== null && p.rate >= 1)
      error("Margin must be below 100%");
    if (
      p.effectiveFrom &&
      p.effectiveUntil &&
      p.effectiveFrom >= p.effectiveUntil
    )
      error("Expiry must follow the effective date");
    p.tiers.forEach((t, i) => {
      if (
        (i === 0 && t.from !== 0) ||
        (i > 0 && p.tiers[i - 1].to !== t.from) ||
        (t.to !== null && t.to <= t.from) ||
        (t.to === null && i !== p.tiers.length - 1)
      )
        error("Price tiers must be ordered and contiguous from zero");
    });
    if (p.tiers.length && p.tiers.at(-1)?.to !== null)
      error("Last tier must have no upper limit");
  });
export const pricingSchema = z
  .array(priceSchema)
  .refine(complete, "Include each of the 17 product groups once");
export type Catalogue = z.infer<typeof catalogueSchema>;
export type Technical = z.infer<typeof technicalSchema>;
export type Pricing = z.infer<typeof pricingSchema>;
export type ControlUser = {
  id: string;
  email: string;
  name: string;
  roles: Role[];
  active: boolean;
  createdAt: string;
};
export type Release = {
  id: string;
  domain: Domain;
  version: number;
  status: "submitted" | "approved";
  baseId: string;
  author: string;
  reviewer: string | null;
  reason: string;
  source: string;
  createdAt: string;
  publishedAt: string | null;
  data: unknown;
};
export function parseDomain(domain: Domain, data: unknown) {
  return {
    catalogue: catalogueSchema,
    technical: technicalSchema,
    pricing: pricingSchema,
  }[domain].parse(data);
}
