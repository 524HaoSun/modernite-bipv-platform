import { useState } from "react";
import { Sparkles, Sun, Check, Info, Sliders, ExternalLink } from "lucide-react";
import type { ProductModel } from "../../../types/solar";

export function InteractiveMaterialCard({
  product,
  isSelected,
  appliedFinish,
  onSelect,
  onFinishChange,
  availableFinishes,
}: {
  product: ProductModel;
  isSelected: boolean;
  appliedFinish?: string | null;
  onSelect: () => void;
  onFinishChange?: (finishId: string) => void;
  availableFinishes?: Array<{ id: string; name: string; hex: string; ral?: string | null }>;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [activeTab, setActiveTab] = useState<"specs" | "craft">("specs");

  const effectiveOutput =
    appliedFinish && appliedFinish !== "black" && product.colouredWpPerM2
      ? product.colouredWpPerM2
      : product.wpPerM2;

  return (
    <article
      className={`interactive-material-card ${isSelected ? "selected" : ""} ${isHovered ? "hovered" : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onSelect}
    >
      <div className="material-card-top">
        <div className="material-identity">
          <span className="material-category">{product.category.toUpperCase()}</span>
          <h4 className="material-name">{product.name}</h4>
        </div>
        <div className="material-selection-indicator">
          <span className={`select-chip ${isSelected ? "active" : ""}`}>
            {isSelected ? <Check size={14} /> : <span>Select</span>}
          </span>
        </div>
      </div>

      <div className="material-output-badge">
        <div className="output-figure">
          <Sun size={15} className="output-icon" />
          <b>{effectiveOutput.toFixed(1)}</b>
          <span>Wp / m²</span>
        </div>
        {appliedFinish && appliedFinish !== "black" && (
          <span className="output-penalty-note">70% colour coefficient</span>
        )}
      </div>

      <p className="material-description">
        {product.category === "roof"
          ? "Seamless BIPV roof element engineered for traditional slate or tile replacement."
          : product.category === "facade"
          ? "Rainscreen glass-glass BIPV panel delivering rear-ventilated building cladding."
          : product.category === "window"
          ? "Architectural solar safety glazing providing high visible light transmission and clean yield."
          : "Toughened laminated safety glass designed for balcony railings and fall protection."}
      </p>

      {/* Colour Swatches if roof */}
      {availableFinishes && availableFinishes.length > 0 && product.category === "roof" && (
        <div
          className="material-finishes-strip"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="finishes-label">Architectural Finish:</span>
          <div className="swatches-flow">
            {availableFinishes.map((finish) => (
              <button
                key={finish.id}
                type="button"
                className={`tactile-swatch ${appliedFinish === finish.id ? "active" : ""}`}
                style={{ backgroundColor: finish.hex }}
                title={`${finish.name} ${finish.ral ? `(RAL ${finish.ral})` : ""}`}
                onClick={() => onFinishChange?.(finish.id)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="material-card-footer">
        <div className="spec-metric">
          <small>Cell Architecture</small>
          <span>Monocrystalline CdTe / Si</span>
        </div>
        <div className="spec-metric">
          <small>Warranty</small>
          <span>25 Years Linear</span>
        </div>
      </div>
    </article>
  );
}
