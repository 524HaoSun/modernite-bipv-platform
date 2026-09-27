import fs from "node:fs";

const path = "/home/ubuntu/modernite-bipv-platform/client/src/App.tsx";
let source = fs.readFileSync(path, "utf8");
const start = source.indexOf("function RoofPage() {");
const end = source.indexOf("\nfunction BuildingPage()", start);

if (start < 0 || end < 0) {
  throw new Error("Unable to locate RoofPage boundaries");
}

const next = `function RoofPage() {
  const state = useDesignStore();
  const language = "en";
  const [, navigate] = useLocation();
  const [searchToken, setSearchToken] = useState(0);
  const [saveName, setSaveName] = useState("");
  const [mapCommand, setMapCommand] = useState<{ id: number; action: "site" | "roof" | "ground" | "street" }>({ id: 0, action: "site" });
  const { location } = state;
  const hasLocatedSite = Boolean(location.label);
  const dimensionsFootprint = () => state.setDimensions(state.building.widthM, state.building.depthM);
  const invalid = location.footprint.length > 2 && (isSelfIntersecting(location.footprint) || location.footprintAreaM2 < 5 || location.footprintAreaM2 > 3000);
  const updateFootprint = (points: { lat: number; lng: number }[]) => state.setFootprint(points, "traced");
  const saveRoof = () => { state.saveRoofArea(saveName); setSaveName(""); };
  const issueMapCommand = (action: "site" | "roof" | "ground" | "street") => setMapCommand((current) => ({ id: current.id + 1, action }));
  const clearLocatedSite = () => state.setLocation({ label: undefined, locality: undefined, postcode: undefined, footprint: [], footprintAreaM2: 0, measureMode: "traced" });

  return <StepLayout active={1}>
    <section className="page-head map-page-head"><p className="eyebrow">STEP 02 OF 06 · SITE STUDY</p><h2>Locate, inspect and measure a site</h2><p>Search for an address, place a precise project pin, then choose whether to trace a roof, study open ground, or inspect the façade from the street.</p></section>
    <div className="site-workbench">
      <section className="card site-control-panel">
        <div className="site-panel-heading"><span>PROJECT LOCATION</span><h3>Define your site</h3><p>Start from an address or place the pin yourself. A location is only applied when you select it.</p></div>
        <div className={hasLocatedSite ? "site-status-card located" : "site-status-card"}>
          <span className="site-status-icon"><MapPin size={18} /></span>
          <div><small>{hasLocatedSite ? "LOCATED PROPERTY" : "AWAITING LOCATION"}</small><b>{hasLocatedSite ? location.label : "No property selected"}</b><p>{hasLocatedSite ? "The map and all following geometry now use this project location." : "Search a full address or place a pin directly on satellite imagery."}</p></div>
          {hasLocatedSite && <button className="clear-site-button" onClick={clearLocatedSite} title="Clear selected property"><X size={15} /></button>}
        </div>
        <div className="site-address-block">
          <div className="control-step-label"><span>01</span><b>Search an address</b><small>Optional, but fastest for a known property.</small></div>
          <AddressAutocomplete value={location.label ?? ""} onChange={(label) => state.setLocation({ label, locality: label })} onLocate={() => setSearchToken((token) => token + 1)} onSelect={(selection) => state.setLocation({ lat: selection.lat, lng: selection.lng, centroid: { lat: selection.lat, lng: selection.lng }, label: selection.label, locality: selection.locality ?? selection.label, postcode: selection.postcode })} />
          <button className="place-pin-link" onClick={() => issueMapCommand("site")}><MapPin size={15} />Or place a pin on the map</button>
        </div>
        <div className="site-action-divider"><span>THEN SELECT A STUDY MODE</span></div>
        <div className="site-study-grid">
          <button className="study-mode-card" onClick={() => issueMapCommand("roof")}><span className="study-mode-icon"><MousePointer2 size={16} /></span><b>Trace a roof</b><small>Measure an existing roof or building footprint.</small></button>
          <button className="study-mode-card" onClick={() => issueMapCommand("ground")}><span className="study-mode-icon"><Layers3 size={16} /></span><b>Trace open ground</b><small>Frame a new-build or ground-mount proposal area.</small></button>
          <button className="study-mode-card road" onClick={() => issueMapCommand("street")}><span className="study-mode-icon"><Eye size={16} /></span><b>Inspect façade</b><small>Open an outdoor road-level view and mark elevation zones.</small></button>
        </div>
        {location.measureMode === "typed" && <div className="dimension-assist"><div className="control-step-label"><span>DIM</span><b>Dimension assist</b><small>Use only where aerial corners are not legible.</small></div><div className="two-fields"><label>Width<input type="number" min="1" value={state.building.widthM} onChange={(e) => state.setDimensions(Number(e.target.value), state.building.depthM)} /></label><label>Depth<input type="number" min="1" value={state.building.depthM} onChange={(e) => state.setDimensions(state.building.widthM, Number(e.target.value))} /></label><button className="secondary" onClick={dimensionsFootprint}>Create footprint</button></div></div>}
        <div className="site-readout-strip"><span><small>Measured area</small><b>{numberFor(language, location.footprintAreaM2, 1)} m²</b></span><span><small>Boundary corners</small><b>{location.footprint.length}</b></span><span><small>Project direction</small><b>{compassName(180)}</b></span></div>
        {invalid && <p className="notice danger">The proposed boundary should remain between 5 and 3,000 m² and must not intersect itself.</p>}
        <section className="saved-roof-manager">
          <div className="save-roof-heading"><div><span>SAVED SITE STUDIES</span><b>Keep this measured boundary</b></div><Save size={16} /></div>
          <div className="save-roof-form"><input value={saveName} placeholder="Name this roof or site" onChange={(event) => setSaveName(event.target.value)} /><button className="secondary" disabled={location.footprint.length < 3 || invalid} onClick={saveRoof}><Save size={15} />Save</button></div>
          {state.savedRoofAreas.length > 0 ? <div className="saved-roof-list">{state.savedRoofAreas.slice(0, 3).map((area) => <div className="saved-roof-row" key={area.id}><button onClick={() => state.loadRoofArea(area.id)}><span><MapPin size={14} /><b>{area.name}</b></span><small>{numberFor(language, area.location.footprintAreaM2, 1)} m² · {new Date(area.savedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</small></button><button className="delete-saved-roof" title={\`Delete \${area.name}\`} onClick={() => state.deleteRoofArea(area.id)}><Trash2 size={14} /></button></div>)}</div> : <p className="saved-roof-empty">Saved studies remain available in this browser. They never overwrite the current project until selected.</p>}
        </section>
      </section>
      <section className="site-map-panel"><LocationMap center={{ lat: location.lat, lng: location.lng }} footprint={location.footprint} onFootprintChange={updateFootprint} searchQuery={location.label} searchToken={searchToken} command={mapCommand} onCenterChange={(next) => state.setLocation({ lat: next.lat, lng: next.lng, centroid: { lat: next.lat, lng: next.lng }, label: next.label ?? location.label, locality: next.label ?? location.locality })} /></section>
    </div>
    <div className="page-actions"><BackButton to="/location" /><button className="primary" disabled={invalid || location.footprintAreaM2 < 5} onClick={() => navigate("/building")}>Choose building type<ArrowRight size={17} /></button></div>
  </StepLayout>;
}
`;

source = source.slice(0, start) + next + source.slice(end);
fs.writeFileSync(path, source, "utf8");
console.log("Rebuilt RoofPage workflow");
