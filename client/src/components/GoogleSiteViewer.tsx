import { useEffect, useRef, useState } from "react";
import { Box, ExternalLink, Footprints, X } from "lucide-react";
import { trpc } from "@/lib/trpc";

type LatLng = { lat: number; lng: number };
type ViewMode = "street" | "earth";

const CALLBACK = "__moderniteGoogleMapsReady";
let loader: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string) {
  if (typeof window.google?.maps?.importLibrary === "function") return Promise.resolve();
  loader ??= new Promise<void>((resolve, reject) => {
    (window as unknown as Record<string, () => void>)[CALLBACK] = () => resolve();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&callback=${CALLBACK}`;
    script.async = true;
    script.onerror = () => {
      loader = null;
      reject(new Error("Google Maps could not be loaded."));
    };
    document.head.append(script);
  });
  return loader;
}

function headingBetween(from: LatLng, to: LatLng) {
  const rad = Math.PI / 180;
  const y = Math.sin((to.lng - from.lng) * rad) * Math.cos(to.lat * rad);
  const x = Math.cos(from.lat * rad) * Math.sin(to.lat * rad) - Math.sin(from.lat * rad) * Math.cos(to.lat * rad) * Math.cos((to.lng - from.lng) * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

function offsetPoint(origin: LatLng, azimuthDeg: number, distanceM: number): LatLng {
  const rad = Math.PI / 180;
  return {
    lat: origin.lat + (distanceM * Math.cos(azimuthDeg * rad)) / 111_320,
    lng: origin.lng + (distanceM * Math.sin(azimuthDeg * rad)) / (111_320 * Math.cos(origin.lat * rad)),
  };
}

export const googleEarthUrl = ({ lat, lng }: LatLng) => `https://earth.google.com/web/@${lat},${lng},60a,260d,35y,0h,60t,0r`;
export const googleStreetViewUrl = ({ lat, lng }: LatLng) => `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;

export function GoogleSiteViewer({ coordinates, label, initialMode = "street", onClose }: { coordinates: LatLng; label: string; initialMode?: ViewMode; onClose: () => void }) {
  const config = trpc.site.publicConfig.useQuery(undefined, { staleTime: Infinity });
  const [mode, setMode] = useState<ViewMode>(initialMode);
  const [message, setMessage] = useState<string | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const apiKey = config.data?.googleMapsApiKey;
  const footprint = trpc.site.buildingFootprint.useQuery(coordinates, { staleTime: Infinity, retry: 1, enabled: mode === "street" });
  const building = footprint.data?.status === "ok" && footprint.data.path?.length ? footprint.data : null;
  const target = building
    ? { lat: building.path!.reduce((sum, p) => sum + p.lat, 0) / building.path!.length, lng: building.path!.reduce((sum, p) => sum + p.lng, 0) / building.path!.length }
    : coordinates;
  const streetPoint = building?.frontAzimuthDeg != null && building.depthM ? offsetPoint(target, building.frontAzimuthDeg, building.depthM / 2 + 10) : null;
  const waitForFootprint = mode === "street" && footprint.isLoading;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || config.isLoading || waitForFootprint) return;
    if (!apiKey) {
      setMessage("Google Maps is not configured on this server. Use the Google links below.");
      return;
    }
    let cancelled = false;
    host.replaceChildren();
    setMessage("Loading Google imagery…");
    (async () => {
      await loadGoogleMaps(apiKey);
      if (cancelled) return;
      if (mode === "street") {
        const { StreetViewService, StreetViewPanorama, StreetViewSource, StreetViewPreference } = (await google.maps.importLibrary("streetView")) as google.maps.StreetViewLibrary;
        const service = new StreetViewService();
        const search = (location: LatLng, radius: number) => service.getPanorama({ location, radius, sources: [StreetViewSource.OUTDOOR], preference: StreetViewPreference.NEAREST });
        const { data } = streetPoint ? await search(streetPoint, 40).catch(() => search(target, 100)) : await search(target, 100);
        const panoLocation = data.location?.latLng;
        if (cancelled || !data.location?.pano || !panoLocation) return;
        new StreetViewPanorama(host, {
          pano: data.location.pano,
          pov: { heading: headingBetween({ lat: panoLocation.lat(), lng: panoLocation.lng() }, target), pitch: 10 },
          zoom: 0,
          addressControl: false,
          fullscreenControl: false,
          motionTracking: false,
          motionTrackingControl: false,
        });
        setMessage(data.imageDate ? `Google Street View · ${data.imageDate}` : "Google Street View");
      } else {
        const maps3d = (await google.maps.importLibrary("maps3d")) as unknown as Record<string, new (options: Record<string, unknown>) => HTMLElement>;
        if (cancelled) return;
        const map = new maps3d.Map3DElement({ center: { lat: coordinates.lat, lng: coordinates.lng, altitude: 0 }, range: 260, tilt: 62, heading: 20, mode: "HYBRID" });
        map.style.width = "100%";
        map.style.height = "100%";
        host.append(map);
        if (maps3d.Marker3DElement) map.append(new maps3d.Marker3DElement({ position: { lat: coordinates.lat, lng: coordinates.lng }, label: "Project" }));
        setMessage("Google photorealistic 3D · drag to orbit, scroll to zoom");
      }
    })().catch((error: unknown) => {
      if (cancelled) return;
      const text = error instanceof Error ? error.message : String(error);
      setMessage(mode === "street" && /ZERO_RESULTS|not find|No panorama/i.test(text) ? "No Street View panorama within 100 m of this address." : `Google imagery unavailable here (${text}).`);
    });
    return () => {
      cancelled = true;
    };
  }, [apiKey, config.isLoading, waitForFootprint, coordinates, mode, target.lat, target.lng, streetPoint?.lat, streetPoint?.lng]);

  return (
    <div className="site-viewer-backdrop" role="dialog" aria-modal="true" aria-label={`Google views of ${label}`} onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="site-viewer">
        <header>
          <div className="site-viewer-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={mode === "street"} className={mode === "street" ? "is-active" : ""} onClick={() => setMode("street")}><Footprints size={15} /> Street View</button>
            <button type="button" role="tab" aria-selected={mode === "earth"} className={mode === "earth" ? "is-active" : ""} onClick={() => setMode("earth")}><Box size={15} /> 3D (Earth view)</button>
          </div>
          <strong title={label}>{label}</strong>
          <button type="button" className="site-viewer-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        <div className="site-viewer-stage" ref={hostRef} />
        <footer>
          <span>{message}</span>
          <a href={googleStreetViewUrl(coordinates)} target="_blank" rel="noreferrer">Street View <ExternalLink size={12} /></a>
          <a href={googleEarthUrl(coordinates)} target="_blank" rel="noreferrer">Google Earth <ExternalLink size={12} /></a>
        </footer>
      </div>
    </div>
  );
}
