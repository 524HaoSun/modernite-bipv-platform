import { useEffect, useMemo, useRef, useState } from "react";
import { geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import worldTopology from "world-atlas/countries-110m.json";
import { ArrowLeft, ArrowRight, Compass, Globe2, Minus, Plus, RotateCcw, Search } from "lucide-react";
import type { Market, MarketKey } from "@/components/ProjectLocationMap";
import { europeName, regionName } from "@/lib/region-names";

export type EuropeanMarket = {
  id: number;
  name: string;
  shortName: string;
  coordinates: { lat: number; lng: number };
};

export type MarketAtlasCopy = {
  coverage: string;
  dragHint: string;
  location: string;
  library: string;
  selected: string;
  selectCountry: string;
  selectedCountry: string;
  countriesAvailable: string;
  chooseMarket: string;
  chooseCountry: string;
  continue: string;
  world: string;
  europe: string;
  europeDirectory: string;
  filterCountries: string;
  resetGlobe: string;
  available: string;
  selectedTag: string;
  unavailable: string;
  studyNote: string;
  marketsAria: string;
  globeAria: string;
  selectAria: (name: string) => string;
};

type WorldFeature = { id?: string | number; properties?: { name?: string } };
type WorldTopology = { objects: { countries: unknown } };
type ProjectedFeature = WorldFeature & { path: string };
type Rotation = [number, number, number];

const WORLD_TOPOLOGY = worldTopology as unknown as WorldTopology;
const WORLD_FEATURES = feature(WORLD_TOPOLOGY as never, WORLD_TOPOLOGY.objects.countries as never) as unknown as { features: WorldFeature[] };

export const EUROPEAN_MARKETS: EuropeanMarket[] = [
  { id: 20, name: "Andorra", shortName: "AD", coordinates: { lat: 42.51, lng: 1.52 } },
  { id: 40, name: "Austria", shortName: "AT", coordinates: { lat: 47.52, lng: 14.55 } },
  { id: 56, name: "Belgium", shortName: "BE", coordinates: { lat: 50.5, lng: 4.47 } },
  { id: 70, name: "Bosnia and Herzegovina", shortName: "BA", coordinates: { lat: 43.91, lng: 17.67 } },
  { id: 100, name: "Bulgaria", shortName: "BG", coordinates: { lat: 42.73, lng: 25.48 } },
  { id: 112, name: "Belarus", shortName: "BY", coordinates: { lat: 53.71, lng: 27.95 } },
  { id: 191, name: "Croatia", shortName: "HR", coordinates: { lat: 45.1, lng: 15.2 } },
  { id: 196, name: "Cyprus", shortName: "CY", coordinates: { lat: 35.13, lng: 33.43 } },
  { id: 203, name: "Czechia", shortName: "CZ", coordinates: { lat: 49.82, lng: 15.47 } },
  { id: 208, name: "Denmark", shortName: "DK", coordinates: { lat: 56.26, lng: 9.5 } },
  { id: 233, name: "Estonia", shortName: "EE", coordinates: { lat: 58.6, lng: 25 } },
  { id: 246, name: "Finland", shortName: "FI", coordinates: { lat: 61.92, lng: 25.75 } },
  { id: 250, name: "France", shortName: "FR", coordinates: { lat: 46.23, lng: 2.21 } },
  { id: 276, name: "Germany", shortName: "DE", coordinates: { lat: 51.16, lng: 10.45 } },
  { id: 300, name: "Greece", shortName: "GR", coordinates: { lat: 39.07, lng: 21.82 } },
  { id: 336, name: "Vatican City", shortName: "VA", coordinates: { lat: 41.9, lng: 12.45 } },
  { id: 348, name: "Hungary", shortName: "HU", coordinates: { lat: 47.16, lng: 19.5 } },
  { id: 352, name: "Iceland", shortName: "IS", coordinates: { lat: 64.96, lng: -19.02 } },
  { id: 372, name: "Ireland", shortName: "IE", coordinates: { lat: 53.14, lng: -7.69 } },
  { id: 380, name: "Italy", shortName: "IT", coordinates: { lat: 41.87, lng: 12.57 } },
  { id: 383, name: "Kosovo", shortName: "XK", coordinates: { lat: 42.6, lng: 20.9 } },
  { id: 428, name: "Latvia", shortName: "LV", coordinates: { lat: 56.88, lng: 24.6 } },
  { id: 438, name: "Liechtenstein", shortName: "LI", coordinates: { lat: 47.17, lng: 9.56 } },
  { id: 440, name: "Lithuania", shortName: "LT", coordinates: { lat: 55.17, lng: 23.88 } },
  { id: 442, name: "Luxembourg", shortName: "LU", coordinates: { lat: 49.82, lng: 6.13 } },
  { id: 470, name: "Malta", shortName: "MT", coordinates: { lat: 35.94, lng: 14.38 } },
  { id: 492, name: "Monaco", shortName: "MC", coordinates: { lat: 43.74, lng: 7.42 } },
  { id: 498, name: "Moldova", shortName: "MD", coordinates: { lat: 47.41, lng: 28.37 } },
  { id: 499, name: "Montenegro", shortName: "ME", coordinates: { lat: 42.7, lng: 19.37 } },
  { id: 528, name: "Netherlands", shortName: "NL", coordinates: { lat: 52.13, lng: 5.29 } },
  { id: 578, name: "Norway", shortName: "NO", coordinates: { lat: 60.47, lng: 8.47 } },
  { id: 616, name: "Poland", shortName: "PL", coordinates: { lat: 51.92, lng: 19.15 } },
  { id: 620, name: "Portugal", shortName: "PT", coordinates: { lat: 39.4, lng: -8.22 } },
  { id: 642, name: "Romania", shortName: "RO", coordinates: { lat: 45.94, lng: 24.97 } },
  { id: 674, name: "San Marino", shortName: "SM", coordinates: { lat: 43.94, lng: 12.46 } },
  { id: 688, name: "Serbia", shortName: "RS", coordinates: { lat: 44.01, lng: 21 } },
  { id: 703, name: "Slovakia", shortName: "SK", coordinates: { lat: 48.67, lng: 19.7 } },
  { id: 705, name: "Slovenia", shortName: "SI", coordinates: { lat: 46.15, lng: 14.99 } },
  { id: 724, name: "Spain", shortName: "ES", coordinates: { lat: 40.46, lng: -3.75 } },
  { id: 752, name: "Sweden", shortName: "SE", coordinates: { lat: 60.13, lng: 18.64 } },
  { id: 756, name: "Switzerland", shortName: "CH", coordinates: { lat: 46.81, lng: 8.22 } },
  { id: 792, name: "Turkey", shortName: "TR", coordinates: { lat: 39.93, lng: 32.86 } },
  { id: 804, name: "Ukraine", shortName: "UA", coordinates: { lat: 48.38, lng: 31.17 } },
  { id: 807, name: "North Macedonia", shortName: "MK", coordinates: { lat: 41.61, lng: 21.75 } },
];

const MARKET_NODES: Array<{ key: MarketKey; id?: number; code: string; name: string; coordinates: [number, number] }> = [
  { key: "GB", id: 826, code: "UK", name: "United Kingdom", coordinates: [-3.1, 54.5] },
  { key: "EU", code: "EU", name: "Europe", coordinates: [10.5, 50.5] },
  { key: "CA", id: 124, code: "CA", name: "Canada", coordinates: [-106.3, 56.1] },
  { key: "JP", id: 392, code: "JP", name: "Japan", coordinates: [138.3, 36.2] },
];

const MARKET_CONFIG: Record<Exclude<MarketKey, "EU">, Market> = {
  GB: { key: "GB", name: "United Kingdom", shortName: "UK", coordinates: { lat: 54.5, lng: -3.1 }, zoom: 5.6 },
  CA: { key: "CA", name: "Canada", shortName: "CA", coordinates: { lat: 56.1, lng: -106.3 }, zoom: 3.8 },
  JP: { key: "JP", name: "Japan", shortName: "JP", coordinates: { lat: 36.2, lng: 138.3 }, zoom: 4.7 },
};

const EUROPE_IDS = new Set(EUROPEAN_MARKETS.map((country) => country.id));
const SELECTABLE_IDS = new Set<number>([826, 124, 392, ...Array.from(EUROPE_IDS)]);
const DEFAULT_ROTATION: Rotation = [8, -28, 0];
const EUROPE_ROTATION: Rotation = [-12, -51, 0];

function numericId(item: WorldFeature): number { return Number(item.id ?? -1); }
function degrees(value: number): number { return value * Math.PI / 180; }
function marketVisible(coordinates: [number, number], rotation: Rotation): boolean {
  const [longitude, latitude] = coordinates;
  const centralLongitude = -rotation[0];
  const centralLatitude = -rotation[1];
  const cosine = Math.sin(degrees(latitude)) * Math.sin(degrees(centralLatitude))
    + Math.cos(degrees(latitude)) * Math.cos(degrees(centralLatitude)) * Math.cos(degrees(longitude - centralLongitude));
  return cosine > 0.13;
}
function clamp(value: number, min: number, max: number): number { return Math.min(Math.max(value, min), max); }
function shortestAngle(from: number, to: number): number { return ((to - from + 540) % 360) - 180; }

function useGlobeProjection(rotation: Rotation, scale: number) {
  return useMemo(() => {
    const projection = geoOrthographic().translate([350, 350]).scale(scale).rotate(rotation).clipAngle(90.1).precision(0.45);
    const path = geoPath(projection);
    const countries = WORLD_FEATURES.features.map((item) => ({ ...item, path: path(item as never) ?? "" })) as ProjectedFeature[];
    return { projection, path, countries, sphere: path({ type: "Sphere" } as never), graticule: path(geoGraticule10() as never) };
  }, [rotation, scale]);
}

type GlobeHover = { name: string; code: string; key: MarketKey; x: number; y: number };

function flagImageCode(code: string): string {
  if (code === "UK") return "gb";
  if (code === "EU") return "eu";
  return code.toLowerCase();
}

function FlagIcon({ code }: { code: string }) {
  return <span className="country-flag" aria-hidden="true"><img src={`https://flagcdn.com/w40/${flagImageCode(code)}.png`} alt="" loading="lazy" /></span>;
}

const DEFAULT_EUROPEAN_MARKET = EUROPEAN_MARKETS.find((country) => country.shortName === "FR") ?? EUROPEAN_MARKETS[0]!;

function RotatableGlobe({ market, europeanCountry, onMarketSelect, onEuropeanSelect, copy, language }: {
  language: string;
  market: Market;
  europeanCountry: EuropeanMarket | null;
  onMarketSelect: (key: MarketKey) => void;
  onEuropeanSelect: (country: EuropeanMarket) => void;
  copy: MarketAtlasCopy;
}) {
  const [rotation, setRotation] = useState<Rotation>(market.key === "EU" ? EUROPE_ROTATION : DEFAULT_ROTATION);
  const [scale, setScale] = useState(305);
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState<GlobeHover | null>(null);
  const pointerOrigin = useRef<{ x: number; y: number; rotation: Rotation; moved: boolean; marketKey: MarketKey | null; countryId: number | null } | null>(null);
  const flightFrame = useRef<number | null>(null);
  const { projection, countries, sphere, graticule } = useGlobeProjection(rotation, scale);
  const selectedCountryId = market.key === "EU" ? europeanCountry?.id : MARKET_NODES.find((node) => node.key === market.key)?.id;
  const isEuropeView = market.key === "EU";

  useEffect(() => () => {
    if (flightFrame.current) window.cancelAnimationFrame(flightFrame.current);
  }, []);

  const flyTo = (targetRotation: Rotation, targetScale = 318) => {
    if (flightFrame.current) window.cancelAnimationFrame(flightFrame.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRotation(targetRotation);
      setScale(targetScale);
      return;
    }
    const originRotation = rotation;
    const originScale = scale;
    const startedAt = performance.now();
    const duration = 680;
    const step = (now: number) => {
      const progress = clamp((now - startedAt) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setRotation([
        originRotation[0] + shortestAngle(originRotation[0], targetRotation[0]) * eased,
        originRotation[1] + (targetRotation[1] - originRotation[1]) * eased,
        0,
      ]);
      setScale(originScale + (targetScale - originScale) * eased);
      if (progress < 1) flightFrame.current = window.requestAnimationFrame(step);
      else flightFrame.current = null;
    };
    flightFrame.current = window.requestAnimationFrame(step);
  };

  const chooseMarket = (key: MarketKey) => {
    setHover(null);
    if (key === "EU") {
      flyTo(EUROPE_ROTATION, 325);
      onMarketSelect("EU");
      return;
    }
    const node = MARKET_NODES.find((item) => item.key === key);
    if (node) flyTo([-node.coordinates[0], -node.coordinates[1], 0], key === "JP" ? 334 : 320);
    onMarketSelect(key);
  };

  const chooseCountry = (country: EuropeanMarket) => {
    setHover(null);
    flyTo([-country.coordinates.lng, -country.coordinates.lat, 0], 332);
    onEuropeanSelect(country);
  };

  const setHoverFromEvent = (event: React.PointerEvent<SVGPathElement>, name: string, code: string, key: MarketKey) => {
    if (dragging) return;
    const bounds = event.currentTarget.ownerSVGElement?.parentElement?.getBoundingClientRect();
    if (!bounds) return;
    setHover({ name, code, key, x: event.clientX - bounds.left, y: event.clientY - bounds.top });
  };

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const target = event.target as Element;
    const marketKey = target.closest("[data-market-key]")?.getAttribute("data-market-key") as MarketKey | null;
    const countryIdAttribute = target.closest("[data-country-id]")?.getAttribute("data-country-id");
    pointerOrigin.current = { x: event.clientX, y: event.clientY, rotation, moved: false, marketKey, countryId: countryIdAttribute ? Number(countryIdAttribute) : null };
    setDragging(true);
  };
  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!pointerOrigin.current) return;
    const offsetX = event.clientX - pointerOrigin.current.x;
    const offsetY = event.clientY - pointerOrigin.current.y;
    if (Math.abs(offsetX) > 5 || Math.abs(offsetY) > 5) {
      pointerOrigin.current.moved = true;
      setHover(null);
    }
    setRotation([pointerOrigin.current.rotation[0] + offsetX * 0.38, clamp(pointerOrigin.current.rotation[1] - offsetY * 0.38, -72, 72), 0]);
  };
  const stopDragging = () => { pointerOrigin.current = null; setDragging(false); };
  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const interaction = pointerOrigin.current;
    pointerOrigin.current = null;
    setDragging(false);
    const countryPath = (event.target as Element).closest<SVGPathElement>(".globe-country.is-covered");
    if (countryPath) window.requestAnimationFrame(() => countryPath.blur());
    if (!interaction || interaction.moved) return;
    if (interaction.countryId !== null && Number.isFinite(interaction.countryId)) {
      const country = EUROPEAN_MARKETS.find((item) => item.id === interaction.countryId);
      if (country) chooseCountry(country);
    } else if (interaction.marketKey) chooseMarket(interaction.marketKey);
  };
  const changeScale = (amount: number) => setScale((current) => clamp(current + amount, 245, 342));
  const onWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    changeScale(event.deltaY > 0 ? -16 : 16);
  };

  return (
    <div className="globe-stage">
      <div className="globe-atmosphere" aria-hidden="true" />
      <div className="globe-market-rail" aria-label={copy.marketsAria}>
        {MARKET_NODES.map((node) => <button type="button" key={node.key} className={`globe-market-rail__item globe-market-rail__item--${node.key} ${market.key === node.key ? "is-selected" : ""}`} onClick={() => chooseMarket(node.key)}><FlagIcon code={node.code} /><span>{regionName(node.code, language, node.name)}</span><i /></button>)}
      </div>
      {hover && <div className={`globe-hover-bubble globe-hover-bubble--${hover.key}`} style={{ left: `${hover.x}px`, top: `${hover.y}px` }}><i /><span><b>{hover.name}</b><small>{hover.code} · {copy.available}</small></span></div>}
      <svg className={`market-globe ${dragging ? "is-dragging" : ""}`} viewBox="0 0 700 700" role="img" aria-label={copy.globeAria} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={stopDragging} onWheel={onWheel}>
        <defs>
          <radialGradient id="globe-ocean" cx="33%" cy="25%" r="75%"><stop offset="0" stopColor="#fbfdf8" /><stop offset=".53" stopColor="#e8f1e6" /><stop offset="1" stopColor="#c8d8c9" /></radialGradient>
          <filter id="globe-shadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="18" stdDeviation="16" floodColor="#28513f" floodOpacity=".19" /></filter>
          <clipPath id="globe-clip"><path d={sphere ?? ""} /></clipPath>
        </defs>
        <path d={sphere ?? ""} className="globe-sphere" filter="url(#globe-shadow)" />
        <g clipPath="url(#globe-clip)">
          <path d={graticule ?? ""} className="globe-graticule" />
          {countries.map((country) => {
            const id = numericId(country);
            const isEuropean = EUROPE_IDS.has(id);
            const marketKey = id === 826 ? "GB" : id === 124 ? "CA" : id === 392 ? "JP" : isEuropean ? "EU" : undefined;
            const marketClass = id === 826 ? "is-uk" : id === 124 ? "is-canada" : id === 392 ? "is-japan" : isEuropean ? "is-europe" : "";
            const active = id === selectedCountryId || (market.key === "EU" && isEuropean && !europeanCountry);
            const selectable = SELECTABLE_IDS.has(id);
            const select = () => {
              if (id === 826) chooseMarket("GB");
              else if (id === 124) chooseMarket("CA");
              else if (id === 392) chooseMarket("JP");
              else if (isEuropean) {
                const european = EUROPEAN_MARKETS.find((item) => item.id === id);
                if (european) chooseCountry(european);
              }
            };
            const european = isEuropean ? EUROPEAN_MARKETS.find((item) => item.id === id) : undefined;
            const node = marketKey ? MARKET_NODES.find((item) => item.key === marketKey) : undefined;
            const name = european ? regionName(european.shortName, language, european.name) : node ? regionName(node.code, language, node.name) : country.properties?.name ?? "";
            const code = isEuropean ? EUROPEAN_MARKETS.find((item) => item.id === id)?.shortName ?? "EU" : marketKey ? MARKET_NODES.find((item) => item.key === marketKey)?.code ?? "" : "";
            return <path key={`${id}-${country.properties?.name ?? "country"}`} d={country.path} data-market-key={marketKey} data-country-id={isEuropean ? id : undefined} className={`globe-country ${selectable ? "is-covered" : ""} ${marketClass} ${active ? "is-active" : ""}`} onClick={selectable ? select : undefined} onPointerEnter={selectable && marketKey ? (event) => setHoverFromEvent(event, name, code, marketKey) : undefined} onPointerMove={selectable && marketKey ? (event) => setHoverFromEvent(event, name, code, marketKey) : undefined} onPointerLeave={() => setHover(null)} role={selectable ? "button" : undefined} tabIndex={selectable ? 0 : -1} aria-label={selectable ? copy.selectAria(name) : undefined} onKeyDown={(event) => { if (selectable && (event.key === "Enter" || event.key === " ")) select(); }} />;
          })}
          <ellipse cx="350" cy="272" rx="205" ry="90" className="globe-light-sweep" />
        </g>
        <path d={sphere ?? ""} className="globe-rim" />
        {isEuropeView && europeanCountry && marketVisible([europeanCountry.coordinates.lng, europeanCountry.coordinates.lat], rotation) && (() => {
          const point = projection([europeanCountry.coordinates.lng, europeanCountry.coordinates.lat]);
          return point ? (
            <g className="globe-selected-beacon" transform={`translate(${point[0]},${point[1]})`}>
              <circle r="14" className="beacon-ring" />
              <circle r="5" className="beacon-core" />
              <rect x="-26" y="-34" width="52" height="22" rx="11" />
              <text y="-19" textAnchor="middle">{europeanCountry.shortName}</text>
            </g>
          ) : null;
        })()}
      </svg>
      <div className="globe-stage-meta">
        <span><i /> {copy.dragHint}</span>
        <div className="globe-zoom-controls" aria-label={copy.dragHint}>
          <button type="button" onClick={() => changeScale(-18)} disabled={scale <= 245} aria-label="−"><Minus size={14} /></button>
          <input type="range" min="245" max="342" step="1" value={scale} onChange={(event) => setScale(Number(event.target.value))} aria-label={copy.dragHint} />
          <button type="button" onClick={() => changeScale(18)} disabled={scale >= 342} aria-label="+"><Plus size={14} /></button>
        </div>
        <button type="button" onClick={() => { setRotation(isEuropeView ? EUROPE_ROTATION : DEFAULT_ROTATION); setScale(305); }} aria-label={copy.resetGlobe}><RotateCcw size={14} /></button>
      </div>
    </div>
  );
}

function MarketLibrary({ market, europeanCountry, onMarketSelect, onEuropeanSelect, copy, language }: {
  language: string;
  market: Market;
  europeanCountry: EuropeanMarket | null;
  onMarketSelect: (key: MarketKey) => void;
  onEuropeanSelect: (country: EuropeanMarket) => void;
  copy: MarketAtlasCopy;
}) {
  const [query, setQuery] = useState("");
  const isEurope = market.key === "EU";
  const filteredEurope = useMemo(() => EUROPEAN_MARKETS.filter((country) => !query.trim() || `${country.name} ${regionName(country.shortName, language, country.name)} ${country.shortName}`.toLowerCase().includes(query.trim().toLowerCase())), [query, language]);

  return (
    <aside className="globe-library">
      <div className="globe-library-heading"><span className="mini-label">{isEurope ? copy.selectCountry : copy.library}</span><span className="globe-library-count">{isEurope ? `${filteredEurope.length} ${copy.countriesAvailable}` : "04"}</span></div>
      {isEurope ? <>
        <label className="globe-library-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.filterCountries} aria-label={copy.filterCountries} /></label>
        <div className="globe-library-list globe-library-list--countries" role="list">
          {filteredEurope.map((country) => <button type="button" key={country.id} role="listitem" className={europeanCountry?.id === country.id ? "is-selected" : ""} onClick={() => onEuropeanSelect(country)}><FlagIcon code={country.shortName} /><span>{regionName(country.shortName, language, country.name)}</span><i /></button>)}
        </div>
      </> : <div className="globe-library-list" role="list">
        {MARKET_NODES.map((node) => <button type="button" key={node.key} role="listitem" className={market.key === node.key ? "is-selected" : ""} onClick={() => onMarketSelect(node.key)}><FlagIcon code={node.code} /><span>{regionName(node.code, language, node.name)}</span><i /></button>)}
      </div>}
      <div className="globe-library-foot"><Compass size={15} /><span>{isEurope && !europeanCountry ? copy.chooseCountry : copy.chooseMarket}</span></div>
    </aside>
  );
}

export function MarketAtlas({ market, europeanCountry, onMarketChange, onEuropeanCountryChange, onContinue, copy, language }: {
  language: string;
  market: Market;
  europeanCountry: EuropeanMarket | null;
  onMarketChange: (market: Market) => void;
  onEuropeanCountryChange: (country: EuropeanMarket | null) => void;
  onContinue: () => void;
  copy: MarketAtlasCopy;
}) {
  const selectMarket = (key: MarketKey) => {
    if (key === "EU") {
      onEuropeanCountryChange(DEFAULT_EUROPEAN_MARKET);
      onMarketChange({ key: "EU", name: DEFAULT_EUROPEAN_MARKET.name, shortName: DEFAULT_EUROPEAN_MARKET.shortName, coordinates: DEFAULT_EUROPEAN_MARKET.coordinates, zoom: 6 });
      return;
    }
    onEuropeanCountryChange(null);
    onMarketChange(MARKET_CONFIG[key]);
  };
  const selectEuropeanCountry = (country: EuropeanMarket) => {
    onEuropeanCountryChange(country);
    onMarketChange({ key: "EU", name: country.name, shortName: country.shortName, coordinates: country.coordinates, zoom: 6 });
  };

  return (
    <section className={`market-globe-workbench ${market.key === "EU" ? "is-europe" : ""}`}>
      <div className="globe-workbench-main">
        <div className="globe-workbench-topline"><span className="atlas-kicker"><Globe2 size={14} /> {copy.coverage}</span><span>{copy.dragHint}</span></div>
        <RotatableGlobe market={market} europeanCountry={europeanCountry} onMarketSelect={selectMarket} onEuropeanSelect={selectEuropeanCountry} copy={copy} language={language} />
      </div>
      {market.key === "EU" && <MarketLibrary market={market} europeanCountry={europeanCountry} onMarketSelect={selectMarket} onEuropeanSelect={selectEuropeanCountry} copy={copy} language={language} />}
      <footer className="globe-workbench-footer globe-workbench-footer--compact">
        <div className="market-next-action">
          <span className="market-next-action__market">
            <small>{market.key === "EU" ? copy.selectedCountry : copy.selected}</small>
            <b><FlagIcon code={market.shortName} />{regionName(market.shortName, language, market.name)}{market.key === "EU" ? ` · ${europeName(language)}` : ""}</b>
          </span>
          <button type="button" className="button-primary" onClick={onContinue} disabled={market.key === "EU" && !europeanCountry}>
            <span><small>{copy.location}</small>{copy.continue}</span><ArrowRight size={17} />
          </button>
        </div>
      </footer>
    </section>
  );
}

export { MARKET_NODES };
