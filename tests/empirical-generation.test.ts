import { describe, expect, it } from "vitest";
import { getProduct } from "../data/catalogue";
import { calculateGenerationStep, coefficientsFor, EMPIRICAL_PRODUCT_PROFILES, empiricalBaseEfficiency, photovoltaicLayerTemperature, totalIrradiance } from "../lib/empirical-generation";

describe("empirical coefficient generation model", () => {
  it("implements the documented irradiance branches", () => {
    expect(totalIrradiance({ directWm2: 600, diffuseWm2: 150, reflectedWm2: 50 })).toBe(800);
    expect(empiricalBaseEfficiency(140)).toBeCloseTo(0.2127, 7);
    expect(empiricalBaseEfficiency(800)).toBeCloseTo(0.169552, 5);
    expect(empiricalBaseEfficiency(1000)).toBeCloseTo(0.16406737524, 10);
  });

  it("contains the 17 customer-supplied product profiles, including the façade-grey temperature coefficient", () => {
    expect(Object.keys(EMPIRICAL_PRODUCT_PROFILES)).toHaveLength(17);
    expect(EMPIRICAL_PRODUCT_PROFILES["facade-grey"]).toEqual({ powerDensityWpM2: 120, directRiseKPerWm2: 0.03806, diffuseReflectedRiseKPerWm2: 0.03567 });
    expect(EMPIRICAL_PRODUCT_PROFILES["tile-windsor:colour"].powerDensityWpM2).toBe(98.42);
    expect(EMPIRICAL_PRODUCT_PROFILES["facade-light"].powerDensityWpM2).toBe(100);
  });

  it("reproduces the documented Solar Window Edge example", () => {
    const product = getProduct("window-edge");
    if (!product) throw new Error("Test product is missing");
    const irradiation = { directWm2: 600, diffuseWm2: 150, reflectedWm2: 50 };
    const temperature = photovoltaicLayerTemperature(25, irradiation, {
      powerDensityWpM2: 100,
      directRiseKPerWm2: 0.03814,
      diffuseReflectedRiseKPerWm2: 0.03605,
    });
    expect(temperature).toBeCloseTo(55.094, 3);

    const step = calculateGenerationStep({
      surface: { areaM2: 1, coverage: 1, finishId: null },
      product,
      airTemperatureC: 25,
      irradiance: irradiation,
      durationHours: 1,
    });
    expect(step.efficiency).toBeCloseTo(0.097465, 5);
    expect(step.dcPowerW).toBeCloseTo(77.972, 2);
    expect(step.acEnergyKwh).toBeCloseTo(0.07017, 5);
  });

  it("uses the specified colour coefficients for coloured roof tiles", () => {
    const product = getProduct("tile-windsor");
    if (!product) throw new Error("Test product is missing");
    const black = calculateGenerationStep({ surface: { areaM2: 1, coverage: 1, finishId: "black" }, product, airTemperatureC: 20, irradiance: { directWm2: 500, diffuseWm2: 100, reflectedWm2: 25 }, durationHours: 1 });
    const coloured = calculateGenerationStep({ surface: { areaM2: 1, coverage: 1, finishId: "graphite-grey" }, product, airTemperatureC: 20, irradiance: { directWm2: 500, diffuseWm2: 100, reflectedWm2: 25 }, durationHours: 1 });
    expect(coloured.dcPowerW).toBeLessThan(black.dcPowerW);
    expect(coefficientsFor({ finishId: "graphite-grey" }, product).powerDensityWpM2).toBe(product.colouredWpPerM2);
  });
});
