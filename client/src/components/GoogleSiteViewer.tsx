import { useEffect, useRef, useState } from "react";
import { Box, ExternalLink, Footprints, X } from "lucide-react";
import { loadGoogleMaps } from "@/lib/google-maps";
import { trpc } from "@/lib/trpc";

type LatLng = { lat: number; lng: number };
type ViewMode = "street" | "earth";
type Language = "en" | "zh" | "zh-Hant" | "fr" | "ja" | "es" | "it";

const TEXT: Record<Language, { street: string; earth: string; close: string; views: (label: string) => string; noKey: string; loading: string; earthHint: string; project: string; noPano: string; unavailable: (reason: string) => string }> = {
  en: { street: "Street View", earth: "3D (Earth view)", close: "Close", views: (l) => `Google views of ${l}`, noKey: "Google Maps is not configured on this server. Use the Google links below.", loading: "Loading Google imagery…", earthHint: "Google photorealistic 3D · drag to orbit, scroll to zoom", project: "Project", noPano: "No Street View panorama within 100 m of this address.", unavailable: (r) => `Google imagery unavailable here (${r}).` },
  zh: { street: "街景", earth: "三维（地球视图）", close: "关闭", views: (l) => `${l} 的谷歌视图`, noKey: "此服务器未配置谷歌地图，请使用下方的谷歌链接。", loading: "正在加载谷歌影像…", earthHint: "谷歌写实三维 · 拖动旋转，滚轮缩放", project: "项目", noPano: "该地址 100 米内没有街景全景。", unavailable: (r) => `此处无法获取谷歌影像（${r}）。` },
  "zh-Hant": { street: "街景", earth: "3D（地球檢視）", close: "關閉", views: (l) => `${l} 的 Google 檢視`, noKey: "此伺服器未設定 Google 地圖，請使用下方的 Google 連結。", loading: "正在載入 Google 影像…", earthHint: "Google 寫實 3D · 拖曳旋轉，滾輪縮放", project: "專案", noPano: "此地址 100 公尺內沒有街景全景。", unavailable: (r) => `此處無法取得 Google 影像（${r}）。` },
  fr: { street: "Street View", earth: "3D (vue Earth)", close: "Fermer", views: (l) => `Vues Google de ${l}`, noKey: "Google Maps n'est pas configuré sur ce serveur. Utilisez les liens Google ci-dessous.", loading: "Chargement des images Google…", earthHint: "3D photoréaliste Google · faites glisser pour pivoter, molette pour zoomer", project: "Projet", noPano: "Aucun panorama Street View à moins de 100 m de cette adresse.", unavailable: (r) => `Images Google indisponibles ici (${r}).` },
  ja: { street: "ストリートビュー", earth: "3D（Earth ビュー）", close: "閉じる", views: (l) => `${l} の Google ビュー`, noKey: "このサーバーでは Google マップが設定されていません。下の Google リンクをご利用ください。", loading: "Google 画像を読み込み中…", earthHint: "Google フォトリアル 3D · ドラッグで回転、スクロールでズーム", project: "プロジェクト", noPano: "この住所から 100 m 以内にストリートビューはありません。", unavailable: (r) => `この場所では Google 画像を利用できません（${r}）。` },
  es: { street: "Street View", earth: "3D (vista Earth)", close: "Cerrar", views: (l) => `Vistas de Google de ${l}`, noKey: "Google Maps no está configurado en este servidor. Use los enlaces de Google de abajo.", loading: "Cargando imágenes de Google…", earthHint: "3D fotorrealista de Google · arrastre para girar, rueda para ampliar", project: "Proyecto", noPano: "No hay panorama de Street View a menos de 100 m de esta dirección.", unavailable: (r) => `Imágenes de Google no disponibles aquí (${r}).` },
  it: { street: "Street View", earth: "3D (vista Earth)", close: "Chiudi", views: (l) => `Viste Google di ${l}`, noKey: "Google Maps non è configurato su questo server. Usa i link Google qui sotto.", loading: "Caricamento immagini Google…", earthHint: "3D fotorealistico Google · trascina per ruotare, rotella per lo zoom", project: "Progetto", noPano: "Nessun panorama Street View entro 100 m da questo indirizzo.", unavailable: (r) => `Immagini Google non disponibili qui (${r}).` },
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
      setMessage(t.noKey);
      return;
    }
    let cancelled = false;
    host.replaceChildren();
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
        if (cancelled) return;
        const map = new maps3d.Map3DElement({ center: { lat: coordinates.lat, lng: coordinates.lng, altitude: 0 }, range: 260, tilt: 62, heading: 20, mode: "HYBRID" });
        map.style.width = "100%";
        map.style.height = "100%";
        host.append(map);
        if (maps3d.Marker3DElement) map.append(new maps3d.Marker3DElement({ position: { lat: coordinates.lat, lng: coordinates.lng }, label: t.project }));
        setMessage(t.earthHint);
      }
    })().catch((error: unknown) => {
      if (cancelled) return;
      const text = error instanceof Error ? error.message : String(error);
      setMessage(mode === "street" && /ZERO_RESULTS|not find|No panorama/i.test(text) ? t.noPano : t.unavailable(text));
    });
    return () => {
      cancelled = true;
    };
  }, [apiKey, config.isLoading, waitForFootprint, coordinates, mode, target.lat, target.lng, streetPoint?.lat, streetPoint?.lng, t]);

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
          <a href={googleStreetViewUrl(coordinates)} target="_blank" rel="noreferrer">{t.street} <ExternalLink size={12} /></a>
          <a href={googleEarthUrl(coordinates)} target="_blank" rel="noreferrer">Google Earth <ExternalLink size={12} /></a>
        </footer>
      </div>
    </div>
  );
}
