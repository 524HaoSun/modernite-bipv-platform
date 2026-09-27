import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, CheckCircle2, Crosshair, Layers3, MapPin, MousePointer2, Ruler, Trash2, Undo2, X } from "lucide-react";
import { MapView } from "./Map";
import type { FacadeDirection, FacadeStudySelection, LatLng } from "../../../types/solar";
import { geodesicArea } from "../../../lib/geometry";

export type MapCopy = {
  toolbarTitle: string;
  findProperty: string;
  findHelp: string;
  finding: string;
  notFound: string;
  traceMode: string;
  streetMode: string;
  ready: string;
  draftArea: string;
  area: string;
  vertices: string;
  satellite: string;
  trace: string;
  undo: string;
  clear: string;
  closeButton: string;
  closeHint: string;
  closureTarget: string;
  minimumHint: string;
  areaReady: string;
  areaReadyHelp: string;
  traceHelp: string;
  panoramaUnavailable: string;
  facade: string;
  facadeHelp: string;
  facadeSelected: string;
  pegmanHint: string;
};

type MapAction = "roof" | "street" | "satellite";
type DrawMode = "idle" | "roof";

type LocationMapProps = {
  center: LatLng;
  countryCode?: string;
  footprint: LatLng[];
  hasLocatedSite: boolean;
  onFootprintChange: (points: LatLng[], kind: "roof") => void;
  onFacadeSelect?: (selection: FacadeStudySelection) => void;
  searchQuery?: string;
  searchToken?: number;
  command?: { id: number; action: MapAction };
  onCenterChange?: (location: LatLng & { label?: string }) => void;
  copy: MapCopy;
  locale: string;
};

export function headingToFacadeDirection(headingDeg: number): FacadeDirection {
  const heading = ((headingDeg % 360) + 360) % 360;
  if (heading >= 315 || heading < 45) return "north";
  if (heading < 135) return "east";
  if (heading < 225) return "south";
  return "west";
}

function samePoint(first: LatLng, second: LatLng) {
  return Math.abs(first.lat - second.lat) < 0.00001 && Math.abs(first.lng - second.lng) < 0.00001;
}

export function LocationMap({ center, countryCode, footprint, hasLocatedSite, onFootprintChange, onFacadeSelect, searchQuery, searchToken = 0, command, onCenterChange, copy, locale }: LocationMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const draftLineRef = useRef<google.maps.Polyline | null>(null);
  const draftShapeRef = useRef<google.maps.Polygon | null>(null);
  const vertexRefs = useRef<google.maps.Marker[]>([]);
  const projectionOverlayRef = useRef<google.maps.OverlayView | null>(null);
  const drawModeRef = useRef<DrawMode>("idle");
  const draftRef = useRef<LatLng[]>([]);
  const lastCommandRef = useRef(0);

  const [drawMode, setDrawMode] = useState<DrawMode>("idle");
  const [view, setView] = useState<"satellite" | "street">("satellite");
  const [status, setStatus] = useState<"ready" | "locating" | "not-found" | "street-unavailable">("ready");
  const [draft, setDraft] = useState<LatLng[]>([]);
  const [cursorPoint, setCursorPoint] = useState<LatLng | null>(null);
  const [area, setArea] = useState(() => geodesicArea(footprint));
  const [facadeMode, setFacadeMode] = useState(false);

  const number = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: area < 100 ? 1 : 0 }), [locale, area]);
  const draftArea = useMemo(() => geodesicArea(draft), [draft]);
  const displayArea = drawMode === "roof" ? draftArea : area;
  const displayVertices = drawMode === "roof" ? draft.length : footprint.length;
  const canClose = draft.length >= 3;

  useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);
  useEffect(() => { draftRef.current = draft; }, [draft]);

  const clearDraftOverlays = () => {
    draftLineRef.current?.setMap(null);
    draftLineRef.current = null;
    draftShapeRef.current?.setMap(null);
    draftShapeRef.current = null;
    vertexRefs.current.forEach((marker) => marker.setMap(null));
    vertexRefs.current = [];
  };

  const renderDraft = (map: google.maps.Map, points: LatLng[], cursor?: LatLng | null) => {
    clearDraftOverlays();
    if (!points.length) return;
    const displayPoints = cursor && points.length ? [...points, cursor] : points;
    draftLineRef.current = new google.maps.Polyline({
      path: displayPoints,
      map,
      strokeColor: "#ffd264",
      strokeOpacity: 1,
      strokeWeight: 3,
      geodesic: true,
      icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 0.9, scale: 2.2 }, offset: "0", repeat: "10px" }],
    });
    if (points.length >= 3) {
      draftShapeRef.current = new google.maps.Polygon({
        paths: points,
        map,
        strokeColor: "#67e7f0",
        strokeOpacity: 1,
        strokeWeight: 2.4,
        fillColor: "#56d9ff",
        fillOpacity: 0.24,
        clickable: false,
        geodesic: true,
      });
    }
    vertexRefs.current = points.map((point, index) => {
      const isClosureTarget = index === 0 && points.length >= 3;
      return new google.maps.Marker({
        position: point,
        map,
        clickable: false,
        zIndex: 30,
        label: { text: isClosureTarget ? "✓" : String(index + 1), color: "#082532", fontSize: isClosureTarget ? "13px" : "10px", fontWeight: "700" },
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: isClosureTarget ? 11 : index === 0 ? 9 : 7, fillColor: isClosureTarget ? "#67e7f0" : "#ffd264", fillOpacity: 1, strokeColor: "#06202d", strokeWeight: 2 },
      });
    });
  };

  const syncCommittedPolygon = (map: google.maps.Map, points: LatLng[]) => {
    polygonRef.current?.setMap(null);
    polygonRef.current = null;
    setArea(geodesicArea(points));
    if (points.length < 3) return;
    const polygon = new google.maps.Polygon({
      paths: points,
      map,
      strokeColor: "#56d9ff",
      strokeOpacity: 1,
      strokeWeight: 3,
      fillColor: "#56d9ff",
      fillOpacity: 0.2,
      editable: true,
      draggable: false,
      geodesic: true,
    });
    polygonRef.current = polygon;
    const report = () => {
      const next = polygon.getPath().getArray().map((point) => ({ lat: point.lat(), lng: point.lng() }));
      setArea(geodesicArea(next));
      onFootprintChange(next, "roof");
    };
    polygon.getPath().addListener("set_at", report);
    polygon.getPath().addListener("insert_at", report);
    polygon.getPath().addListener("remove_at", report);
  };

  const setSatellite = () => {
    const map = mapRef.current;
    if (!map) return;
    map.getStreetView().setVisible(false);
    map.setMapTypeId("satellite");
    map.setOptions({ streetViewControl: true, gestureHandling: "greedy", disableDefaultUI: false, mapTypeControl: false, fullscreenControl: false });
    setFacadeMode(false);
    setView("satellite");
  };

  const moveMap = (point: LatLng, zoom: number) => {
    const map = mapRef.current;
    if (!map) return;
    setSatellite();
    map.panTo(point);
    map.setZoom(zoom);
  };

  const emitCenter = (point: LatLng, label?: string) => {
    moveMap(point, 20);
    onCenterChange?.({ ...point, label });
  };

  const startTrace = () => {
    const map = mapRef.current;
    if (!map) return;
    setSatellite();
    polygonRef.current?.setOptions({ strokeOpacity: 0.25, fillOpacity: 0.04 });
    draftRef.current = [];
    setDraft([]);
    setCursorPoint(null);
    clearDraftOverlays();
    setDrawMode("roof");
  };

  const finishTrace = () => {
    const map = mapRef.current;
    const points = draftRef.current;
    if (!map || points.length < 3) return;
    onFootprintChange(points, "roof");
    clearDraftOverlays();
    draftRef.current = [];
    setDraft([]);
    setCursorPoint(null);
    setDrawMode("idle");
    syncCommittedPolygon(map, points);
  };

  const cancelTrace = () => {
    draftRef.current = [];
    setDraft([]);
    setCursorPoint(null);
    setDrawMode("idle");
    clearDraftOverlays();
    polygonRef.current?.setOptions({ strokeOpacity: 1, fillOpacity: 0.2 });
  };

  const appendCorner = (point: LatLng) => {
    const map = mapRef.current;
    if (!map) return;
    const current = draftRef.current;
    if (current.length >= 3 && samePoint(current[0], point)) {
      finishTrace();
      return;
    }
    const next = [...current, point];
    draftRef.current = next;
    setDraft(next);
    renderDraft(map, next, cursorPoint);
    setArea(geodesicArea(next));
  };

  const undo = () => {
    const map = mapRef.current;
    const next = draftRef.current.slice(0, -1);
    draftRef.current = next;
    setDraft(next);
    if (map) renderDraft(map, next, cursorPoint);
  };

  const startStreetView = async () => {
    const map = mapRef.current;
    if (!map) return;
    cancelTrace();
    setStatus("locating");
    const service = new google.maps.StreetViewService();
    // A direct lookup can occasionally resolve to a contributed indoor panorama.
    // Sampling around the address lets the experience favour an outdoor road capture
    // with multiple navigable links, while retaining the closest suitable result.
    const samples = [
      center,
      { lat: center.lat + 0.00055, lng: center.lng }, { lat: center.lat - 0.00055, lng: center.lng },
      { lat: center.lat, lng: center.lng + 0.0008 }, { lat: center.lat, lng: center.lng - 0.0008 },
      { lat: center.lat + 0.0004, lng: center.lng + 0.00055 }, { lat: center.lat - 0.0004, lng: center.lng - 0.00055 },
    ];
    const candidates = (await Promise.all(samples.map((location) => new Promise<google.maps.StreetViewPanoramaData | null>((resolve) => {
      service.getPanorama({ location, radius: 100, source: google.maps.StreetViewSource.OUTDOOR }, (data, panoramaStatus) => resolve(panoramaStatus === google.maps.StreetViewStatus.OK && data?.location?.pano ? data : null));
    })))).filter((data): data is google.maps.StreetViewPanoramaData => Boolean(data));
    const selected = candidates.sort((left, right) => {
      const leftLinks = left.links?.length ?? 0;
      const rightLinks = right.links?.length ?? 0;
      if (rightLinks !== leftLinks) return rightLinks - leftLinks;
      const leftPoint = left.location?.latLng;
      const rightPoint = right.location?.latLng;
      const leftDistance = leftPoint ? Math.hypot(leftPoint.lat() - center.lat, leftPoint.lng() - center.lng) : Infinity;
      const rightDistance = rightPoint ? Math.hypot(rightPoint.lat() - center.lat, rightPoint.lng() - center.lng) : Infinity;
      return leftDistance - rightDistance;
    })[0];
    const pano = selected?.location?.pano;
    if (!pano) {
      setStatus("street-unavailable");
      return;
    }
    const panorama = map.getStreetView();
    panorama.setOptions({ linksControl: true, panControl: true, addressControl: true, enableCloseButton: true, motionTracking: false, motionTrackingControl: false, zoomControl: true, clickToGo: true });
    panorama.setPano(pano);
    panorama.setPov({ heading: 0, pitch: 0 });
    panorama.setVisible(true);
    setView("street");
    setStatus("ready");
  };

  const selectFacade = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!facadeMode || view !== "street") return;
    event.preventDefault();
    event.stopPropagation();
    const panorama = mapRef.current?.getStreetView();
    const headingDeg = panorama?.getPov().heading ?? 0;
    const direction = headingToFacadeDirection(headingDeg);
    onFacadeSelect?.({ direction, headingDeg, selectedAt: Date.now() });
    setFacadeMode(false);
  };

  const pointFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const projection = projectionOverlayRef.current?.getProjection();
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const point = projection?.fromContainerPixelToLatLng(new google.maps.Point(x, y));
    if (point) return { point: { lat: point.lat(), lng: point.lng() }, x, y };
    const mapBounds = mapRef.current?.getBounds();
    if (!mapBounds || !bounds.width || !bounds.height) return null;
    const northEast = mapBounds.getNorthEast();
    const southWest = mapBounds.getSouthWest();
    return { point: { lat: northEast.lat() - (y / bounds.height) * (northEast.lat() - southWest.lat()), lng: southWest.lng() + (x / bounds.width) * (northEast.lng() - southWest.lng()) }, x, y };
  };

  const onTracePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drawMode !== "roof") return;
    event.preventDefault();
    event.stopPropagation();
    const result = pointFromPointer(event);
    if (!result) return;
    const projection = projectionOverlayRef.current?.getProjection();
    const first = draftRef.current[0];
    const firstPixel = first && projection?.fromLatLngToContainerPixel(new google.maps.LatLng(first.lat, first.lng));
    if (firstPixel && draftRef.current.length >= 3 && Math.hypot(result.x - firstPixel.x, result.y - firstPixel.y) <= 30) {
      finishTrace();
      return;
    }
    appendCorner(result.point);
  };

  const onTracePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drawMode !== "roof") return;
    const result = pointFromPointer(event);
    const map = mapRef.current;
    if (map && result) {
      setCursorPoint(result.point);
      renderDraft(map, draftRef.current, result.point);
    }
  };

  const clear = () => {
    cancelTrace();
    polygonRef.current?.setMap(null);
    polygonRef.current = null;
    onFootprintChange([], "roof");
    setArea(0);
  };

  useEffect(() => {
    if (mapRef.current && drawMode === "idle") syncCommittedPolygon(mapRef.current, footprint);
  }, [footprint, drawMode]);

  useEffect(() => {
    if (mapRef.current && hasLocatedSite) moveMap(center, 20);
  }, [center.lat, center.lng, hasLocatedSite]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !searchToken || !searchQuery?.trim()) return;
    setStatus("locating");
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: searchQuery, componentRestrictions: countryCode ? { country: countryCode.toLowerCase() } : undefined }, (results, geocodeStatus) => {
      const result = results?.[0];
      if (geocodeStatus !== "OK" || !result?.geometry?.location) {
        setStatus("not-found");
        return;
      }
      const point = { lat: result.geometry.location.lat(), lng: result.geometry.location.lng() };
      emitCenter(point, result.formatted_address);
      setStatus("ready");
    });
  }, [searchToken, countryCode, searchQuery]);

  useEffect(() => {
    if (!command || command.id <= lastCommandRef.current) return;
    lastCommandRef.current = command.id;
    if (command.action === "roof") startTrace();
    if (command.action === "street") startStreetView();
    if (command.action === "satellite") setSatellite();
  }, [command]);

  const toolbarText = status === "locating" ? copy.finding
    : status === "not-found" ? copy.notFound
      : status === "street-unavailable" ? copy.panoramaUnavailable
        : drawMode === "roof" ? copy.traceMode
          : facadeMode ? copy.facadeHelp
            : view === "street" ? copy.streetMode
              : copy.ready;

  return <div className={`map-live-shell ${drawMode === "roof" ? "drawing" : ""} ${view === "street" ? "street-mode" : ""} ${facadeMode ? "facade-mode" : ""}`}>
    <div className="map-live-toolbar">
      <div><span><i />{copy.toolbarTitle}</span><small>{toolbarText}</small></div>
      <div className="map-live-metrics">
        <div className="map-metric-pill"><Ruler size={14} /><span><small>{drawMode === "roof" ? copy.draftArea : copy.area}</small><b>{displayArea > 0 ? `${number.format(displayArea)} m²` : "—"}</b></span></div>
        <div className="map-metric-pill"><Crosshair size={14} /><span><small>{copy.vertices}</small><b>{displayVertices}</b></span></div>
      </div>
    </div>
    <div className="map-viewport">
      <MapView className="live-property-map" initialCenter={center} initialZoom={hasLocatedSite ? 20 : 6} onMapReady={(map) => {
        mapRef.current = map;
        const projectionOverlay = new google.maps.OverlayView();
        projectionOverlay.onAdd = () => undefined;
        projectionOverlay.draw = () => undefined;
        projectionOverlay.onRemove = () => undefined;
        projectionOverlay.setMap(map);
        projectionOverlayRef.current = projectionOverlay;
        map.setOptions({ mapTypeId: "satellite", mapTypeControl: false, fullscreenControl: false, streetViewControl: true, streetViewControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM }, rotateControl: true, tilt: 0, gestureHandling: "greedy", disableDefaultUI: false, zoomControl: true });
        map.getStreetView().addListener("visible_changed", () => {
          const visible = map.getStreetView().getVisible();
          setView(visible ? "street" : "satellite");
          if (!visible) setFacadeMode(false);
        });
        map.addListener("click", (event: google.maps.MapMouseEvent) => {
          if (!event.latLng || drawModeRef.current !== "roof") return;
          appendCorner({ lat: event.latLng.lat(), lng: event.latLng.lng() });
        });
        syncCommittedPolygon(map, footprint);
      }} />
      {!hasLocatedSite && drawMode === "idle" && view === "satellite" && <div className="map-awaiting-location"><MapPin size={20} /><b>{copy.findProperty}</b><span>{copy.findHelp}</span></div>}
      {hasLocatedSite && drawMode === "idle" && view === "satellite" && <div className="pegman-road-guide" aria-hidden="true"><i>●</i><span>{copy.pegmanHint}</span></div>}
      {drawMode === "roof" && <div className="corner-trace-layer" onPointerDown={onTracePointerDown} onPointerMove={onTracePointerMove} aria-label="Roof boundary drawing surface" />}
      {facadeMode && <div className="facade-study-layer" onPointerDown={selectFacade} role="button" aria-label={copy.facade}><div><Building2 size={19} /><b>{copy.facade}</b><span>{copy.facadeHelp}</span><small>{copy.facadeSelected}</small></div></div>}
    </div>
    <div className="map-live-controls">
      <button className={view === "satellite" ? "map-control selected" : "map-control"} onClick={setSatellite}><Layers3 size={15} />{copy.satellite}</button>
      {drawMode === "idle" && view === "satellite" && <button className="map-control map-control-primary" onClick={startTrace}><MousePointer2 size={15} />{copy.trace}</button>}
      {drawMode === "roof" && <button className="map-control map-control-primary" disabled={!canClose} onClick={finishTrace}><CheckCircle2 size={15} />{copy.closeButton}</button>}
      {drawMode === "roof" && <button className="map-control" disabled={draft.length === 0} onClick={undo}><Undo2 size={15} />{copy.undo}</button>}
      {drawMode === "roof" && <button className="map-control" onClick={cancelTrace}><X size={15} />{copy.clear}</button>}
      {view === "street" && <button className={facadeMode ? "map-control map-control-primary" : "map-control"} onClick={() => setFacadeMode((current) => !current)}><Building2 size={15} />{copy.facade}</button>}
      {(footprint.length > 0 && drawMode === "idle") && <button className="map-control map-control-icon" onClick={clear} title={copy.clear}><Trash2 size={15} /></button>}
    </div>
    {drawMode === "roof" && <div className="drawing-instruction"><Crosshair size={17} /><span><b>{draft.length < 3 ? `${Math.max(0, 3 - draft.length)} ${copy.minimumHint}` : copy.closureTarget}</b>{draft.length < 3 ? copy.traceHelp : copy.closeHint}</span></div>}
    <div className="map-live-caption"><span>{view === "street" ? "STREET VIEW" : drawMode === "roof" ? "ROOF TRACE" : "SATELLITE"}</span><span>{view === "street" ? (facadeMode ? copy.facadeHelp : copy.streetMode) : drawMode === "roof" ? `${draft.length} ${copy.vertices.toLowerCase()} · ${canClose ? copy.closureTarget : copy.closeHint}` : footprint.length >= 3 ? `${footprint.length} ${copy.vertices.toLowerCase()} · ${number.format(area)} m²` : copy.ready}</span></div>
  </div>;
}
