import { describe, expect, it } from "vitest";
import { defaults, dispatch, dispatchWithGridCharging, simulate, synthetic, SYSTEM_ASSUMPTIONS, type Building, type HourlyRow, type Surface } from "../lib/customer-energy-core";

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

  it("tracks off-peak grid charging separately from PV self-consumption", () => {
    const rows: HourlyRow[] = [
      { t: Date.UTC(2025, 0, 1, 0), pv: 0, load: 0 },
      { t: Date.UTC(2025, 0, 1, 10), pv: 3, load: 0 },
      { t: Date.UTC(2025, 0, 1, 19), pv: 0, load: 4 },
    ];
    const result = dispatchWithGridCharging(rows, 5, 5, { collect: true, offPeakHours: 7, peakStartHour: 16, peakHours: 5, reserveSolarCapacity: false });
    const sums = result.rows.reduce((acc, row) => ({
      self: acc.self + row.self,
      solarDischarge: acc.solarDischarge + (row.batterySolarDischarge ?? 0),
      gridDischarge: acc.gridDischarge + (row.batteryGridDischarge ?? 0),
      gridCharge: acc.gridCharge + (row.gridBatteryCharge ?? 0),
    }), { self: 0, solarDischarge: 0, gridDischarge: 0, gridCharge: 0 });

    expect(sums.gridCharge).toBeGreaterThan(0);
    expect(sums.gridDischarge).toBeGreaterThan(0);
    expect(sums.self).toBeCloseTo(sums.solarDischarge, 6);
    expect(sums.self).toBeLessThan(4);
  });

  it("supports cross-midnight off-peak windows and releases grid energy only during peak hours", () => {
    const rows: HourlyRow[] = [
      { t: Date.UTC(2025, 0, 1, 23), pv: 0, load: 0 },
      { t: Date.UTC(2025, 0, 2, 12), pv: 0, load: 2 },
      { t: Date.UTC(2025, 0, 2, 17), pv: 0, load: 3 },
    ];
    const result = dispatchWithGridCharging(rows, 6, 6, {
      collect: true,
      offPeakStartHour: 23,
      offPeakHours: 8,
      peakStartHour: 16,
      peakHours: 5,
      reserveSolarCapacity: false,
    });

    expect(result.rows[0].gridBatteryCharge).toBeGreaterThan(0);
    expect(result.rows[1]).toMatchObject({ batteryGridDischarge: 0, grid: 2 });
    expect(result.rows[2].batteryGridDischarge).toBeGreaterThan(0);
  });

  it("does not use solar surplus occurring after a peak deficit to reduce earlier grid charging", () => {
    const rows: HourlyRow[] = [
      { t: Date.UTC(2025, 0, 1, 0), pv: 0, load: 0 },
      { t: Date.UTC(2025, 0, 1, 17), pv: 0, load: 3 },
      { t: Date.UTC(2025, 0, 1, 20), pv: 10, load: 0 },
    ];
    const result = dispatchWithGridCharging(rows, 5, 5, {
      collect: true,
      offPeakStartHour: 0,
      offPeakHours: 7,
      peakStartHour: 16,
      peakHours: 3,
    });

    expect(result.rows[0].gridBatteryCharge).toBeGreaterThan(0);
    expect(result.rows[1].batteryGridDischarge).toBeGreaterThan(0);
  });

  it("applies tariff windows in the site's negative timezone and respects a 24-hour off-peak window", () => {
    const rows: HourlyRow[] = [
      { t: Date.UTC(2025, 0, 2, 4), pv: 0, load: 0 },
      { t: Date.UTC(2025, 0, 2, 22), pv: 0, load: 2 },
    ];
    const shifted = dispatchWithGridCharging(rows, 4, 4, { collect: true, timezone: -5, offPeakStartHour: 23, offPeakHours: 8, peakStartHour: 16, peakHours: 5, reserveSolarCapacity: false });
    const alwaysOffPeak = dispatchWithGridCharging(rows, 4, 4, { collect: true, timezone: -5, offPeakStartHour: 0, offPeakHours: 24, peakStartHour: 16, peakHours: 5, reserveSolarCapacity: false });

    expect(shifted.rows[0].gridBatteryCharge).toBeGreaterThan(0);
    expect(shifted.rows[1].batteryGridDischarge).toBeGreaterThan(0);
    expect(alwaysOffPeak.rows[1].batteryGridDischarge).toBe(0);
  });

  it("uses cyclic annual SOC and conserves solar generation including losses and net storage", () => {
    const rows: HourlyRow[] = Array.from({ length: 24 }, (_, hour) => ({
      t: Date.UTC(2025, 0, 1, hour),
      pv: hour === 12 ? 4 : 0,
      load: hour === 0 ? 3 : 0,
    }));
    const result = dispatchWithGridCharging(rows, 5, 5, { collect: true, cyclic: true });
    const total = (key: string) => result.rows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0);
    const solarInput = rows.reduce((sum, row) => sum + row.pv, 0);
    const accounted = total("directSelf") + total("batterySolarDischarge") + total("export") + total("batterySolarLoss") + result.storedSolar - result.initialSolar;

    expect(result.initialSolar).toBeGreaterThan(0);
    expect(result.rows[0].batterySolarDischarge).toBeGreaterThan(0);
    expect(result.storedSolar).toBeCloseTo(result.initialSolar, 6);
    expect(accounted).toBeCloseTo(solarInput, 6);
  });

  it("converges cyclic SOC when annual surplus fills the battery slowly", () => {
    const rows: HourlyRow[] = [
      { t: Date.UTC(2025, 5, 1, 12), pv: 0.001, load: 0 },
    ];
    const result = dispatchWithGridCharging(rows, 5, 5, { collect: false, cyclic: true });

    expect(result.initialSolar).toBeGreaterThan(4);
    expect(result.storedSolar).toBeCloseTo(result.initialSolar, 6);
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

  it("calibrates annual demand without breaking EV power or heat-pump COP constraints", () => {
    const building: Building = { width: 9, depth: 8, floors: 2, usage: "residential" };
    const surfaces: Surface[] = [{ id: "roof_tiles:south", profile: "windsor_black", area: 32, tilt: 35, az: 180, role: "none", linked: true, u: 0, g: 0 }];
    const location = { lat: 51.5, lon: -0.12, tz: 0 };
    const result = simulate({
      ...defaults(building),
      heatMode: "pump",
      annualLoadTargetKwh: 6500,
      devices: { ev: { enabled: true, distance: 12000, chargerKW: 7.4 } },
    }, surfaces, synthetic("UK", location), location);

    expect(result.totals.load).toBeCloseTo(6500, 6);
    expect(Math.max(...result.hourly.map((row) => row.ev))).toBeLessThanOrEqual(7.4);
    expect(result.totals.heat / result.totals.heatPump).toBeCloseTo(3, 6);
  });
});
