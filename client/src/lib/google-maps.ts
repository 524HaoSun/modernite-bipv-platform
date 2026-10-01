const CALLBACK = "__moderniteGoogleMapsReady";
let loader: Promise<void> | null = null;

export function loadGoogleMaps(apiKey: string) {
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

export type GoogleTileType = "satellite" | "roadmap";
export type GoogleTileSession = { session: string; expiry: number };

type MapStyle = { featureType?: string; elementType?: string; stylers: Array<Record<string, string | number>> };

const QUIET_LABELS: MapStyle[] = [
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi.attraction", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
];

/** Modernité brand basemap for the Map Tiles API (same schema as Maps JS styles). */
const BRAND_ROADMAP: MapStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f1f5f0" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#4d665a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f8fbf7" }, { weight: 3 }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#b9cbbb" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#0e2d34" }] },
  { featureType: "landscape.man_made", elementType: "geometry.fill", stylers: [{ color: "#e6ede4" }] },
  { featureType: "landscape.man_made", elementType: "geometry.stroke", stylers: [{ color: "#cbd9c9" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#e9f1e6" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#e3ece0" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#cfe3cf" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#3f6f50" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#d9e4d7" }] },
  { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#5d7568" }] },
  { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#dcebdd" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#a9c6ae" }] },
  { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#c5d6c6" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c4ddd6" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4f7f73" }] },
  ...QUIET_LABELS,
];

const STYLE_VERSION = "brand1";
const sessions = new Map<string, Promise<GoogleTileSession>>();

/** Map Tiles API session (valid ~2 weeks); cached per key/type/language/region in memory and localStorage. */
export function googleTileSession(apiKey: string, mapType: GoogleTileType, language: string, region: string) {
  const highDpi = typeof window !== "undefined" && window.devicePixelRatio >= 1.5;
  const cacheKey = `modernite-gtile:${apiKey.slice(-6)}:${mapType}:${language}:${region}:${STYLE_VERSION}:${highDpi ? 2 : 1}`;
  const now = Date.now() / 1000;
  try {
    const stored = JSON.parse(window.localStorage.getItem(cacheKey) ?? "null") as GoogleTileSession | null;
    if (stored?.session && stored.expiry - now > 3600) return Promise.resolve(stored);
  } catch {
    // storage unavailable
  }
  const pending = sessions.get(cacheKey);
  if (pending) return pending;
  const request = fetch(`https://tile.googleapis.com/v1/createSession?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mapType,
      language,
      region,
      ...(highDpi ? { scale: "scaleFactor2x", highDpi: true } : {}),
      ...(mapType === "satellite" ? { layerTypes: ["layerRoadmap"], overlay: false, styles: QUIET_LABELS } : { styles: BRAND_ROADMAP }),
    }),
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Map Tiles session failed (${response.status})`);
      const data = (await response.json()) as { session: string; expiry: string };
      const session = { session: data.session, expiry: Number(data.expiry) };
      try {
        window.localStorage.setItem(cacheKey, JSON.stringify(session));
      } catch {
        // storage unavailable
      }
      return session;
    })
    .catch((error: unknown) => {
      sessions.delete(cacheKey);
      throw error;
    });
  sessions.set(cacheKey, request);
  return request;
}

export const googleTileUrl = (apiKey: string, session: string, zoom: number, x: number, y: number) =>
  `https://tile.googleapis.com/v1/2dtiles/${zoom}/${x}/${y}?session=${encodeURIComponent(session)}&key=${encodeURIComponent(apiKey)}`;

export type GoogleViewportInfo = { copyright: string; maxZoom: number | null };

/** Viewport info: attribution plus the deepest zoom with imagery at the viewport centre (`maxZoomRects`). */
export async function googleViewportInfo(apiKey: string, session: string, zoom: number, bounds: { north: number; south: number; east: number; west: number }): Promise<GoogleViewportInfo> {
  const params = new URLSearchParams({ session, key: apiKey, zoom: String(zoom), north: bounds.north.toFixed(6), south: bounds.south.toFixed(6), east: bounds.east.toFixed(6), west: bounds.west.toFixed(6) });
  const response = await fetch(`https://tile.googleapis.com/tile/v1/viewport?${params.toString()}`);
  if (!response.ok) throw new Error(`Viewport info failed (${response.status})`);
  const data = (await response.json()) as { copyright?: string; maxZoomRects?: Array<{ maxZoom: number; north: number; south: number; east: number; west: number }> };
  const lat = (bounds.north + bounds.south) / 2;
  const lng = (bounds.east + bounds.west) / 2;
  const covering = (data.maxZoomRects ?? []).filter((rect) => lat <= rect.north && lat >= rect.south && lng <= rect.east && lng >= rect.west);
  return { copyright: data.copyright ?? "", maxZoom: covering.length ? Math.max(...covering.map((rect) => rect.maxZoom)) : null };
}

/** Maps JS Geocoder (the key is referrer-restricted, so the REST geocoding endpoint is not usable). */
export async function googleGeocode(apiKey: string, address: string, language: string, country?: string) {
  await loadGoogleMaps(apiKey);
  const { Geocoder } = (await google.maps.importLibrary("geocoding")) as google.maps.GeocodingLibrary;
  const { results } = await new Geocoder().geocode({ address, language, ...(country ? { componentRestrictions: { country } } : {}) });
  const result = results.find((item) => !item.types.includes("country")) ?? results[0];
  if (!result) return null;
  return { coordinates: { lat: result.geometry.location.lat(), lng: result.geometry.location.lng() }, label: result.formatted_address };
}
