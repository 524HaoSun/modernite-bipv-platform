import type { ProjectCalculation } from "../../../server/estimate-service";
import type { FinancialScenario } from "../../../types/solar";

/** The results page publishes the scenario on screen so the advisor answers about that, not a stale server copy. */
let onScreen: string | null = null;
export function publishAdvisorStudy(text: string | null) {
  onScreen = text;
}
export function publishedAdvisorStudy() {
  return onScreen;
}

const r0 = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;

function firstYearValue(scenario: FinancialScenario) {
  const year = scenario.annualCashFlows[0];
  return (year?.billSavingGbp ?? 0) + (year?.exportIncomeGbp ?? 0) + (year?.monetizableValueGbp ?? year?.arbitrageIncomeGbp ?? 0);
}

function scenarioLine(scenario: FinancialScenario, viewed: boolean) {
  if (!scenario.available) return `- ${scenario.id}: not available${scenario.unavailableReason ? ` (${scenario.unavailableReason})` : ""}`;
  return `- ${scenario.id}${viewed ? " (currently on screen)" : ""}: upfront £${r0(scenario.upfrontGbp)}, first-year benefit £${r0(firstYearValue(scenario))}, simple payback ${scenario.breakEvenYear ?? "beyond 25"} years, year-25 cumulative £${r0(scenario.net25YearGbp)}`;
}

/** Compact study record for the advisor. No hourly series; those blow the context and are not what the customer asks about. */
export function formatAdvisorStudy(study: ProjectCalculation, scenarioId: FinancialScenario["id"]) {
  const { result, weather, simulation, energy, project } = study;
  const viewed = result.scenarios.find((item) => item.id === scenarioId) ?? result.scenarios[0];
  const surfaces = [...result.surfaces].sort((a, b) => b.annualKwh - a.annualKwh);
  const lines = [
    `Project study ${study.caseId}${project ? ` at ${project.address} (${project.market}, ${project.coordinates.lat.toFixed(5)}, ${project.coordinates.lng.toFixed(5)})` : ""}.`,
    project ? `Building in the study: ${project.buildingTypeId}, ${project.building.width} × ${project.building.depth} m, ${project.building.floors} storeys, heating ${project.heatMode}${project.electricHotWater ? ", electric hot water" : ""}${project.evCharger ? ", EV charger" : ""}.` : "",
    `Weather: ${weather.name} (${weather.kind}, ${weather.source}), ${weather.hours} hours, annual irradiation GHI ${r0(weather.annualGhiKwhM2)} / DNI ${r0(weather.annualDniKwhM2)} / DHI ${r0(weather.annualDhiKwhM2)} kWh/m², mean air temperature ${r1(weather.meanAirTemperatureC)} °C.`,
    `System: ${r1(result.totalCapacityKwp)} kWp, annual generation ${r0(result.range.representative)} kWh (range ${r0(result.range.low)}–${r0(result.range.high)}).`,
    `Household electricity demand: ${r0(energy.annualDemandKwh)} kWh/year (${energy.source}).`,
    `Monthly generation kWh (Jan–Dec): ${result.monthlyByOrientation.map((month) => r0(month.total)).join(", ")}.`,
    "Surfaces, largest first:",
    ...surfaces.map((surface) => `- ${surface.surfaceLabel}: ${surface.productName}${surface.finishName ? ` ${surface.finishName}` : ""}, ${surface.orientationName} ${r0(surface.azimuthDeg)}°/${r0(surface.tiltDeg)}°, ${r1(surface.areaM2)} m², ${r1(surface.capacityKwp)} kWp, ${r0(surface.annualKwh)} kWh/year (${r0(surface.sharePercent)}% of generation).`),
    `Inverter ${r1(simulation.inverterKw)} kW, peak AC ${r1(simulation.peakAcKw)} kW, recommended battery ${r1(simulation.recommendedBatteryKwh)} kWh. Modelled battery ${r1(simulation.battery.nominalKwh)} kWh.`,
    "Scenarios (planning estimates, not a quotation):",
    ...result.scenarios.map((scenario) => scenarioLine(scenario, scenario.id === viewed?.id)),
  ];
  if (viewed?.available) {
    const key = viewed.id === "solar-battery" ? "solarBattery" : "solarOnly";
    const kpis = simulation.kpis?.[key];
    if (kpis) lines.push(`KPIs for the scenario on screen: solar coverage ${r0(kpis.solarCoverage * 100)}% of demand, PV self-consumption ${r0(kpis.pvSelfConsumption * 100)}% of generation, export rate ${r0(kpis.exportRate * 100)}% (${r0(kpis.selfConsumedKwh)} kWh used on site, ${r0(kpis.exportKwh)} kWh exported, ${r0(kpis.gridImportKwh)} kWh imported).`);
  }
  lines.push("These figures are planning estimates from the hourly model. They are not a performance guarantee or a sales quotation.");
  return lines.filter(Boolean).join("\n");
}
