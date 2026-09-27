import fs from "node:fs";

const path = "/home/ubuntu/modernite-bipv-platform/client/src/App.tsx";
let source = fs.readFileSync(path, "utf8");

const entryStart = source.indexOf("function Entry() {");
const entryEnd = source.indexOf("\n\nfunction LocationPage()", entryStart);
if (entryStart < 0 || entryEnd < 0) throw new Error("Entry block not found");
const entry = `function Entry() {
  const language = useDesignStore((s) => s.language);
  const [, navigate] = useLocation();
  const seedPreview = useDesignStore((s) => s.seedPreview);
  const hasDraft = useDesignStore((s) => s.location.footprint.length > 0);
  return <main className="entry">
    <header className="entry-header"><button className="brand" onClick={() => navigate("/")}><span className="brand-mark"><i /></span><strong>{t(language, "brand.name")}</strong></button><label className="language-select"><span className="sr-only">Language</span><select value={language} onChange={(e) => useDesignStore.getState().setLanguage(e.target.value as typeof language)}><option value="en">EN</option><option value="fr">FR</option><option value="ja">日本語</option><option value="zh">中文</option></select></label></header>
    <section className="entry-grid">
      <div className="entry-copy"><p className="eyebrow">{t(language, "entry.eyebrow")}</p><h1>{t(language, "entry.title_one")}<em>{t(language, "entry.title_two")}</em></h1><p className="entry-lead">{t(language, "entry.lead")}</p><button className="primary" onClick={() => { if (!hasDraft) seedPreview(); navigate("/location"); }}>{hasDraft ? t(language, "entry.resume") : t(language, "entry.start")}<ArrowRight size={18} /></button><p className="scope"><MapPin size={15} />{t(language, "entry.scope")}</p><div className="entry-steps">{["entry.process_one", "entry.process_two", "entry.process_three"].map((key, index) => <span key={key}><b>0{index + 1}</b>{t(language, key)}</span>)}</div></div>
      <div className="entry-visual"><figure className="architecture-hero"><img src="/manus-storage/modernite-hero-architecture_8e02af57.png" alt="Contemporary home with integrated photovoltaic roof and glass" /><figcaption><span>Featured system</span><strong>Integrated roof + solar glass</strong><small>Explore materials, geometry and expected energy on your own site.</small></figcaption><div className="architecture-signal"><i /><span>Solar architecture / 01</span></div></figure></div>
    </section>
    <Footer />
  </main>;
}`;
source = source.slice(0, entryStart) + entry + source.slice(entryEnd);

const buildingStart = source.indexOf("function BuildingPage() {");
const buildingEnd = source.indexOf("\n\nfunction ProductsPage()", buildingStart);
if (buildingStart < 0 || buildingEnd < 0) throw new Error("BuildingPage block not found");
const building = `function BuildingPage() {
  const state = useDesignStore();
  const language = state.language;
  const [, navigate] = useLocation();
  const archetypes = Object.values(ARCHETYPES).filter((item) => item.region === state.location.region);
  return <StepLayout active={1}>
    <section className="page-head"><h2>{t(language, "building.title")}</h2><p>{t(language, "building.lead")}</p></section>
    <div className="building-workbench">
      <aside className="building-library">
        <div className="library-heading"><span>02 / ARCHITECTURE LIBRARY</span><h3>Base forms</h3><p>Select the closest starting point, then adjust the geometry or add components.</p></div>
        <section className="archetype-list">{archetypes.map((item) => <button className={state.building.archetypeId === item.id ? "archetype selected" : "archetype"} key={item.id} onClick={() => state.setArchetype(item.id)}><span>0{item.baseModel}</span><div><strong>{t(language, item.labelKey)}</strong><small>{numberFor(language, item.widthM, 1)} × {numberFor(language, item.depthM, 1)} m · {item.floors}</small></div><Check size={16} /></button>)}</section>
        <section className="building-details card"><div className="library-heading"><span>MANUAL PARAMETERS</span><h3>Make it yours</h3></div><div className="two-fields"><label>Storeys<input type="number" min="1" max="30" value={state.building.storeys} onChange={(e) => state.setBuilding({ storeys: Math.max(1, Number(e.target.value)) })} /></label><label>Roof pitch<input type="number" min="0" max="70" value={state.building.roofPitchDeg} onChange={(e) => state.setBuilding({ roofPitchDeg: Math.max(0, Number(e.target.value)) })} /></label><label>Width<input type="number" min="2" value={state.building.widthM} onChange={(e) => state.setDimensions(Number(e.target.value), state.building.depthM)} /></label><label>Depth<input type="number" min="2" value={state.building.depthM} onChange={(e) => state.setDimensions(state.building.widthM, Number(e.target.value))} /></label></div></section>
      </aside>
      <section className="building-viewport card">
        <div className="viewport-topline"><span><i />LIVE 3D ARCHITECTURE</span><small>Drag to orbit · scroll to inspect</small></div>
        <BuildingCanvas building={state.building} surfaces={state.surfaces} label={t(language, "building.title")} />
        <div className="model-meta"><div><span>{t(language, "building.parameters")}</span><b>{state.building.roofForm} · {state.building.roofPitchDeg}°</b></div><div><span>{t(language, "building.storeys")}</span><b>{state.building.storeys}</b></div><div><span>Footprint</span><b>{numberFor(language, state.location.footprintAreaM2, 1)} m²</b></div></div>
        <div className="addition-heading"><span>OPTIONAL ARCHITECTURE</span><p>Toggle additions to update the 3D massing and product surfaces.</p></div>
        <div className="structure-grid">{(["conservatory", "carport", "canopy"] as const).map((kind) => <button key={kind} className={state.building.structures.some((item) => item.kind === kind) ? "structure selected" : "structure"} onClick={() => state.toggleStructure(kind)}><Plus size={16} /><strong>{t(language, \`building.\${kind}\`)}</strong><small>{t(language, \`building.\${kind}_detail\`)}</small></button>)}</div>
      </section>
    </div>
    <div className="page-actions"><BackButton to="/location" /><button className="primary" onClick={() => navigate("/products")}>{t(language, "building.next")}<ArrowRight size={17} /></button></div>
  </StepLayout>;
}`;
source = source.slice(0, buildingStart) + building + source.slice(buildingEnd);
fs.writeFileSync(path, source);
