/**
 * Google Maps Platform Solar API — `buildingInsights:findClosest`.
 * Used as an external roof-geometry reference (segment pitch, azimuth, area,
 * sunshine hours). It never replaces the customer empirical generation model.
 */

export type GoogleSolarRoofSegment = {
  pitchDeg: number;
  azimuthDeg: number;
  areaM2: number;
  groundAreaM2: number;
  sunshineMedianHoursPerYear: number | null;
};

export type GoogleSolarReference = {
  status: "ok" | "not-found" | "unavailable";
  buildingId?: string;
  center?: { lat: number; lng: number };
  distanceM?: number;
  imageryQuality?: string;
  imageryDate?: string;
  wholeRoofAreaM2?: number;
  maxArrayAreaM2?: number;
  maxArrayPanelsCount?: number;
  maxSunshineHoursPerYear?: number;
  roofSegments?: GoogleSolarRoofSegment[];
  note: string;
};

type LatLng = { latitude?: number; longitude?: number };
type SizeAndSunshine = { areaMeters2?: number; groundAreaMeters2?: number; sunshineQuantiles?: number[] };
type BuildingInsights = {
  name?: string;
  center?: LatLng;
  imageryQuality?: string;
  imageryDate?: { year?: number; month?: number; day?: number };
  solarPotential?: {
    maxArrayPanelsCount?: number;
    maxArrayAreaMeters2?: number;
    maxSunshineHoursPerYear?: number;
    wholeRoofStats?: SizeAndSunshine;
    roofSegmentStats?: ({ pitchDegrees?: number; azimuthDegrees?: number; stats?: SizeAndSunshine })[];
  };
  error?: { code?: number; status?: string; message?: string };
};

export const GOOGLE_SOLAR_ENDPOINT = "https://solar.googleapis.com/v1/buildingInsights:findClosest";

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = 6_371_000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

const round = (value: number | undefined, digits = 1) => (Number.isFinite(value) ? Number((value as number).toFixed(digits)) : undefined);

export function parseBuildingInsights(payload: BuildingInsights, requested: { lat: number; lng: number }): GoogleSolarReference {
  if (payload.error) {
    const notFound = payload.error.code === 404 || payload.error.status === "NOT_FOUND";
    return { status: notFound ? "not-found" : "unavailable", note: notFound ? "Google Solar has no building model at this location." : `Google Solar request failed (${payload.error.status ?? payload.error.code ?? "error"}).` };
  }
  const potential = payload.solarPotential;
  const center = payload.center?.latitude !== undefined && payload.center?.longitude !== undefined ? { lat: payload.center.latitude, lng: payload.center.longitude } : undefined;
  const date = payload.imageryDate;
  const segments = (potential?.roofSegmentStats ?? []).map((segment) => {
    const quantiles = segment.stats?.sunshineQuantiles ?? [];
    return {
      pitchDeg: round(segment.pitchDegrees) ?? 0,
      azimuthDeg: round(segment.azimuthDegrees) ?? 0,
      areaM2: round(segment.stats?.areaMeters2) ?? 0,
      groundAreaM2: round(segment.stats?.groundAreaMeters2) ?? 0,
      sunshineMedianHoursPerYear: quantiles.length ? round(quantiles[Math.floor(quantiles.length / 2)], 0) ?? null : null,
    };
  }).sort((a, b) => b.areaM2 - a.areaM2);
  return {
    status: "ok",
    buildingId: payload.name,
    center,
    distanceM: center ? Math.round(haversineM(requested, center)) : undefined,
    imageryQuality: payload.imageryQuality,
    imageryDate: date?.year ? `${date.year}-${String(date.month ?? 1).padStart(2, "0")}-${String(date.day ?? 1).padStart(2, "0")}` : undefined,
    wholeRoofAreaM2: round(potential?.wholeRoofStats?.areaMeters2),
    maxArrayAreaM2: round(potential?.maxArrayAreaMeters2),
    maxArrayPanelsCount: potential?.maxArrayPanelsCount,
    maxSunshineHoursPerYear: round(potential?.maxSunshineHoursPerYear, 0),
    roofSegments: segments,
    note: "Google Solar roof model (aerial imagery and DSM). Used as a roof-geometry reference only; generation follows the customer empirical model.",
  };
}

export async function fetchBuildingInsights(input: { lat: number; lng: number; apiKey: string; timeoutMs?: number }): Promise<GoogleSolarReference> {
  const url = new URL(GOOGLE_SOLAR_ENDPOINT);
  url.searchParams.set("location.latitude", input.lat.toFixed(6));
  url.searchParams.set("location.longitude", input.lng.toFixed(6));
  url.searchParams.set("requiredQuality", "LOW");
  url.searchParams.set("key", input.apiKey);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 12_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const payload = (await response.json()) as BuildingInsights;
    return parseBuildingInsights(payload, input);
  } catch (error) {
    return { status: "unavailable", note: `Google Solar is temporarily unavailable${error instanceof Error && !/abort/i.test(error.message) ? ` (${error.message})` : ""}.` };
  } finally {
    clearTimeout(timer);
  }
}
