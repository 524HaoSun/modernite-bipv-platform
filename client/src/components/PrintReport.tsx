import { useEffect, useState } from "react";
import { Leaf } from "lucide-react";
import { buildingTypeLabel } from "@/components/BuildingProfileCard";
import {
  GRID_CO2_KG_PER_KWH, MARKET_CURRENCY, MARKET_REGION, ORIENTATION_SERIES, SCENARIO_COLORS,
  deriveResultsKpis, ledgerValue, niceStep, scenarioAnnualValue, useFormatters, weatherSourceLabel,
  type Fmt, type MarketKey,
} from "@/components/ResultsReport";
import "@/styles/print-report.css";
import type { ProjectCalculation } from "../../../server/estimate-service";
import type { FinancialScenario } from "../../../types/solar";

/**
 * A4 document layout of the results page, used for the server PDF (`/p/:id?print=1`) and browser printing.
 * Every figure comes from the same study and KPI derivation as the on-screen results page.
 */
export function PrintReport({ study, scenarioId, language, marketKey, className = "" }: {
  study: ProjectCalculation;
  scenarioId: FinancialScenario["id"] | string;
  language: string;
  marketKey: MarketKey;
  className?: string;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void document.fonts.ready.then(() => setTimeout(() => !cancelled && setReady(true), 300));
    return () => { cancelled = true; };
  }, []);
  const project = study.project;
  const market = (project?.market ?? marketKey) as MarketKey;
  const region = project?.region ?? MARKET_REGION[market];
  const f = useFormatters(language, project?.currency ?? MARKET_CURRENCY[market]);
  const { t } = f;
  const scenario = study.result.scenarios.find((item) => item.id === scenarioId)
    ?? study.result.scenarios.find((item) => item.id === (scenarioId === "solar-battery" ? "solar-battery" : "solar-only"))
    ?? study.result.scenarios[0]!;
  const kpis = deriveResultsKpis(study, scenario.id);
  const range = study.result.range;
  const surfaces = study.result.surfaces.slice().sort((a, b) => b.annualKwh - a.annualKwh);
  const sim = study.simulation;
  const solar = study.googleSolar;
  const front = Math.round(project?.frontAzimuthDeg ?? sim.buildingNorthDeg);
  const typeId = project?.buildingTypeId;
  const created = new Date(study.createdAt).toLocaleDateString(t.locale, { day: "2-digit", month: "long", year: "numeric" });

  return <article className={`print-report ${ready ? "is-ready" : ""} ${className}`.trim()} lang={t.locale}>
    <header className="pr-masthead">
      <div className="pr-brand"><Leaf size={18} /><span>MODERNITÉ<small>Building integrated solar</small></span></div>
      <div className="pr-reference"><span>{t.reference}</span><strong>{study.caseId}</strong><small>{created}</small></div>
    </header>

    <section className="pr-cover">
      <p className="pr-eyebrow">{t.eyebrow}</p>
      <h1>{t.title}</h1>
      <p className="pr-lede">{t.intro}</p>
    </section>

    <dl className="pr-project">
      <div><dt>{t.site}</dt><dd>{project?.address ?? t.regions[region]}<small>{t.regions[region]}</small></dd></div>
      <div><dt>{t.building}</dt><dd>{typeId ? `${typeId} · ${buildingTypeLabel(typeId, language)}` : "—"}{project && <small>{t.dims(f.n(project.building.width, 1), f.n(project.building.depth, 1), project.building.floors)} · {t.facing(front, f.compass(front))}</small>}</dd></div>
      {project && <div><dt>{t.heating}</dt><dd>{t.heatModes[project.heatMode]}{(project.electricHotWater || project.evCharger) && <small>{[project.electricHotWater ? t.extras.hotWater : "", project.evCharger ? t.extras.ev : ""].filter(Boolean).join(" · ")}</small>}</dd></div>}
      <div><dt>{t.scenario}</dt><dd>{t.scenarioTitles[scenario.id]}<small>{scenario.available ? t.scenarioSub : t.planningComparison}</small></dd></div>
    </dl>

    <section className="pr-kpis">
      <div className="pr-kpi is-primary">
        <span>{t.heroLabel}</span>
        <strong>{f.n(range.representative)}<small>{t.perYear}</small></strong>
        <em>{t.rangeTitle}: {f.n(range.low)} – {f.n(range.high)}</em>
      </div>
      <div className="pr-kpi">
        <span>{t.estimatedValue}</span>
        <strong>{f.money(scenarioAnnualValue(scenario))}<small>{t.perYearMoney}</small></strong>
        <em>{scenario.breakEvenYear ? t.breakEvenSimple(scenario.breakEvenYear) : t.longTerm}</em>
      </div>
      <div className="pr-kpi">
        <span>{t.solarOnSite}</span>
        <strong>{kpis.solarCoveragePercent}%</strong>
        <em>{t.selfUse(kpis.pvSelfConsumptionPercent, kpis.solarCoveragePercent)}</em>
      </div>
      <div className="pr-kpi">
        <span>{t.capacity}</span>
        <strong>{f.n(study.result.totalCapacityKwp, 2)}<small>kWp</small></strong>
        <em>{t.activeSurfaces(study.result.surfaces.length)}</em>
      </div>
    </section>

    <EnergyBalance study={study} scenario={scenario} f={f} />

    <section className="pr-section pr-keep">
      <Heading label={t.monthlyLabel} title={t.monthlyTitle} aside={`${f.n(range.representative)} ${t.perYear}`} />
      <MonthlyChart study={study} f={f} />
      <p className="pr-note">{t.monthlyNote}</p>
    </section>

    <section className="pr-section pr-keep">
      <Heading label={t.scenarioLabel} title={t.cashTitle} aside={t.view25} />
      <ScenarioTable scenarios={study.result.scenarios} selected={scenario} f={f} />
      <CashChart scenarios={study.result.scenarios} selected={scenario} f={f} />
      <p className="pr-note">{t.scenarioNote} {t.cashDisclaimer}</p>
    </section>

    <SystemAndCarbon study={study} region={region} f={f} />

    <section className="pr-section">
      <Heading label={t.surfacesLabel} title={t.surfacesTitle} />
      <table className="pr-table">
        <thead><tr><th>{t.colSurface}</th><th>{t.colOrientation}</th><th className="num">{t.colArea}</th><th className="num">{t.colCapacity}</th><th className="num">{t.colYield}</th><th className="num">{t.colGeneration}</th></tr></thead>
        <tbody>{surfaces.map((surface) => <tr key={surface.surfaceId}>
          <td><strong>{surface.surfaceLabel}</strong><small>{surface.productName}{surface.finishName ? ` · ${surface.finishName}` : ""}</small></td>
          <td>{t.orientations[surface.orientationName]} · {f.n(surface.azimuthDeg)}° / {f.n(surface.tiltDeg)}°</td>
          <td className="num">{f.n(surface.areaM2, 1)} m²</td>
          <td className="num">{f.n(surface.capacityKwp, 2)} kWp</td>
          <td className="num">{f.n(surface.specificYield)} kWh/kWp</td>
          <td className="num"><b>{f.n(surface.annualKwh)} kWh</b></td>
        </tr>)}
        <tr className="is-total">
          <td colSpan={2}>{t.surfacesValue(surfaces.length)}</td>
          <td className="num">{f.n(surfaces.reduce((sum, s) => sum + s.areaM2, 0), 1)} m²</td>
          <td className="num">{f.n(study.result.totalCapacityKwp, 2)} kWp</td>
          <td />
          <td className="num"><b>{f.n(surfaces.reduce((sum, s) => sum + s.annualKwh, 0))} kWh</b></td>
        </tr></tbody>
      </table>
      {surfaces[0] && <p className="pr-note">{t.largest(surfaces[0].surfaceLabel, f.n(surfaces[0].annualKwh))}</p>}
    </section>

    {study.result.schedule.length > 0 && <section className="pr-section">
      <Heading label={t.scheduleLabel} title={t.scheduleTitle} />
      <table className="pr-table">
        <thead><tr><th>{t.colProduct}</th><th className="num">{t.colArea}</th><th className="num">{t.colPeak}</th><th className="num">{t.colCapacity}</th></tr></thead>
        <tbody>{study.result.schedule.map((line) => <tr key={line.productId}>
          <td><strong>{line.productName}</strong><small>{line.surfaceNames.length} × {t.colSurface}</small></td>
          <td className="num">{f.n(line.totalAreaM2, 1)} m²</td>
          <td className="num">{f.n(line.peakPowerWpM2)} Wp/m²</td>
          <td className="num"><b>{f.n(line.totalCapacityKwp, 2)} kWp</b></td>
        </tr>)}</tbody>
      </table>
    </section>}

    <section className="pr-section pr-keep">
      <Heading label={t.basisLabel} title={t.basisTitle[study.weather.kind]} aside={study.weather.kind === "customer-synthetic" ? t.indicative : t.siteWeather} />
      <dl className="pr-facts">
        <div><dt>{t.annualGeneration}</dt><dd>{f.n(study.validation.empiricalAnnualKwh)} {t.perYear}</dd></div>
        <div><dt>{t.hourlyWeather}</dt><dd>{weatherSourceLabel(study.weather.kind, study.weather.source, study.weather.name, t)}</dd></div>
        <div><dt>{t.irradiation}</dt><dd>GHI {f.n(study.weather.annualGhiKwhM2)} · DNI {f.n(study.weather.annualDniKwhM2)} · DHI {f.n(study.weather.annualDhiKwhM2)} kWh/m²</dd></div>
        <div><dt>{t.solarOnSite}</dt><dd>{t.selfUse(kpis.pvSelfConsumptionPercent, kpis.solarCoveragePercent)}</dd></div>
        {scenario.id === "solar-battery" && <div><dt>{t.withBattery(sim.battery.nominalKwh)}</dt><dd>{t.usedOnSite(f.n(sim.battery.selfConsumedKwh))}</dd></div>}
        <div><dt>{t.meanTemp}</dt><dd>{f.n(study.weather.meanAirTemperatureC, 1)} °C</dd></div>
      </dl>
      <p className="pr-note">{study.weather.kind === "customer-synthetic" ? t.basisSynthetic : t.basisSite(study.weather.source, study.weather.hours)}</p>
    </section>

    {solar?.status === "ok" && <section className="pr-section pr-keep">
      <Heading label={t.extLabel} title={t.googleTitle} aside={t.imagery(solar.imageryQuality ?? "")} />
      <dl className="pr-facts">
        <div><dt>{t.roofSegments}</dt><dd>{solar.roofSegments?.length ?? 0}</dd></div>
        <div><dt>{t.usableArea}</dt><dd>{solar.maxArrayAreaM2 ?? "—"} m²</dd></div>
        <div><dt>{t.peakSunshine}</dt><dd>{solar.maxSunshineHoursPerYear ?? "—"} {t.hoursYear}</dd></div>
      </dl>
      <p className="pr-note">{t.googleOk}{solar.distanceM !== undefined ? ` ${t.nearest(solar.distanceM)}` : ""}</p>
    </section>}

    <section className="pr-section">
      <Heading label={t.ledgerLabel} title={t.ledgerTitle} />
      <dl className="pr-ledger">{study.result.ledger.map((entry) => <div key={entry.id}>
        <dt>{t.ledger[entry.id] ?? entry.label}<small>{t.provenance[entry.provenance] ?? entry.provenance}</small></dt>
        <dd>{ledgerValue(entry, f)}</dd>
      </div>)}</dl>
    </section>

    <footer className="pr-closing">
      <p>{t.chainNote}</p>
    </footer>
  </article>;
}

function Heading({ label, title, aside }: { label: string; title: string; aside?: string }) {
  return <div className="pr-heading">
    <div><p>{label}</p><h2>{title}</h2></div>
    {aside && <span>{aside}</span>}
  </div>;
}

function EnergyBalance({ study, scenario, f }: { study: ProjectCalculation; scenario: FinancialScenario; f: Fmt }) {
  const { t } = f;
  const kpis = deriveResultsKpis(study, scenario.id);
  const parts = [
    { key: "home", label: t.usedHome, value: kpis.directSolarKwh, color: "#0b6047", detail: t.usedHomeDetail },
    { key: "battery", label: t.batteryShift, value: kpis.batteryToLoadKwh, color: "#e3ac2f", detail: scenario.id === "solar-battery" ? t.batteryShiftOn : t.batteryShiftOff },
    { key: "export", label: t.exported, value: kpis.exportKwh, color: "#9cc884", detail: t.exportedDetail },
  ];
  const total = Math.max(1, parts.reduce((sum, part) => sum + part.value, 0));
  return <section className="pr-section pr-keep pr-balance">
    <Heading label={t.flowLabel} title={t.flowTitle} aside={`${f.n(study.result.range.representative)} ${t.perYear}`} />
    <div className="pr-balance-bar">{parts.filter((part) => part.value > 0).map((part) => <i key={part.key} style={{ width: `${(part.value / total) * 100}%`, background: part.color }} />)}</div>
    <div className="pr-balance-legend">{parts.map((part) => <div key={part.key}>
      <i style={{ background: part.color }} />
      <span>{part.label}</span>
      <strong>{f.n(part.value)} kWh <small>{Math.round((part.value / total) * 100)}%</small></strong>
      <em>{part.detail}</em>
    </div>)}</div>
    <p className="pr-note">{t.demandLabel}: {f.n(study.energy.annualDemandKwh)} {t.perYear} · {study.energy.source === "bill" ? t.demandNoteBill : study.energy.source === "household" ? t.demandNoteHousehold : t.demandNoteModel} {t.chainDetail(kpis.solarCoveragePercent, kpis.pvSelfConsumptionPercent)}</p>
  </section>;
}

function MonthlyChart({ study, f }: { study: ProjectCalculation; f: Fmt }) {
  const { t } = f;
  const entries = study.result.monthlyByOrientation;
  const step = niceStep(Math.max(1, ...entries.map((entry) => entry.total)), 4);
  const max = Math.max(step, Math.ceil(Math.max(1, ...entries.map((entry) => entry.total)) / step) * step);
  const W = 720, H = 250, left = 52, right = 708, top = 18, bottom = 214;
  const slot = (right - left) / 12, bar = slot * 0.62;
  const yAt = (value: number) => bottom - (value / max) * (bottom - top);
  const present = ORIENTATION_SERIES.filter(([key]) => entries.some((entry) => entry[key] > 0));
  return <>
    <svg className="pr-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t.monthlyTitle}>
      {Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step).map((tick) => <g key={tick}>
        <line x1={left} x2={right} y1={yAt(tick)} y2={yAt(tick)} className={tick === 0 ? "axis" : "grid"} />
        <text x={left - 8} y={yAt(tick) + 3.5} textAnchor="end" className="tick">{f.n(tick)}</text>
      </g>)}
      {entries.map((entry, index) => {
        const x = left + index * slot + (slot - bar) / 2;
        let y = bottom;
        return <g key={entry.month}>
          {ORIENTATION_SERIES.map(([key, color]) => {
            const height = (entry[key] / max) * (bottom - top);
            y -= height;
            return height > 0.3 ? <rect key={key} x={x} y={y} width={bar} height={height} fill={color} /> : null;
          })}
          <text x={x + bar / 2} y={yAt(entry.total) - 5} textAnchor="middle" className="value">{f.n(entry.total)}</text>
          <text x={x + bar / 2} y={bottom + 16} textAnchor="middle" className="tick">{f.month(index)}</text>
        </g>;
      })}
      <text x={left - 8} y={top - 6} textAnchor="end" className="tick">kWh</text>
    </svg>
    <div className="pr-legend">{present.map(([key, color]) => <span key={key}><i style={{ background: color }} />{t.orientations[key]}</span>)}</div>
  </>;
}

function ScenarioTable({ scenarios, selected, f }: { scenarios: FinancialScenario[]; selected: FinancialScenario; f: Fmt }) {
  const { t } = f;
  const rows = scenarios.filter((item) => item.id !== "battery-only");
  return <table className="pr-table pr-scenarios">
    <thead><tr><th>{t.scenario}</th><th className="num">{t.upfrontCost}</th><th className="num">{t.firstYearBenefit}</th><th className="num">{t.estimatedValue}</th><th className="num">{t.year25Cumulative}</th></tr></thead>
    <tbody>{rows.map((item) => <tr key={item.id} className={item.id === selected.id ? "is-selected" : ""}>
      <td><strong><i style={{ background: SCENARIO_COLORS[item.id] }} />{t.scenarioTitles[item.id]}</strong><small>{item.available ? (item.breakEvenYear ? t.breakEvenYear(item.breakEvenYear) : t.noBreakEven) : t.planningComparison}</small></td>
      {item.available ? <>
        <td className="num">{f.money(item.upfrontGbp)}</td>
        <td className="num">{f.money(item.firstYearBenefitGbp)}</td>
        <td className="num">{f.money(scenarioAnnualValue(item))}</td>
        <td className="num"><b>{f.money(item.net25YearGbp)}</b></td>
      </> : <td colSpan={4} className="muted">{t.unavailable[item.id]}</td>}
    </tr>)}</tbody>
  </table>;
}

function CashChart({ scenarios, selected, f }: { scenarios: FinancialScenario[]; selected: FinancialScenario; f: Fmt }) {
  const { t } = f;
  const visible = scenarios.filter((item) => item.id !== "battery-only" && item.available && item.annualCashFlows.length > 0);
  if (!visible.length) return null;
  const W = 720, H = 230, left = 70, right = 708, top = 16, bottom = 196;
  const years = Math.max(1, ...visible.map((item) => item.annualCashFlows.length));
  const values = visible.flatMap((item) => item.annualCashFlows.map((flow) => flow.cumulativeNetGbp));
  const step = niceStep(Math.max(1, Math.max(0, ...values) - Math.min(0, ...values)), 4);
  const yMin = Math.floor(Math.min(0, ...values) / step) * step;
  const yMax = Math.max(step, Math.ceil(Math.max(0, ...values) / step) * step);
  const xAt = (index: number) => left + (index / Math.max(1, years - 1)) * (right - left);
  const yAt = (value: number) => bottom - ((value - yMin) / (yMax - yMin)) * (bottom - top);
  const ticks = Array.from({ length: Math.round((yMax - yMin) / step) + 1 }, (_, i) => yMin + i * step);
  return <>
    <svg className="pr-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t.cashTitle}>
      {ticks.map((tick) => <g key={tick}>
        <line x1={left} x2={right} y1={yAt(tick)} y2={yAt(tick)} className={tick === 0 ? "axis" : "grid"} />
        <text x={left - 8} y={yAt(tick) + 3.5} textAnchor="end" className="tick">{tick === 0 ? "0" : f.moneyCompact(tick)}</text>
      </g>)}
      {[1, 5, 10, 15, 20, 25].filter((year) => year <= years).map((year) => <text key={year} x={xAt(year - 1)} y={bottom + 18} textAnchor={year === 1 ? "start" : year === years ? "end" : "middle"} className="tick">{t.year(year)}</text>)}
      {visible.map((item) => <polyline key={item.id} fill="none" stroke={SCENARIO_COLORS[item.id]} strokeWidth={item.id === selected.id ? 2.6 : 1.6} strokeDasharray={item.id === selected.id ? undefined : "5 4"}
        points={item.annualCashFlows.map((flow, index) => `${xAt(index).toFixed(1)},${yAt(flow.cumulativeNetGbp).toFixed(1)}`).join(" ")} />)}
      {visible.map((item) => {
        const index = item.annualCashFlows.findIndex((flow) => flow.cumulativeNetGbp >= 0);
        if (index <= 0) return null;
        const before = item.annualCashFlows[index - 1]!.cumulativeNetGbp, after = item.annualCashFlows[index]!.cumulativeNetGbp;
        const x = xAt(index - 1 + (0 - before) / Math.max(1e-9, after - before));
        return <circle key={item.id} cx={x} cy={yAt(0)} r={3.6} fill={SCENARIO_COLORS[item.id]} />;
      })}
    </svg>
    <div className="pr-legend">{visible.map((item) => <span key={item.id}><i style={{ background: SCENARIO_COLORS[item.id] }} />{t.scenarioTitles[item.id]}{item.breakEvenYear ? ` · ${t.breakEvenYear(item.breakEvenYear)}` : ""}</span>)}</div>
  </>;
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
  return <div className="pr-columns pr-keep">
    <section className="pr-section">
      <Heading label={t.systemLabel} title={t.systemTitle} />
      <dl className="pr-facts is-stacked">
        <div><dt>{t.inverter}</dt><dd>{t.inverterValue(rec.inverterKw)}</dd></div>
        <div><dt>{t.peakAc}</dt><dd>{f.n(sim.peakAcKw, 2)} kW</dd></div>
        <div><dt>{t.mppt}</dt><dd>{split ? t.mpptSplit : t.mpptShared}</dd></div>
        <div><dt>{t.battery}</dt><dd>{f.n(rec.batteryCapacityKwh, 1)} kWh</dd></div>
      </dl>
      <ul className="pr-bullets">{t.installerNotes.map((note) => <li key={note}>{note}</li>)}</ul>
    </section>
    <section className="pr-section">
      <Heading label={t.carbonLabel} title={t.carbonTitle} />
      <div className="pr-carbon">
        <div><span>{t.co2Year}</span><strong>{f.n(firstYearT, 1)} t</strong></div>
        <div><span>{t.co2Life}</span><strong>{f.n(lifeT, 0)} t</strong></div>
      </div>
      <p className="pr-note">{t.carbonNote(factor)}</p>
    </section>
  </div>;
}
