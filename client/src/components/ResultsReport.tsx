import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight, BarChart3, BatteryCharging, Building2, CircleHelp, Cpu, Download, Gauge, Home, Leaf, MessageCircle,
  Link2, Loader2, Pencil, Printer, ShieldCheck, Sparkles, SunMedium, TowerControl, TrendingUp,
} from "lucide-react";
import { ADVISOR_ASK_EVENT } from "@/components/ModerniteAdvisor";
import { resultsCopy, type ResultsCopy } from "@/lib/results-copy";
import { shareCopy } from "@/lib/share-copy";
import { buildingTypeLabel } from "@/components/BuildingProfileCard";
import { PageIntro } from "@/components/PageIntro";
import { PrintReport } from "@/components/PrintReport";
import { WORKFLOW_LABELS, type WorkflowLanguage } from "@/lib/workflow-labels";
import "@/styles/results-compass-refinement.css";
import type { ProjectCalculation } from "../../../server/estimate-service";
import type { FinancialScenario, LedgerEntry, SurfaceResult } from "../../../types/solar";

type Route = "entry" | "market" | "location" | "studio" | "energy" | "calculation" | "results";
export type MarketKey = "GB" | "EU" | "CA" | "JP";

export const MARKET_CURRENCY: Record<MarketKey, string> = { GB: "GBP", EU: "EUR", CA: "CAD", JP: "JPY" };
export const MARKET_REGION: Record<MarketKey, "UK" | "EU" | "CA" | "JP"> = { GB: "UK", EU: "EU", CA: "CA", JP: "JP" };
/** Grid emission factors, kg CO₂e per kWh (UK DESNZ 2024, EEA EU-27 2023, Canada NIR 2023, Japan MoE 2022). */
export const GRID_CO2_KG_PER_KWH: Record<"UK" | "EU" | "CA" | "JP", number> = { UK: 0.207, EU: 0.244, CA: 0.11, JP: 0.453 };
export const ORIENTATION_SERIES = [
  ["south", "#07573f"],
  ["east", "#4d9b71"],
  ["west", "#a5c979"],
  ["north", "#79aeca"],
  ["horizontal", "#f1b33d"],
] as const;
export const SCENARIO_COLORS: Record<string, string> = { "solar-only": "#0c6249", "solar-battery": "#d6a226", "battery-only": "#789" };

export type Fmt = {
  t: ResultsCopy;
  n: (value: number, digits?: number) => string;
  money: (value: number) => string;
  moneyCompact: (value: number) => string;
  month: (index: number) => string;
  compass: (deg: number) => string;
};

const GAUGE_CENTER = 500;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

type ScenarioKpiKey = "solarOnly" | "solarBattery";

type ResultsKpis = {
  solarCoveragePercent: number;
  pvSelfConsumptionPercent: number;
  exportRatePercent: number;
  selfConsumedKwh: number;
  directSolarKwh: number;
  batteryToLoadKwh: number;
  exportKwh: number;
  gridImportKwh: number;
};

function selectedKpiKey(scenarioId: FinancialScenario["id"]): ScenarioKpiKey {
  return scenarioId === "solar-battery" ? "solarBattery" : "solarOnly";
}

/** First-year value shown as "Estimated value": avoided import + export income + monetizable value. */
export function scenarioAnnualValue(scenario: FinancialScenario) {
  const firstYear = scenario.annualCashFlows[0];
  return (firstYear?.billSavingGbp ?? 0) + (firstYear?.exportIncomeGbp ?? 0) + (firstYear?.monetizableValueGbp ?? firstYear?.arbitrageIncomeGbp ?? 0);
}

export function deriveResultsKpis(study: ProjectCalculation, scenarioId: FinancialScenario["id"]): ResultsKpis {
  const key = selectedKpiKey(scenarioId);
  const simWithKpis = study.simulation as ProjectCalculation["simulation"] & {
    kpis?: ProjectCalculation["simulation"]["kpis"];
  };
  const canonical = simWithKpis.kpis?.[key];
  const generated = Math.max(1, study.simulation.annualGenerationKwh ?? study.result.range.representative);
  const demand = Math.max(1, study.simulation.annualLoadKwh ?? study.energy.annualDemandKwh);
  const selfConsumedKwh = canonical?.selfConsumedKwh ?? (key === "solarBattery" ? study.simulation.battery.selfConsumedKwh : study.simulation.selfConsumedKwh);
  const exportKwh = canonical?.exportKwh ?? (key === "solarBattery" ? study.simulation.battery.exportKwh : study.simulation.exportKwh);
  const gridImportKwh = canonical?.gridImportKwh ?? (key === "solarBattery" ? study.simulation.battery.gridImportKwh : study.simulation.gridImportKwh);
  const solarOnlySelf = study.simulation.selfConsumedKwh;
  return {
    solarCoveragePercent: Math.round(clamp(canonical?.solarCoverage ?? selfConsumedKwh / demand, 0, 1) * 100),
    pvSelfConsumptionPercent: Math.round(clamp(canonical?.pvSelfConsumption ?? selfConsumedKwh / generated, 0, 1) * 100),
    exportRatePercent: Math.round(clamp(canonical?.exportRate ?? exportKwh / generated, 0, 1) * 100),
    selfConsumedKwh,
    directSolarKwh: Math.min(selfConsumedKwh, solarOnlySelf),
    batteryToLoadKwh: key === "solarBattery" ? Math.max(0, selfConsumedKwh - solarOnlySelf) : 0,
    exportKwh,
    gridImportKwh,
  };
}

function useAnimatedGaugeValue(value: number, animate: boolean) {
  const target = clamp(Math.round(value), 0, 100);
  const [displayValue, setDisplayValue] = useState(animate ? 0 : target);

  useEffect(() => {
    if (!animate) {
      setDisplayValue(target);
      return;
    }
    let frame = 0;
    const from = displayValue;
    const duration = 980;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = clamp((now - started) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(from + (target - from) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animate, target]);

  return displayValue;
}

function GaugeNeedle({ value, visible = false }: { value: number; visible?: boolean }) {
  if (!visible) return null;
  const angle = -65 + (clamp(value, 0, 100) / 100) * 130;
  return <g className="solar-coverage-gauge__needle" transform={`rotate(${angle} ${GAUGE_CENTER} ${GAUGE_CENTER})`} aria-hidden="true">
    <path d="M 492 510 L 500 230 L 508 510 Z" />
    <circle cx={GAUGE_CENTER} cy={GAUGE_CENTER} r="9" />
  </g>;
}

function SolarCoverageGauge({ value, showNeedle = false, animate = true, className = "" }: {
  value: number;
  showNeedle?: boolean;
  animate?: boolean;
  className?: string;
}) {
  const percentage = clamp(Math.round(value), 0, 100);
  const displayValue = useAnimatedGaugeValue(percentage, animate);

  return <div className={`solar-coverage-gauge ${className}`.trim()}>
    <svg className="solar-coverage-gauge__svg" viewBox="0 0 1000 1000" role="img" aria-label={`Solar Coverage ${percentage}%`}>
      <defs>
        <linearGradient id="coverageNeedleGold" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#b88a28" />
          <stop offset="55%" stopColor="#d9b454" />
          <stop offset="100%" stopColor="#f1d481" />
        </linearGradient>
        <clipPath id="coverageReferenceCrop">
          <circle cx="500" cy="500" r="482" />
        </clipPath>
      </defs>
      <rect className="solar-coverage-gauge__reference-backplate" x="0" y="0" width="1000" height="1000" />
      <image className="solar-coverage-gauge__reference" href="/assets/modernite-solar-coverage-gauge-final-cutout-v2.png" x="12" y="12" width="976" height="976" preserveAspectRatio="xMidYMid meet" clipPath="url(#coverageReferenceCrop)" />
      <GaugeNeedle value={percentage} visible={showNeedle} />
      <text className="solar-coverage-gauge__percent" x="500" y="444" textAnchor="middle">{displayValue}%</text>
      <g className="solar-coverage-gauge__crisp-brand" aria-hidden="true">
        <rect className="solar-coverage-gauge__crisp-brand-cover" x="338" y="692" width="324" height="128" rx="54" />
        <line x1="304" y1="609" x2="384" y2="609" />
        <line x1="616" y1="609" x2="696" y2="609" />
        <text className="solar-coverage-gauge__crisp-brand-label" x="500" y="622" textAnchor="middle">SOLAR COVERAGE</text>
        <text className="solar-coverage-gauge__crisp-brand-bipv" x="500" y="684" textAnchor="middle">BIPV</text>
        <line x1="472" y1="716" x2="528" y2="716" />
        <text className="solar-coverage-gauge__crisp-brand-name" x="500" y="758" textAnchor="middle">Modernité</text>
        <text className="solar-coverage-gauge__crisp-brand-group" x="500" y="786" textAnchor="middle">By CarbonFutureX Group</text>
      </g>
    </svg>
  </div>;
}

function EnergyGlyph({ type }: { type: "generated" | "used" | "exported" | "capacity" }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return <svg className={`energy-glyph energy-glyph--${type}`} viewBox="0 0 48 48" aria-hidden="true">
    {type === "generated" && <>
      <circle {...common} cx="24" cy="24" r="7.2" strokeWidth="2.5" />
      <circle cx="24" cy="24" r="2" fill="currentColor" opacity=".82" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) =>
        <line {...common} key={angle} x1="24" y1="8.5" x2="24" y2="12.7" strokeWidth="2.2" transform={`rotate(${angle} 24 24)`} />,
      )}
      <path {...common} d="M15.2 33.6c3.1 2.1 6.6 2.8 10.5 2.1 3.9-.7 6.8-2.7 8.7-5.9" strokeWidth="1.7" opacity=".64" />
    </>}
    {type === "used" && <>
      <path {...common} d="M11 25.2 24 14.5l13 10.7" strokeWidth="2.7" />
      <path {...common} d="M15.2 24.4v12h17.6v-12" strokeWidth="2.4" />
      <path {...common} d="M24 36.4v-7.2" strokeWidth="2.2" />
      <path {...common} d="M19 29.1h10" strokeWidth="1.9" opacity=".62" />
      <path {...common} d="M35.8 17.5c-3.3-3.1-7.3-4.7-11.8-4.7s-8.4 1.5-11.7 4.5" strokeWidth="1.6" opacity=".5" />
    </>}
    {type === "exported" && <>
      <path {...common} d="M24 10.5v27" strokeWidth="2.5" />
      <path {...common} d="M14.5 37.5 24 10.5l9.5 27" strokeWidth="2.2" />
      <path {...common} d="M17.7 23.2h12.6M15.8 29.2h16.4" strokeWidth="2" />
      <path {...common} d="M8.8 18.5c4.2-2.7 8.2-2.7 12.1 0 2.3 1.6 4.6 2.4 7 2.4 3.6 0 7.4-1.5 11.3-4.4" strokeWidth="1.7" opacity=".62" />
      <circle cx="24" cy="10.5" r="2.3" fill="currentColor" />
    </>}
    {type === "capacity" && <>
      <path {...common} d="M12 35.6h24" strokeWidth="2.3" />
      <path {...common} d="M15.4 31.8V20.7M24 31.8V14.4M32.6 31.8V24.1" strokeWidth="3.3" />
      <path {...common} d="M13.5 12.5h21" strokeWidth="1.8" opacity=".55" />
      <path {...common} d="m18 12.5-3.8 8.2M25.4 12.5l-3.8 8.2M32.8 12.5 29 20.7" strokeWidth="1.4" opacity=".46" />
      <path {...common} d="M13.5 20.7h21" strokeWidth="1.8" opacity=".55" />
    </>}
  </svg>;
}

export function weatherSourceLabel(kind: string, source: string, name: string | null | undefined, t: ResultsCopy) {
  if (kind !== "customer-synthetic") return source;
  const city = (name ?? source.match(/\(([^)·]+)/)?.[1] ?? "").split("·")[0].trim();
  return t.ledgerText.synthetic(t.ledgerText.cities[city] ?? city);
}

export function ledgerValue(entry: LedgerEntry, f: Fmt) {
  const { t } = f;
  const p = entry.params;
  if (entry.id === "generation") return t.ledgerText.generation;
  if (!p) return entry.value;
  const num = (key: string, digits = 0) => (typeof p[key] === "number" ? f.n(p[key] as number, digits) : "—");
  const lt = t.ledgerText;
  switch (entry.id) {
    case "location": {
      const tz = Number(p.tz);
      return `${p.address} (${p.lat}, ${p.lng}, UTC${tz >= 0 ? "+" : ""}${tz})`;
    }
    case "irradiance": return lt.weather(weatherSourceLabel(String(p.kind), String(p.source), p.name as string | null, t), num("ghi"), num("dni"), num("dhi"), num("temp", 1));
    case "capacity": return lt.capacity(num("kwp", 2), Number(p.surfaces));
    case "orientation": return lt.orientation(Number(p.deg));
    case "building": return lt.building(num("width", 1), num("depth", 1), Number(p.floors), lt.heat[String(p.heat)] ?? String(p.heat));
    case "demand": return `${num("kwh")} kWh`;
    case "inverter": return lt.inverter(num("kw", 1), num("ratio", 2), num("clipping", 2));
    case "battery": return lt.battery(num("kwh", 1), num("kw", 2), num("recommended", 1));
    case "costs": return lt.costs(f.money(Number(p.solar)), typeof p.battery === "number" ? f.money(p.battery) : null, p.estimated === 1);
    case "google-solar": return [
      lt.google(Number(p.segments), num("area")),
      p.topArea != null ? lt.googleTop(num("topArea"), num("topPitch"), num("topAz")) : "",
      p.quality || p.date ? lt.imagery(String(p.quality ?? ""), String(p.date ?? "")) : "",
    ].filter(Boolean).join(" · ");
    default: return entry.value;
  }
}

export function useFormatters(language: string, currency: string): Fmt {
  return useMemo(() => {
    const t = resultsCopy(language);
    const money = new Intl.NumberFormat(t.locale, { style: "currency", currency, maximumFractionDigits: 0 });
    const compact = new Intl.NumberFormat(t.locale, { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 });
    const months = new Intl.DateTimeFormat(t.locale, { month: "short" });
    return {
      t,
      n: (value, digits = 0) => value.toLocaleString(t.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }),
      money: (value) => money.format(Math.round(value)),
      moneyCompact: (value) => compact.format(Math.round(value)),
      month: (index) => months.format(new Date(2025, index, 1)),
      compass: (deg) => t.compass[Math.round((((deg % 360) + 360) % 360) / 45) % 8],
    };
  }, [language, currency]);
}

function GenerationRangeCard({ study, f, scenarioId }: { study: ProjectCalculation; f: Fmt; scenarioId: FinancialScenario["id"] }) {
  const { t } = f;
  const range = study.result.range;
  const position = ((range.representative - range.low) / Math.max(1, range.high - range.low)) * 100;
  const generated = range.representative;
  const kpis = deriveResultsKpis(study, scenarioId);
  const flowCards = [
    { key: "generated", icon: <EnergyGlyph type="generated" />, label: t.generated, value: f.n(generated), unit: t.perYear, note: t.heroLabel },
    { key: "used", icon: <EnergyGlyph type="used" />, label: t.usedHome, value: f.n(kpis.selfConsumedKwh), unit: t.perYear, note: `${kpis.solarCoveragePercent}% ${t.demandLabel.toLowerCase()}` },
    { key: "exported", icon: <EnergyGlyph type="exported" />, label: t.exported, value: f.n(kpis.exportKwh), unit: t.perYear, note: t.exportedDetail },
    { key: "capacity", icon: <EnergyGlyph type="capacity" />, label: t.capacity, value: f.n(study.result.totalCapacityKwp, 2), unit: "kWp", note: t.activeSurfaces(study.result.surfaces.length) },
  ];
  return <section className="result-section generation-range-card generation-hero-card">
    <img className="modernite-client-home-visual" src="/assets/modernite-results-client-bg.png" alt="" aria-hidden="true" />
    <div className="generation-dashboard">
      <div className="generation-dashboard-copy">
        <p className="mini-label">Design Studio · {t.heroLabel}</p>
        <strong>{f.n(range.representative)} <small>{t.perYear}</small></strong>
        <p>{t.heroBody(study.result.surfaces.length)} {t.chainDetail(kpis.solarCoveragePercent, kpis.pvSelfConsumptionPercent)}</p>
        <ul className="generation-benefit-list" aria-label={t.flowTitle}>
          <li><Leaf size={16} /> {t.usedHomeDetail}</li>
          <li><Home size={16} /> {t.demandLabel}: {f.n(study.energy.annualDemandKwh)} {t.perYear}</li>
          <li><TrendingUp size={16} /> {t.view25}</li>
        </ul>
      </div>
      <div className="generation-outlook-dial" aria-label={`Solar Coverage ${kpis.solarCoveragePercent}%`}>
        <SolarCoverageGauge value={kpis.solarCoveragePercent} showNeedle={false} />
      </div>
    </div>
    <div className="generation-range-flow">
      <div className="range-window">
        <div className="range-window-head"><span>{t.rangeTitle}</span><b>{f.n(range.low)} – {f.n(range.high)} {t.perYear}</b></div>
        <div className="range-points"><span><i>{t.low}</i><b>{f.n(range.low)}</b></span><span className="is-main"><i>{t.representative}</i><b>{f.n(range.representative)}</b></span><span><i>{t.high}</i><b>{f.n(range.high)}</b></span></div>
        <div className="range-energy-path" aria-hidden="true"><span /><span /><span /></div>
        <div className="range-track"><em style={{ left: "0%" }} /><strong style={{ left: `${position}%` }} /><em style={{ left: "100%" }} /></div>
        <p>{t.rangeNote}</p>
      </div>
      <div className="result-story-strip generation-flow-cards">
        {flowCards.map((card) => <article className={`generation-flow-card generation-flow-card--${card.key}`} key={card.key}>
          <span>{card.icon}</span>
          <small>{card.label}</small>
          <b>{card.value} <i>{card.unit}</i></b>
          <em>{card.note}</em>
        </article>)}
      </div>
    </div>
  </section>;
}

function ExecutiveOutcomePanel({ study, scenario, f }: { study: ProjectCalculation; scenario: FinancialScenario; f: Fmt }) {
  const { t } = f;
  const kpis = deriveResultsKpis(study, scenario.id);
  const selfUse = kpis.selfConsumedKwh;
  const exportKwh = kpis.exportKwh;
  const annualValue = scenarioAnnualValue(scenario);
  return <section className="result-section executive-outcome-panel">
    <div className="executive-outcome-main">
      <p className="mini-label">{t.estimatedValue}</p>
      <h2>{f.money(annualValue)} <small>{t.perYearMoney}</small></h2>
      <p>{scenario.breakEvenYear ? t.breakEvenSimple(scenario.breakEvenYear) : t.longTerm} · {t.byYear25(f.money(scenario.net25YearGbp))}</p>
    </div>
    <div className="executive-kpis">
      <article><span>{t.annualGeneration}</span><strong>{f.n(study.result.range.representative)}</strong><small>{t.perYear}</small></article>
      <article><span>{t.demandLabel}</span><strong>{f.n(study.energy.annualDemandKwh)}</strong><small>{t.perYear}</small></article>
      <article><span>{t.scenario}</span><strong>{t.scenarioTitles[scenario.id]}</strong><small>{scenario.breakEvenYear ? t.breakEvenYear(scenario.breakEvenYear) : t.planningComparison}</small></article>
    </div>
    <div className="executive-flow-strip" aria-label={t.flowTitle}>
      <span style={{ ["--w" as string]: `${Math.max(8, kpis.pvSelfConsumptionPercent)}%` }}><b>{t.usedHome}</b><i>{f.n(selfUse)} kWh</i></span>
      <span style={{ ["--w" as string]: `${Math.max(8, kpis.exportRatePercent)}%` }}><b>{t.exported}</b><i>{f.n(exportKwh)} kWh</i></span>
    </div>
  </section>;
}

function EnergyAppliedChain({ study, scenario, onNavigate, f }: { study: ProjectCalculation; scenario: FinancialScenario; onNavigate: (route: Route) => void; f: Fmt }) {
  const { t } = f;
  const kpis = deriveResultsKpis(study, scenario.id);
  const selfConsumed = kpis.selfConsumedKwh;
  const exported = kpis.exportKwh;
  const value = scenarioAnnualValue(scenario);
  return <section className="result-section energy-applied-chain">
    <div className="result-section-heading"><div><p className="mini-label">{t.chainLabel}</p><h2>{t.chainTitle}</h2></div><button type="button" onClick={() => onNavigate("energy")}><Pencil size={14} /> {t.editEnergy}</button></div>
    <div className="applied-chain-grid">
      <article><span><Home size={17} /></span><p>01 · {t.household}</p><strong>{f.n(study.energy.annualDemandKwh)} {t.perYear}</strong><small>{study.energy.source === "bill" ? t.demandNoteBill : study.energy.source === "household" ? t.demandNoteHousehold : t.demandNoteModel}</small></article>
      <i><ArrowRight size={18} /></i>
      <article><span><SunMedium size={17} /></span><p>02 · {t.selfUseExport}</p><strong>{t.usedExported(f.n(selfConsumed), f.n(exported))}</strong><small>{t.chainDetail(kpis.solarCoveragePercent, kpis.pvSelfConsumptionPercent)}</small></article>
      <i><ArrowRight size={18} /></i>
      <article className="is-highlighted"><span><TrendingUp size={17} /></span><p>03 · {t.estimatedValue}</p><strong>{f.money(value)} {t.perYearMoney}</strong><small>{scenario.breakEvenYear ? t.breakEvenSimple(scenario.breakEvenYear) : t.longTerm} {t.onCost(f.money(scenario.upfrontGbp))}</small></article>
    </div>
    <p className="result-note"><Gauge size={14} /> {t.chainNote}</p>
  </section>;
}

function EnergyFlowPanel({ study, scenario, f }: { study: ProjectCalculation; scenario: FinancialScenario; f: Fmt }) {
  const { t } = f;
  const generation = study.result.range.representative;
  const kpis = deriveResultsKpis(study, scenario.id);
  const directUse = kpis.directSolarKwh;
  const batteryUse = kpis.batteryToLoadKwh;
  const exported = kpis.exportKwh;
  const total = Math.max(1, directUse + batteryUse + exported);
  const flows = [
    { key: "home", label: t.usedHome, value: directUse, color: "#0b6047", detail: t.usedHomeDetail },
    { key: "battery", label: t.batteryShift, value: batteryUse, color: "#efba45", detail: scenario.id === "solar-battery" ? t.batteryShiftOn : t.batteryShiftOff },
    { key: "export", label: t.exported, value: exported, color: "#8fbf79", detail: t.exportedDetail },
  ];
  return <section className="result-section energy-flow-panel">
    <div className="result-section-heading"><div><p className="mini-label">{t.flowLabel}</p><h2>{t.flowTitle}</h2></div><span className="chart-total">{f.n(generation)} {t.perYear}</span></div>
    <div className="energy-flow-visual">
      <div className="energy-flow-source"><SunMedium size={25} /><strong>{f.n(generation)}</strong><small>{t.generated}</small></div>
      <div className="energy-flow-bars">{flows.map((flow) => <article key={flow.key} style={{ ["--flow-color" as string]: flow.color, ["--flow-width" as string]: `${Math.max(5, (flow.value / total) * 100)}%` }}><span><i /></span><div><b>{flow.label}</b><strong>{f.n(flow.value)} kWh</strong><small>{flow.detail}</small></div></article>)}</div>
    </div>
  </section>;
}

function MonthlyProfileChart({ study, f }: { study: ProjectCalculation; f: Fmt }) {
  const { t } = f;
  const [selectedMonth, setSelectedMonth] = useState(5);
  const entries = study.result.monthlyByOrientation;
  const max = Math.max(1, ...entries.map((entry) => entry.total));
  const selected = entries[selectedMonth] ?? entries[0];
  const top = selected ? ORIENTATION_SERIES.slice().sort(([a], [b]) => selected[b] - selected[a])[0] : ORIENTATION_SERIES[0];
  return <section className="result-section monthly-profile-card premium-chart-card">
    <div className="result-section-heading"><div><p className="mini-label">{t.monthlyLabel}</p><h2>{t.monthlyTitle}</h2></div><span className="chart-total">{f.n(study.result.range.representative)} {t.perYear}</span></div>
    <div className="orientation-legend">{ORIENTATION_SERIES.map(([key, color]) => <span key={key}><i style={{ backgroundColor: color }} />{t.orientations[key]}</span>)}</div>
    <div className="monthly-chart-stage">
      <svg className="monthly-profile-chart" viewBox="0 0 760 310" role="img" aria-label={t.monthlyTitle}>
        <defs><linearGradient id="monthlyGlow" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#fff8da" stopOpacity=".9" /><stop offset="1" stopColor="#eaf6eb" stopOpacity=".15" /></linearGradient></defs>
        <rect x="34" y="24" width="690" height="218" rx="18" fill="url(#monthlyGlow)" opacity=".6" />
        {[0.25, 0.5, 0.75, 1].map((ratio) => <line key={ratio} x1="58" y1={244 - ratio * 190} x2="710" y2={244 - ratio * 190} className="chart-grid" />)}
        <line x1="58" y1="244" x2="710" y2="244" className="chart-axis" />
        {entries.map((entry, index) => {
          const x = 70 + index * 53;
          const barWidth = 33;
          let y = 244;
          return <g key={entry.month} onClick={() => setSelectedMonth(index)} className={selectedMonth === index ? "is-selected" : ""}>
            <rect x={x - 5} y="38" width={barWidth + 10} height="206" rx="17" fill={selectedMonth === index ? "rgba(255,255,255,.72)" : "transparent"} />
            {ORIENTATION_SERIES.map(([key, color]) => {
              const height = (entry[key] / max) * 190;
              y -= height;
              return height > 0.45 ? <rect key={key} x={x} y={y} width={barWidth} height={height} rx={y < 60 ? 5 : 2} fill={color}><title>{`${f.month(index)}: ${t.orientations[key]} ${f.n(entry[key])} kWh`}</title></rect> : null;
            })}
            <circle cx={x + barWidth / 2} cy={Math.max(42, y - 10)} r={selectedMonth === index ? 4.6 : 0} fill="#f0b83a" />
            <text x={x + barWidth / 2} y="268" textAnchor="middle">{f.month(index)}</text>
          </g>;
        })}
      </svg>
      {selected && <aside className="month-inspector">
        <span>{f.month(selectedMonth)}</span>
        <strong>{f.n(selected.total)} kWh</strong>
        <small>{t.largestShare}: {t.orientations[top[0]]} · {f.n(selected[top[0]])} kWh</small>
        <em>{t.monthHint}</em>
      </aside>}
    </div>
    <p className="result-note"><CircleHelp size={14} /> {t.monthlyNote}</p>
  </section>;
}

function ScenarioComparisonPanel({ scenarios, scenario, onSelect, f }: { scenarios: FinancialScenario[]; scenario: FinancialScenario; onSelect: (id: FinancialScenario["id"]) => void; f: Fmt }) {
  const { t } = f;
  const visible = scenarios.filter((item) => item.id !== "battery-only");
  return <section className="result-section scenario-comparison-panel scenario-premium-panel">
    <div className="result-section-heading"><div><p className="mini-label">{t.scenarioLabel}</p><h2>{t.scenarioTitle}</h2></div><span className="validation-status ready">{t.view25}</span></div>
    <div className="scenario-options">{visible.map((item) => <button key={item.id} type="button" className={`${scenario.id === item.id ? "is-selected" : ""} ${!item.available ? "is-unavailable" : ""}`} onClick={() => onSelect(item.id)}>
      <span>{item.id === "solar-battery" ? <BatteryCharging size={17} /> : <SunMedium size={17} />}</span>
      <div><b>{t.scenarioTitles[item.id]}</b><small>{item.available ? `${item.breakEvenYear ? t.breakEvenYear(item.breakEvenYear) : t.planningComparison} · ${t.byYear25(f.money(item.net25YearGbp))}` : t.unavailable[item.id]}</small></div>
    </button>)}</div>
    <p className="result-note"><ShieldCheck size={14} /> {t.scenarioNote}</p>
  </section>;
}

export function niceStep(range: number, target: number) {
  const raw = range / Math.max(1, target);
  const power = 10 ** Math.floor(Math.log10(raw));
  return ([1, 2, 2.5, 5, 10].find((m) => m * power >= raw) ?? 10) * power;
}

const CHART = { left: 78, right: 732, top: 30, bottom: 214, width: 760, height: 252 };

function CashPositionChart({ scenarios, scenario, f }: { scenarios: FinancialScenario[]; scenario: FinancialScenario; f: Fmt }) {
  const { t } = f;
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const visible = scenarios.filter((item) => item.id !== "battery-only" && item.available && item.annualCashFlows.length > 0);
  const years = Math.max(1, ...visible.map((item) => item.annualCashFlows.length));
  const values = visible.flatMap((item) => item.annualCashFlows.map((flow) => flow.cumulativeNetGbp));
  const step = niceStep(Math.max(1, Math.max(0, ...values) - Math.min(0, ...values)), 4);
  const yMin = Math.floor(Math.min(0, ...values) / step) * step;
  const yMax = Math.max(step, Math.ceil(Math.max(0, ...values) / step) * step);
  const ticks = Array.from({ length: Math.round((yMax - yMin) / step) + 1 }, (_, i) => yMin + i * step);
  const xAt = (index: number) => CHART.left + (index / Math.max(1, years - 1)) * (CHART.right - CHART.left);
  const yAt = (value: number) => CHART.bottom - ((value - yMin) / (yMax - yMin)) * (CHART.bottom - CHART.top);
  const points = (item: FinancialScenario) => item.annualCashFlows.map((flow, index) => `${xAt(index).toFixed(1)},${yAt(flow.cumulativeNetGbp).toFixed(1)}`);
  const zeroY = yAt(0);
  const yearTicks = [1, 5, 10, 15, 20, 25].filter((year) => year <= years);
  const breaks = visible.flatMap((item) => {
    const flows = item.annualCashFlows;
    const index = flows.findIndex((flow) => flow.cumulativeNetGbp >= 0);
    if (index <= 0) return [];
    const before = flows[index - 1]!.cumulativeNetGbp, after = flows[index]!.cumulativeNetGbp;
    return [{ item, x: xAt(index - 1 + (0 - before) / Math.max(1e-9, after - before)), year: item.breakEvenYear ?? flows[index]!.year }];
  }).sort((a, b) => a.x - b.x);
  const labelRows = breaks.map((entry, i) => (i > 0 && entry.x - breaks[i - 1]!.x < 132 ? 1 : 0));
  const selected = visible.find((item) => item.id === scenario.id) ?? visible[0];
  const areaPath = selected ? `M${xAt(0)},${zeroY} L${points(selected).join(" L")} L${xAt(selected.annualCashFlows.length - 1)},${zeroY} Z` : "";
  const selectedFinal = scenario.annualCashFlows.at(-1);
  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * CHART.width;
    setHoverIndex(Math.max(0, Math.min(years - 1, Math.round(((x - CHART.left) / (CHART.right - CHART.left)) * (years - 1)))));
  };
  return <section className="result-section cash-position-card premium-chart-card">
    <div className="result-section-heading"><div><p className="mini-label">{t.cashLabel}</p><h2>{t.cashTitle}</h2></div><span className="cash-position-stat">{scenario.breakEvenYear ? t.breakEvenYear(scenario.breakEvenYear) : t.noBreakEven}</span></div>
    {visible.length > 0 ? <>
      <svg className="cash-position-chart" viewBox={`0 0 ${CHART.width} ${CHART.height}`} role="img" aria-label={t.cashTitle} onPointerMove={onMove} onPointerLeave={() => setHoverIndex(null)}>
        <defs>
          <clipPath id="cash-above"><rect x={CHART.left} y={CHART.top - 4} width={CHART.right - CHART.left} height={Math.max(0, zeroY - CHART.top + 4)} /></clipPath>
          <clipPath id="cash-below"><rect x={CHART.left} y={zeroY} width={CHART.right - CHART.left} height={Math.max(0, CHART.bottom - zeroY + 4)} /></clipPath>
        </defs>
        {ticks.map((tick) => <g key={tick} className={tick === 0 ? "cash-zero" : "cash-tick"}>
          <line x1={CHART.left} x2={CHART.right} y1={yAt(tick)} y2={yAt(tick)} />
          <text x={CHART.left - 10} y={yAt(tick) + 4} textAnchor="end">{tick === 0 ? "0" : f.moneyCompact(tick)}</text>
        </g>)}
        {yearTicks.map((year) => <text key={year} className="cash-year" x={xAt(year - 1)} y={CHART.bottom + 24} textAnchor={year === 1 ? "start" : year === years ? "end" : "middle"}>{t.year(year)}</text>)}
        {selected && <>
          <path d={areaPath} className="cash-area is-positive" clipPath="url(#cash-above)" />
          <path d={areaPath} className="cash-area is-negative" clipPath="url(#cash-below)" />
        </>}
        {visible.map((item) => <polyline key={item.id} points={points(item).join(" ")} className={`cash-position-line ${item.id === scenario.id ? "is-selected" : ""}`} style={{ stroke: SCENARIO_COLORS[item.id] }} />)}
        {breaks.map(({ item, x, year }, i) => {
          const selectedLine = item.id === scenario.id;
          const labelY = CHART.top + 22 + labelRows[i]! * 30;
          return <g key={`${item.id}-break`} className={`cash-break ${selectedLine ? "is-selected" : ""}`}>
            <line x1={x} x2={x} y1={labelY + 6} y2={zeroY} style={{ stroke: SCENARIO_COLORS[item.id] }} />
            <circle cx={x} cy={zeroY} r={selectedLine ? 5.5 : 4.5} fill={SCENARIO_COLORS[item.id]} />
            <text x={x} y={labelY} textAnchor={x > CHART.right - 76 ? "end" : x < CHART.left + 76 ? "start" : "middle"} style={{ fill: SCENARIO_COLORS[item.id] }}>{t.breakEvenYear(year)}</text>
          </g>;
        })}
        {visible.map((item) => {
          const last = item.annualCashFlows.at(-1)!;
          return <circle key={`${item.id}-end`} cx={xAt(item.annualCashFlows.length - 1)} cy={yAt(last.cumulativeNetGbp)} r={item.id === scenario.id ? 4.5 : 3.5} fill="#fff" stroke={SCENARIO_COLORS[item.id]} strokeWidth="2.5" />;
        })}
        {hoverIndex !== null && (() => {
          const x = xAt(hoverIndex);
          const rows = visible.map((item) => ({ item, value: item.annualCashFlows[hoverIndex]?.cumulativeNetGbp })).filter((row) => row.value !== undefined);
          const boxX = x > CHART.right - 170 ? x - 162 : x + 12;
          return <g className="cash-hover" pointerEvents="none">
            <line x1={x} x2={x} y1={CHART.top} y2={CHART.bottom} />
            {rows.map(({ item, value }) => <circle key={item.id} cx={x} cy={yAt(value!)} r="4" fill={SCENARIO_COLORS[item.id]} stroke="#fff" strokeWidth="1.5" />)}
            <rect x={boxX} y={CHART.top + 44} width="150" height={26 + rows.length * 18} rx="9" />
            <text x={boxX + 12} y={CHART.top + 62} className="cash-hover-title">{t.year(hoverIndex + 1)}</text>
            {rows.map(({ item, value }, i) => <text key={item.id} x={boxX + 12} y={CHART.top + 80 + i * 18}><tspan style={{ fill: SCENARIO_COLORS[item.id] }}>●</tspan> {f.money(value!)}</text>)}
          </g>;
        })()}
      </svg>
      <div className="cash-position-values">
        <span><i>{t.selectedScenario}</i><b>{t.scenarioTitles[scenario.id]}</b></span>
        <span><i>{t.year25Cumulative}</i><b>{f.money(selectedFinal?.cumulativeNetGbp ?? scenario.net25YearGbp)}</b></span>
        <span><i>{t.firstYearBenefit}</i><b>{f.money(scenario.firstYearBenefitGbp)}</b></span>
      </div>
      <div className="cash-scenario-legend">{visible.map((item) => <span key={item.id}><i style={{ backgroundColor: SCENARIO_COLORS[item.id] }} />{t.scenarioTitles[item.id]}</span>)}</div>
    </> : <p className="result-note">{t.unavailable[scenario.id]}</p>}
    <p className="result-note">{t.cashDisclaimer}</p>
  </section>;
}

function SystemAndCarbon({ study, region, f }: { study: ProjectCalculation; region: "UK" | "EU" | "CA" | "JP"; f: Fmt }) {
  const { t } = f;
  const sim = study.simulation;
  const rec = study.result.recommendation;
  const factor = GRID_CO2_KG_PER_KWH[region];
  const firstYearT = (study.result.range.representative * factor) / 1000;
  const lifeT = Array.from({ length: 25 }, (_, year) => firstYearT * 0.995 ** year).reduce((sum, value) => sum + value, 0);
  const azimuths = study.result.surfaces.map((surface) => surface.azimuthDeg);
  const split = azimuths.length > 1 && Math.max(...azimuths) - Math.min(...azimuths) > 45;
  return <div className="result-main-grid result-system-grid">
    <section className="result-section system-recommendation">
      <div className="result-section-heading"><div><p className="mini-label">{t.systemLabel}</p><h2>{t.systemTitle}</h2></div><Cpu size={20} /></div>
      <dl className="result-facts">
        <div><dt>{t.inverter}</dt><dd>{t.inverterValue(rec.inverterKw)}</dd></div>
        <div><dt>{t.peakAc}</dt><dd>{f.n(sim.peakAcKw, 2)} kW</dd></div>
        <div><dt>{t.mppt}</dt><dd>{split ? t.mpptSplit : t.mpptShared}</dd></div>
        <div><dt>{t.battery}</dt><dd>{f.n(rec.batteryCapacityKwh, 1)} kWh</dd></div>
      </dl>
      <ul className="result-bullets">{t.installerNotes.map((note) => <li key={note}>{note}</li>)}</ul>
    </section>
    <section className="result-section carbon-card">
      <div className="result-section-heading"><div><p className="mini-label">{t.carbonLabel}</p><h2>{t.carbonTitle}</h2></div><Leaf size={20} /></div>
      <div className="carbon-values">
        <span><i>{t.co2Year}</i><b>{f.n(firstYearT, 1)} t</b></span>
        <span><i>{t.co2Life}</i><b>{f.n(lifeT, 0)} t</b></span>
      </div>
      <p className="result-note">{t.carbonNote(factor)}</p>
    </section>
  </div>;
}

function ResultAdvisor({ isDemo, t }: { isDemo: boolean; t: ResultsCopy }) {
  const ask = (question?: string) => window.dispatchEvent(new CustomEvent(ADVISOR_ASK_EVENT, { detail: { question } }));
  return <section className="study-summary-card advisor-card results-advisor" aria-label={t.advisorLabel}>
    <div className="results-advisor-orbit" aria-hidden="true"><i /><i /><i /></div>
    <span className="results-advisor-mark"><MessageCircle size={20} /></span>
    <div>
      <p className="mini-label">{t.advisorLabel}</p>
      <p>{isDemo ? t.advisorDemo : t.advisorBody}</p>
    </div>
    <div className="assistant-prompts">{t.prompts.map((prompt) => <button key={prompt} type="button" onClick={() => ask(prompt)}>{prompt}</button>)}</div>
    <div className="results-advisor-status"><Sparkles size={13} /><span>{t.chainNote}</span></div>
    <button type="button" className="button-secondary wide" onClick={() => ask()}><Sparkles size={15} /> {t.advisorLabel}</button>
  </section>;
}

export type ResultsShare = {
  /** Set when viewing a shared project: the id is reused for the PDF and actions are read-only. */
  sharedId?: string;
  /** Scenario captured by sharedId; switching scenario should mint a new share/PDF id. */
  baseScenarioId?: FinancialScenario["id"];
  onCreate?: (scenarioId: FinancialScenario["id"]) => Promise<string>;
};

const APP_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function ShareActions({ share, language, scenarioId }: { share: ResultsShare; language: string; scenarioId: FinancialScenario["id"] }) {
  const c = shareCopy(language);
  const [id, setId] = useState(share.sharedId);
  const [busy, setBusy] = useState<"link" | "pdf" | null>(null);
  const [message, setMessage] = useState<{ text: string; url?: string; error?: boolean } | null>(null);
  useEffect(() => {
    setId(share.sharedId && scenarioId === share.baseScenarioId ? share.sharedId : undefined);
    setMessage(null);
  }, [scenarioId, share.baseScenarioId, share.sharedId]);
  const ensureId = async () => {
    if (id) return id;
    if (!share.onCreate) throw new Error("Cannot create shared project");
    const created = await share.onCreate!(scenarioId);
    setId(created);
    return created;
  };
  const copyLink = async () => {
    setBusy("link");
    try {
      const url = `${window.location.origin}${APP_BASE}/p/${await ensureId()}`;
      await navigator.clipboard?.writeText(url).catch(() => undefined);
      setMessage({ text: c.copied, url });
    } catch {
      setMessage({ text: c.linkFailed, error: true });
    } finally {
      setBusy(null);
    }
  };
  const downloadPdf = async () => {
    setBusy("pdf");
    setMessage(null);
    try {
      const projectId = await ensureId();
      const response = await fetch(`${APP_BASE}/api/projects/${projectId}/report.pdf?lang=${encodeURIComponent(language)}`);
      if (!response.ok) throw new Error(String(response.status));
      const href = URL.createObjectURL(await response.blob());
      const link = Object.assign(document.createElement("a"), { href, download: `modernite-study-${projectId}.pdf` });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
    } catch {
      setMessage({ text: c.pdfFailed, error: true });
    } finally {
      setBusy(null);
    }
  };
  return <>
    <button type="button" className="button-primary wide" disabled={busy !== null} onClick={() => void downloadPdf()}>{busy === "pdf" ? <Loader2 size={15} className="spin" /> : <Download size={15} />} {busy === "pdf" ? c.pdfBusy : c.pdf}</button>
    <button type="button" className="button-secondary wide" disabled={busy !== null} onClick={() => void copyLink()}>{busy === "link" ? <Loader2 size={15} className="spin" /> : <Link2 size={15} />} {busy === "link" ? c.linkBusy : c.link}</button>
    {message && <p className={`result-share-note ${message.error ? "is-error" : ""}`} aria-live="polite">{message.text}{message.url && <input readOnly value={message.url} onFocus={(event) => event.currentTarget.select()} />}</p>}
  </>;
}

export function ResultsPage({ study, preferredBatteryMode, onNavigate, language, marketKey, share }: {
  study: ProjectCalculation;
  preferredBatteryMode: "solar-only" | "solar-battery" | string;
  onNavigate: (route: Route) => void;
  language: string;
  marketKey: MarketKey;
  share?: ResultsShare;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void document.fonts.ready.then(() => setTimeout(() => !cancelled && setReady(true), 600));
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    document.documentElement.classList.add("has-print-report");
    return () => document.documentElement.classList.remove("has-print-report");
  }, []);
  const sc = shareCopy(language);
  const project = study.project;
  const market = (project?.market ?? marketKey) as MarketKey;
  const region = project?.region ?? MARKET_REGION[market];
  const f = useFormatters(language, project?.currency ?? MARKET_CURRENCY[market]);
  const { t } = f;
  const isDemo = study.caseId.startsWith("MOD-DEMO");
  const [scenarioId, setScenarioId] = useState<FinancialScenario["id"]>(() => study.result.scenarios.some((item) => item.id === preferredBatteryMode) ? preferredBatteryMode as FinancialScenario["id"] : preferredBatteryMode === "solar-battery" ? "solar-battery" : "solar-only");
  const scenario = study.result.scenarios.find((item) => item.id === scenarioId) ?? study.result.scenarios[0]!;
  const selectedKpis = deriveResultsKpis(study, scenario.id);
  const surfaces = study.result.surfaces.slice().sort((a: SurfaceResult, b: SurfaceResult) => b.annualKwh - a.annualKwh);
  const sim = study.simulation;
  const solar = study.googleSolar;
  const weatherKind = study.weather.kind;
  const front = Math.round(project?.frontAzimuthDeg ?? sim.buildingNorthDeg);
  const typeId = project?.buildingTypeId;
  return (
    <section className="results-page gateway-page">
      <PageIntro
        chapter={6}
        eyebrow={WORKFLOW_LABELS[language as WorkflowLanguage]?.results ?? WORKFLOW_LABELS.en.results}
        icon={<Sparkles size={14} />}
        title={t.title}
        lede={t.intro}
        aside={<div className="result-case-chip"><span>{t.reference}</span><strong>{study.caseId}</strong><small>{new Date(study.createdAt).toLocaleDateString(t.locale, { day: "2-digit", month: "short", year: "numeric" })}</small></div>}
      />
      {isDemo && <p className="results-demo-banner"><CircleHelp size={15} /> {t.demo}</p>}
      <div className={`results-hero-stage ${ready ? "is-ready" : ""}`}><GenerationRangeCard study={study} f={f} scenarioId={scenario.id} /></div>
      <div className="results-layout"><main className={`results-report ${ready ? "is-ready" : ""}`}>
        <ExecutiveOutcomePanel study={study} scenario={scenario} f={f} />
        <div className="result-main-grid">
          <section className="result-section energy-demand-card"><div><p className="mini-label">{t.demandLabel}</p><h2>{f.n(study.energy.annualDemandKwh)} {t.perYear}</h2><p>{study.energy.source === "bill" ? t.demandBill : t.demandModel} · {study.energy.source === "bill" ? t.demandNoteBill : study.energy.source === "household" ? t.demandNoteHousehold : t.demandNoteModel}</p></div><button type="button" onClick={() => onNavigate("energy")}>{t.demandUpdate} <ArrowRight size={14} /></button></section>
          <section className="result-section result-capacity-tile"><span><BarChart3 size={20} /></span><p className="mini-label">{t.capacity}</p><h2>{f.n(study.result.totalCapacityKwp, 2)} kWp</h2><p>{t.activeSurfaces(study.result.surfaces.length)}</p></section>
        </div>
        <EnergyAppliedChain study={study} scenario={scenario} onNavigate={onNavigate} f={f} />
        <EnergyFlowPanel study={study} scenario={scenario} f={f} />
        <MonthlyProfileChart study={study} f={f} />
        <ScenarioComparisonPanel scenarios={study.result.scenarios} scenario={scenario} onSelect={setScenarioId} f={f} />
        <CashPositionChart scenarios={study.result.scenarios} scenario={scenario} f={f} />
        <SystemAndCarbon study={study} region={region} f={f} />
        <section className="result-section">
          <div className="result-section-heading"><div><p className="mini-label">{t.surfacesLabel}</p><h2>{t.surfacesTitle}</h2></div></div>
          <div className="result-table-wrap"><table className="result-table">
            <thead><tr><th>{t.colSurface}</th><th>{t.colOrientation}</th><th>{t.colArea}</th><th>{t.colCapacity}</th><th>{t.colYield}</th><th>{t.colGeneration}</th></tr></thead>
            <tbody>{surfaces.map((surface) => <tr key={surface.surfaceId}>
              <td><strong>{surface.surfaceLabel}</strong><small>{surface.productName}{surface.finishName ? ` · ${surface.finishName}` : ""}</small></td>
              <td>{t.orientations[surface.orientationName]} · {f.n(surface.azimuthDeg)}° / {f.n(surface.tiltDeg)}°</td>
              <td>{f.n(surface.areaM2, 1)} m²</td>
              <td>{f.n(surface.capacityKwp, 2)} kWp</td>
              <td>{f.n(surface.specificYield)} kWh/kWp</td>
              <td><b>{f.n(surface.annualKwh)} kWh</b><span className="share-bar"><i style={{ width: `${Math.min(100, surface.sharePercent)}%` }} /></span></td>
            </tr>)}</tbody>
          </table></div>
          {surfaces[0] && <p className="result-note"><CircleHelp size={14} /> {t.largest(surfaces[0].surfaceLabel, f.n(surfaces[0].annualKwh))}</p>}
        </section>
        {study.result.schedule.length > 0 && <section className="result-section">
          <div className="result-section-heading"><div><p className="mini-label">{t.scheduleLabel}</p><h2>{t.scheduleTitle}</h2></div></div>
          <div className="result-table-wrap"><table className="result-table">
            <thead><tr><th>{t.colProduct}</th><th>{t.colArea}</th><th>{t.colPeak}</th><th>{t.colCapacity}</th></tr></thead>
            <tbody>{study.result.schedule.map((line) => <tr key={line.productId}>
              <td><strong>{line.productName}</strong><small>{line.surfaceNames.length} × {t.colSurface}</small></td>
              <td>{f.n(line.totalAreaM2, 1)} m²</td>
              <td>{f.n(line.peakPowerWpM2)} Wp/m²</td>
              <td><b>{f.n(line.totalCapacityKwp, 2)} kWp</b></td>
            </tr>)}</tbody>
          </table></div>
        </section>}
        <section className="result-section">
          <div className="result-section-heading"><div><p className="mini-label">{t.basisLabel}</p><h2>{t.basisTitle[weatherKind]}</h2></div><span className={`validation-status ${study.validation.status}`}>{weatherKind === "customer-synthetic" ? t.indicative : t.siteWeather}</span></div>
          <div className="validation-grid">
            <div><span>{t.annualGeneration}</span><strong>{f.n(study.validation.empiricalAnnualKwh)} {t.perYear}</strong></div>
            <div><span>{t.hourlyWeather}</span><strong>{weatherSourceLabel(study.weather.kind, study.weather.source, study.weather.name, t)}</strong></div>
            <div><span>{t.irradiation}</span><strong>GHI {f.n(study.weather.annualGhiKwhM2)} · DNI {f.n(study.weather.annualDniKwhM2)} · DHI {f.n(study.weather.annualDhiKwhM2)} kWh/m²</strong></div>
            <div><span>{t.solarOnSite}</span><strong>{t.selfUse(selectedKpis.pvSelfConsumptionPercent, selectedKpis.solarCoveragePercent)}</strong></div>
            {scenario.id === "solar-battery" && <div><span>{t.withBattery(sim.battery.nominalKwh)}</span><strong>{t.usedOnSite(f.n(sim.battery.selfConsumedKwh))}</strong></div>}
            <div><span>{t.meanTemp}</span><strong>{f.n(study.weather.meanAirTemperatureC, 1)} °C</strong></div>
          </div>
          <p className="result-note">{weatherKind === "customer-synthetic" ? t.basisSynthetic : t.basisSite(study.weather.source, study.weather.hours)}</p>
        </section>
        {solar && <section className="result-section">
          <div className="result-section-heading"><div><p className="mini-label">{t.extLabel}</p><h2>{t.googleTitle}</h2></div><span className={`validation-status ${solar.status}`}>{solar.status === "ok" ? t.imagery(solar.imageryQuality ?? "") : t.unavailableShort}</span></div>
          {solar.status === "ok" && <>
            <div className="validation-grid">
              <div><span>{t.roofSegments}</span><strong>{solar.roofSegments?.length ?? 0}</strong></div>
              <div><span>{t.usableArea}</span><strong>{solar.maxArrayAreaM2 ?? "—"} m²</strong></div>
              <div><span>{t.peakSunshine}</span><strong>{solar.maxSunshineHoursPerYear ?? "—"} {t.hoursYear}</strong></div>
            </div>
            <div className="surface-list">{(solar.roofSegments ?? []).slice(0, 6).map((segment, index) => <article className="surface-row" key={index}><div><strong>{t.segment(index + 1)}</strong><span>{t.pitchAz(segment.pitchDeg, segment.azimuthDeg)}</span></div><span>{segment.areaM2} m²</span><b>{segment.sunshineMedianHoursPerYear ?? "—"} {t.hoursYear}</b></article>)}</div>
          </>}
          <p className="result-note">{solar.status === "ok" ? t.googleOk : t.googleNone}{solar.distanceM !== undefined ? ` ${t.nearest(solar.distanceM)}` : ""}</p>
        </section>}
        <section className="result-section source-ledger">
          <div className="result-section-heading"><div><p className="mini-label">{t.ledgerLabel}</p><h2>{t.ledgerTitle}</h2></div></div>
          <dl>{study.result.ledger.map((entry) => <div key={entry.id}><dt>{t.ledger[entry.id] ?? entry.label}<small>{t.provenance[entry.provenance] ?? entry.provenance}</small></dt><dd>{ledgerValue(entry, f)}</dd></div>)}</dl>
        </section>
      </main><aside className="results-side-rail">
        <section className="study-summary-card">
          <span><Building2 size={20} /></span>
          <p className="mini-label">{t.summaryLabel}</p>
          <div className="selected-case-chip"><small>{t.selectedCase}</small><strong>{study.caseId}</strong></div>
          <dl>
            <div><dt>{t.site}</dt><dd>{project?.address ?? t.regions[region]}<small>{t.regions[region]}</small></dd></div>
            <div><dt>{t.building}</dt><dd>{typeId ? `${typeId} · ${buildingTypeLabel(typeId, language)}` : "—"}{project && <small>{t.dims(f.n(project.building.width, 1), f.n(project.building.depth, 1), project.building.floors)} · {t.facing(front, f.compass(front))}</small>}</dd></div>
            {project && <div><dt>{t.heating}</dt><dd>{t.heatModes[project.heatMode]}{(project.electricHotWater || project.evCharger) && <small>{[project.electricHotWater ? t.extras.hotWater : "", project.evCharger ? t.extras.ev : ""].filter(Boolean).join(" · ")}</small>}</dd></div>}
            <div><dt>{t.surfaces}</dt><dd>{t.surfacesValue(study.result.surfaces.length)}<small>{f.n(study.result.totalCapacityKwp, 2)} kWp</small></dd></div>
            <div><dt>{t.scenario}</dt><dd>{t.scenarioTitles[scenario.id]}<small>{scenario.available ? t.scenarioSub : t.planningComparison}</small></dd></div>
          </dl>
          {share && (share.sharedId || share.onCreate) && !isDemo && <ShareActions share={share} language={language} scenarioId={scenario.id} />}
          {!share?.sharedId && <>
            <button type="button" className={`button-${share?.onCreate && !isDemo ? "secondary" : "primary"} wide`} onClick={() => window.dispatchEvent(new CustomEvent("modernite:finalize-request", { detail: "report" }))}><Download size={15} /> {share?.onCreate && !isDemo ? sc.studioReport : t.downloadPdf}</button>
            <button type="button" className="button-secondary wide" onClick={() => window.dispatchEvent(new CustomEvent("modernite:finalize-request", { detail: "configuration" }))}><Download size={15} /> {t.saveConfig}</button>
          </>}
          <button type="button" className="button-secondary wide" onClick={() => window.print()}><Printer size={15} /> {t.print}</button>
        </section>
        <ResultAdvisor isDemo={isDemo} t={t} />
      </aside></div>
      {createPortal(<div className="print-report-portal"><PrintReport study={study} scenarioId={scenario.id} language={language} marketKey={marketKey} /></div>, document.body)}
    </section>
  );
}
