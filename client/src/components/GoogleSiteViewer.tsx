import { useEffect, useRef, useState } from "react";
import { Box, ExternalLink, Footprints, RotateCw, X } from "lucide-react";
import { loadGoogleMaps } from "@/lib/google-maps";
import { trpc } from "@/lib/trpc";

type LatLng = { lat: number; lng: number };
type ViewMode = "street" | "earth";
type Language = "en" | "zh" | "zh-Hant" | "fr" | "ja" | "es" | "it";

const TEXT: Record<Language, { street: string; earth: string; close: string; views: (label: string) => string; noKey: string; loading: string; earthHint: string; project: string; noPano: string; unavailable: (reason: string) => string; orbit: string; orbiting: string }> = {
  en: { street: "Street View", earth: "3D (Earth view)", close: "Close", views: (l) => `Google views of ${l}`, noKey: "Google Maps is not configured on this server. Use the Google links below.", loading: "Loading Google imagery…", earthHint: "Google photorealistic 3D · drag to orbit, scroll to zoom", project: "Project", noPano: "No Street View panorama within 100 m of this address.", unavailable: (r) => `Google imagery unavailable here (${r}).`, orbit: "Orbit again", orbiting: "Circling the building · drag to take over" },
  zh: { street: "街景", earth: "三维（地球视图）", close: "关闭", views: (l) => `${l} 的谷歌视图`, noKey: "此服务器未配置谷歌地图，请使用下方的谷歌链接。", loading: "正在加载谷歌影像…", earthHint: "谷歌写实三维 · 拖动旋转，滚轮缩放", project: "项目", noPano: "该地址 100 米内没有街景全景。", unavailable: (r) => `此处无法获取谷歌影像（${r}）。`, orbit: "再转一圈", orbiting: "正在环绕这栋建筑 · 拖动即可接管视角" },
  "zh-Hant": { street: "街景", earth: "3D（地球檢視）", close: "關閉", views: (l) => `${l} 的 Google 檢視`, noKey: "此伺服器未設定 Google 地圖，請使用下方的 Google 連結。", loading: "正在載入 Google 影像…", earthHint: "Google 寫實 3D · 拖曳旋轉，滾輪縮放", project: "專案", noPano: "此地址 100 公尺內沒有街景全景。", unavailable: (r) => `此處無法取得 Google 影像（${r}）。`, orbit: "再轉一圈", orbiting: "正在環繞這棟建築 · 拖曳即可接管視角" },
  fr: { street: "Street View", earth: "3D (vue Earth)", close: "Fermer", views: (l) => `Vues Google de ${l}`, noKey: "Google Maps n'est pas configuré sur ce serveur. Utilisez les liens Google ci-dessous.", loading: "Chargement des images Google…", earthHint: "3D photoréaliste Google · faites glisser pour pivoter, molette pour zoomer", project: "Projet", noPano: "Aucun panorama Street View à moins de 100 m de cette adresse.", unavailable: (r) => `Images Google indisponibles ici (${r}).`, orbit: "Refaire le tour", orbiting: "Tour du bâtiment · faites glisser pour reprendre la main" },
  ja: { street: "ストリートビュー", earth: "3D（Earth ビュー）", close: "閉じる", views: (l) => `${l} の Google ビュー`, noKey: "このサーバーでは Google マップが設定されていません。下の Google リンクをご利用ください。", loading: "Google 画像を読み込み中…", earthHint: "Google フォトリアル 3D · ドラッグで回転、スクロールでズーム", project: "プロジェクト", noPano: "この住所から 100 m 以内にストリートビューはありません。", unavailable: (r) => `この場所では Google 画像を利用できません（${r}）。`, orbit: "もう一周", orbiting: "建物の周囲を周回中 · ドラッグで操作を引き継げます" },
  es: { street: "Street View", earth: "3D (vista Earth)", close: "Cerrar", views: (l) => `Vistas de Google de ${l}`, noKey: "Google Maps no está configurado en este servidor. Use los enlaces de Google de abajo.", loading: "Cargando imágenes de Google…", earthHint: "3D fotorrealista de Google · arrastre para girar, rueda para ampliar", project: "Proyecto", noPano: "No hay panorama de Street View a menos de 100 m de esta dirección.", unavailable: (r) => `Imágenes de Google no disponibles aquí (${r}).`, orbit: "Dar otra vuelta", orbiting: "Rodeando el edificio · arrastre para tomar el control" },
  it: { street: "Street View", earth: "3D (vista Earth)", close: "Chiudi", views: (l) => `Viste Google di ${l}`, noKey: "Google Maps non è configurato su questo server. Usa i link Google qui sotto.", loading: "Caricamento immagini Google…", earthHint: "3D fotorealistico Google · trascina per ruotare, rotella per lo zoom", project: "Progetto", noPano: "Nessun panorama Street View entro 100 m da questo indirizzo.", unavailable: (r) => `Immagini Google non disponibili qui (${r}).`, orbit: "Fai un altro giro", orbiting: "Giro attorno all'edificio · trascina per prendere il controllo" },
};

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

export function GoogleSiteViewer({ coordinates, label, language = "en", initialMode = "street", onClose }: { coordinates: LatLng; label: string; language?: string; initialMode?: ViewMode; onClose: () => void }) {
  const t = TEXT[language as Language] ?? TEXT.en;
  const config = trpc.site.publicConfig.useQuery(undefined, { staleTime: Infinity });
  const [mode, setMode] = useState<ViewMode>(initialMode);
  const [message, setMessage] = useState<string | null>(null);
  const [orbiting, setOrbiting] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const orbitRef = useRef<(() => void) | null>(null);
  const apiKey = config.data?.googleMapsApiKey;
  const footprint = trpc.site.buildingFootprint.useQuery(coordinates, { staleTime: Infinity, retry: 1 });
  const elevation = trpc.site.groundElevation.useQuery(coordinates, { staleTime: Infinity, retry: 1, enabled: mode === "earth" });
  const building = footprint.data?.status === "ok" && footprint.data.path?.length ? footprint.data : null;
  const target = building
    ? { lat: building.path!.reduce((sum, p) => sum + p.lat, 0) / building.path!.length, lng: building.path!.reduce((sum, p) => sum + p.lng, 0) / building.path!.length }
    : coordinates;
  const streetPoint = building?.frontAzimuthDeg != null && building.depthM ? offsetPoint(target, building.frontAzimuthDeg, building.depthM / 2 + 10) : null;
  const waitForFootprint = footprint.isLoading || (mode === "earth" && elevation.isLoading);
  const groundM = elevation.data?.elevationM ?? null;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || config.isLoading || waitForFootprint) return;
    if (!apiKey) {
      setMessage(t.noKey);
      return;
    }
    let cancelled = false;
    const cleanups: Array<() => void> = [];
    host.replaceChildren();
    orbitRef.current = null;
    setOrbiting(false);
    setMessage(t.loading);
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
        setMessage(data.imageDate ? `Google ${t.street} · ${data.imageDate}` : `Google ${t.street}`);
      } else {
        const maps3d = (await google.maps.importLibrary("maps3d")) as unknown as Record<string, new (options: Record<string, unknown>) => HTMLElement>;
        const markerLib = (await google.maps.importLibrary("marker").catch(() => null)) as google.maps.MarkerLibrary | null;
        if (cancelled) return;
        const heightM = building?.heightM ?? (building?.floors ? building.floors * 3 + 2 : 8);
        const span = Math.max(building?.widthM ?? 12, building?.depthM ?? 12);
        const range = Math.min(320, Math.max(150, span * 5));
        const heading = building?.frontAzimuthDeg != null ? (building.frontAzimuthDeg + 180) % 360 : 20;
        const center = { lat: target.lat, lng: target.lng, altitude: (groundM ?? 0) + heightM * 0.5 };
        const camera = { center, range, tilt: 62, heading };
        const map = new maps3d.Map3DElement({ center, range: range * 3, tilt: 38, heading: heading - 50, mode: "HYBRID" }) as HTMLElement & {
          flyCameraTo: (options: Record<string, unknown>) => void;
          flyCameraAround: (options: Record<string, unknown>) => void;
          stopCameraAnimation: () => void;
        };
        map.style.width = "100%";
        map.style.height = "100%";
        host.append(map);

        const marker = new maps3d.Marker3DElement({ position: { lat: target.lat, lng: target.lng, altitude: heightM + 12 }, altitudeMode: "RELATIVE_TO_GROUND", extruded: true, label: t.project });
        try {
          if (markerLib?.PinElement) marker.append(new markerLib.PinElement({ background: "#0e644a", borderColor: "#07452f", glyphColor: "#ffffff", scale: 1.15 }) as unknown as Node);
        } catch {
          // older maps3d builds only render the default pin
        }
        map.append(marker);
        if (building?.path && maps3d.Polygon3DElement) {
          map.append(new maps3d.Polygon3DElement({
            outerCoordinates: building.path.map((point) => ({ lat: point.lat, lng: point.lng })),
            altitudeMode: "CLAMP_TO_GROUND",
            fillColor: "rgba(14, 100, 74, 0.28)",
            strokeColor: "#18b07a",
            strokeWidth: 4,
            drawsOccludedSegments: true,
          }));
        }

        let phase: "intro" | "orbit" | "idle" = "intro";
        let fallback = 0;
        const expect = (ms: number) => {
          window.clearTimeout(fallback);
          fallback = window.setTimeout(() => onAnimationEnd(), ms + 4000);
        };
        const orbit = () => {
          phase = "orbit";
          setOrbiting(true);
          setMessage(t.orbiting);
          map.flyCameraAround({ camera, durationMillis: 18000, repeatCount: 1 });
          expect(18000);
        };
        const settle = () => {
          window.clearTimeout(fallback);
          phase = "idle";
          setOrbiting(false);
          setMessage(t.earthHint);
        };
        const onAnimationEnd = () => (phase === "intro" ? orbit() : phase === "orbit" && settle());
        const takeOver = () => {
          if (phase === "idle") return;
          phase = "idle";
          map.stopCameraAnimation();
          settle();
        };
        map.addEventListener("gmp-animationend", onAnimationEnd);
        host.addEventListener("pointerdown", takeOver);
        host.addEventListener("wheel", takeOver, { passive: true });
        cleanups.push(() => {
          window.clearTimeout(fallback);
          map.removeEventListener("gmp-animationend", onAnimationEnd);
          host.removeEventListener("pointerdown", takeOver);
          host.removeEventListener("wheel", takeOver);
        });
        orbitRef.current = () => {
          phase = "intro";
          setOrbiting(true);
          setMessage(t.orbiting);
          map.flyCameraTo({ endCamera: camera, durationMillis: 1400 });
          expect(1400);
        };
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          map.flyCameraTo({ endCamera: camera, durationMillis: 0 });
          settle();
        } else {
          setOrbiting(true);
          setMessage(t.orbiting);
          map.flyCameraTo({ endCamera: camera, durationMillis: 2800 });
          expect(2800);
        }
      }
    })().catch((error: unknown) => {
      if (cancelled) return;
      const text = error instanceof Error ? error.message : String(error);
      setMessage(mode === "street" && /ZERO_RESULTS|not find|No panorama/i.test(text) ? t.noPano : t.unavailable(text));
    });
    return () => {
      cancelled = true;
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [apiKey, config.isLoading, waitForFootprint, coordinates, mode, target.lat, target.lng, streetPoint?.lat, streetPoint?.lng, groundM, t]);

  return (
    <div className="site-viewer-backdrop" role="dialog" aria-modal="true" aria-label={t.views(label)} onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="site-viewer">
        <header>
          <div className="site-viewer-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={mode === "street"} className={mode === "street" ? "is-active" : ""} onClick={() => setMode("street")}><Footprints size={15} /> {t.street}</button>
            <button type="button" role="tab" aria-selected={mode === "earth"} className={mode === "earth" ? "is-active" : ""} onClick={() => setMode("earth")}><Box size={15} /> {t.earth}</button>
          </div>
          <strong title={label}>{label}</strong>
          <button type="button" className="site-viewer-close" onClick={onClose} aria-label={t.close}><X size={18} /></button>
        </header>
        <div className="site-viewer-stage" ref={hostRef} />
        <footer>
          <span>{message}</span>
          {mode === "earth" && apiKey && <button type="button" className="site-viewer-orbit" disabled={orbiting} onClick={() => orbitRef.current?.()}><RotateCw size={12} /> {t.orbit}</button>}
          <a href={googleStreetViewUrl(coordinates)} target="_blank" rel="noreferrer">{t.street} <ExternalLink size={12} /></a>
          <a href={googleEarthUrl(coordinates)} target="_blank" rel="noreferrer">Google Earth <ExternalLink size={12} /></a>
        </footer>
      </div>
    </div>
  );
}
