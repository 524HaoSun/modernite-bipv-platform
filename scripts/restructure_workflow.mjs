import fs from "node:fs";
const path = "/home/ubuntu/modernite-bipv-platform/client/src/App.tsx";
let source = fs.readFileSync(path, "utf8");

source = source.replace('import { BuildingCanvas } from "./components/BuildingCanvas";', 'import { BuildingCanvas } from "./components/BuildingCanvas";\nimport { ProductModelCanvas } from "./components/ProductModelCanvas";');
source = source.replace('const steps = ["nav.location", "nav.building", "nav.products", "nav.energy", "nav.results"];\nconst routeForStep = ["/location", "/building", "/products", "/energy", "/results"];', 'const steps = ["Location", "Roof", "Building", "Structures", "Solar products", "Review"];\nconst routeForStep = ["/location", "/roof", "/building", "/structures", "/products", "/energy"];');

const headerStart = source.indexOf('function PageHeader(');
const headerEnd = source.indexOf('\n\nfunction Footer()', headerStart);
if (headerStart < 0 || headerEnd < 0) throw new Error("PageHeader not found");
const header = `function PageHeader({ active }: { active: number }) {
  const [, navigate] = useLocation();
  return <header className="app-header"><button className="brand" onClick={() => navigate("/")}><span className="brand-mark"><i /></span><strong>Modernité</strong></button><nav className="workflow" aria-label="Design workflow">{steps.map((label, index) => <button key={label} className={index === active ? "step active" : index < active ? "step complete" : "step"} onClick={() => index <= active && navigate(routeForStep[index])}><span>{String(index + 1).padStart(2, "0")}</span><b>{label}</b></button>)}</nav><span className="locale-chip">EN</span></header>;
}`;
source = source.slice(0, headerStart) + header + source.slice(headerEnd);
source = source.replace(/<header className="entry-header">([\s\S]*?)<\/header>/, '<header className="entry-header"><button className="brand" onClick={() => navigate("/")}><span className="brand-mark"><i /></span><strong>Modernité</strong></button><span className="locale-chip">EN</span></header>');

const locationStart = source.indexOf('function LocationPage() {');
const locationEnd = source.indexOf('\nfunction BuildingPage()', locationStart);
if (locationStart < 0 || locationEnd < 0) throw new Error("LocationPage not found");
const countryAndRoof = `function CountryPage() {
  const state = useDesignStore();
  const [, navigate] = useLocation();
  const regions: Array<{ id: Region; title: string; description: string; image: string; count: string }> = [
    { id: "UK", title: "United Kingdom", description: "British homes, terraces and apartments", image: "/manus-storage/region-uk_c5cf49c0.png", count: "7 building types" },
    { id: "EU", title: "Europe", description: "European residential forms and façades", image: "/manus-storage/region-eu_5b8db2b3.png", count: "6 building types" },
    { id: "CA", title: "Canada", description: "Residential types for Canadian climates", image: "/manus-storage/region-ca_a8e86459.png", count: "8 building types" },
    { id: "JP", title: "Japan", description: "Compact houses and urban apartment forms", image: "/manus-storage/region-jp_45fb3171.png", count: "5 building types" },
  ];
  const selected = regions.find((region) => region.id === state.location.region) ?? regions[0];
  return <StepLayout active={0}>
    <section className="country-head"><div><p className="eyebrow">STEP 01 OF 06</p><h2>Choose your region</h2><p>Start with where the property is located. The next steps will tailor building forms, climate assumptions and solar material options.</p></div><aside className="site-summary"><MapPin size={22} /><span><b>{state.location.label || "Property not yet located"}</b><small>{selected.title}</small></span><button className="secondary" onClick={() => navigate("/roof")}>Locate property</button></aside></section>
    <div className="country-layout"><section className="country-card-grid">{regions.map((region) => <button key={region.id} className={state.location.region === region.id ? "country-card selected" : "country-card"} onClick={() => state.setRegion(region.id)}><img src={region.image} alt={\`\${region.title} architectural solar context\`} /><span className="country-check">{state.location.region === region.id ? <Check size={16} /> : region.id}</span><div><small>{region.id}</small><strong>{region.title}</strong><p>{region.description}</p><footer><em>{region.count}</em><ArrowRight size={18} /></footer></div></button>)}</section><aside className="country-aside"><span>REGION PROFILE</span><h3>Different places.<br />A brighter tomorrow.</h3><p>Each region is paired with architecture patterns, local climate defaults and building-integrated solar surfaces.</p><img src={selected.image} alt="Selected regional solar architecture" /><ul><li><Building2 size={17} />Building forms curated by region</li><li><Sun size={17} />Climate-ready solar assumptions</li><li><Sparkles size={17} />Material choices suited to the property</li></ul></aside></div>
    <div className="page-actions"><BackButton to="/" /><button className="primary" onClick={() => navigate("/roof")}>Continue to property mapping<ArrowRight size={17} /></button></div>
  </StepLayout>;
}

function RoofPage() {
  const state = useDesignStore();
  const language = "en";
  const [, navigate] = useLocation();
  const { location } = state;
  const config = REGION_CONFIG[location.region];
  const dimensionsFootprint = () => state.setDimensions(state.building.widthM, state.building.depthM);
  const invalid = location.footprint.length > 2 && (isSelfIntersecting(location.footprint) || location.footprintAreaM2 < 5 || location.footprintAreaM2 > 3000);
  const updateFootprint = (points: { lat: number; lng: number }[]) => state.setFootprint(points, "traced");
  return <StepLayout active={1}>
    <section className="page-head"><p className="eyebrow">STEP 02 OF 06</p><h2>Map and measure the roof</h2><p>Search or navigate to the property, then trace an existing roof, a building footprint, or open ground for a new-build proposal.</p></section>
    <div className="location-grid"><section className="card location-controls"><div className="live-card-heading"><span>PROPERTY INPUT</span><b>Define your site</b></div><label>Address or postcode<div className="input-row"><input value={location.label ?? ""} placeholder="Search an address or postcode" onChange={(e) => state.setLocation({ label: e.target.value, locality: e.target.value })} /><button className="icon-button" title="Locate property" onClick={() => state.setLocation({ lat: config.initialMap.lat, lng: config.initialMap.lng })}><MapPin size={17} /></button></div></label><div className="mode-grid"><button className={location.measureMode === "traced" ? "mode active" : "mode"} onClick={() => state.setLocation({ measureMode: "traced" })}><Edit3 size={18} />Trace roof</button><button className={location.measureMode === "typed" ? "mode active" : "mode"} onClick={() => state.setLocation({ measureMode: "typed" })}><Layers3 size={18} />Type dimensions</button><button className={location.measureMode === "ground" ? "mode active" : "mode"} onClick={() => state.setLocation({ measureMode: "ground" })}><Sun size={18} />Open ground</button></div>{location.measureMode === "typed" && <div className="two-fields"><label>Width<input type="number" min="1" value={state.building.widthM} onChange={(e) => state.setDimensions(Number(e.target.value), state.building.depthM)} /></label><label>Depth<input type="number" min="1" value={state.building.depthM} onChange={(e) => state.setDimensions(state.building.widthM, Number(e.target.value))} /></label><button className="secondary" onClick={dimensionsFootprint}>Create footprint</button></div>}<div className="measurement"><span>Footprint area<b>{numberFor(language, location.footprintAreaM2, 1)} m²</b></span><span>Vertices<b>{location.footprint.length}</b></span><span>Building orientation<b>{compassName(180)}</b></span></div>{invalid && <p className="notice danger">The boundary should be between 5 and 3,000 m² without intersecting itself.</p>}<p className="notice"><CircleHelp size={15} />Use Satellite to trace any site, then toggle Street View to assess access and surroundings.</p></section><section className="location-map-panel"><LocationMap center={{ lat: location.lat, lng: location.lng }} footprint={location.footprint} onFootprintChange={updateFootprint} /></section></div>
    <div className="page-actions"><BackButton to="/location" /><button className="primary" disabled={invalid || location.footprintAreaM2 < 5} onClick={() => navigate("/building")}>Choose building type<ArrowRight size={17} /></button></div>
  </StepLayout>;
}
`;
source = source.slice(0, locationStart) + countryAndRoof + source.slice(locationEnd);

source = source.replace('return <StepLayout active={1}>', 'return <StepLayout active={2}>');
source = source.replace('<span>02 / ARCHITECTURE LIBRARY</span>', '<span>03 / ARCHITECTURE LIBRARY</span>');
source = source.replace('<p>Select the closest starting point, then adjust the geometry or add components.</p>', '<p>Select the closest starting point, then adjust its geometry in the live 3D model.</p>');
source = source.replace(/\s*<div className="addition-heading">[\s\S]*?<\/div>\s*<div className="structure-grid">[\s\S]*?<\/div>/, '');
source = source.replace('BackButton to="/location" /><button className="primary" onClick={() => navigate("/products")}', 'BackButton to="/roof" /><button className="primary" onClick={() => navigate("/structures")}');

const productsIndex = source.indexOf('\nfunction ProductsPage()');
if (productsIndex < 0) throw new Error("ProductsPage not found");
const structures = `
function StructuresPage() {
  const state = useDesignStore();
  const [, navigate] = useLocation();
  const [preview, setPreview] = useState<"conservatory" | "carport" | "canopy">("conservatory");
  const cards: Array<{ kind: "conservatory" | "carport" | "canopy"; title: string; detail: string; tag: string }> = [{ kind: "conservatory", title: "Solar conservatory", detail: "An enclosed glass addition that can become a productive solar surface.", tag: "Glass room" }, { kind: "carport", title: "Solar carport", detail: "Covered vehicle parking with a solar canopy above.", tag: "Parking" }, { kind: "canopy", title: "Solar canopy", detail: "A smaller roof for a threshold, terrace or walkway.", tag: "Shade" }];
  return <StepLayout active={3}><section className="page-head"><p className="eyebrow">STEP 04 OF 06</p><h2>Add optional structures</h2><p>Add one or more structures, or continue without them. The selection becomes a live, configurable part of the 3D scheme.</p></section><div className="structures-layout"><section className="structure-library"><div className="structure-intro"><span>OPTIONAL ARCHITECTURE</span><h3>Extend the solar envelope</h3><p>These are modelled separately so they can receive their own solar materials and performance assumptions later.</p></div><div className="structure-card-list">{cards.map((card) => { const selected = state.building.structures.some((item) => item.kind === card.kind); return <button key={card.kind} className={selected ? "structure-option selected" : "structure-option"} onClick={() => { setPreview(card.kind); state.toggleStructure(card.kind); }}><span>{card.tag}</span><div><strong>{card.title}</strong><p>{card.detail}</p></div><i>{selected ? <Check size={17} /> : <Plus size={17} />}</i></button>; })}</div><div className="structure-note"><CircleHelp size={18} /><p><b>You can change this later.</b><br />The next stage lets you assign BIPV materials to every selected structure.</p></div></section><aside className="structure-preview card"><div className="viewport-topline"><span><i />LIVE 3D COMPONENT</span><small>Based on the selected addition</small></div><ProductModelCanvas category="structure" variant={preview} label="Interactive additional structure preview" /><div className="structure-preview-meta"><span>Selected component</span><b>{cards.find((card) => card.kind === preview)?.title}</b><small>Real 3D geometry · orbit, pan and inspect</small></div></aside></div><div className="page-actions"><BackButton to="/building" /><button className="primary" onClick={() => navigate("/products")}>Choose solar products<ArrowRight size={17} /></button></div></StepLayout>;
}
`;
source = source.slice(0, productsIndex) + structures + source.slice(productsIndex);

source = source.replace('return <StepLayout active={2}>', 'return <StepLayout active={4}>');
source = source.replace('<span>03 / SOLAR MATERIAL LIBRARY</span>', '<span>05 / SOLAR MATERIAL LIBRARY</span>');
source = source.replace('<aside className="product-visual"><div className="material-hero"><img src="/manus-storage/modernite-product-detail_915604ec.png" alt="Integrated photovoltaic tile material detail" /><span>Material reality</span></div><BuildingCanvas building={state.building} surfaces={state.surfaces} label={t(language, "products.title")} /><p><Sun size={16} />{selected.find((surface) => surface.productId)?.label ?? t(language, "products.none_selected")}</p></aside>', '<aside className="product-visual"><div className="material-hero"><img src="/manus-storage/modernite-product-detail_915604ec.png" alt="Integrated photovoltaic tile material detail" /><span>Material reality</span></div><BuildingCanvas building={state.building} surfaces={state.surfaces} label={t(language, "products.title")} /><div className="product-geometry-window"><ProductModelCanvas category={tab === "roof" ? "roof" : tab === "structure" ? "structure" : tab as "window" | "facade" | "railing"} finish={selected.find((surface) => surface.finishId)?.finishId} label="Selected solar product model" /><span>Product-level 3D inspection</span></div><p><Sun size={16} />{selected.find((surface) => surface.productId)?.label ?? t(language, "products.none_selected")}</p></aside>');
source = source.replace('BackButton to="/building" /><button className="primary" disabled={state.totalCapacityKwp <= 0.1}', 'BackButton to="/structures" /><button className="primary" disabled={state.totalCapacityKwp <= 0.1}');

source = source.replace('return <StepLayout active={3}>', 'return <StepLayout active={5}>');
source = source.replace('return <StepLayout active={4}><div className="card"', 'return <StepLayout active={5}><div className="card"');
source = source.replace('return <StepLayout active={4}><div className="results-grid">', 'return <StepLayout active={5}><div className="results-grid">');
source = source.replace('<Route path="/location" component={LocationPage} /><Route path="/building" component={BuildingPage} /><Route path="/products" component={ProductsPage} />', '<Route path="/location" component={CountryPage} /><Route path="/roof" component={RoofPage} /><Route path="/building" component={BuildingPage} /><Route path="/structures" component={StructuresPage} /><Route path="/products" component={ProductsPage} />');
fs.writeFileSync(path, source);
