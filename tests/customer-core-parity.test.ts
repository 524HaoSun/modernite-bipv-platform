import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import * as core from "../lib/customer-energy-core";

const studio = fs.readFileSync(path.resolve(import.meta.dirname, "../client/public/studio.html"), "utf8");

function customerRuntime() {
  const script = (id: string) => {
    const match = studio.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`));
    if (!match) throw new Error(`Missing ${id}`);
    return match[1];
  };
  const context = vm.createContext({ Math, Date, Number, Array, Object, Map, Set, JSON, Error, Infinity, NaN, isFinite });
  vm.runInContext("var window = this;", context);
  vm.runInContext(script("modernite-energy-core"), context);
  vm.runInContext(script("modernite-system-core"), context);
  return (context as unknown as { ModerniteEnergyCore: any }).ModerniteEnergyCore;
}

const building: core.Building = { width: 9, depth: 8, floors: 2, storeyHeight: 2.9, wwr: 0.2, usage: "residential" };
const surfaces: core.Surface[] = [
  { id: "roof_tiles:s", profile: "windsor_black", area: 32, tilt: 35, az: 180, role: "none", linked: true, u: 0, g: 0 },
  { id: "roof_tiles:n", profile: "cotswold_colour", area: 28, tilt: 35, az: 0, role: "none", linked: true, u: 0, g: 0 },
  { id: "facade:grey", profile: "facade_grey", area: 14, tilt: 90, az: 90, role: "none", linked: true, u: 0, g: 0 },
  { id: "facade:lt", profile: "facade_lt", area: 6, tilt: 90, az: 180, role: "window", linked: true, u: 1.1, g: 0.3 },
  { id: "skylight:1", profile: "skylight", area: 2.5, tilt: 20, az: 270, role: "skylight", linked: true, u: 1.3, g: 0.25 },
];

function round(value: unknown): unknown {
  if (typeof value === "number") return Number.isFinite(value) ? Number(value.toPrecision(12)) : value;
  if (Array.isArray(value)) return value.map(round);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, round(v)]));
  return value;
}

describe("customer V31 energy core parity", () => {
  const original = customerRuntime();

  it("keeps product coefficients identical to the customer runtime", () => {
    expect(JSON.parse(JSON.stringify(core.PROFILES))).toEqual(JSON.parse(JSON.stringify(original.PROFILES)));
  });

  const cases: [string, Partial<core.Parameters>][] = [
    ["gas boiler default, solar only", {}],
    ["heat pump + EV + hot water, auto battery", { heatMode: "pump", dhw: 15, devices: { ev: { enabled: true } }, batteryEnabled: true, batteryMode: "auto" }],
    ["office, manual inverter, manual battery", { occupancy: "office", base: 45, inverterMode: "manual", inverter: 5, batteryEnabled: true, batteryMode: "manual", batteryKWh: 8, batteryKW: 3 }],
  ];

  for (const [label, overrides] of cases) {
    it(`matches the customer simulate(): ${label}`, () => {
      const p = { ...core.defaults(building), ...overrides } as core.Parameters;
      const location = { lat: 51.5072, lon: -0.1276, tz: 0 };
      const weather = core.synthetic("UK", location);
      const ours = core.simulate(p, surfaces, weather, location);
      const theirs = original.simulate(JSON.parse(JSON.stringify(p)), JSON.parse(JSON.stringify(surfaces)), original.synthetic("UK", location), location);

      expect(round(ours.totals)).toEqual(round(theirs.totals));
      expect(round(ours.monthly)).toEqual(round(theirs.monthly));
      expect(round(ours.products.map(({ monthlyAc: _m, ...rest }) => rest))).toEqual(round(theirs.products));
      expect(round(ours.systemSizing)).toEqual(round(theirs.systemSizing));
      expect(round(ours.kwp)).toEqual(round(theirs.kwp));
      for (const product of ours.products) {
        expect(product.monthlyAc.reduce((a, b) => a + b, 0)).toBeCloseTo(product.ac, 6);
      }
    });
  }

  it("matches the customer model on UTC weather with a non-zero timezone", () => {
    const p = { ...core.defaults(building), heatMode: "pump" } as core.Parameters;
    const location = { lat: 35.68, lon: 139.69, tz: 9 };
    const base = core.synthetic("JP", location);
    const weather: core.Weather = { ...base, timeStandard: "UTC", year: 2025, location };
    const ours = core.simulate(p, surfaces, weather, location);
    const theirs = original.simulate(JSON.parse(JSON.stringify(p)), JSON.parse(JSON.stringify(surfaces)), JSON.parse(JSON.stringify(weather)), location);
    expect(round(ours.totals)).toEqual(round(theirs.totals));
    expect(round(ours.systemSizing)).toEqual(round(theirs.systemSizing));
  });
});
