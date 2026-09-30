import { Box, Building2, Check, Footprints, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { BuildingFootprint } from "../../../lib/building-footprint";

export type BuildingMatch = {
  osmId: number;
  widthM: number;
  depthM: number;
  floors?: number;
  frontAzimuthDeg: number;
  footprintAreaM2: number;
};

type LatLng = { lat: number; lng: number };

const TEXT = {
  en: { title: "Building from the map", loading: "Looking up the building outline…", none: "No mapped building outline at this address. Trace the footprint on the map instead.", error: "Building lookup is unavailable right now.", size: "Size", storeys: "Storeys", front: "Front faces", unknown: "not mapped", facing: "facing", useOutline: "Use outline as footprint", apply: "Apply size, storeys and orientation in Studio", applied: "Studio will use these values", street: "Street View", earth: "3D view", source: "OpenStreetMap outline" },
  zh: { title: "地图识别的建筑", loading: "正在查询建筑轮廓…", none: "该地址没有已测绘的建筑轮廓，请在地图上手动描绘占地。", error: "暂时无法查询建筑信息。", size: "尺寸", storeys: "层数", front: "正面朝向", unknown: "未标注", facing: "面向", useOutline: "用该轮廓作为占地", apply: "在 Studio 中应用尺寸、层数和朝向", applied: "Studio 将使用这些参数", street: "街景", earth: "三维", source: "OpenStreetMap 轮廓" },
};

const compass = (deg: number) => ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(deg / 45) % 8];

export function BuildingMatchCard({ language, coordinates, match, onUseOutline, onMatchChange, onOpenViewer }: {
  language: string;
  coordinates: LatLng;
  match: BuildingMatch | null | undefined;
  onUseOutline: (footprint: BuildingFootprint) => void;
  onMatchChange: (match: BuildingMatch | null) => void;
  onOpenViewer: (mode: "street" | "earth") => void;
}) {
  const t = language === "zh" || language === "zh-Hant" ? TEXT.zh : TEXT.en;
  const query = trpc.site.buildingFootprint.useQuery(coordinates, { staleTime: Infinity, retry: 1 });
  const footprint = query.data;
  const applied = Boolean(footprint?.status === "ok" && match && match.osmId === footprint.osmId);

  const toggleApply = () => {
    if (!footprint || footprint.status !== "ok") return;
    onMatchChange(applied ? null : {
      osmId: footprint.osmId!,
      widthM: footprint.widthM!,
      depthM: footprint.depthM!,
      floors: footprint.floors,
      frontAzimuthDeg: footprint.frontAzimuthDeg!,
      footprintAreaM2: footprint.footprintAreaM2!,
    });
  };

  return (
    <section className="building-match" aria-live="polite">
      <header>
        <Building2 size={16} />
        <strong>{t.title}</strong>
        <span className="building-match-views">
          <button type="button" onClick={() => onOpenViewer("street")}><Footprints size={13} /> {t.street}</button>
          <button type="button" onClick={() => onOpenViewer("earth")}><Box size={13} /> {t.earth}</button>
        </span>
      </header>
      {query.isLoading && <p className="building-match-note"><Loader2 size={13} className="spin" /> {t.loading}</p>}
      {query.isError && <p className="building-match-note">{t.error}</p>}
      {footprint?.status === "not-found" && <p className="building-match-note">{t.none}</p>}
      {footprint?.status === "ok" && (
        <>
          <dl>
            <div><dt>{t.size}</dt><dd>{footprint.widthM} × {footprint.depthM} m · {footprint.footprintAreaM2} m²</dd></div>
            <div><dt>{t.storeys}</dt><dd>{footprint.floors ?? t.unknown}</dd></div>
            <div><dt>{t.front}</dt><dd>{footprint.frontAzimuthDeg}° {compass(footprint.frontAzimuthDeg!)}{footprint.roadName ? ` · ${t.facing} ${footprint.roadName}` : ""}</dd></div>
          </dl>
          <div className="building-match-actions">
            <button type="button" className="thin" onClick={() => onUseOutline(footprint)}>{t.useOutline}</button>
            <label className={applied ? "is-on" : ""}>
              <input type="checkbox" checked={applied} onChange={toggleApply} />
              {applied ? <><Check size={13} /> {t.applied}</> : t.apply}
            </label>
          </div>
          <p className="building-match-note">{t.source} · way {footprint.osmId}</p>
        </>
      )}
    </section>
  );
}
