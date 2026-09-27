import { useState } from "react";
import { ArrowRight, Compass, Shield, Sun, Sparkles, Building, Layers } from "lucide-react";
import { useLocation } from "wouter";
import { publicPath } from "@/lib/paths";
import { ArchitecturalHotspots, Hotspot } from "./ArchitecturalHotspots";

const HERO_HOTSPOTS: Hotspot[] = [
  {
    id: "roof",
    x: 62,
    y: 28,
    label: "Integrated Solar Slate",
    detail: "High-density monocrystalline tiles flush with natural slate joints. Zero visible fixings.",
    metric: "140.6 Wp / m²",
  },
  {
    id: "facade",
    x: 52,
    y: 56,
    label: "Architectural Solar Glazing",
    detail: "Semiconducting laminated glass envelope delivering natural diffuse daylight and clean power.",
    metric: "40% Transparency",
  },
  {
    id: "carport",
    x: 84,
    y: 65,
    label: "Photovoltaic Canopy",
    detail: "Bi-facial toughened structural glass canopy for electric vehicle charging resilience.",
    metric: "3.2 kWp Capacity",
  },
];

export function PremiumHero({ onStart }: { onStart: () => void }) {
  const [, navigate] = useLocation();
  const [activeLayer, setActiveLayer] = useState<"architecture" | "solar" | "thermal">("solar");
  const [selectedHotspot, setSelectedHotspot] = useState<string>("roof");

  return (
    <section className="premium-hero-grid">
      <div className="hero-editorial">
        <div className="hero-kicker">
          <span className="hero-pill">
            <span className="live-dot" /> BIPV Architecture Platform
          </span>
          <span className="hero-subkicker">Precision European & Global Solar Planning</span>
        </div>

        <h1 className="hero-headline">
          Buildings that <span className="text-serif-accent">generate</span> their own future.
        </h1>

        <p className="hero-narrative">
          Replace passive building cladding with precision architectural photovoltaic tiles, solar façade
          glazing, and integrated structures. Engineered for timeless European aesthetic harmony and verified
          by hourly irradiance models.
        </p>

        <div className="hero-cta-cluster">
          <button className="cta-primary-cinematic" onClick={onStart}>
            <span>Design Your Building</span>
            <ArrowRight size={18} />
          </button>
          <button
            className="cta-secondary-minimal"
            onClick={() => {
              navigate(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/location`);
            }}
          >
            <Compass size={17} />
            <span>Interactive World Map</span>
          </button>
        </div>

        <div className="hero-trust-bar">
          <div className="trust-item">
            <Sun size={15} />
            <span>Hourly PVGIS-SARAH3 Physics</span>
          </div>
          <div className="trust-item">
            <Layers size={15} />
            <span>Full Envelope Integration</span>
          </div>
          <div className="trust-item">
            <Shield size={15} />
            <span>25-Year Degradation Accounting</span>
          </div>
        </div>
      </div>

      <div className="hero-canvas-frame">
        <div className="hero-interactive-viewport">
          <img
            src={publicPath("assets/premium-solar-house-hero_ae3a0ca1.png")}
            alt="Modernité Contemporary Residence"
            className="hero-image-render"
          />

          <div className="hero-viewport-overlay" />

          {/* Interactive Inspection Hotspots */}
          <ArchitecturalHotspots
            hotspots={HERO_HOTSPOTS}
            activeId={selectedHotspot}
            onSelect={(id) => setSelectedHotspot(id)}
          />

          {/* Layer switcher bar */}
          <div className="hero-layer-dock">
            <button
              className={`layer-btn ${activeLayer === "solar" ? "active" : ""}`}
              onClick={() => setActiveLayer("solar")}
            >
              <Sparkles size={13} />
              <span>Solar Envelope</span>
            </button>
            <button
              className={`layer-btn ${activeLayer === "architecture" ? "active" : ""}`}
              onClick={() => setActiveLayer("architecture")}
            >
              <Building size={13} />
              <span>Architecture</span>
            </button>
          </div>

          <div className="hero-status-tag">
            <span className="tag-label">INSPECTION MODE</span>
            <span className="tag-title">Click points to view envelope specifications</span>
          </div>
        </div>
      </div>
    </section>
  );
}
