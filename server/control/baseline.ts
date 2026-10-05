import { PROFILES } from "../../lib/customer-energy-core";
import type { Catalogue, Technical, Pricing } from "../../shared/control";
const websiteNames: Record<keyof typeof PROFILES, string> = {
  windsor_black: "Windsor Broad · All Black",
  windsor_colour: "Windsor Broad · Coloured",
  cotswold_black: "Cotswold Slate · All Black",
  cotswold_colour: "Cotswold Slate · Coloured",
  yorkshire_black: "Yorkshire Longspan · All Black",
  yorkshire_colour: "Yorkshire Longspan · Coloured",
  highland_black: "Highland Shingle · All Black",
  highland_colour: "Highland Shingle · Coloured",
  canopy: "Solar Canopy",
  railing: "Solar Railing",
  edge: "Solar Window — Edge",
  standard: "Solar Window — Standard",
  skylight: "Solar Skylight",
  sunroom: "Solar Conservatory — Roof",
  facade_black: "Solar Facade — Black Opaque",
  facade_grey: "Solar Facade — Grey Coloured",
  facade_lt: "Solar Facade — Light-Transmitting",
};
export const catalogue: Catalogue = Object.entries(PROFILES).map(([id, p]) => ({
  id: id as Catalogue[number]["id"],
  name: websiteNames[id as keyof typeof PROFILES],
  active: true,
  frameColour: id.includes("black") ? "All Black" : "Graphite Grey",
  description: "",
}));
export const technical: Technical = {
  products: catalogue.map(p => {
    const thermal = (
      {
        edge: [0.4, 0.12],
        standard: [1.2, 0.2],
        skylight: [0.5, 0.11],
        facade_lt: [0.4, 0.12],
      } as Record<string, number[]>
    )[p.id];
    return {
      id: p.id,
      wp: PROFILES[p.id][1],
      a: PROFILES[p.id][2],
      b: PROFILES[p.id][3],
      role: thermal ? (p.id === "skylight" ? "skylight" : "window") : "none",
      u: thermal?.[0] ?? null,
      g: thermal?.[1] ?? null,
      thermalBasis: thermal ? "unconfirmed" : "not_applicable",
      areaBasis: "unconfirmed",
    };
  }),
  model: {
    gamma: -0.00189,
    referenceTemperature: 25,
    threshold: 140,
    lowIntercept: 0.2021,
    lowSlope: 0.0000757142857,
    highLog: -0.02458,
    highIntercept: 0.33386,
    tileWidthDeduction: 0.025,
    tileHeightDeduction: 0.045,
  },
};
export const pricing: Pricing = catalogue.map(p => ({
  id: p.id,
  currency: "GBP",
  unit: "m2",
  taxBasis: "excluding_tax",
  cost: null,
  method: "fixed",
  rate: null,
  sale: null,
  minimumMargin: null,
  maxDiscount: 0,
  wastage: 0,
  wastageIncluded: true,
  effectiveFrom: null,
  effectiveUntil: null,
  bom: [],
  tiers: [],
}));
