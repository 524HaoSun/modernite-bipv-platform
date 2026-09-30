import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Express, Request, Response } from "express";
import type { Weather } from "../lib/customer-energy-core";
import { compactWeather, pvgisTmyToWeather, pvgisTmyUrl, type PvgisTmyPayload } from "../lib/pvgis-tmy";
import { ENV } from "./_core/env";

const PVGIS_TIMEOUT_MS = 45_000;
const memory = new Map<string, PvgisTmyPayload>();
const inflight = new Map<string, Promise<PvgisTmyPayload>>();

const cacheKey = (lat: number, lon: number) => `${lat.toFixed(4)}_${lon.toFixed(4)}`;

async function readDiskCache(key: string): Promise<PvgisTmyPayload | null> {
  try {
    return JSON.parse(await readFile(path.join(ENV.weatherCacheDir, `pvgis-tmy-${key}.json`), "utf8")) as PvgisTmyPayload;
  } catch {
    return null;
  }
}

async function writeDiskCache(key: string, payload: PvgisTmyPayload) {
  try {
    await mkdir(ENV.weatherCacheDir, { recursive: true });
    await writeFile(path.join(ENV.weatherCacheDir, `pvgis-tmy-${key}.json`), JSON.stringify(payload));
  } catch (error) {
    console.warn("[weather] cache write failed", error);
  }
}

async function requestPvgis(lat: number, lon: number): Promise<PvgisTmyPayload> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PVGIS_TIMEOUT_MS);
    try {
      const response = await fetch(pvgisTmyUrl(lat, lon), { signal: controller.signal });
      if (!response.ok) {
        const body = await response.text();
        const message = body.match(/"message"\s*:\s*"([^"]+)"/)?.[1];
        throw new Error(`PVGIS ${response.status}${message ? `: ${message}` : ""}`);
      }
      const payload = (await response.json()) as PvgisTmyPayload;
      if (payload.outputs?.tmy_hourly?.length !== 8760) throw new Error("PVGIS returned an incomplete TMY");
      return {
        inputs: payload.inputs,
        outputs: {
          months_selected: payload.outputs.months_selected,
          tmy_hourly: payload.outputs.tmy_hourly.map((h) => ({ "time(UTC)": h["time(UTC)"], T2m: h.T2m, RH: h.RH, "G(h)": h["G(h)"], "Gb(n)": h["Gb(n)"], "Gd(h)": h["Gd(h)"], "IR(h)": h["IR(h)"], WS10m: h.WS10m })),
        },
      };
    } catch (error) {
      lastError = error;
      if (error instanceof Error && /PVGIS 400/.test(error.message)) break;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 500));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("PVGIS request failed");
}

async function pvgisTmyPayload(lat: number, lon: number): Promise<PvgisTmyPayload> {
  const key = cacheKey(lat, lon);
  const cached = memory.get(key) ?? (await readDiskCache(key));
  if (cached) {
    memory.set(key, cached);
    return cached;
  }
  let pending = inflight.get(key);
  if (!pending) {
    pending = requestPvgis(lat, lon).then(async (payload) => {
      memory.set(key, payload);
      await writeDiskCache(key, payload);
      return payload;
    }).finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  return pending;
}

export type WeatherSite = { lat: number; lon: number; tz: number; zone?: string; address?: string; year: number };

export async function getPvgisTmyWeather(site: WeatherSite): Promise<Weather> {
  const payload = await pvgisTmyPayload(site.lat, site.lon);
  return pvgisTmyToWeather(payload, site, site.year);
}

function parseSite(req: Request): WeatherSite | string {
  const lat = Number(req.query.lat), lon = Number(req.query.lon), tz = Number(req.query.tz ?? 0), year = Number(req.query.year ?? new Date().getUTCFullYear() - 1);
  if (!Number.isFinite(lat) || Math.abs(lat) > 89.9 || !Number.isFinite(lon) || Math.abs(lon) > 180) return "Invalid coordinates";
  if (!Number.isFinite(tz) || Math.abs(tz) > 14) return "Invalid timezone offset";
  if (!Number.isInteger(year) || year < 2001 || year > 2100) return "Invalid year";
  const zone = typeof req.query.zone === "string" ? req.query.zone.slice(0, 64) : "";
  const address = typeof req.query.address === "string" ? req.query.address.slice(0, 200) : "";
  return { lat, lon, tz, zone, address, year };
}

export function registerWeatherRoutes(app: Express) {
  app.get("/api/weather/pvgis-tmy", async (req: Request, res: Response) => {
    const site = parseSite(req);
    if (typeof site === "string") {
      res.status(400).json({ error: site });
      return;
    }
    try {
      const weather = await getPvgisTmyWeather(site);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.json(compactWeather(weather));
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : "PVGIS unavailable" });
    }
  });
}
