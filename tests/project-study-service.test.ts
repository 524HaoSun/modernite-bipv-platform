import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { synthetic } from "../lib/customer-energy-core";
import { NASA_POWER_PARAMS, type NasaPowerPayload } from "../lib/nasa-power";
import type { PvgisTmyPayload } from "../lib/pvgis-tmy";
import { estimateAnnualDemandKwh } from "../lib/studio-calculation";

process.env.WEATHER_CACHE_DIR = mkdtempSync(path.join(os.tmpdir(), "modernite-weather-"));
delete process.env.GOOGLE_SOLAR_API_KEY;

let runProjectCalculation: typeof import("../server/estimate-service")["runProjectCalculation"];

function fakeTmy(): PvgisTmyPayload {
  const rows = synthetic("UK", { lat: 51.5, lon: -0.12, tz: 0 }).rows;
  return {
    inputs: { meteo_data: { radiation_db: "PVGIS-SARAH3", meteo_db: "ERA5", year_min: 2005, year_max: 2023 } },
    outputs: {
      months_selected: [],
      tmy_hourly: rows.map((row) => {
        const d = new Date(row.t);
        const stamp = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}:${String(d.getUTCHours()).padStart(2, "0")}00`;
        return { "time(UTC)": stamp, T2m: row.ta, RH: 80, "G(h)": row.ghi, "Gb(n)": row.dni, "Gd(h)": row.dhi, "IR(h)": 300, WS10m: 3 };
      }),
    },
  };
}

function fakeNasa(year = new Date().getUTCFullYear() - 1): NasaPowerPayload {
  const rows = synthetic("UK", { lat: 51.5, lon: -0.12, tz: 0 }).rows;
  const parameter: Record<string, Record<string, number>> = Object.fromEntries(Object.values(NASA_POWER_PARAMS).map((param) => [param, {}]));
  const start = Date.UTC(year, 0, 1), hours = (Date.UTC(year + 1, 0, 1) - start) / 3_600_000;
  for (let i = 0; i < hours; i++) {
    const row = rows[i % rows.length];
    const key = new Date(start + i * 3_600_000).toISOString().slice(0, 13).replace(/[-T]/g, "");
    Object.assign(parameter.T2M, { [key]: row.ta });
    Object.assign(parameter.ALLSKY_SFC_SW_DWN, { [key]: row.ghi });
    Object.assign(parameter.ALLSKY_SFC_SW_DIFF, { [key]: row.dhi });
    Object.assign(parameter.ALLSKY_SFC_SW_DNI, { [key]: row.dni });
    Object.assign(parameter.ALLSKY_SFC_LW_DWN, { [key]: 300 });
    Object.assign(parameter.RH2M, { [key]: 80 });
    Object.assign(parameter.WS10M, { [key]: 3 });
  }
  const radiation = { units: "Wh/m^2" };
  return {
    header: { time_standard: "UTC", fill_value: -999 },
    parameters: { T2M: { units: "C" }, ALLSKY_SFC_SW_DWN: radiation, ALLSKY_SFC_SW_DIFF: radiation, ALLSKY_SFC_SW_DNI: radiation, ALLSKY_SFC_LW_DWN: radiation, RH2M: { units: "%" }, WS10M: { units: "m/s" } },
    properties: { parameter },
  };
}

const snapshot = {
  building: { id: "UK01", width: 9, depth: 8, floors: 2, usage: "residential" as const },
  surfaces: [{ id: "roof_tiles:main", product: "roof_tiles", profile: "yorkshire_black", area: 24, tilt: 35, az: 0, enabled: true, role: "none", linked: true, u: 0, g: 0 }],
};

const energySettings = {
  demandMode: "bill" as const,
  annualDemandKwh: 4800,
  householdSize: 3,
  daytimeOccupancy: "usually" as const,
  electricHeating: false,
  heatPump: false,
  electricHotWater: false,
  evCharger: false,
  batteryMode: "solar-only" as const,
  batteryCapacityKwh: 5,
  projectPriceGbp: 12000,
  batteryPriceGbp: null,
};

describe("project study calculation service", () => {
  beforeAll(async () => {
    ({ runProjectCalculation } = await import("../server/estimate-service"));
  });
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("uses NASA POWER by default, as the customer Studio does", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify(fakeNasa()), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const study = await runProjectCalculation({ market: "GB", address: "London, UK", coordinates: { lat: 51.51, lng: -0.13 }, timezone: 0, studioSnapshot: snapshot, energySettings });

    expect(fetchMock.mock.calls[0][0]).toContain("power.larc.nasa.gov/api/temporal/hourly/point");
    expect(study.validation.status).toBe("nasa-power");
    expect(study.weather.source).toBe("NASA POWER / CERES / MERRA-2");
    expect(study.weather.hours).toBeGreaterThanOrEqual(8760);
  });

  it("falls back to PVGIS when NASA POWER is unavailable", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => (url.includes("power.larc.nasa.gov") ? new Response("down", { status: 503 }) : new Response(JSON.stringify(fakeTmy()), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    const study = await runProjectCalculation({ market: "GB", address: "London, UK", coordinates: { lat: 51.52, lng: -0.14 }, timezone: 0, studioSnapshot: snapshot, energySettings });
    expect(study.validation.status).toBe("pvgis-tmy");
  });

  it("runs the customer V31 hourly model on PVGIS TMY weather when selected", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify(fakeTmy()), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const study = await runProjectCalculation({ market: "GB", address: "London, UK", coordinates: { lat: 51.5, lng: -0.12 }, timezone: 0, weatherSource: "pvgis-tmy", studioSnapshot: snapshot, energySettings });

    expect(fetchMock.mock.calls[0][0]).toContain("re.jrc.ec.europa.eu/api/v5_3/tmy");
    expect(study.caseId).toMatch(/^MOD-[A-F0-9]{8}$/);
    expect(study.validation.status).toBe("pvgis-tmy");
    expect(study.weather.source).toContain("PVGIS-SARAH3");
    expect(study.result.surfaces).toHaveLength(1);
    expect(study.result.surfaces[0]).toMatchObject({ productName: "Yorkshire Longspan · Black", azimuthDeg: 180, orientationName: "south" });
    expect(study.result.surfaces[0].monthlyKwh.reduce((a, b) => a + b, 0)).toBeCloseTo(study.result.surfaces[0].annualKwh, 6);
    expect(study.energy.source).toBe("bill");
    expect(study.energy.annualDemandKwh).toBeCloseTo(4800, -1);
    expect(study.simulation.heatingSystem).toBe("gas");
    expect(study.simulation.selfConsumption).toBeGreaterThan(0);
    expect(study.googleSolar).toBeNull();
    expect(study.result.scenarios.find((scenario) => scenario.id === "solar-only")?.annualCashFlows).toHaveLength(25);
  });

  it("calibrates demand to the household estimate and prices the design when no bill or quote is entered", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(JSON.stringify(fakeTmy()), { status: 200 })));
    const settings = { ...energySettings, demandMode: "estimate" as const, annualDemandKwh: null, householdSize: 5, projectPriceGbp: null };
    const study = await runProjectCalculation({ market: "GB", address: "London, UK", coordinates: { lat: 51.5, lng: -0.12 }, timezone: 0, weatherSource: "pvgis-tmy", studioSnapshot: snapshot, energySettings: settings });
    expect(study.energy.source).toBe("household");
    expect(study.energy.annualDemandKwh).toBeCloseTo(estimateAnnualDemandKwh(settings), -1);
    expect(study.result.scenarios.find((scenario) => scenario.id === "solar-only")?.upfrontGbp).toBe(4200);
    expect(study.result.ledger.find((entry) => entry.id === "costs")?.params).toMatchObject({ currency: "GBP", estimated: 1 });
  });

  it("uses the recommended battery capacity by default unless the user overrides it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(JSON.stringify(fakeTmy()), { status: 200 })));
    const autoSettings = { ...energySettings, batteryMode: "solar-battery" as const, batteryCapacityKwh: 1, batteryCapacitySource: "auto" as const, batteryPriceGbp: null };
    const autoStudy = await runProjectCalculation({ market: "GB", address: "London, UK", coordinates: { lat: 51.5, lng: -0.12 }, timezone: 0, weatherSource: "pvgis-tmy", studioSnapshot: snapshot, energySettings: autoSettings });
    expect(autoStudy.simulation.battery.nominalKwh).toBe(autoStudy.simulation.recommendedBatteryKwh);
    expect(autoStudy.result.recommendation.batteryCapacityKwh).toBe(autoStudy.simulation.recommendedBatteryKwh);
    expect(autoStudy.result.ledger.find((entry) => entry.id === "battery")?.params).toMatchObject({ kwh: autoStudy.simulation.recommendedBatteryKwh });

    const manualSettings = { ...autoSettings, batteryCapacityKwh: 3, batteryCapacitySource: "user" as const };
    const manualStudy = await runProjectCalculation({ market: "GB", address: "London, UK", coordinates: { lat: 51.5, lng: -0.12 }, timezone: 0, weatherSource: "pvgis-tmy", studioSnapshot: snapshot, energySettings: manualSettings });
    expect(manualStudy.simulation.battery.nominalKwh).toBe(3);
    expect(manualStudy.simulation.recommendedBatteryKwh).not.toBe(3);
    expect(manualStudy.result.ledger.find((entry) => entry.id === "battery")?.params).toMatchObject({ kwh: 3, recommended: manualStudy.simulation.recommendedBatteryKwh });
  });

  it("falls back to the customer synthetic climate when no site weather is reachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const study = await runProjectCalculation({ market: "JP", address: "Tokyo", coordinates: { lat: 35.68, lng: 139.69 }, timezone: 9, studioSnapshot: snapshot });
    expect(study.validation.status).toBe("customer-synthetic");
    expect(study.result.engine.guardsTriggered).toContain("customer-synthetic-climate");
    expect(study.energy.source).toBe("customer-model");
    expect(study.result.range.representative).toBeGreaterThan(0);
  });

  it("returns a clear configuration requirement before any network request for an empty Studio snapshot", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(runProjectCalculation({
      market: "GB",
      address: "London, UK",
      coordinates: { lat: 51.5, lng: -0.12 },
      studioSnapshot: { building: { id: "UK01", width: 9, depth: 8, floors: 2, usage: "residential" }, surfaces: [] },
    })).rejects.toThrow("Add at least one supported solar product in Solar Studio");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
