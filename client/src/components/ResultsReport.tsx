import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, BarChart3, BatteryCharging, Building2, CircleHelp, Cpu, Download, Gauge, Home, Leaf, LineChart, MessageCircle,
  Link2, Loader2, Pencil, Printer, ShieldCheck, Sparkles, SunMedium, TrendingUp, Zap,
} from "lucide-react";
import { ADVISOR_ASK_EVENT } from "@/components/ModerniteAdvisor";
import { resultsCopy, type ResultsCopy } from "@/lib/results-copy";
import { shareCopy } from "@/lib/share-copy";
import { buildingTypeLabel } from "@/components/BuildingProfileCard";
import { PageIntro } from "@/components/PageIntro";
import { WORKFLOW_LABELS, type WorkflowLanguage } from "@/lib/workflow-labels";
import type { ProjectCalculation } from "../../../server/estimate-service";
import type { FinancialScenario, LedgerEntry, SurfaceResult } from "../../../types/solar";

type Route = "entry" | "market" | "location" | "studio" | "energy" | "calculation" | "results";
type MarketKey = "GB" | "EU" | "CA" | "JP";

const MARKET_CURRENCY: Record<MarketKey, string> = { GB: "GBP", EU: "EUR", CA: "CAD", JP: "JPY" };
const MARKET_REGION: Record<MarketKey, "UK" | "EU" | "CA" | "JP"> = { GB: "UK", EU: "EU", CA: "CA", JP: "JP" };
/** Grid emission factors, kg CO₂e per kWh (UK DESNZ 2024, EEA EU-27 2023, Canada NIR 2023, Japan MoE 2022). */
const GRID_CO2_KG_PER_KWH: Record<"UK" | "EU" | "CA" | "JP", number> = { UK: 0.207, EU: 0.244, CA: 0.11, JP: 0.453 };
const ORIENTATION_SERIES = [
  ["south", "#07573f"],
  ["east", "#4d9b71"],
  ["west", "#a5c979"],
  ["north", "#79aeca"],
  ["horizontal", "#f1b33d"],
] as const;
const SCENARIO_COLORS: Record<string, string> = { "solar-only": "#0c6249", "solar-battery": "#d6a226", "battery-only": "#789" };

type Fmt = {
  t: ResultsCopy;
  n: (value: number, digits?: number) => string;
  money: (value: number) => string;
  month: (index: number) => string;
  compass: (deg: number) => string;
};

function weatherSourceLabel(kind: string, source: string, name: string | null | undefined, t: ResultsCopy) {
  if (kind !== "customer-synthetic") return source;
  const city = (name ?? source.match(/\(([^)·]+)/)?.[1] ?? "").split("·")[0].trim();
  return t.ledgerText.synthetic(t.ledgerText.cities[city] ?? city);
}

function ledgerValue(entry: LedgerEntry, f: Fmt) {
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
    case "google-solar": return [
      lt.google(Number(p.segments), num("area")),
      p.topArea != null ? lt.googleTop(num("topArea"), num("topPitch"), num("topAz")) : "",
      p.quality || p.date ? lt.imagery(String(p.quality ?? ""), String(p.date ?? "")) : "",
    ].filter(Boolean).join(" · ");
    default: return entry.value;
  }
}

function useFormatters(language: string, currency: string): Fmt {
  return useMemo(() => {
    const t = resultsCopy(language);
    const money = new Intl.NumberFormat(t.locale, { style: "currency", currency, maximumFractionDigits: 0 });
    const months = new Intl.DateTimeFormat(t.locale, { month: "short" });
    return {
      t,
      n: (value, digits = 0) => value.toLocaleString(t.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }),
      money: (value) => money.format(Math.round(value)),
      month: (index) => months.format(new Date(2025, index, 1)),
      compass: (deg) => t.compass[Math.round((((deg % 360) + 360) % 360) / 45) % 8],
    };
  }, [language, currency]);
}

function GenerationRangeCard({ study, scenario, f }: { study: ProjectCalculation; scenario: FinancialScenario; f: Fmt }) {
  const { t } = f;
  const range = study.result.range;
  const position = ((range.representative - range.low) / Math.max(1, range.high - range.low)) * 100;
  return <section className="result-section generation-range-card generation-hero-card">
    <div className="range-card-top"><div><p className="mini-label">{t.heroLabel}</p><strong>{f.n(range.representative)} <small>{t.perYear}</small></strong><p>{t.heroBody(study.result.surfaces.length)}</p></div><span><i /> {t.model} · {t.weather[study.weather.kind]}</span></div>
    <div className="range-insight-grid">
      <div className="range-window">
        <div className="range-window-head"><span>{t.rangeTitle}</span><b>{f.n(range.low)} – {f.n(range.high)} {t.perYear}</b></div>
        <div className="range-points"><span><i>{t.low}</i><b>{f.n(range.low)}</b></span><span className="is-main"><i>{t.representative}</i><b>{f.n(range.representative)}</b></span><span><i>{t.high}</i><b>{f.n(range.high)}</b></span></div>
        <div className="range-track"><em style={{ left: "0%" }} /><strong style={{ left: `${position}%` }} /><em style={{ left: "100%" }} /></div>
        <p>{t.rangeNote}</p>
      </div>
      <div className="hero-result-metrics">
        <article><span><BarChart3 size={18} /></span><small>{t.capacity}</small><b>{f.n(study.result.totalCapacityKwp, 2)} kWp</b></article>
        <article><span><Zap size={18} /></span><small>{t.firstYearValue}</small><b>{f.money(scenario.firstYearBenefitGbp)}</b></article>
        <article><span><LineChart size={18} /></span><small>{t.view25}</small><b>{f.money(scenario.net25YearGbp)}</b></article>
      </div>
    </div>
  </section>;
}

function EnergyAppliedChain({ study, scenario, onNavigate, f }: { study: ProjectCalculation; scenario: FinancialScenario; onNavigate: (route: Route) => void; f: Fmt }) {
  const { t } = f;
  const firstYear = scenario.annualCashFlows[0];
  const directUse = firstYear?.directUseKwh ?? study.simulation.selfConsumedKwh;
  const exported = firstYear?.exportKwh ?? study.simulation.exportKwh;
  const value = (firstYear?.billSavingGbp ?? 0) + (firstYear?.exportIncomeGbp ?? 0) + (firstYear?.arbitrageIncomeGbp ?? 0);
  const directPercent = Math.round((directUse / Math.max(1, study.energy.annualDemandKwh)) * 100);
  const keptPercent = Math.round((directUse / Math.max(1, study.result.range.representative)) * 100);
  return <section className="result-section energy-applied-chain">
    <div className="result-section-heading"><div><p className="mini-label">{t.chainLabel}</p><h2>{t.chainTitle}</h2></div><button type="button" onClick={() => onNavigate("energy")}><Pencil size={14} /> {t.editEnergy}</button></div>
    <div className="applied-chain-grid">
      <article><span><Home size={17} /></span><p>01 · {t.household}</p><strong>{f.n(study.energy.annualDemandKwh)} {t.perYear}</strong><small>{study.energy.source === "bill" ? t.demandNoteBill : t.demandNoteModel}</small></article>
      <i><ArrowRight size={18} /></i>
      <article><span><SunMedium size={17} /></span><p>02 · {t.selfUseExport}</p><strong>{t.usedExported(f.n(directUse), f.n(exported))}</strong><small>{t.chainDetail(directPercent, keptPercent)}</small></article>
      <i><ArrowRight size={18} /></i>
      <article className="is-highlighted"><span><TrendingUp size={17} /></span><p>03 · {t.estimatedValue}</p><strong>{f.money(value)} {t.perYearMoney}</strong><small>{scenario.breakEvenYear ? t.breakEvenSimple(scenario.breakEvenYear) : t.longTerm} {t.onCost(f.money(scenario.upfrontGbp))}</small></article>
    </div>
    <p className="result-note"><Gauge size={14} /> {t.chainNote}</p>
  </section>;
}

function EnergyFlowPanel({ study, scenario, f }: { study: ProjectCalculation; scenario: FinancialScenario; f: Fmt }) {
  const { t } = f;
  const generation = study.result.range.representative;
  const withBattery = scenario.id === "solar-battery";
  const directUse = study.simulation.selfConsumedKwh;
  const batteryUse = withBattery ? Math.max(0, study.simulation.battery.selfConsumedKwh - study.simulation.selfConsumedKwh) : 0;
  const exported = withBattery ? study.simulation.battery.exportKwh : study.simulation.exportKwh;
  const total = Math.max(1, directUse + batteryUse + exported);
  const flows = [
    { key: "home", label: t.usedHome, value: directUse, color: "#0b6047", detail: t.usedHomeDetail },
    { key: "battery", label: t.batteryShift, value: batteryUse, color: "#efba45", detail: withBattery ? t.batteryShiftOn : t.batteryShiftOff },
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

function ScenarioComparisonPanel({ scenarios, scenario, onSelect, f }: { scenarios: FinancialScenario[]; scenario: FinancialScenario; onSelect: (id: string) => void; f: Fmt }) {
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

function CashPositionChart({ scenarios, scenario, f }: { scenarios: FinancialScenario[]; scenario: FinancialScenario; f: Fmt }) {
  const { t } = f;
  const visible = scenarios.filter((item) => item.id !== "battery-only" && item.available && item.annualCashFlows.length > 0);
  const maxAbs = Math.max(1, ...visible.flatMap((item) => item.annualCashFlows.map((flow) => Math.abs(flow.cumulativeNetGbp))));
  const pathFor = (item: FinancialScenario) => item.annualCashFlows.map((flow, index) => {
    const x = 54 + (index / Math.max(1, item.annualCashFlows.length - 1)) * 646;
    const y = 164 - (flow.cumulativeNetGbp / maxAbs) * 112;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  const selectedFinal = scenario.annualCashFlows.at(-1);
  return <section className="result-section cash-position-card premium-chart-card">
    <div className="result-section-heading"><div><p className="mini-label">{t.cashLabel}</p><h2>{t.cashTitle}</h2></div><span className="cash-position-stat">{scenario.breakEvenYear ? t.breakEvenYear(scenario.breakEvenYear) : t.noBreakEven}</span></div>
    {visible.length > 0 ? <>
      <svg className="cash-position-chart" viewBox="0 0 760 242" role="img" aria-label={t.cashTitle}>
        <rect x="36" y="26" width="690" height="168" rx="18" fill="rgba(245,250,244,.82)" />
        {[0.25, 0.5, 0.75, 1].map((ratio) => <line key={ratio} x1="54" y1={164 - ratio * 112} x2="700" y2={164 - ratio * 112} className="chart-grid" />)}
        <line x1="54" y1="164" x2="700" y2="164" className="chart-axis" />
        {visible.map((item) => <path key={`${item.id}-glow`} d={pathFor(item)} className={`cash-position-line-glow ${item.id === scenario.id ? "is-selected" : ""}`} style={{ stroke: SCENARIO_COLORS[item.id] }} />)}
        {visible.map((item) => <path key={item.id} d={pathFor(item)} className={`cash-position-line ${item.id === scenario.id ? "is-selected" : ""}`} style={{ stroke: SCENARIO_COLORS[item.id] }} />)}
        {visible.map((item) => {
          const breakFlow = item.breakEvenYear === null ? undefined : item.annualCashFlows.find((flow) => flow.year === item.breakEvenYear);
          if (!breakFlow) return null;
          const x = 54 + ((breakFlow.year - 1) / Math.max(1, item.annualCashFlows.length - 1)) * 646;
          const y = 164 - (breakFlow.cumulativeNetGbp / maxAbs) * 112;
          return <g key={`${item.id}-break`}><circle cx={x} cy={y} r={item.id === scenario.id ? 5.5 : 4} fill={SCENARIO_COLORS[item.id]} stroke="#fff" strokeWidth="2" /><text x={x + 8} y={y - 8}>{t.year(breakFlow.year)}</text></g>;
        })}
        <text x="54" y="220">{t.year(1)}</text><text x="700" y="220" textAnchor="end">{t.year(25)}</text>
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
  return <section className="study-summary-card advisor-card results-advisor">
    <span><MessageCircle size={20} /></span>
    <p className="mini-label">{t.advisorLabel}</p>
    <p>{isDemo ? t.advisorDemo : t.advisorBody}</p>
    <div className="assistant-prompts">{t.prompts.map((prompt) => <button key={prompt} type="button" onClick={() => ask(prompt)}>{prompt}</button>)}</div>
    <button type="button" className="button-secondary wide" onClick={() => ask()}><Sparkles size={15} /> {t.advisorLabel}</button>
  </section>;
}

export type ResultsShare = {
  /** Set when viewing a shared project: the id is reused for the PDF and actions are read-only. */
  sharedId?: string;
  onCreate?: () => Promise<string>;
};

const APP_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function ShareActions({ share, language }: { share: ResultsShare; language: string }) {
  const c = shareCopy(language);
  const [id, setId] = useState(share.sharedId);
  const [busy, setBusy] = useState<"link" | "pdf" | null>(null);
  const [message, setMessage] = useState<{ text: string; url?: string; error?: boolean } | null>(null);
  const ensureId = async () => {
    if (id) return id;
    const created = await share.onCreate!();
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
  const sc = shareCopy(language);
  const project = study.project;
  const market = (project?.market ?? marketKey) as MarketKey;
  const region = project?.region ?? MARKET_REGION[market];
  const f = useFormatters(language, project?.currency ?? MARKET_CURRENCY[market]);
  const { t } = f;
  const isDemo = study.caseId.startsWith("MOD-DEMO");
  const [scenarioId, setScenarioId] = useState(preferredBatteryMode === "solar-battery" ? "solar-battery" : "solar-only");
  const scenario = study.result.scenarios.find((item) => item.id === scenarioId) ?? study.result.scenarios[0]!;
  const surfaces = study.result.surfaces.slice().sort((a: SurfaceResult, b: SurfaceResult) => b.annualKwh - a.annualKwh);
  const sim = study.simulation;
  const solar = study.googleSolar;
  const weatherKind = study.weather.kind;
  const front = Math.round(project?.frontAzimuthDeg ?? sim.buildingNorthDeg);
  const typeId = project?.buildingTypeId;
  return (
    <section className="results-page gateway-page">
      <PageIntro
        chapter={7}
        eyebrow={WORKFLOW_LABELS[language as WorkflowLanguage]?.results ?? WORKFLOW_LABELS.en.results}
        icon={<Sparkles size={14} />}
        title={t.title}
        lede={t.intro}
        aside={<div className="result-case-chip"><span>{t.reference}</span><strong>{study.caseId}</strong><small>{new Date(study.createdAt).toLocaleDateString(t.locale, { day: "2-digit", month: "short", year: "numeric" })}</small></div>}
      />
      {isDemo && <p className="results-demo-banner"><CircleHelp size={15} /> {t.demo}</p>}
      <div className="results-layout"><main className={`results-report ${ready ? "is-ready" : ""}`}>
        <GenerationRangeCard study={study} scenario={scenario} f={f} />
        <div className="result-main-grid">
          <section className="result-section energy-demand-card"><div><p className="mini-label">{t.demandLabel}</p><h2>{f.n(study.energy.annualDemandKwh)} {t.perYear}</h2><p>{study.energy.source === "bill" ? t.demandBill : t.demandModel} · {study.energy.source === "bill" ? t.demandNoteBill : t.demandNoteModel}</p></div><button type="button" onClick={() => onNavigate("energy")}>{t.demandUpdate} <ArrowRight size={14} /></button></section>
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
            <div><span>{t.solarOnSite}</span><strong>{t.selfUse(Math.round(sim.selfConsumption * 100), Math.round(sim.selfSufficiency * 100))}</strong></div>
            <div><span>{t.withBattery(sim.battery.nominalKwh)}</span><strong>{t.usedOnSite(f.n(sim.battery.selfConsumedKwh))}</strong></div>
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
              {solar.maxArrayPanelsCount ? <div><span>{sc.googleLayout}</span><strong>{sc.googleLayoutValue(solar.maxArrayPanelsCount, f.n(solar.maxArrayCapacityKwp ?? 0, 1))}</strong></div> : null}
              {solar.maxArrayYearlyDcKwh ? <div><span>{sc.googleYearly}</span><strong>{f.n(solar.maxArrayYearlyDcKwh)} {t.perYear}</strong></div> : null}
            </div>
            {solar.maxArrayYearlyDcKwh && solar.maxArrayCapacityKwp && study.result.totalCapacityKwp > 0 ? <p className="result-note result-crosscheck">{sc.crossCheck(f.n(study.result.range.representative / study.result.totalCapacityKwp), f.n(solar.maxArrayYearlyDcKwh / solar.maxArrayCapacityKwp))}</p> : null}
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
          {share && (share.sharedId || share.onCreate) && !isDemo && <ShareActions share={share} language={language} />}
          {!share?.sharedId && <>
            <button type="button" className={`button-${share?.onCreate && !isDemo ? "secondary" : "primary"} wide`} onClick={() => window.dispatchEvent(new CustomEvent("modernite:finalize-request", { detail: "report" }))}><Download size={15} /> {share?.onCreate && !isDemo ? sc.studioReport : t.downloadPdf}</button>
            <button type="button" className="button-secondary wide" onClick={() => window.dispatchEvent(new CustomEvent("modernite:finalize-request", { detail: "configuration" }))}><Download size={15} /> {t.saveConfig}</button>
          </>}
          <button type="button" className="button-secondary wide" onClick={() => window.print()}><Printer size={15} /> {t.print}</button>
        </section>
        <ResultAdvisor isDemo={isDemo} t={t} />
      </aside></div>
    </section>
  );
}
