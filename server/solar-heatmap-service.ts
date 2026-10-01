import { fromArrayBuffer } from "geotiff";
import { PNG } from "pngjs";
import { utmToLatLng, utmZoneFromEpsg } from "../lib/utm";
import { cachedValue } from "./persistent-cache";
import { ENV } from "./_core/env";

type LatLng = { lat: number; lng: number };

export type SolarHeatmap =
  | { status: "ok"; dataUrl: string; corners: { nw: LatLng; ne: LatLng; sw: LatLng; se: LatLng }; minKwhPerKw: number; maxKwhPerKw: number; imageryDate?: string; imageryQuality?: string }
  | { status: "not-found" | "unavailable" | "disabled"; note: string };

const DATA_LAYERS = "https://solar.googleapis.com/v1/dataLayers:get";
const TTL_MS = 365 * 24 * 60 * 60 * 1000;

/** Google's "iron" ramp: low sun → dark violet, high sun → pale yellow. */
const RAMP = [[0x00, 0x00, 0x0a], [0x91, 0x00, 0x9c], [0xe6, 0x40, 0x16], [0xfe, 0xb4, 0x00], [0xff, 0xff, 0xf6]];

function rampColour(t: number) {
  const x = Math.min(1, Math.max(0, t)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(x)), f = x - i;
  return RAMP[i]!.map((c, k) => Math.round(c + (RAMP[i + 1]![k]! - c) * f));
}

async function readTiff(url: string) {
  const response = await fetch(`${url}&key=${ENV.googleSolarApiKey}`, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`GeoTIFF download failed (${response.status})`);
  const tiff = await fromArrayBuffer(await response.arrayBuffer());
  const image = await tiff.getImage();
  const raster = (await image.readRasters())[0] as ArrayLike<number>;
  return { image, raster, width: image.getWidth(), height: image.getHeight() };
}

export function quantile(sorted: number[], q: number) {
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))]! : 0;
}

async function renderHeatmap(lat: number, lng: number): Promise<SolarHeatmap> {
  const url = new URL(DATA_LAYERS);
  url.searchParams.set("location.latitude", lat.toFixed(6));
  url.searchParams.set("location.longitude", lng.toFixed(6));
  url.searchParams.set("radiusMeters", "35");
  url.searchParams.set("view", "IMAGERY_AND_ANNUAL_FLUX_LAYERS");
  url.searchParams.set("requiredQuality", "LOW");
  url.searchParams.set("pixelSizeMeters", "0.25");
  url.searchParams.set("key", ENV.googleSolarApiKey);
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const layers = (await response.json()) as { annualFluxUrl?: string; maskUrl?: string; imageryQuality?: string; imageryDate?: { year?: number; month?: number; day?: number }; error?: { code?: number; status?: string; message?: string } };
  if (layers.error || !layers.annualFluxUrl || !layers.maskUrl) {
    const notFound = layers.error?.code === 404 || layers.error?.status === "NOT_FOUND";
    return { status: notFound ? "not-found" : "unavailable", note: notFound ? "Google Solar has no roof imagery here." : `Google Solar data layers failed (${layers.error?.status ?? response.status}).` };
  }
  const [flux, mask] = await Promise.all([readTiff(layers.annualFluxUrl), readTiff(layers.maskUrl)]);
  const zone = utmZoneFromEpsg(Number(flux.image.getGeoKeys()?.ProjectedCSTypeGeoKey));
  if (!zone) return { status: "unavailable", note: "Unexpected GeoTIFF projection." };
  const { width, height } = flux;
  const roofValues: number[] = [];
  const maskAt = (x: number, y: number) => mask.raster[Math.floor((y * mask.height) / height) * mask.width + Math.floor((x * mask.width) / width)] ?? 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const v = flux.raster[y * width + x]!;
    if (maskAt(x, y) > 0 && v > 0) roofValues.push(v);
  }
  if (roofValues.length < 20) return { status: "not-found", note: "No roof pixels in the Google Solar mask." };
  roofValues.sort((a, b) => a - b);
  const lo = quantile(roofValues, 0.03), hi = quantile(roofValues, 0.98);
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const v = flux.raster[y * width + x]!, o = (y * width + x) * 4;
    if (maskAt(x, y) > 0 && v > 0) {
      const [r, g, b] = rampColour((v - lo) / Math.max(1, hi - lo));
      png.data[o] = r!; png.data[o + 1] = g!; png.data[o + 2] = b!; png.data[o + 3] = 215;
    } else png.data[o + 3] = 0;
  }
  const [minX, minY, maxX, maxY] = flux.image.getBoundingBox();
  const corner = (x: number, y: number) => utmToLatLng(x, y, zone.zone, zone.south);
  const date = layers.imageryDate;
  return {
    status: "ok",
    dataUrl: `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`,
    corners: { nw: corner(minX!, maxY!), ne: corner(maxX!, maxY!), sw: corner(minX!, minY!), se: corner(maxX!, minY!) },
    minKwhPerKw: Math.round(lo),
    maxKwhPerKw: Math.round(hi),
    imageryDate: date?.year ? `${date.year}-${String(date.month ?? 1).padStart(2, "0")}` : undefined,
    imageryQuality: layers.imageryQuality,
  };
}

/** Billed per call, so it is only requested on demand and persisted for a year. */
export async function getSolarHeatmap(lat: number, lng: number): Promise<SolarHeatmap> {
  if (!ENV.googleSolarApiKey) return { status: "disabled", note: "Google Solar is not configured." };
  const key = `${lat.toFixed(5)}:${lng.toFixed(5)}`;
  return cachedValue("solar-heatmap", key, TTL_MS, async () => {
    try {
      return await renderHeatmap(lat, lng);
    } catch (error) {
      return { status: "unavailable" as const, note: error instanceof Error ? error.message : "Google Solar data layers failed." };
    }
  }, (value) => value.status !== "unavailable");
}
