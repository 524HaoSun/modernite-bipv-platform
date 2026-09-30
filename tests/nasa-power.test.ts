import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import * as core from "../lib/customer-energy-core";
import { NASA_POWER_PARAMS, nasaPowerToWeather, nasaPowerUrl, type NasaPowerPayload } from "../lib/nasa-power";

const studio = fs.readFileSync(path.resolve(import.meta.dirname, "../client/public/studio.html"), "utf8");

function customerLocationCore() {
  const script = (id: string) => {
    const match = studio.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`));
    if (!match) throw new Error(`Missing ${id}`);
    return match[1];
  };
  const context = vm.createContext({ Math, Date, Number, Array, Object, Map, Set, JSON, Error, Infinity, NaN, isFinite, URL, Intl });
  vm.runInContext("var window = this;", context);
  vm.runInContext(script("modernite-energy-core"), context);
  vm.runInContext(script("modernite-location-core"), context);
  return (context as unknown as { ModerniteLocationCore: any }).ModerniteLocationCore;
}

function nasaPayload(year: number, site: core.Location): NasaPowerPayload {
  const weather = core.synthetic("UK", site);
  const parameter: Record<string, Record<string, number>> = Object.fromEntries(Object.values(NASA_POWER_PARAMS).map((param) => [param, {}]));
  const start = Date.UTC(year, 0, 1);
  const hours = (Date.UTC(year + 1, 0, 1) - start) / 3_600_000;
  for (let i = 0; i < hours; i++) {
    const row = weather.rows[i % weather.rows.length];
    const key = new Date(start + i * 3_600_000).toISOString().slice(0, 13).replace(/[-T]/g, "");
    parameter.T2M[key] = row.ta;
    parameter.ALLSKY_SFC_SW_DWN[key] = row.ghi;
    parameter.ALLSKY_SFC_SW_DIFF[key] = row.dhi;
    parameter.ALLSKY_SFC_SW_DNI[key] = row.dni;
    parameter.ALLSKY_SFC_LW_DWN[key] = 300 + (i % 50);
    parameter.RH2M[key] = 70 + (i % 20);
    parameter.WS10M[key] = 3 + (i % 7) / 2;
  }
  const units = Object.fromEntries(Object.values(NASA_POWER_PARAMS).map((param) => [param, { units: param === "T2M" ? "C" : param === "RH2M" ? "%" : param === "WS10M" ? "m/s" : "Wh/m^2" }]));
  return { header: { time_standard: "UTC", fill_value: -999 }, parameters: units, properties: { parameter } };
}

describe("NASA POWER weather (customer Studio parser)", () => {
  const site = { lat: 51.5079, lon: -0.1392, tz: 0, zone: "Europe/London", address: "London" };
  const original = customerLocationCore();

  it("builds the same request URL as the customer Studio", () => {
    expect(nasaPowerUrl(site, 2024)).toBe(original.url(site, 2024));
  });

  it("parses rows identically to the customer Studio for a leap year", () => {
    const payload = nasaPayload(2024, site);
    const ours = nasaPowerToWeather(payload, site, 2024);
    const theirs = original.parse(JSON.parse(JSON.stringify(payload)), site, 2024);
    expect(ours.rows).toHaveLength(8784);
    expect(JSON.parse(JSON.stringify(ours.rows))).toEqual(JSON.parse(JSON.stringify(theirs.rows)));
    expect(ours.source).toBe(theirs.source);
    expect(ours.location).toEqual(JSON.parse(JSON.stringify(theirs.location)));
  });

  it("rejects fill values and incomplete years like the customer Studio", () => {
    const payload = nasaPayload(2023, site);
    const key = Object.keys(payload.properties!.parameter!.T2M)[100];
    payload.properties!.parameter!.ALLSKY_SFC_SW_DNI[key] = -999;
    expect(() => nasaPowerToWeather(payload, site, 2023)).toThrow(/WEATHER_MISSING/);
    expect(() => nasaPowerToWeather(nasaPayload(2023, site), site, 2022)).toThrow(/WEATHER_INCOMPLETE/);
  });
});
