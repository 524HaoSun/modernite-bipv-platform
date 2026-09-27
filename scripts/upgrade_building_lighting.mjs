import fs from "node:fs";
const path = "/home/ubuntu/modernite-bipv-platform/client/src/App.tsx";
let source = fs.readFileSync(path, "utf8");
const start = source.indexOf("function BuildingPage() {");
const end = source.indexOf("\nfunction StructuresPage()", start);
if (start < 0 || end < 0) throw new Error("BuildingPage boundary not found");
const replacement = `function BuildingPage() {
  const state = useDesignStore();
  const language = state.language;
  const [, navigate] = useLocation();
  const [sunSimulation, setSunSimulation] = useState<{ season: "spring" | "summer" | "autumn" | "winter"; hour: number }>({ season: "summer", hour: 13 });
  const archetypes = Object.values(ARCHETYPES).filter((item) => item.region === state.location.region);
  const formattedTime = String(Math.floor(sunSimulation.hour)).padStart(2, "0") + ":" + String(Math.round((sunSimulation.hour % 1) * 60)).padStart(2, "0");
  const seasonDescriptions = { spring: "Balanced spring sunlight", summer: "High summer solar gain", autumn: "Low-angle autumn light", winter: "Long winter shadows" };
  return <StepLayout active={2}>
    <section className="page-head"><h2>{t(language, "building.title")}</h2><p>{t(language, "building.lead")}</p></section>
    <div className="building-workbench">
      <aside className="building-library">
        <div className="library-heading"><span>03 / ARCHITECTURE LIBRARY</span><h3>Base forms</h3><p>Select the closest starting point, then adjust its geometry in the live 3D model.</p></div>
        <section className="archetype-list">{archetypes.map((item) => <button className={state.building.archetypeId === item.id ? "archetype selected" : "archetype"} key={item.id} onClick={() => state.setArchetype(item.id)}><span>0{item.baseModel}</span><div><strong>{t(language, item.labelKey)}</strong><small>{numberFor(language, item.widthM, 1)} × {numberFor(language, item.depthM, 1)} m · {item.floors}</small></div><Check size={16} /></button>)}</section>
        <section className="building-details card"><div className="library-heading"><span>MANUAL PARAMETERS</span><h3>Make it yours</h3></div><div className="two-fields"><label>Storeys<input type="number" min="1" max="30" value={state.building.storeys} onChange={(e) => state.setBuilding({ storeys: Math.max(1, Number(e.target.value)) })} /></label><label>Roof pitch<input type="number" min="0" max="70" value={state.building.roofPitchDeg} onChange={(e) => state.setBuilding({ roofPitchDeg: Math.max(0, Number(e.target.value)) })} /></label><label>Width<input type="number" min="2" value={state.building.widthM} onChange={(e) => state.setDimensions(Number(e.target.value), state.building.depthM)} /></label><label>Depth<input type="number" min="2" value={state.building.depthM} onChange={(e) => state.setDimensions(state.building.widthM, Number(e.target.value))} /></label></div></section>
      </aside>
      <section className="building-viewport card">
        <div className="viewport-topline"><span><i />LIVE 3D ARCHITECTURE</span><small>Drag to orbit · scroll to inspect</small></div>
        <section className="sun-simulation" aria-label="Seasonal sunlight and shadow simulation"><div className="sun-simulation-heading"><span><Sun size={16} />Sun and shadow study</span><b>{formattedTime}</b></div><div className="season-picker">{(["spring", "summer", "autumn", "winter"] as const).map((season) => <button key={season} className={sunSimulation.season === season ? "active" : ""} onClick={() => setSunSimulation((current) => ({ ...current, season }))}>{season}</button>)}</div><label className="sun-time-slider"><span>Time of day</span><input aria-label="Time of day" type="range" min="6" max="20" step="0.25" value={sunSimulation.hour} onChange={(event) => setSunSimulation((current) => ({ ...current, hour: Number(event.target.value) }))} /><small><span>06:00</span><b>{seasonDescriptions[sunSimulation.season]}</b><span>20:00</span></small></label></section>
        <BuildingCanvas building={state.building} surfaces={state.surfaces} label={t(language, "building.title")} sunSimulation={sunSimulation} />
        <div className="model-meta"><div><span>{t(language, "building.parameters")}</span><b>{state.building.roofForm} · {state.building.roofPitchDeg}°</b></div><div><span>{t(language, "building.storeys")}</span><b>{state.building.storeys}</b></div><div><span>Footprint</span><b>{numberFor(language, state.location.footprintAreaM2, 1)} m²</b></div></div>
      </section>
    </div>
    <div className="page-actions"><BackButton to="/roof" /><button className="primary" onClick={() => navigate("/structures")}>{t(language, "building.next")}<ArrowRight size={17} /></button></div>
  </StepLayout>;
}
`;
source = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(path, source);
