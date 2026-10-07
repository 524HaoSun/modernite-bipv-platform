import { describe, expect, it } from "vitest";
import { defaults, dispatch, simulate, synthetic, SYSTEM_ASSUMPTIONS, type Building, type HourlyRow, type Surface } from "../lib/customer-energy-core";

describe("customer battery dispatch model", () => {
  it("respects capacity, SOC reserve, power limits and round-trip efficiency", () => {
    const eta = Math.sqrt(SYSTEM_ASSUMPTIONS.roundTrip);
    const rows: HourlyRow[] = [
      { t: 0, pv: 10, load: 0 },
      { t: 3_600_000, pv: 0, load: 10 },
    ];

    const powerLimited = dispatch(rows, 10, 2, true).rows;
    expect(powerLimited[0]).toMatchObject({ batteryCharge: 2, export: 8 });
    expect(powerLimited[1].batteryDischarge).toBeCloseTo(2 * SYSTEM_ASSUMPTIONS.roundTrip, 6);
    expect(powerLimited[1].grid).toBeCloseTo(10 - 2 * SYSTEM_ASSUMPTIONS.roundTrip, 6);

    const capacityLimited = dispatch([{ t: 0, pv: 100, load: 0 }, { t: 3_600_000, pv: 0, load: 100 }], 10, 100, true).rows;
    const usable = 10 * SYSTEM_ASSUMPTIONS.usableFraction;
    expect(capacityLimited[0].batteryCharge).toBeCloseTo(usable / eta, 6);
    expect(capacityLimited[0].batterySOC).toBeCloseTo(100, 6);
    expect(capacityLimited[1].batteryDischarge).toBeCloseTo(usable * eta, 6);
    expect(capacityLimited[1].batterySOC).toBeCloseTo((1 - SYSTEM_ASSUMPTIONS.usableFraction) * 100, 6);
    expect(capacityLimited[0].batteryLoss + capacityLimited[1].batteryLoss).toBeCloseTo(usable / eta - usable * eta, 6);
  });

  it("rolls dispatched battery rows into simulation totals and sizing metadata", () => {
    const building: Building = { width: 9, depth: 8, floors: 2, usage: "residential" };
    const surfaces: Surface[] = [{ id: "roof_tiles:south", profile: "windsor_black", area: 32, tilt: 35, az: 180, role: "none", linked: true, u: 0, g: 0 }];
    const location = { lat: 51.5, lon: -0.12, tz: 0 };
    const result = simulate({ ...defaults(building), inverterMode: "manual", inverter: 4, batteryEnabled: true, batteryMode: "manual", batteryKWh: 6, batteryKW: 2 }, surfaces, synthetic("UK", location), location);

    const sum = (key: string) => result.hourly.reduce((total, row) => total + Number(row[key] ?? 0), 0);
    expect(result.systemSizing).toMatchObject({
      batteryEnabled: true,
      batteryMode: "manual",
      batteryNominalKWh: 6,
      batteryUsableKWh: 6 * SYSTEM_ASSUMPTIONS.usableFraction,
      batteryPowerKW: 2,
      topology: "AC-coupled",
    });
    expect(result.totals.self).toBeCloseTo(sum("self"), 6);
    expect(result.totals.export).toBeCloseTo(sum("export"), 6);
    expect(result.totals.grid).toBeCloseTo(sum("grid"), 6);
    expect(result.totals.batteryLoss).toBeCloseTo(sum("batteryLoss"), 6);
  });
});
