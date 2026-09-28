import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, EyeOff, MapPin, Navigation, Pencil, Ruler, Search, Undo2 } from "lucide-react";

export type MarketKey = "GB" | "EU" | "CA" | "JP";

export type Market = {
  key: MarketKey;
  name: string;
  shortName: string;
  coordinates: google.maps.LatLngLiteral;
  zoom: number;
  referenceLabel?: string;
};

export type ProjectLocationSelection = {
  label: string;
  coordinates: google.maps.LatLngLiteral;
};

export type SiteAreaSelection = {
  areaM2: number;
  path: google.maps.LatLngLiteral[];
};

type GatewayLanguage = "en" | "zh" | "zh-Hant" | "fr" | "ja" | "es" | "it";
type LatLng = google.maps.LatLngLiteral;
type Point = { x: number; y: number };
type MapMode = "aerial" | "road";
type DragState =
  | { type: "pan"; pointerId: number; startX: number; startY: number; startCenter: Point; moved: boolean }
  | { type: "vertex"; pointerId: number; index: number };

type MapText = {
  ready: string;
  locating: string;
  unavailable: string;
  selected: string;
  drawStart: string;
  needVertices: string;
  drawCleared: string;
  vertexPlaced: (count: number) => string;
  outlined: (area: string, count: number) => string;
  aerial: string;
  road: string;
  siteArea: string;
  drawZone: string;
  trace: string;
  finish: string;
  undo: string;
  clear: string;
  traceHelp: string;
  drawCue: string;
  closeCue: string;
  outlinedArea: string;
  points: string;
  openData: string;
  editHint: string;
  googleLater: string;
  zoomIn: string;
  zoomOut: string;
  detailView: string;
};

const EN_TEXT: MapText = {
  ready: "OpenStreetMap is ready. Search an address, place a pin, or trace a solar-ready area.",
  locating: "Searching OpenStreetMap...",
  unavailable: "Location unavailable. Try a complete address or postcode.",
  selected: "Project site selected.",
  drawStart: "Use the pencil cursor to place numbered corners. Return to point 1 after point 3 to close the outline.",
  needVertices: "Place at least three vertices before closing the site outline.",
  drawCleared: "Site outline cleared. Trace another area when ready.",
  vertexPlaced: (count) => `Point ${count} placed. Add another corner, or return to point 1 to close the boundary.`,
  outlined: (area, count) => `Outlined site area: ${area} across ${count} vertices. Drag a numbered point to refine it.`,
  aerial: "Aerial",
  road: "Road",
  siteArea: "Solar-ready area",
  drawZone: "Pencil-trace a boundary, then close it",
  trace: "Trace area",
  finish: "Close outline",
  undo: "Undo point",
  clear: "Clear",
  traceHelp: "Click around a roof, facade, or open plot. After point 3, click point 1 to close the shape.",
  drawCue: "Click to add corners",
  closeCue: "Point 1 is ready - click to close",
  outlinedArea: "Outlined solar area",
  points: "points",
  openData: "Aerial map with OpenStreetMap search",
  editHint: "Drag any numbered point to refine the boundary",
  googleLater: "Google Street View can be connected later with the Google Maps API.",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  detailView: "Close-up view",
};

const ZH_TEXT: MapText = {
  ready: "OpenStreetMap 已就绪。可以搜索地址、放置定位点或勾画光伏区域。",
  locating: "正在搜索 OpenStreetMap...",
  unavailable: "无法定位，请尝试完整地址或邮编。",
  selected: "已选择项目场地。",
  drawStart: "使用铅笔光标放置编号顶点。放置第 3 个点后，回到第 1 个点即可闭合边界。",
  needVertices: "请至少放置三个顶点后再完成边界。",
  drawCleared: "已清除场地边界，可重新勾画。",
  vertexPlaced: (count) => `已放置第 ${count} 个点。继续添加顶点，或回到第 1 个点闭合边界。`,
  outlined: (area, count) => `已勾画场地面积：${area}，共 ${count} 个顶点。可拖动编号顶点进行微调。`,
  aerial: "航拍",
  road: "道路",
  siteArea: "光伏候选区域",
  drawZone: "用铅笔勾画边界并闭合",
  trace: "勾画区域",
  finish: "闭合边界",
  undo: "撤销顶点",
  clear: "清除",
  traceHelp: "在屋顶、立面或空地周围依次点击。放置第 3 个点后，点击第 1 个点即可闭合。",
  drawCue: "点击添加顶点",
  closeCue: "第 1 点已高亮，点击即可闭合",
  outlinedArea: "已勾画光伏区域",
  points: "个顶点",
  openData: "航拍地图与 OpenStreetMap 搜索",
  editHint: "拖动任意编号顶点即可微调边界",
  googleLater: "Google Street View 可在后续接入 Google Maps API 后启用。",
  zoomIn: "放大",
  zoomOut: "缩小",
  detailView: "拉近查看",
};

const MAP_TEXT: Record<GatewayLanguage, MapText> = {
  en: EN_TEXT,
  zh: ZH_TEXT,
  "zh-Hant": ZH_TEXT,
  fr: EN_TEXT,
  ja: EN_TEXT,
  es: EN_TEXT,
  it: EN_TEXT,
};

const TILE_SIZE = 256;
const EARTH_RADIUS = 6_371_000;
const MIN_ZOOM = 3;
const MAX_ZOOM = 20;

const COUNTRY_NAME_TERMS: Record<string, string> = {
  andorra: "ad", austria: "at", belgium: "be", bosnia: "ba", bulgaria: "bg", belarus: "by", canada: "ca", croatia: "hr", cyprus: "cy", czechia: "cz", denmark: "dk", estonia: "ee", finland: "fi", france: "fr", germany: "de", greece: "gr", hungary: "hu", iceland: "is", ireland: "ie", italy: "it", japan: "jp", latvia: "lv", liechtenstein: "li", lithuania: "lt", luxembourg: "lu", malta: "mt", moldova: "md", monaco: "mc", montenegro: "me", netherlands: "nl", norway: "no", poland: "pl", portugal: "pt", romania: "ro", russia: "ru", serbia: "rs", slovakia: "sk", slovenia: "si", spain: "es", sweden: "se", switzerland: "ch", turkey: "tr", ukraine: "ua", "united kingdom": "gb", england: "gb", scotland: "gb", wales: "gb", "vatican city": "va", "north macedonia": "mk", kosovo: "xk",
};

type ProjectLocationMapProps = {
  language: GatewayLanguage;
  market: Market;
  placeholder: string;
  searchLabel: string;
  locateLabel: string;
  initialLocation?: ProjectLocationSelection | null;
  initialArea?: SiteAreaSelection | null;
  onLocationChange: (selection: ProjectLocationSelection) => void;
  onAreaChange: (selection: SiteAreaSelection | null) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function areaLabel(areaM2: number) {
  return `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(areaM2)} m²`;
}

function countryRestriction(market: Market) {
  if (market.key === "GB") return "gb";
  if (market.key === "CA") return "ca";
  if (market.key === "JP") return "jp";
  return market.shortName !== "EU" ? market.shortName.toLowerCase() : undefined;
}

function latLngToPoint(coordinates: LatLng, zoom: number): Point {
  const scale = TILE_SIZE * 2 ** zoom;
  const sinLat = Math.sin((clamp(coordinates.lat, -85.05112878, 85.05112878) * Math.PI) / 180);
  return {
    x: ((coordinates.lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
}

function pointToLatLng(point: Point, zoom: number): LatLng {
  const scale = TILE_SIZE * 2 ** zoom;
  const lng = (point.x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * point.y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat: clamp(lat, -85.05112878, 85.05112878), lng: ((((lng + 180) % 360) + 360) % 360) - 180 };
}

function distanceMetres(a: LatLng, b: LatLng) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function screenDistance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function calculateArea(path: LatLng[]) {
  if (path.length < 3) return 0;
  const latitude = path.reduce((sum, point) => sum + point.lat, 0) / path.length;
  const metresPerDegreeLat = (Math.PI * EARTH_RADIUS) / 180;
  const metresPerDegreeLng = metresPerDegreeLat * Math.cos((latitude * Math.PI) / 180);
  const projected = path.map((point) => ({ x: point.lng * metresPerDegreeLng, y: point.lat * metresPerDegreeLat }));
  const area = projected.reduce((sum, point, index) => {
    const next = projected[(index + 1) % projected.length]!;
    return sum + point.x * next.y - next.x * point.y;
  }, 0);
  return Math.abs(area) / 2;
}

function pathKey(path: LatLng[]) {
  return path.map((point) => `${point.lat.toFixed(6)}:${point.lng.toFixed(6)}`).join("|");
}

function isUsablePath(path: LatLng[] | null | undefined): path is LatLng[] {
  return Boolean(path && path.length >= 3 && path.every((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180));
}

function normaliseTileX(x: number, zoom: number) {
  const max = 2 ** zoom;
  return ((x % max) + max) % max;
}

function tileUrl(mode: MapMode, zoom: number, x: number, y: number) {
  if (mode === "aerial") return `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${x}`;
  return `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
}

export function ProjectLocationMap({
  language,
  market,
  placeholder,
  searchLabel,
  locateLabel,
  initialLocation,
  initialArea,
  onLocationChange,
  onAreaChange,
}: ProjectLocationMapProps) {
  const text = MAP_TEXT[language] ?? MAP_TEXT.en;
  const shellRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const emittedAreaKeyRef = useRef("");
  const toolPointerHandledRef = useRef(false);
  const [query, setQuery] = useState("");
  const [center, setCenter] = useState<LatLng>(initialLocation?.coordinates ?? market.coordinates);
  const [zoom, setZoom] = useState(clamp(Math.max(market.zoom, 16), MIN_ZOOM, MAX_ZOOM));
  const [mapMode, setMapMode] = useState<MapMode>("aerial");
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [marker, setMarker] = useState<ProjectLocationSelection | null>(initialLocation ?? null);
  const [area, setArea] = useState<SiteAreaSelection | null>(isUsablePath(initialArea?.path) ? initialArea ?? null : null);
  const [draftPath, setDraftPath] = useState<LatLng[]>([]);
  const [drawingActive, setDrawingActive] = useState(false);
  const [closeReady, setCloseReady] = useState(false);
  const [hoverPoint, setHoverPoint] = useState<LatLng | null>(null);
  const [status, setStatus] = useState(text.ready);

  useEffect(() => {
    const element = shellRef.current;
    if (!element) return;
    const update = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setCenter(initialLocation?.coordinates ?? market.coordinates);
    setZoom(clamp(Math.max(market.zoom, initialLocation ? 18 : 16), MIN_ZOOM, MAX_ZOOM));
    setMarker(initialLocation ?? null);
    setQuery("");
    setStatus(text.ready);
  }, [initialLocation, market, text.ready]);

  useEffect(() => {
    if (isUsablePath(initialArea?.path)) {
      setArea(initialArea);
      emittedAreaKeyRef.current = pathKey(initialArea.path);
    } else {
      setArea(null);
      emittedAreaKeyRef.current = "";
    }
    setDraftPath([]);
    setDrawingActive(false);
    setCloseReady(false);
    setHoverPoint(null);
  }, [initialArea]);

  const centerPoint = useMemo(() => latLngToPoint(center, zoom), [center, zoom]);

  const projectToScreen = useCallback((coordinates: LatLng): Point => {
    const point = latLngToPoint(coordinates, zoom);
    return { x: point.x - centerPoint.x + size.width / 2, y: point.y - centerPoint.y + size.height / 2 };
  }, [centerPoint, size.height, size.width, zoom]);

  const screenToLatLng = useCallback((clientX: number, clientY: number): LatLng => {
    const rect = shellRef.current?.getBoundingClientRect();
    const localX = clientX - (rect?.left ?? 0);
    const localY = clientY - (rect?.top ?? 0);
    return pointToLatLng({ x: centerPoint.x + localX - size.width / 2, y: centerPoint.y + localY - size.height / 2 }, zoom);
  }, [centerPoint, size.height, size.width, zoom]);

  const tiles = useMemo(() => {
    if (!size.width || !size.height) return [];
    const startX = Math.floor((centerPoint.x - size.width / 2) / TILE_SIZE) - 1;
    const endX = Math.floor((centerPoint.x + size.width / 2) / TILE_SIZE) + 1;
    const startY = Math.max(0, Math.floor((centerPoint.y - size.height / 2) / TILE_SIZE) - 1);
    const endY = Math.min(2 ** zoom - 1, Math.floor((centerPoint.y + size.height / 2) / TILE_SIZE) + 1);
    const output: Array<{ key: string; url: string; left: number; top: number }> = [];
    for (let x = startX; x <= endX; x += 1) {
      for (let y = startY; y <= endY; y += 1) {
        const tileX = normaliseTileX(x, zoom);
        output.push({
          key: `${zoom}-${x}-${y}`,
          url: tileUrl(mapMode, zoom, tileX, y),
          left: x * TILE_SIZE - centerPoint.x + size.width / 2,
          top: y * TILE_SIZE - centerPoint.y + size.height / 2,
        });
      }
    }
    return output;
  }, [centerPoint, mapMode, size.height, size.width, zoom]);

  const polygonPoints = useMemo(() => (area?.path ?? []).map(projectToScreen).map((point) => `${point.x},${point.y}`).join(" "), [area, projectToScreen]);
  const draftPoints = useMemo(() => {
    const path = hoverPoint && drawingActive && draftPath.length ? [...draftPath, closeReady ? draftPath[0]! : hoverPoint] : draftPath;
    return path.map(projectToScreen).map((point) => `${point.x},${point.y}`).join(" ");
  }, [closeReady, draftPath, drawingActive, hoverPoint, projectToScreen]);

  const publishArea = useCallback((path: LatLng[]) => {
    if (!isUsablePath(path)) {
      setStatus(text.needVertices);
      return;
    }
    const selection = { areaM2: calculateArea(path), path };
    emittedAreaKeyRef.current = pathKey(path);
    setArea(selection);
    onAreaChange(selection);
    setStatus(text.outlined(areaLabel(selection.areaM2), path.length));
  }, [onAreaChange, text]);

  const finishDrawing = useCallback(() => {
    if (draftPath.length < 3) {
      setStatus(text.needVertices);
      return;
    }
    publishArea(draftPath);
    setDrawingActive(false);
    setDraftPath([]);
    setHoverPoint(null);
    setCloseReady(false);
  }, [draftPath, publishArea, text.needVertices]);

  const selectLocation = useCallback((coordinates: LatLng, label?: string) => {
    const fallback = `${coordinates.lat.toFixed(5)}, ${coordinates.lng.toFixed(5)}`;
    const selection = { coordinates, label: label || fallback };
    setMarker(selection);
    setCenter(coordinates);
    setZoom((current) => Math.max(current, 18));
    setStatus(label || text.selected);
    onLocationChange(selection);
  }, [onLocationChange, text.selected]);

  const locate = useCallback(async (address: string) => {
    const trimmed = address.trim();
    if (!trimmed) return;
    const country = countryRestriction(market);
    const statedCountry = Object.entries(COUNTRY_NAME_TERMS).find(([term]) => trimmed.toLowerCase().includes(term))?.[1];
    if (country && statedCountry && statedCountry !== country) {
      setStatus(text.unavailable);
      return;
    }
    setStatus(text.locating);
    const params = new URLSearchParams({ format: "jsonv2", limit: "1", q: trimmed });
    if (country) params.set("countrycodes", country);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, { headers: { Accept: "application/json" } });
      const results = await response.json() as Array<{ lat: string; lon: string; display_name?: string; type?: string }>;
      const result = results.find((item) => item.type !== "country") ?? results[0];
      if (!result) {
        setStatus(text.unavailable);
        return;
      }
      const coordinates = { lat: Number(result.lat), lng: Number(result.lon) };
      if (!Number.isFinite(coordinates.lat) || !Number.isFinite(coordinates.lng)) {
        setStatus(text.unavailable);
        return;
      }
      selectLocation(coordinates, result.display_name ?? trimmed);
    } catch {
      setStatus(text.unavailable);
    }
  }, [market, selectLocation, text.locating, text.unavailable]);

  const startDrawing = useCallback(() => {
    setArea(null);
    setDraftPath([]);
    setHoverPoint(null);
    setCloseReady(false);
    emittedAreaKeyRef.current = "";
    onAreaChange(null);
    setDrawingActive(true);
    setStatus(text.drawStart);
  }, [onAreaChange, text.drawStart]);

  const clearArea = useCallback(() => {
    setArea(null);
    setDraftPath([]);
    setHoverPoint(null);
    setCloseReady(false);
    setDrawingActive(false);
    emittedAreaKeyRef.current = "";
    onAreaChange(null);
    setStatus(text.drawCleared);
  }, [onAreaChange, text.drawCleared]);

  const undoDraftPoint = useCallback(() => {
    setDraftPath((path) => {
      const next = path.slice(0, -1);
      setStatus(next.length ? text.vertexPlaced(next.length) : text.drawStart);
      return next;
    });
    setCloseReady(false);
  }, [text]);

  const setZoomAroundCenter = useCallback((nextZoom: number) => {
    setZoom(clamp(Math.round(nextZoom), MIN_ZOOM, MAX_ZOOM));
  }, []);

  const focusDetailView = useCallback(() => {
    if (area?.path.length) {
      const centroid = area.path.reduce((sum, point) => ({ lat: sum.lat + point.lat, lng: sum.lng + point.lng }), { lat: 0, lng: 0 });
      setCenter({ lat: centroid.lat / area.path.length, lng: centroid.lng / area.path.length });
      setZoom(20);
      return;
    }
    if (marker) {
      setCenter(marker.coordinates);
      setZoom(20);
      return;
    }
    setCenter(market.coordinates);
    setZoom(Math.max(18, market.zoom));
  }, [area, marker, market.coordinates, market.zoom]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drawingActive) {
      event.preventDefault();
      event.stopPropagation();
      const point = screenToLatLng(event.clientX, event.clientY);
      const first = draftPath[0];
      const shouldClose = Boolean(first && draftPath.length >= 3 && (screenDistance(projectToScreen(point), projectToScreen(first)) <= 34 || distanceMetres(point, first) <= 5.2));
      if (shouldClose) {
        finishDrawing();
        return;
      }
      setDraftPath((path) => {
        const next = [...path, point];
        setStatus(text.vertexPlaced(next.length));
        return next;
      });
      setHoverPoint(null);
      setCloseReady(false);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { type: "pan", pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startCenter: centerPoint, moved: false };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const pointerLocation = screenToLatLng(event.clientX, event.clientY);
    if (drawingActive) {
      setHoverPoint(pointerLocation);
      const first = draftPath[0];
      setCloseReady(Boolean(first && draftPath.length >= 3 && (screenDistance(projectToScreen(pointerLocation), projectToScreen(first)) <= 30 || distanceMetres(pointerLocation, first) <= 4.8)));
    }
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.type === "vertex") {
      const path = area?.path ?? [];
      setArea({ areaM2: calculateArea(path.map((point, index) => (index === drag.index ? pointerLocation : point))), path: path.map((point, index) => (index === drag.index ? pointerLocation : point)) });
      return;
    }
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
    setCenter(pointToLatLng({ x: drag.startCenter.x - dx, y: drag.startCenter.y - dy }, zoom));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId === event.pointerId && drag.type === "vertex" && area) {
      const key = pathKey(area.path);
      if (key !== emittedAreaKeyRef.current) {
        emittedAreaKeyRef.current = key;
        onAreaChange(area);
        setStatus(text.outlined(areaLabel(area.areaM2), area.path.length));
      }
    }
    if (!drawingActive && drag?.type === "pan" && !drag.moved) {
      selectLocation(screenToLatLng(event.clientX, event.clientY));
    }
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    setZoom((current) => clamp(current + (event.deltaY < 0 ? 1 : -1), MIN_ZOOM, MAX_ZOOM));
  };

  const beginVertexDrag = (event: React.PointerEvent<SVGCircleElement>, index: number) => {
    event.stopPropagation();
    shellRef.current?.setPointerCapture(event.pointerId);
    dragRef.current = { type: "vertex", pointerId: event.pointerId, index };
  };

  const closeFromFirstDraftPoint = (event: React.PointerEvent<SVGCircleElement>) => {
    if (draftPath.length < 3) return;
    event.stopPropagation();
    finishDrawing();
  };

  const runToolAction = (event: React.PointerEvent<HTMLButtonElement>, action: () => void) => {
    event.preventDefault();
    event.stopPropagation();
    toolPointerHandledRef.current = true;
    window.setTimeout(() => { toolPointerHandledRef.current = false; }, 0);
    action();
  };

  const runToolClickAction = (event: React.MouseEvent<HTMLButtonElement>, action: () => void) => {
    event.preventDefault();
    event.stopPropagation();
    if (toolPointerHandledRef.current) return;
    action();
  };

  const showReference = !marker;
  const referenceLabel = market.referenceLabel ?? market.name;

  return (
    <section className={`location-map-shell location-map-shell--studio ${drawingActive ? "is-tracing" : ""}`} aria-label={searchLabel}>
      <div
        ref={shellRef}
        className={`osm-map-canvas osm-map-canvas--${mapMode}`}
        role="application"
        aria-label={text.openData}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => { dragRef.current = null; }}
        onWheel={handleWheel}
      >
        <div className="osm-tile-layer" aria-hidden="true">
          {tiles.map((tile) => <img key={tile.key} src={tile.url} alt="" draggable={false} style={{ left: tile.left, top: tile.top }} />)}
        </div>
        <svg className="osm-vector-layer" aria-hidden="true">
          {area && <polygon className="osm-area-polygon" points={polygonPoints} />}
          {area?.path.map((point, index) => {
            const screen = projectToScreen(point);
            return (
              <g key={`${index}-${point.lat}-${point.lng}`} className="osm-area-vertex">
                <circle cx={screen.x} cy={screen.y} r="12" onPointerDown={(event) => beginVertexDrag(event, index)} />
                <text x={screen.x} y={screen.y + 4}>{index + 1}</text>
              </g>
            );
          })}
          {draftPath.length > 0 && <polyline className={`osm-draft-line ${closeReady ? "is-close-ready" : ""}`} points={draftPoints} />}
          {draftPath.map((point, index) => {
            const screen = projectToScreen(point);
            return (
              <g key={`draft-${index}-${point.lat}-${point.lng}`} className={`osm-draft-vertex ${index === 0 && closeReady ? "is-close-ready" : ""}`}>
                <circle cx={screen.x} cy={screen.y} r={index === 0 && closeReady ? 17 : 12} onPointerDown={index === 0 ? closeFromFirstDraftPoint : undefined} />
                <text x={screen.x} y={screen.y + 4}>{index + 1}</text>
              </g>
            );
          })}
        </svg>
        {marker && <div className="osm-site-marker" style={{ left: projectToScreen(marker.coordinates).x, top: projectToScreen(marker.coordinates).y }}><MapPin size={24} /></div>}
        <div className="osm-control-stack" aria-label="Map zoom">
          <button type="button" aria-label={text.zoomIn} onClick={() => setZoomAroundCenter(zoom + 1)}>+</button>
          <button type="button" aria-label={text.zoomOut} onClick={() => setZoomAroundCenter(zoom - 1)}>−</button>
          <button type="button" className="osm-detail-button" aria-label={text.detailView} title={text.detailView} onClick={focusDetailView}>1:1</button>
          <button type="button" aria-label="Center on selected site" onClick={() => setCenter(marker?.coordinates ?? market.coordinates)}><Crosshair size={16} /></button>
        </div>
        <div className="osm-attribution">
          {mapMode === "aerial" ? "Imagery © Esri, Maxar, Earthstar Geographics" : <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>}
        </div>
      </div>

      <div className="site-map-search">
        <Search size={17} aria-hidden="true" />
        <input aria-label={searchLabel} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void locate(query); }} placeholder={placeholder} />
        <button type="button" onClick={() => void locate(query)} disabled={!query.trim()}>{locateLabel}</button>
      </div>

      <div className="site-map-mode-control" aria-label="Map layers">
        <button type="button" className={mapMode === "aerial" ? "is-active" : ""} onClick={() => setMapMode("aerial")}><Navigation size={14} /> {text.aerial}</button>
        <button type="button" className={mapMode === "road" ? "is-active" : ""} onClick={() => setMapMode("road")}><Navigation size={14} /> {text.road}</button>
      </div>

      {showReference && <div className="site-map-reference" aria-live="polite"><span><MapPin size={14} /></span><div><small>{text.openData}</small><b>{referenceLabel}</b><p>{text.ready}</p></div></div>}

      <div className="site-map-tools">
        <div className={`site-map-tool-card ${drawingActive ? "is-drawing" : ""}`}>
          <div className="site-map-tool-heading"><span><Ruler size={15} /></span><div><b>{text.siteArea}</b><small>{text.drawZone}</small></div></div>
          <div className={`site-map-tool-actions ${drawingActive ? "is-drawing" : ""}`}>
            <button type="button" className={drawingActive ? "is-active" : ""} onPointerDown={(event) => runToolAction(event, drawingActive ? finishDrawing : startDrawing)} onClick={(event) => runToolClickAction(event, drawingActive ? finishDrawing : startDrawing)}><Pencil size={14} /> {drawingActive ? text.finish : text.trace}</button>
            {drawingActive && <button type="button" className="is-quiet" onPointerDown={(event) => runToolAction(event, undoDraftPoint)} onClick={(event) => runToolClickAction(event, undoDraftPoint)} disabled={draftPath.length === 0}><Undo2 size={13} /> {text.undo}</button>}
            <button type="button" className="is-quiet" onPointerDown={(event) => runToolAction(event, clearArea)} onClick={(event) => runToolClickAction(event, clearArea)} disabled={!area && !drawingActive}>{text.clear}</button>
          </div>
          {drawingActive && <div className={`site-trace-progress ${closeReady ? "is-close-ready" : ""}`} aria-live="polite"><span>{draftPath.length}</span><b>{text.points}</b><i>{closeReady ? text.closeCue : text.drawCue}</i></div>}
          <p className="site-map-trace-help">{text.traceHelp}</p>
        </div>
        <button type="button" className="site-street-view" disabled title={text.googleLater}><EyeOff size={15} /><span><b>Google Street View</b><small>{text.googleLater}</small></span></button>
      </div>

      {drawingActive && <div className={`site-draw-cue ${closeReady ? "is-close-ready" : ""}`}><Pencil size={15} /><span>{closeReady ? text.closeCue : text.drawCue}</span></div>}
      {area && <div className="site-area-readout" aria-live="polite"><span><Ruler size={16} /></span><div><small>{text.outlinedArea}</small><strong>{areaLabel(area.areaM2)}</strong></div><em>{area.path.length} {text.points}</em><p>{text.editHint}</p></div>}
      <div className="site-map-status"><span><MapPin size={14} aria-hidden="true" /> {status}</span><span><Crosshair size={14} aria-hidden="true" /> {text.openData}</span></div>
    </section>
  );
}
