import { useState } from "react";
import { Info, Sparkles, Sun, ShieldCheck } from "lucide-react";

export type Hotspot = {
  id: string;
  x: number; // percentage
  y: number; // percentage
  label: string;
  detail: string;
  metric?: string;
};

export function ArchitecturalHotspots({
  hotspots,
  activeId,
  onSelect,
}: {
  hotspots: Hotspot[];
  activeId?: string;
  onSelect?: (id: string) => void;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="architectural-hotspots-layer" aria-label="Interactive architectural hotspots">
      {hotspots.map((spot) => {
        const isHovered = hoveredId === spot.id;
        const isActive = activeId === spot.id;

        return (
          <div
            key={spot.id}
            className={`hotspot-anchor ${isActive ? "active" : ""} ${isHovered ? "hovered" : ""}`}
            style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
            onMouseEnter={() => setHoveredId(spot.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => onSelect?.(spot.id)}
          >
            <button className="hotspot-trigger" aria-label={spot.label}>
              <span className="hotspot-pulse" />
              <span className="hotspot-dot" />
            </button>

            {(isHovered || isActive) && (
              <div className="hotspot-popover" role="tooltip">
                <div className="hotspot-popover-header">
                  <Sparkles size={13} className="hotspot-icon" />
                  <strong>{spot.label}</strong>
                </div>
                <p>{spot.detail}</p>
                {spot.metric && (
                  <div className="hotspot-metric">
                    <Sun size={12} />
                    <span>{spot.metric}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
