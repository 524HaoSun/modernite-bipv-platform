import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Express, Request, Response } from "express";
import type { Weather } from "../lib/customer-energy-core";
import { NASA_POWER_PARAMS, nasaPowerToWeather, nasaPowerUrl, type NasaPowerPayload } from "../lib/nasa-power";
import { compactWeather, pvgisTmyToWeather, pvgisTmyUrl, type PvgisTmyPayload } from "../lib/pvgis-tmy";
import { ENV } from "./_core/env";

export const WEATHER_SOURCES = ["nasa-power", "pvgis-tmy"] as const;
export type WeatherSource = (typeof WEATHER_SOURCES)[number];
export const DEFAULT_WEATHER_SOURCE: WeatherSource = "nasa-power";

export type WeatherSite = { lat: number; lon: number; tz: number; zone?: string; address?: string; year: number };

type Provider<P> = {
  label: string;
  timeoutMs: number;
  cacheKey: (site: WeatherSite) => string;
  url: (site: WeatherSite) => string;
  trim: (payload: P) => P;
  toWeather: (payload: P, site: WeatherSite) => Weather;
};

const nasaPower: Provider<NasaPowerPayload> = {
  label: "NASA POWER",
  timeoutMs: 120_000,
  cacheKey: (site) => `nasa-power-${site.year}-${site.lat.toFixed(5)}_${site.lon.toFixed(5)}`,
  url: (site) => nasaPowerUrl(site, site.year),
  trim: (payload) => {
    const keep = Object.values(NASA_POWER_PARAMS) as string[];
    const pick = <T,>(record: Record<string, T> | undefined) => Object.fromEntries(Object.entries(record ?? {}).filter(([key]) => keep.includes(key)));
    if (!payload.properties?.parameter?.T2M) throw new Error("NASA POWER returned no hourly parameters");
    return { header: payload.header, parameters: pick(payload.parameters), properties: { parameter: pick(payload.properties.parameter) } };
  },
  toWeather: (payload, site) => nasaPowerToWeather(payload, site, site.year),
};

const pvgisTmy: Provider<PvgisTmyPayload> = {
  label: "PVGIS",
  timeoutMs: 45_000,
  cacheKey: (site) => `pvgis-tmy-${site.lat.toFixed(4)}_${site.lon.toFixed(4)}`,
  url: (site) => pvgisTmyUrl(site.lat, site.lon),
  trim: (payload) => {
    if (payload.outputs?.tmy_hourly?.length !== 8760) throw new Error("PVGIS returned an incomplete TMY");
    return {
      inputs: payload.inputs,
      outputs: {
        months_selected: payload.outputs.months_selected,
        tmy_hourly: payload.outputs.tmy_hourly.map((h) => ({ "time(UTC)": h["time(UTC)"], T2m: h.T2m, RH: h.RH, "G(h)": h["G(h)"], "Gb(n)": h["Gb(n)"], "Gd(h)": h["Gd(h)"], "IR(h)": h["IR(h)"], WS10m: h.WS10m })),
      },
    };
  },
  toWeather: (payload, site) => pvgisTmyToWeather(payload, site, site.year),
};

const PROVIDERS: Record<WeatherSource, Provider<any>> = { "nasa-power": nasaPower, "pvgis-tmy": pvgisTmy };

const memory = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

async function readDiskCache(key: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(path.join(ENV.weatherCacheDir, `${key}.json`), "utf8"));
  } catch {
    return null;
  }
}

async function writeDiskCache(key: string, payload: unknown) {
  try {
    await mkdir(ENV.weatherCacheDir, { recursive: true });
    await writeFile(path.join(ENV.weatherCacheDir, `${key}.json`), JSON.stringify(payload));
  } catch (error) {
    console.warn("[weather] cache write failed", error);
  }
}

async function request<P>(provider: Provider<P>, site: WeatherSite): Promise<P> {
  const url = provider.url(site);
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), provider.timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        const body = await response.text();
        const message = body.match(/"message"\s*:\s*"([^"]+)"/)?.[1] ?? body.match(/"messages"\s*:\s*\[\s*"([^"]+)"/)?.[1];
        throw new Error(`${provider.label} ${response.status}${message ? `: ${message}` : ""}`);
      }
      return provider.trim((await response.json()) as P);
    } catch (error) {
      lastError = error;
      if (error instanceof Error && / 4\d\d/.test(error.message)) break;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 500));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${provider.label} request failed`);
}

async function payloadFor<P>(provider: Provider<P>, site: WeatherSite): Promise<P> {
  const key = provider.cacheKey(site);
  const cached = (memory.get(key) ?? (await readDiskCache(key))) as P | null;
  if (cached) {
    memory.set(key, cached);
    return cached;
  }
  let pending = inflight.get(key) as Promise<P> | undefined;
  if (!pending) {
    pending = request(provider, site).then(async (payload) => {
      memory.set(key, payload);
      await writeDiskCache(key, payload);
      return payload;
    }).finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  return pending;
}

export async function getSiteWeather(source: WeatherSource, site: WeatherSite): Promise<Weather> {
  const provider = PROVIDERS[source];
  return provider.toWeather(await payloadFor(provider, site), site);
}

export const getPvgisTmyWeather = (site: WeatherSite) => getSiteWeather("pvgis-tmy", site);
export const getNasaPowerWeather = (site: WeatherSite) => getSiteWeather("nasa-power", site);

/** Tries the preferred source first, then the other one; throws only when both fail. */
export async function getWeatherWithFallback(preferred: WeatherSource, site: WeatherSite): Promise<{ weather: Weather; source: WeatherSource; errors: string[] }> {
  const order: WeatherSource[] = [preferred, ...WEATHER_SOURCES.filter((source) => source !== preferred)];
  const errors: string[] = [];
  for (const source of order) {
    try {
      return { weather: await getSiteWeather(source, site), source, errors };
    } catch (error) {
      errors.push(`${PROVIDERS[source].label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(errors.join("; "));
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
  for (const source of WEATHER_SOURCES) {
    app.get(`/api/weather/${source}`, async (req: Request, res: Response) => {
      const site = parseSite(req);
      if (typeof site === "string") {
        res.status(400).json({ error: site });
        return;
      }
      try {
        const weather = await getSiteWeather(source, site);
        res.setHeader("Cache-Control", "public, max-age=86400");
        res.json(compactWeather(weather));
      } catch (error) {
        res.status(502).json({ error: error instanceof Error ? error.message : `${PROVIDERS[source].label} unavailable` });
      }
    });
  }
}
