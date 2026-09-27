import fs from "node:fs";

const path = "/home/ubuntu/modernite-bipv-platform/client/src/App.tsx";
let source = fs.readFileSync(path, "utf8");
source = source.replace('import { BuildingCanvas } from "./components/BuildingCanvas";', 'import { BuildingCanvas } from "./components/BuildingCanvas";\nimport { LocationMap } from "./components/LocationMap";');
const start = source.indexOf("function LocationPage() {");
const end = source.indexOf("\nfunction BuildingPage()", start);
if (start < 0 || end < 0) throw new Error("LocationPage block not found");
const replacement = `function LocationPage() {
  const state = useDesignStore();
  const language = state.language;
  const [, navigate] = useLocation();
  const { location } = state;
  const config = REGION_CONFIG[location.region];
  const dimensionsFootprint = () => state.setDimensions(state.building.widthM, state.building.depthM);
  const invalid = location.footprint.length > 2 && (isSelfIntersecting(location.footprint) || location.footprintAreaM2 < 5 || location.footprintAreaM2 > 3000);
  const updateFootprint = (points: { lat: number; lng: number }[]) => state.setFootprint(points, "traced");
  return <StepLayout active={0}>
    <section className="page-head"><h2>{t(language, "location.title")}</h2><p>{t(language, "location.lead")}</p></section>
    <div className="region-grid">{(["UK", "EU", "CA", "JP"] as Region[]).map((region) => <button key={region} className={location.region === region ? "region-card selected" : "region-card"} onClick={() => state.setRegion(region)}><span>{region}</span><strong>{t(language, \`location.\${region.toLowerCase()}\`)}</strong><small>{t(language, \`location.\${region.toLowerCase()}_detail\`)}</small></button>)}</div>
    <div className="location-grid">
      <section className="card location-controls">
        <div className="live-card-heading"><span>01 / PROPERTY INPUT</span><b>Define your site</b></div>
        <label>{t(language, "location.address")}<div className="input-row"><input value={location.label ?? ""} placeholder={t(language, "location.address_placeholder")} onChange={(e) => state.setLocation({ label: e.target.value, locality: e.target.value })} /><button className="icon-button" title={t(language, "location.search")} onClick={() => state.setLocation({ lat: config.initialMap.lat, lng: config.initialMap.lng })}><MapPin size={17} /></button></div></label>
        <div className="mode-grid"><button className={location.measureMode === "traced" ? "mode active" : "mode"} onClick={() => state.setLocation({ measureMode: "traced" })}><Edit3 size={18} />{t(language, "location.trace")}</button><button className={location.measureMode === "typed" ? "mode active" : "mode"} onClick={() => state.setLocation({ measureMode: "typed" })}><Layers3 size={18} />{t(language, "location.dimensions")}</button><button className={location.measureMode === "ground" ? "mode active" : "mode"} onClick={() => state.setLocation({ measureMode: "ground" })}><Sun size={18} />{t(language, "location.ground")}</button></div>
        {location.measureMode === "typed" && <div className="two-fields"><label>{t(language, "location.width")}<input type="number" min="1" value={state.building.widthM} onChange={(e) => state.setDimensions(Number(e.target.value), state.building.depthM)} /></label><label>{t(language, "location.depth")}<input type="number" min="1" value={state.building.depthM} onChange={(e) => state.setDimensions(state.building.widthM, Number(e.target.value))} /></label><button className="secondary" onClick={dimensionsFootprint}>{t(language, "location.create_outline")}</button></div>}
        <div className="measurement"><span>{t(language, "location.area")}<b>{numberFor(language, location.footprintAreaM2, 1)} m²</b></span><span>{t(language, "location.vertices")}<b>{location.footprint.length}</b></span><span>{t(language, "location.orientation")}<b>{compassName(180)}</b></span></div>
        {invalid && <p className="notice danger">{t(language, "location.invalid_area")}</p>}
        <p className="notice"><CircleHelp size={15} />{t(language, "location.map_notice")}</p>
      </section>
      <section className="location-map-panel"><LocationMap center={{ lat: location.lat, lng: location.lng }} footprint={location.footprint} onFootprintChange={updateFootprint} /></section>
    </div>
    <div className="page-actions"><BackButton to="/" /><button className="primary" disabled={invalid || location.footprintAreaM2 < 5} onClick={() => navigate("/building")}>{t(language, "location.next")}<ArrowRight size={17} /></button></div>
  </StepLayout>;
}`;
source = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(path, source);
