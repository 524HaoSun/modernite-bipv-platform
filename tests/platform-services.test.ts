import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { parseBuildingInsights } from "../lib/google-solar";
import { utmToLatLng, utmZoneFromEpsg } from "../lib/utm";
import { cachedValue } from "../server/persistent-cache";
import { quantile } from "../server/solar-heatmap-service";
import { SHARE_COPY } from "../client/src/lib/share-copy";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("external roof geometry reference", () => {
  it("summarises roof area and sunshine without exposing panel output", () => {
    const reference = parseBuildingInsights({
      center: { latitude: 52.925, longitude: -1.229 },
      solarPotential: { maxArrayAreaMeters2: 29.3, maxSunshineHoursPerYear: 1042 },
    }, { lat: 52.925, lng: -1.229 });
    expect(reference.maxArrayAreaM2).toBe(29.3);
    expect(reference.maxSunshineHoursPerYear).toBe(1042);
    expect(reference).not.toHaveProperty("maxArray" + "CapacityKwp");
    expect(reference).not.toHaveProperty("maxArray" + "YearlyDcKwh");
  });
});

describe("solar heatmap geometry", () => {
  it("converts UTM GeoTIFF corners back to WGS84", () => {
    expect(utmZoneFromEpsg(32630)).toEqual({ zone: 30, south: false });
    expect(utmZoneFromEpsg(32755)).toEqual({ zone: 55, south: true });
    expect(utmZoneFromEpsg(3857)).toBeNull();
    const centre = utmToLatLng(619053.25, 5865395.6, 30, false);
    expect(centre.lat).toBeCloseTo(52.925, 3);
    expect(centre.lng).toBeCloseTo(-1.229, 3);
  });

  it("picks colour-scale bounds from sorted roof values", () => {
    const values = Array.from({ length: 101 }, (_, i) => i * 10);
    expect(quantile(values, 0)).toBe(0);
    expect(quantile(values, 0.5)).toBe(500);
    expect(quantile(values, 1)).toBe(1000);
    expect(quantile([], 0.5)).toBe(0);
  });
});

describe("persistent cache", () => {
  it("falls back to memory and dedupes loads without Cloudflare credentials", async () => {
    const load = vi.fn(async () => ({ ok: true }));
    const [a, b] = await Promise.all([cachedValue("test", "k1", 60_000, load), cachedValue("test", "k1", 60_000, load)]);
    expect(a).toEqual({ ok: true });
    expect(b).toBe(a);
    await cachedValue("test", "k1", 60_000, load);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not keep values rejected by shouldStore", async () => {
    const load = vi.fn(async () => ({ status: "unavailable" }));
    await cachedValue("test", "k2", 60_000, load, (value) => value.status !== "unavailable");
    await cachedValue("test", "k2", 60_000, load, (value) => value.status !== "unavailable");
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe("platform wiring", () => {
  it("routes caches, heatmap, sharing and PDF through the server", () => {
    const routers = read("server/routers.ts");
    expect(routers).toContain("solarHeatmap");
    expect(routers).toContain("sharedProject");
    expect(read("server/_core/index.ts")).toContain("registerProjectReportRoute");
    for (const file of ["server/google-solar-service.ts", "server/building-service.ts", "server/building-profile-service.ts", "server/solar-heatmap-service.ts"]) {
      expect(read(file)).toContain("cachedValue(");
    }
    expect(read("server/_core/vite.ts")).toContain("static.cloudflareinsights.com/beacon.min.js");
  });

  it("wires the client features", () => {
    expect(read("client/src/components/AddressGate.tsx")).toContain("placesAutocomplete(");
    expect(read("client/src/components/ProjectLocationMap.tsx")).toContain("osm-sun-layer");
    expect(read("client/src/components/BuildingProfileCard.tsx")).toContain("potentialNote");
    const results = read("client/src/components/ResultsReport.tsx");
    expect(results).toContain("ShareActions");
    expect(results).toContain("/report.pdf");
    expect(results).toContain("onCreate?: (scenarioId: FinancialScenario[\"id\"]) => Promise<string>");
    expect(results).toContain("baseScenarioId?: FinancialScenario[\"id\"]");
    expect(results).toContain("share.onCreate!(scenarioId)");
    expect(results).toContain("scenarioId === share.baseScenarioId");
    const app = read("client/src/App.tsx");
    expect(app).toContain("SharedProjectPage");
    expect(app).toContain("query.data?.scenarioId");
    expect(app).toContain("createScenarioShare");
    expect(app).toContain("share={{ sharedId: id, baseScenarioId: scenarioId as FinancialScenario[\"id\"] | undefined, onCreate: createScenarioShare }}");
    expect(app).toContain("payload: { study: study as unknown as Record<string, unknown>, context: context as unknown as Record<string, unknown>, scenarioId }");
    expect(read("server/routers.ts")).toContain("scenarioId: z.enum([\"solar-only\", \"solar-battery\", \"battery-only\"]).optional()");
    expect(app).toContain("customer-studio-shell is-workspace");
    expect(app).toContain("requestFullscreen");
    expect(read("client/src/index.css")).toContain(".customer-studio-shell.is-focus .studio-bridge-bar");
  });

  it("has share copy in all seven languages", () => {
    expect(Object.keys(SHARE_COPY).sort()).toEqual(["en", "es", "fr", "it", "ja", "zh", "zh-Hant"]);
    for (const copy of Object.values(SHARE_COPY)) {
      expect(copy.pdf).toBeTruthy();
      expect(copy.studioReport).toBeTruthy();
      expect(copy.sharedBanner).toBeTruthy();
    }
  });
});
