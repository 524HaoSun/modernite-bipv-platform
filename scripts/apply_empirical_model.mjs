import fs from "node:fs";

const path = "/home/ubuntu/modernite-bipv-platform/lib/estimate-engine.ts";
let source = fs.readFileSync(path, "utf8");

source = source
  .replace('import { convertedProductEfficiency } from "./conversion";\n', "")
  .replace('import { degradationFactor } from "./degradation";\n', 'import { degradationFactor } from "./degradation";\nimport { calculateGenerationStep } from "./empirical-generation";\n')
  .replace('import { noctCellTemperature, temperatureFactor } from "./temperature";\n', "");

const oldMonthly = `  const monthlyKwh = irradiation.monthly.map((month) => {\n    const equivalentIrradiance = 800;\n    const pvTemperatureC = noctCellTemperature(month.averageAirTemperatureC, equivalentIrradiance);\n    const electricalEfficiency = convertedProductEfficiency(equivalentIrradiance, wpPerM2);\n    const temperature = temperatureFactor(pvTemperatureC);\n    return surface.areaM2 * surface.coverage * month.irradiationKwhM2 * electricalEfficiency * temperature * SYSTEM_LOSS_FACTOR * degradationFactor(1);\n  });`;
const newMonthly = `  const monthlyKwh = irradiation.monthly.map((month) => {\n    // Monthly irradiation is converted to a representative hourly irradiance.\n    // The empirical coefficients then solve equations (1)–(7) over that interval.\n    const hours = 30 * 24;\n    const directWm2 = (month.beamKwhM2 / hours) * 1000;\n    const diffuseWm2 = (month.diffuseKwhM2 / hours) * 1000;\n    const reflectedWm2 = (month.reflectedKwhM2 / hours) * 1000;\n    const step = calculateGenerationStep({\n      surface,\n      product,\n      airTemperatureC: month.averageAirTemperatureC,\n      irradiance: { directWm2, diffuseWm2, reflectedWm2 },\n      durationHours: hours,\n    });\n    return step.acEnergyKwh * degradationFactor(1);\n  });`;
if (!source.includes(oldMonthly)) throw new Error("Monthly generation block not found");
source = source.replace(oldMonthly, newMonthly)
  .replace('value: "NOCT approximation"', 'value: "Empirical direct + diffuse temperature rise"')
  .replace('label: "Ground albedo", value: String(GROUND_ALBEDO), provenance: "assumed", stepNumber: 5, fieldKey: "albedo"', 'label: "Generation model", value: "Empirical coefficients · 90% AC factor", provenance: "assumed", stepNumber: 4, fieldKey: "generation"')
  .replace('label: "Product conversion", value: INTERIM_CONVERSION_RULE, provenance: "assumed", stepNumber: 5, fieldKey: "conversion"', 'label: "Product configuration", value: "Rated density and selected finish", provenance: "manufacturer", stepNumber: 4, fieldKey: "product"')
  .replace('conversionRule: INTERIM_CONVERSION_RULE', 'conversionRule: "Empirical coefficients (2026-09-22)"');

fs.writeFileSync(path, source);
