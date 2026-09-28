import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const app = fs.readFileSync(path.join(root, "client/src/App.tsx"), "utf8");
const styles = fs.readFileSync(path.join(root, "client/src/index.css"), "utf8");
const map = fs.readFileSync(path.join(root, "client/src/components/ProjectLocationMap.tsx"), "utf8");

describe("V28-aligned entry gateway", () => {
  it("keeps the customer Studio runtime available behind the new entry flow", () => {
    expect(app).toContain('CUSTOMER_STUDIO_URL = publicPath("studio.html")');
    expect(app).toContain("customer-studio-frame");
    expect(app).toContain("ProjectLocationMap");
  });

  it("locks the Studio building selector to the selected market without filtering its product library", () => {
    expect(app).toContain("STUDIO_REGION_BY_MARKET");
    expect(app).toContain("[data-region=\"${studioRegion}\"]");
    expect(app).toContain("regionControl?.click()");
    expect(app).toContain(".region-tabs,");
    expect(app).toContain("#open-catalog,");
    expect(app).toContain("root.dataset.hostMarket = studioRegion");
    expect(app).toContain('marketLock.dataset.marketLock = "true"');
    expect(app).not.toContain("#products { display: none");
  });

  it("persists the project context and hands map coordinates, language, and market presets into the same-origin Studio", () => {
    expect(app).toContain('PROJECT_CONTEXT_STORAGE_KEY = "modernite-project-context-v1"');
    expect(app).toContain("ModerniteEnergyApp?.setSite?.");
    expect(app).toContain("ModerniteLocationCore?.timezone?.");
    expect(app).toContain("#mb-query");
    expect(app).toContain("#roof-recommend");
    expect(app).toContain("STUDIO_LANGUAGES");
  });

  it("includes a restrained local-model calculation transition and optional AI study control", () => {
    expect(app).toContain("Preparing a grounded project study.");
    expect(app).toContain("Local empirical climate profile");
    expect(app).toContain("Regional monthly baseline");
    expect(app).toContain("Modernité Design Guide");
    expect(app).toContain("PersistentStudyAssistant");
    expect(styles).toContain(".persistent-study-assistant");
    expect(styles).toContain(".calculation-page");
  });

  it("uses a V28-derived pale botanical palette for entry and location pages", () => {
    expect(styles).toContain("--v28-green: #234e40");
    expect(styles).toContain("--v28-paper: #fafbf7");
    expect(styles).toContain(".gateway-shell");
    expect(styles).toContain(".location-map-shell");
  });

  it("uses an OpenStreetMap frontend layer for address search and pin placement", () => {
    expect(map).toContain("tile.openstreetmap.org");
    expect(map).toContain("nominatim.openstreetmap.org/search");
    expect(map).toContain("OpenStreetMap is ready");
    expect(map).toContain("osm-map-canvas");
    expect(map).toContain("osm-tile-layer");
    expect(map).toContain("osm-vector-layer");
    expect(map).toContain("Close outline");
    expect(map).toContain("Undo point");
    expect(map).toContain("countrycodes");
    expect(map).toContain("COUNTRY_NAME_TERMS");
    expect(map).toContain("item.type !== \"country\"");
    expect(map).toContain("calculateArea");
    expect(map).toContain("Google Street View can be connected later");
    expect(map).toContain("Trace area");
    expect(map).toContain('site-map-tool-card ${drawingActive ? "is-drawing" : ""}');
    expect(map).toContain("handlePointerUp");
    expect(map).toContain("ProjectLocationSelection");
    expect(map).toContain("coordinates");
    expect(map).toContain("beginVertexDrag");
    expect(map).toContain("distanceMetres");
    expect(map).toContain("is-close-ready");
    expect(map).toContain("Pencil");
  });

  it("keeps the selected market locked at the site stage with reversible map exploration", () => {
    expect(app).not.toContain('aria-label="Change selected market"');
    expect(map).toContain('type MapMode = "aerial" | "road"');
    expect(map).toContain("setMapMode");
    expect(map).toContain("Google Maps API");
    expect(map).not.toContain("map.setTilt(45)");
    expect(map).not.toContain("45° view");
  });

  it("hands the completed satellite trace into the Studio footprint geometry field", () => {
    expect(app).toContain('context.siteArea.areaM2');
    expect(app).toContain('[data-building-field="footprint"]');
    expect(app).toContain('footprintField.dispatchEvent(new Event("change", { bubbles: true }))');
    expect(app).toContain("root.dataset.hostSiteArea");
  });

  it("extends the project journey from the site through Design Studio, energy and results", () => {
    expect(app).toContain("WORKFLOW_LABELS");
    expect(app).toContain('studio: "Design Studio"');
    expect(app).toContain('energy: "Energy"');
    expect(app).toContain('results: "Results"');
    expect(app).toContain("STUDIO_BRIDGE_COPY");
    expect(app).toContain("studio-bridge-bar");
    expect(app).toContain("Building · Products · Finishes · Environment");
    expect(app).toContain("customer-studio-stage");
    expect(app).toContain("canOpenStudio");
    expect(app).toContain("Set a project site before opening Design Studio");
    expect(app).toContain("studyReady");
    expect(app).toContain("Opening Design Studio");
    expect(app).toContain("studio-opening-notice");
    expect(app).toContain("Return to Design Studio");
    expect(app).toContain("siteArea");
    expect(app).toContain("EUROPEAN_CAPITALS");
    expect(app).toContain('coordinates: { lat: 51.5072, lng: -0.1276 }, zoom: 12');
    expect(app).toContain('coordinates: { lat: 45.4215, lng: -75.6972 }, zoom: 12');
    expect(app).toContain('coordinates: { lat: 35.6762, lng: 139.6503 }, zoom: 12');
    expect(app).toContain("Map the solar-ready zone.");
    expect(styles).toContain(".location-scene-heading");
    expect(styles).toContain(".site-map-tools");
    expect(styles).toContain(".site-area-readout");
    expect(styles).toContain(".site-trace-progress");
    expect(styles).toContain(".site-map-tool-card.is-drawing");
    expect(styles).toContain(".studio-bridge-bar");
    expect(styles).toContain(".studio-bridge-journey");
    expect(styles).toContain(".customer-studio-stage");
    expect(styles).toContain(".journey-rail button:disabled");
    expect(styles).toContain(".studio-calculate:disabled");
    expect(styles).toContain(".studio-opening-notice");
    expect(app).toContain("HomeEnergyPanel");
    expect(app).toContain("EnergyPage");
    expect(app).toContain('energy: "/energy"');
    expect(app).toContain("Calculate project results");
    expect(app).toContain("MonthlyProfileChart");
    expect(app).toContain("CashPositionChart");
    expect(app).toContain("energySettings");
    expect(app).toContain("designHelp");
    expect(app).toContain("mapStudioSnapshotToSurfaces(snapshot)");
    expect(app).toContain("Configuration required");
    expect(app).toContain("Add at least one solar product in the supplied Products step before calculating the project study.");
    expect(app).toContain("The project-study request ended before it completed.");
    expect(app).toContain('SAVED_STUDY_STORAGE_KEY = "modernite-saved-study-v1"');
    expect(app).toContain('(["studio", "energy", "calculation", "results"] as GatewayRoute[]).includes(route)');
    expect(app).toContain("modernite:study-request");
    expect(app).toContain("modernite:finalize-request");
    expect(app).toContain("Save configuration");
    expect(app).toContain("Download Studio PDF");
    expect(app).toContain("style[data-host-workflow]");
    expect(app).toContain("Environment controls");
    expect(app).toContain('studioTabs[4].hidden = true');
    expect(styles).toContain(".home-energy-panel");
    expect(styles).toContain(".energy-page");
    expect(styles).toContain(".finalise-card");
    expect(styles).toContain(".monthly-profile-chart");
    expect(styles).toContain(".cash-position-chart");
    expect(styles).toContain(".studio-configuration-notice");
  });

  it("features an interactive rotatable market globe, library, and 7-language system matching Studio V31", () => {
    const atlas = fs.readFileSync(path.join(root, "client/src/components/MarketAtlas.tsx"), "utf8");
    expect(app).toContain("journey-rail");
    expect(app).toContain("market-intro-grid");
    expect(atlas).toContain("market-next-action");
    expect(app).toContain("MarketAtlas");
    expect(app).toContain('"zh-Hant"');
    expect(app).toContain('"es"');
    expect(app).toContain('"it"');
    expect(app).toContain("GATEWAY_COPY");
    expect(atlas).toContain("EUROPEAN_MARKETS");
    expect(atlas).toContain("RotatableGlobe");
    expect(atlas).toContain("market-globe");
    expect(atlas).toContain("globe-library");
    expect(atlas).toContain('market.key === "EU" && <MarketLibrary');
    expect(atlas).toContain("onWheel={onWheel}");
    expect(atlas).toContain("globe-zoom-controls");
    expect(atlas).toContain("globe-hover-bubble");
    expect(atlas).toContain("const flyTo");
    expect(atlas).toContain("requestAnimationFrame(step)");
    expect(atlas).toContain("countryPath.blur()");
    expect(atlas).not.toContain("GlobeLabel");
    expect(atlas).not.toContain("globe-halo");
    expect(styles).toContain(".market-globe-workbench");
    expect(styles).toContain("modernite-globe-celestial-field_17a01131.png");
    expect(styles).toContain(".market-globe-workbench.is-europe");
    expect(styles).toContain(".globe-country.is-covered");
    expect(styles).toContain(".globe-hover-bubble");
    expect(styles).toContain(".market-globe .globe-country.is-covered:focus");
    expect(styles).toContain("outline: 0 solid transparent !important");
    expect(styles).toContain("min-height: 44px");
    expect(styles).toContain("border-radius: 48% 52% 43% 57%");
    expect(styles).toContain(".globe-stage-meta");
  });
});
