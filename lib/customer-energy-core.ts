/**
 * TypeScript port of the customer-supplied Modernité Solar Studio V31 energy
 * model (`modernite-energy-core` and `modernite-system-core` in
 * client/public/studio.html). Numerics, defaults and validation are kept
 * identical to the customer runtime; tests/customer-core-parity.test.ts runs
 * the original scripts side by side and requires matching results.
 *
 * The only addition is `monthlyAc` per product surface, collected from the
 * same hourly values so the host results page can chart surfaces by month.
 */

const D = Math.PI / 180;
export const REF = 164.06737524;
export const GAMMA = -0.00189;

export type Profile = readonly [name: string, wpPerM2: number, directRise: number, diffuseReflectedRise: number];

export const PROFILES: Readonly<Record<string, Profile>> = {
  windsor_black: ["Windsor Broad · Black", 140.6, 0.04156, 0.03889], windsor_colour: ["Windsor Broad · Colour", 98.42, 0.03747, 0.03469],
  cotswold_black: ["Cotswold Slate · Black", 133.2, 0.04194, 0.03927], cotswold_colour: ["Cotswold Slate · Colour", 93.24, 0.03775, 0.03497],
  yorkshire_black: ["Yorkshire Longspan · Black", 152, 0.04097, 0.0383], yorkshire_colour: ["Yorkshire Longspan · Colour", 106.4, 0.03704, 0.03425],
  highland_black: ["Highland Shingle · Black", 139.2, 0.04163, 0.03896], highland_colour: ["Highland Shingle · Colour", 97.44, 0.03752, 0.03474],
  canopy: ["Solar Canopy", 95, 0.02365, 0.02236], railing: ["Solar Railing", 105, 0.0256, 0.02418],
  edge: ["Solar Window Edge", 100, 0.03814, 0.03605], standard: ["Solar Window Standard", 100, 0.0294, 0.02743],
  skylight: ["Solar Skylight", 105, 0.04385, 0.04142], sunroom: ["Conservatory PV roof", 100, 0.04997, 0.0469],
  facade_black: ["Solar Facade Black", 150, 0.04511, 0.04219], facade_grey: ["Solar Facade Grey", 120, 0.03806, 0.03515], facade_lt: ["Solar Facade Light Transmitting", 100, 0.03338, 0.03163],
};

export type ClimateKey = "UK" | "EU" | "CA" | "JP";
type Climate = { name: string; lat: number; lon: number; tz: number; ta: number[]; ghi: number[]; df: number };

export const CLIMATES: Readonly<Record<ClimateKey, Climate>> = {
  UK: { name: "Manchester · synthetic", lat: 53.48, lon: -2.24, tz: 0, ta: [5, 5, 7, 9, 12, 15, 17, 17, 14, 11, 7, 5], ghi: [0.55, 0.95, 1.9, 3.2, 4.25, 4.65, 4.45, 3.65, 2.55, 1.45, 0.75, 0.45], df: 0.58 },
  EU: { name: "Paris · synthetic", lat: 48.86, lon: 2.35, tz: 1, ta: [5, 6, 9, 12, 16, 19, 21, 21, 17, 13, 8, 5], ghi: [0.8, 1.4, 2.55, 3.85, 4.8, 5.35, 5.4, 4.7, 3.3, 1.95, 1, 0.7], df: 0.5 },
  CA: { name: "Toronto · synthetic", lat: 43.65, lon: -79.38, tz: -5, ta: [-3, -2, 2, 8, 14, 20, 23, 22, 18, 11, 5, 0], ghi: [1.5, 2.2, 3.2, 4.3, 5.3, 5.8, 5.9, 5, 3.9, 2.5, 1.5, 1.2], df: 0.45 },
  JP: { name: "Tokyo · synthetic", lat: 35.68, lon: 139.69, tz: 9, ta: [6, 7, 10, 15, 19, 22, 26, 27, 24, 18, 13, 8], ghi: [2.5, 3.1, 3.6, 4.4, 4.8, 4, 4.5, 4.9, 3.7, 3, 2.5, 2.2], df: 0.52 },
};

export type WeatherRow = { t: number; ta: number; dni: number; dhi: number; ghi: number; longwave?: number; humidity?: number; wind?: number };
export type Location = { lat: number; lon: number; tz: number; zone?: string };
export type Weather = {
  rows: WeatherRow[];
  name: string;
  synthetic: boolean;
  location?: Location;
  timeStandard?: "UTC";
  year?: number;
  source?: string;
  sourceURL?: string;
  [key: string]: unknown;
};

export type Surface = {
  id: string;
  profile: string;
  area: number;
  tilt: number;
  az: number;
  enabled?: boolean;
  role?: string;
  linked?: boolean;
  u?: number;
  g?: number;
  product?: string;
};

export type Building = { width: number; depth: number; floors: number; storeyHeight?: number; glazedArea?: number; wwr?: number; usage?: string };

export type DeviceSettings = {
  ev: { enabled: boolean; vehicles: number; distance: number; per100: number; homeFraction: number; chargeEfficiency: number; chargerKW: number; start: number; end: number };
  heatPump: { enabled: boolean; share: number; cop: number };
  hotWater: { enabled: boolean; intensity: number; start: number; end: number };
  underfloor: { enabled: boolean; share: number };
  radiant: { enabled: boolean; share: number };
  infrared: { enabled: boolean; share: number };
  ac: { enabled: boolean; cop: number; start: number; end: number };
  gasBoiler: { enabled: boolean; share: number; efficiency: number };
  heatingSchedule: { start: number; end: number };
};

export type ProductRuntime = { profiles: Readonly<Record<string, Profile>>; gamma: number; referenceTemperature: number; threshold: number; lowIntercept: number; lowSlope: number; highLog: number; highIntercept: number };

export type Parameters = ReturnType<typeof defaults> & {
  productRuntime?: ProductRuntime;
  devices?: Partial<{ [K in keyof DeviceSettings]: Partial<DeviceSettings[K]> }>;
  inverterMode?: "auto" | "manual";
  batteryEnabled?: boolean;
  batteryMode?: "auto" | "manual";
  batteryKWh?: number;
  batteryKW?: number;
};

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
void clamp;

export function eta0(g: number): number {
  if (!Number.isFinite(g) || g < 0) throw Error("Invalid irradiance");
  return g === 0 ? 0 : g <= 140 ? 0.2021 + 0.0000757142857 * g : -0.02458 * Math.log(g) + 0.33386;
}

export function pv(profile: string | Profile, area: number, ta: number, beam: number, diffuse: number, reflected: number, system = 0.9, model?: ProductRuntime) {
  const p = typeof profile === "string" ? (model?.profiles ?? PROFILES)[profile] : profile;
  if (!p || [area, beam, diffuse, reflected].some((x) => !Number.isFinite(x) || x < 0) || !Number.isFinite(ta) || system < 0 || system > 1) throw Error("Invalid PV input");
  const g = beam + diffuse + reflected, temp = ta + p[2] * beam + p[3] * (diffuse + reflected);
  const reference = model ? 1000 * (model.highLog * Math.log(1000) + model.highIntercept) : REF;
  const eta = model ? (g <= model.threshold ? model.lowIntercept + model.lowSlope * g : model.highLog * Math.log(g) + model.highIntercept) : eta0(g);
  const efficiency = g ? Math.max(0, (p[1] / reference) * eta * (1 + (model?.gamma ?? GAMMA) * (temp - (model?.referenceTemperature ?? 25)))) : 0;
  const dc = area * g * efficiency;
  return { g, temp, efficiency, dc, ac: dc * system };
}

export type SunVector = { east: number; north: number; up: number };

export function sun(timestamp: number, lat: number, lon: number, tz: number): SunVector {
  const t = new Date(timestamp + 1800000), year = t.getUTCFullYear();
  const day = Math.floor((Date.UTC(year, t.getUTCMonth(), t.getUTCDate()) - Date.UTC(year, 0, 1)) / 86400000) + 1;
  const h = t.getUTCHours() + t.getUTCMinutes() / 60, b = (2 * Math.PI * (day - 81)) / 364;
  const eot = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
  const ha = (h + (4 * (lon - 15 * tz) + eot) / 60 - 12) * 15 * D, dec = 23.45 * D * Math.sin((2 * Math.PI * (284 + day)) / 365), la = lat * D;
  return { east: -Math.cos(dec) * Math.sin(ha), north: Math.cos(la) * Math.sin(dec) - Math.sin(la) * Math.cos(dec) * Math.cos(ha), up: Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha) };
}

export function poa(w: Pick<WeatherRow, "dni" | "dhi" | "ghi">, s: SunVector, tilt: number, azimuth: number, albedo = 0.2) {
  const b = tilt * D, a = azimuth * D, c = Math.cos(b);
  const incidence = s.east * Math.sin(b) * Math.sin(a) + s.north * Math.sin(b) * Math.cos(a) + s.up * c;
  // No double counting: DNI -> beam; DHI -> sky; GHI is used only for ground reflection.
  return { beam: s.up > 0 ? w.dni * Math.max(0, incidence) : 0, diffuse: (w.dhi * (1 + c)) / 2, reflected: (w.ghi * albedo * (1 - c)) / 2 };
}

export function synthetic(key: ClimateKey, location?: Location): Weather {
  const c = CLIMATES[key] || CLIMATES.UK, l = location || c, out: WeatherRow[] = [];
  for (let d = 0; d < 365; d++) {
    const start = Date.UTC(2025, 0, 1 + d), month = new Date(start).getUTCMonth(), ss = Array.from({ length: 24 }, (_, h) => sun(start + h * 3600000, l.lat, l.lon, l.tz));
    const sum = ss.reduce((a, s) => a + Math.max(0, s.up), 0);
    for (let h = 0; h < 24; h++) {
      const up = Math.max(0, ss[h].up), ghi = sum ? (c.ghi[month] * 1000 * up) / sum : 0, dhi = ghi * c.df;
      out.push({ t: start + h * 3600000, ta: c.ta[month] + 3 * Math.cos(((h - 15) * Math.PI) / 12), dni: up > 0.001 ? (ghi - dhi) / up : 0, dhi, ghi });
    }
  }
  return { rows: out, name: c.name, synthetic: true, location: { lat: l.lat, lon: l.lon, tz: l.tz } };
}

export function validateWeather(rows: WeatherRow[]): WeatherRow[] {
  if (!rows.length || rows.length > 8784) throw Error("Expected 1–8784 hourly rows");
  for (let i = 0; i < rows.length; i++) {
    const w = rows[i];
    if (!Number.isFinite(w.t) || !Number.isFinite(w.ta) || w.ta < -90 || w.ta > 70) throw Error("Invalid timestamp / air temperature: row " + (i + 1));
    if ((["dni", "dhi", "ghi"] as const).some((k) => !Number.isFinite(w[k]) || w[k] < 0 || w[k] > 2000)) throw Error("Invalid / missing radiation: row " + (i + 1));
    if (i && w.t - rows[i - 1].t !== 3600000) throw Error("Timestamps must be consecutive hourly local STANDARD time (no DST, gaps or duplicates): row " + (i + 1));
  }
  return rows;
}

export function defaults(building: Building) {
  const b = building, foot = b.width * b.depth, height = b.floors * (b.storeyHeight || 2.95), wallGross = 2 * (b.width + b.depth) * height;
  return {
    floorArea: foot * b.floors, volume: foot * height, wallArea: Math.max(0, wallGross - (b.glazedArea ?? wallGross * (b.wwr ?? 0.2))), windowArea: b.glazedArea ?? wallGross * (b.wwr ?? 0.2), roofArea: foot, groundArea: foot,
    wallU: 0.6, roofU: 0.3, floorU: 0.35, windowU: 2.8, windowG: 0.63, bridge: 0.1, ach: 0.5, mass: 120, heatSet: 20, coolSet: 26,
    heatMode: "gas" as string, cop: 3, eer: 3, gasEff: 0.9, base: b.usage === "office" ? 45 : 22, dhw: 0, gains: b.usage === "office" ? 4 : 2,
    heatOn: true, coolOn: false, system: 0.9, inverter: 0, albedo: 0.2, north: 180, glassShade: 0, groundTemp: 12, occupancy: (b.usage === "office" ? "office" : "home") as string,
  };
}

export const HEATING_IDS = ["heatPump", "underfloor", "radiant", "infrared", "gasBoiler"] as const;
export const DEVICE_IDS = ["ev", "heatPump", "hotWater", "underfloor", "radiant", "infrared", "ac", "gasBoiler"] as const;

export function deviceSettings(p: Partial<Parameters>): DeviceSettings {
  const heating = p.heatOn !== false, mode = p.heatMode || "gas";
  const base: DeviceSettings = {
    ev: { enabled: false, vehicles: 1, distance: 12000, per100: 18, homeFraction: 1, chargeEfficiency: 0.9, chargerKW: 7.4, start: 22, end: 7 },
    heatPump: { enabled: heating && mode === "pump", share: mode === "pump" ? 100 : 0, cop: p.cop ?? 3 },
    hotWater: { enabled: (p.dhw ?? 0) > 0, intensity: (p.dhw ?? 0) > 0 ? p.dhw! : 12, start: 0, end: 0 },
    underfloor: { enabled: false, share: 0 },
    radiant: { enabled: heating && mode === "direct", share: mode === "direct" ? 100 : 0 },
    infrared: { enabled: false, share: 0 },
    ac: { enabled: p.coolOn === true, cop: p.eer ?? 3, start: 0, end: 0 },
    gasBoiler: { enabled: heating && mode === "gas", share: mode === "gas" ? 100 : 0, efficiency: p.gasEff ?? 0.9 },
    heatingSchedule: { start: 0, end: 0 },
  };
  for (const k of Object.keys(base) as (keyof DeviceSettings)[]) (base as Record<string, unknown>)[k] = { ...base[k], ...(p.devices?.[k] || {}) };
  return base;
}

export function inWindow(hour: number, start: number, end: number) { return start === end || (hour - start + 24) % 24 < (end - start + 24) % 24; }
export function windowFraction(hour: number, start: number, end: number) {
  if (start === end) return 1;
  let total = 0; const duration = (end - start + 24) % 24;
  for (const shift of [-24, 0, 24]) total += Math.max(0, Math.min(hour + 1, start + shift + duration) - Math.max(hour, start + shift));
  return Math.min(1, total);
}
export function windowHours(start: number, end: number) { return (end - start + 24) % 24 || 24; }

export function distributeHeating(dev: DeviceSettings) {
  const on = HEATING_IDS.filter((k) => dev[k].enabled); let assigned = 0;
  HEATING_IDS.forEach((k) => (dev[k].share = 0));
  on.forEach((k, i) => { const share = i === on.length - 1 ? +(100 - assigned).toFixed(2) : Math.floor(10000 / on.length) / 100; dev[k].share = share; assigned += share; });
  return dev;
}

export function validateDevices(d: DeviceSettings) {
  function range(x: number, min: number, max: number, name: string) { if (!Number.isFinite(x) || x < min || x > max) throw Error("Invalid device parameter: " + name); }
  for (const k of DEVICE_IDS) if (typeof d[k].enabled !== "boolean") throw Error("Invalid device selection: " + k);
  for (const k of ["ev", "hotWater", "ac", "heatingSchedule"] as const) {
    const entry = d[k] as { enabled?: boolean; start: number; end: number };
    if (k === "heatingSchedule" || entry.enabled) for (const f of ["start", "end"] as const) { range(entry[f], 0, 23, k + "." + f); if (!Number.isInteger(entry[f])) throw Error("Device schedule requires whole hours"); }
  }
  const on = HEATING_IDS.filter((k) => d[k].enabled);
  for (const k of on) range(d[k].share, 0, 100, k + ".share");
  if (on.length && Math.abs(on.reduce((s, k) => s + d[k].share, 0) - 100) > 0.001) throw Error("HEATING_SHARE_TOTAL");
  if (d.heatPump.enabled) range(d.heatPump.cop, 0.1, 15, "heatPump.cop");
  if (d.ac.enabled) range(d.ac.cop, 0.1, 15, "ac.cop");
  if (d.gasBoiler.enabled) range(d.gasBoiler.efficiency, 0.01, 1, "gasBoiler.efficiency");
  if (d.hotWater.enabled) range(d.hotWater.intensity, 0, 1000, "hotWater.intensity");
  if (d.ev.enabled) {
    const e = d.ev; range(e.vehicles, 1, 10000, "ev.vehicles"); if (!Number.isInteger(e.vehicles)) throw Error("EV vehicle count must be an integer");
    range(e.distance, 0, 1000000, "ev.distance"); range(e.per100, 0, 200, "ev.per100"); range(e.homeFraction, 0, 1, "ev.homeFraction"); range(e.chargeEfficiency, 0.01, 1, "ev.chargeEfficiency"); range(e.chargerKW, 0.01, 100000, "ev.chargerKW");
  }
}

function heatingSplit(heat: number, d: DeviceSettings) {
  const part = (k: (typeof HEATING_IDS)[number]) => (d[k].enabled ? (heat * d[k].share) / 100 : 0);
  return { heatPump: d.heatPump.enabled ? part("heatPump") / d.heatPump.cop : 0, underfloor: part("underfloor"), radiant: part("radiant"), infrared: part("infrared"), gas: d.gasBoiler.enabled ? part("gasBoiler") / d.gasBoiler.efficiency : 0 };
}

export function step(temp: number, ta: number, ground: number, gains: number, Hout: number, Hground: number, C: number, heatSet: number, coolSet: number, heatOn: boolean, coolOn: boolean) {
  const H = Hout + Hground, hours = 3600;
  let free: number, factor: number;
  if (H > 1e-9) { const decay = Math.exp((-H * hours) / C), eq = (Hout * ta + Hground * ground + gains) / H; free = eq + (temp - eq) * decay; factor = H / -Math.expm1((-H * hours) / C); }
  else { free = temp + (gains * hours) / C; factor = C / hours; }
  let heat = 0, cool = 0, next = free;
  if (heatOn && free < heatSet) { heat = (heatSet - free) * factor; next = heatSet; }
  if (coolOn && free > coolSet) { cool = (free - coolSet) * factor; next = coolSet; }
  return { temp: next, heat: heat / 1000, cool: cool / 1000 }; // kWh for 1 hour
}

export function validateParameters(p: Parameters, surfaces: Surface[]) {
  const positive = ["floorArea", "volume", "mass", "cop", "eer", "gasEff"] as const;
  const record = p as unknown as Record<string, number>;
  for (const k of positive) if (!Number.isFinite(record[k]) || record[k] <= 0) throw Error("Invalid parameter: " + k);
  for (const k of ["wallArea", "windowArea", "roofArea", "groundArea", "wallU", "roofU", "floorU", "windowU", "windowG", "bridge", "ach", "base", "dhw", "gains", "inverter", "albedo", "system"]) if (!Number.isFinite(record[k]) || record[k] < 0) throw Error("Invalid parameter: " + k);
  if (p.heatSet >= p.coolSet || p.system > 1 || p.albedo > 1 || p.windowG > 1 || p.gasEff > 1) throw Error("Check setpoints and fractions (0–1)");
  if (![p.north, p.groundTemp, p.heatSet, p.coolSet].every(Number.isFinite)) throw Error("Invalid temperature or orientation");
  for (const s of surfaces) if (!(p.productRuntime?.profiles ?? PROFILES)[s.profile] || !Number.isFinite(s.area) || s.area < 0 || s.tilt < 0 || s.tilt > 90 || s.g! < 0 || s.g! > 1 || s.u! < 0 || ![s.tilt, s.az, s.u, s.g].every(Number.isFinite)) throw Error("Invalid PV surface: " + s.id);
}

const TOTAL_KEYS = ["pv", "load", "heat", "cool", "heatElectric", "coolElectric", "base", "dhw", "gas", "self", "grid", "export", "baseline", "baselineGas", "baselineHeat", "baselineCool", "thermalSaving", "heatPump", "underfloor", "radiant", "infrared", "ev", "evUnserved", "underHeatHours", "overheatHours", "hours"] as const;
export type Totals = Record<(typeof TOTAL_KEYS)[number], number> & Record<string, number>;
const empty = (): Totals => Object.fromEntries(TOTAL_KEYS.map((k) => [k, 0])) as Totals;

export type ProductStat = {
  id: string; profile: string; area: number; kwp: number; dc: number; ac: number; tempMax: number; poa: number; lowLight: number;
  beamBefore?: number; beamAfter?: number; directShade?: number; skyVisibility?: number;
  monthlyAc: number[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HourlyRow = { t: number; pv: number; load: number; rawProductAC?: number[]; [key: string]: any };

export type Shadows = { method?: string; receivers: Record<string, { beam: number[]; sky?: number; ground?: number; area?: number }> };

export type SimulationResult = {
  devices: DeviceSettings; totals: Totals; monthly: Totals[]; products: ProductStat[]; hourly: HourlyRow[];
  automaticShadows: boolean; shadowMethod?: string; kwp: number; peak: number; fullYear: boolean; period: [number, number]; areaCapped: boolean; irradiationWarnings: number;
  Hbase: number; Hnew: number; electricSaving: number; selfConsumption: number; selfSufficiency: number;
  systemSizing?: SystemSizing;
};

function simulateBase(p: Parameters, surfaces: Surface[], weather: Weather, location: Location, shadows: Shadows | null = null): SimulationResult {
  validateParameters(p, surfaces); const devices = deviceSettings(p); validateDevices(devices); const rows = validateWeather(weather.rows);
  if (!location || ![location.lat, location.lon, location.tz].every(Number.isFinite) || Math.abs(location.lat) > 89.9 || Math.abs(location.lon) > 180 || Math.abs(location.tz) > 14) throw Error("Invalid location");
  const active = surfaces.filter((s) => s.enabled !== false && s.area > 0), barea = p.wallArea + p.windowArea + p.roofArea + p.groundArea;
  const Hcommon = p.wallArea * p.wallU + p.roofArea * p.roofU + p.bridge * barea + 0.33 * p.ach * p.volume, Hground = p.groundArea * p.floorU;
  let Hbase = Hcommon + p.windowArea * p.windowU, Hnew = Hbase, remaining = p.windowArea, remainingRoof = p.roofArea;
  const windows: (Surface & { thermalArea: number })[] = [], rooflights: (Surface & { thermalArea: number })[] = []; let areaCapped = false;
  for (const s of active) {
    // Only explicitly mapped glazing modifies the conditioned building envelope.
    if (s.role === "window") { const area = Math.min(remaining, s.area); remaining -= area; areaCapped ||= area < s.area; Hnew += area * (s.u! - p.windowU); windows.push({ ...s, thermalArea: area }); }
    if (s.role === "skylight") { const area = Math.min(remainingRoof, s.area); remainingRoof -= area; areaCapped ||= area < s.area; Hbase += area * (p.windowU - p.roofU); Hnew += area * (s.u! - p.roofU); rooflights.push({ ...s, thermalArea: area }); }
  }
  const az = (s: Surface) => (s.az + (s.linked ? p.north : 0) + 360) % 360;
  const totals = empty(), monthly = Array.from({ length: 12 }, () => empty());
  const stats: ProductStat[] = active.map((s) => ({ id: s.id, profile: s.profile, area: s.area, kwp: (s.area * (p.productRuntime?.profiles ?? PROFILES)[s.profile][1]) / 1000, dc: 0, ac: 0, tempMax: -Infinity, poa: 0, lowLight: 0, monthlyAc: Array(12).fill(0) }));
  const byId = new Map(stats.map((s) => [s.id, s])), hourly: HourlyRow[] = [], C = p.floorArea * p.mass * 1000;
  const timeIndex = new Map(rows.map((r, i) => [r.t, i]));
  if (shadows) for (const surface of active) if (!shadows.receivers[surface.id] || shadows.receivers[surface.id].beam.length !== rows.length) throw Error("Missing automatic shadow result: " + surface.id);
  function radiation(w: WeatherRow, s: SunVector, tilt: number, bearing: number, id: string) {
    const q = poa(w, s, tilt, bearing, p.albedo), f = shadows?.receivers[id];
    return { ...q, unshadedBeam: q.beam, beam: q.beam * (f ? f.beam[timeIndex.get(w.t)!] : 1), diffuse: q.diffuse * (f?.sky ?? 1), reflected: q.reflected * (f?.ground ?? 1) };
  }
  let oldTemp = p.heatSet, newTemp = p.heatSet, peak = 0;
  function hour(w: WeatherRow, collect: boolean) {
    const date = new Date(w.t), localDate = new Date(w.t + (weather.timeStandard === "UTC" ? location.tz * 3600000 : 0)), h = localDate.getUTCHours() + localDate.getUTCMinutes() / 60, weekend = [0, 6].includes(localDate.getUTCDay()), s = sun(w.t, location.lat, location.lon, weather.timeStandard === "UTC" ? 0 : location.tz);
    const occ = p.occupancy === "office" ? (weekend ? 0.25 : h >= 8 && h < 18 ? 1.8 : 0.35) : h >= 17 && h < 23 ? 1.6 : h >= 6 && h < 9 ? 1.3 : 0.7;
    // Normalize the electricity schedule against the whole calendar year below.
    const days = yearHours / 24, base = (p.base * p.floorArea * occ) / baseNorm;
    const dh = devices.hotWater, evs = devices.ev;
    const dhw = dh.enabled ? (dh.intensity * p.floorArea * windowFraction(h, dh.start, dh.end)) / (days * windowHours(dh.start, dh.end)) : 0;
    const evRequested = evs.enabled ? ((((evs.vehicles * evs.distance * evs.per100) / 100) * evs.homeFraction) / evs.chargeEfficiency * windowFraction(h, evs.start, evs.end)) / (days * windowHours(evs.start, evs.end)) : 0;
    const ev = Math.min(evRequested, evs.chargerKW * windowFraction(h, evs.start, evs.end)), evUnserved = evRequested - ev;
    const heatingOn = HEATING_IDS.some((k) => devices[k].enabled && devices[k].share > 0) && inWindow((h + 0.5) % 24, devices.heatingSchedule.start, devices.heatingSchedule.end);
    const coolingOn = devices.ac.enabled && inWindow((h + 0.5) % 24, devices.ac.start, devices.ac.end);
    const gains = base * 1000 * 0.9 + p.gains * p.floorArea * occ;
    const vertical = [0, 90, 180, 270].map((a) => { const x = radiation(w, s, 90, (a + p.north) % 360, "glazing:" + a); return x.beam + x.diffuse + x.reflected; });
    const weights = [0, 90, 180, 270].map((a) => (shadows ? shadows.receivers["glazing:" + a]?.area || 0 : 1)), weightSum = weights.reduce((a, b) => a + b, 0);
    const avg = weightSum ? vertical.reduce((a, b, i) => a + b * weights[i], 0) / weightSum : 0;
    let gainBase = p.windowArea * p.windowG * avg, gainNew = remaining * p.windowG * avg, pvAC = 0;
    for (const x of windows) {
      const q = radiation(w, s, x.tilt, az(x), x.id); const g = q.beam + q.diffuse + q.reflected;
      // Baseline uses the SAME opening orientation as the replacement.
      gainBase += x.thermalArea * p.windowG * (g - avg); gainNew += x.thermalArea * x.g! * g;
    }
    for (const x of rooflights) { const q = radiation(w, s, x.tilt, az(x), x.id), g = q.beam + q.diffuse + q.reflected; gainBase += x.thermalArea * p.windowG * g; gainNew += x.thermalArea * x.g! * g; }
    const contributions: [Surface, ReturnType<typeof pv>, ReturnType<typeof radiation>][] = [];
    let beamBefore = 0, beamAfter = 0;
    for (const x of active) { const q = radiation(w, s, x.tilt, az(x), x.id), v = pv(x.profile, x.area, w.ta, q.beam, q.diffuse, q.reflected, p.system, p.productRuntime); pvAC += v.ac / 1000; beamBefore += q.unshadedBeam * x.area; beamAfter += q.beam * x.area; contributions.push([x, v, q]); }
    const clipped = p.inverter > 0 ? Math.min(pvAC, p.inverter) : pvAC, ratio = pvAC ? clipped / pvAC : 1;
    const old = step(oldTemp, w.ta, p.groundTemp, gains + gainBase, Hbase, Hground, C, p.heatSet, p.coolSet, heatingOn, coolingOn);
    const cur = step(newTemp, w.ta, p.groundTemp, gains + gainNew, Hnew, Hground, C, p.heatSet, p.coolSet, heatingOn, coolingOn); oldTemp = old.temp; newTemp = cur.temp;
    if (!collect) return;
    const split = heatingSplit(cur.heat, devices), oldSplit = heatingSplit(old.heat, devices);
    const heatElectric = split.heatPump + split.underfloor + split.radiant + split.infrared, coolElectric = devices.ac.enabled ? cur.cool / devices.ac.cop : 0;
    const oldElec = oldSplit.heatPump + oldSplit.underfloor + oldSplit.radiant + oldSplit.infrared;
    const load = heatElectric + coolElectric + base + dhw + ev, baseline = oldElec + (devices.ac.enabled ? old.cool / devices.ac.cop : 0) + base + dhw + ev, self = Math.min(clipped, load);
    const r: Totals = {
      pv: clipped, load, heat: cur.heat, cool: cur.cool, heatElectric, coolElectric, base, dhw, gas: split.gas, self, grid: load - self, export: clipped - self,
      baseline, baselineGas: oldSplit.gas, baselineHeat: old.heat, baselineCool: old.cool, thermalSaving: old.heat + old.cool - (cur.heat + cur.cool),
      heatPump: split.heatPump, underfloor: split.underfloor, radiant: split.radiant, infrared: split.infrared, ev, evUnserved,
      underHeatHours: cur.temp < p.heatSet - 0.5 ? 1 : 0, overheatHours: cur.temp > p.coolSet + 0.5 ? 1 : 0, hours: 1,
    };
    const month = date.getUTCMonth();
    for (const key of Object.keys(totals)) { totals[key] += r[key]; monthly[month][key] += r[key]; }
    for (const [x, v, q] of contributions) {
      const st = byId.get(x.id)!; st.dc += v.dc / 1000; st.ac += (v.ac / 1000) * ratio; st.monthlyAc[month] += (v.ac / 1000) * ratio; st.poa += v.g / 1000; st.tempMax = Math.max(st.tempMax, v.temp);
      st.beamBefore = (st.beamBefore || 0) + q.unshadedBeam; st.beamAfter = (st.beamAfter || 0) + q.beam; st.directShade = st.beamBefore ? 1 - st.beamAfter / st.beamBefore : 0; st.skyVisibility = shadows?.receivers[x.id]?.sky ?? 1; if (v.g > 0 && v.g < 70) st.lowLight++;
    }
    peak = Math.max(peak, clipped);
    hourly.push({ rawProductAC: contributions.map(([, v]) => v.ac / 1000), t: w.t, ta: w.ta, ghi: w.ghi, dni: w.dni, dhi: w.dhi, longwave: w.longwave ?? NaN, pv: clipped, load, self, grid: r.grid, export: r.export, heat: cur.heat, cool: cur.cool, gas: r.gas, baseline, baselineGas: r.baselineGas, heatElectric, coolElectric, base, dhw, ev, evUnserved, heatPump: split.heatPump, underfloor: split.underfloor, radiant: split.radiant, infrared: split.infrared, indoorTemp: cur.temp, directShadeFraction: beamBefore ? 1 - beamAfter / beamBefore : 0 });
  }
  const year = new Date(rows[0].t).getUTCFullYear(), yearHours = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 3600000;
  let baseNorm = 0;
  for (let t = Date.UTC(year, 0, 1); t < Date.UTC(year + 1, 0, 1); t += 3600000) { const d = new Date(t), h = d.getUTCHours(), wk = [0, 6].includes(d.getUTCDay()); baseNorm += p.occupancy === "office" ? (wk ? 0.25 : h >= 8 && h < 18 ? 1.8 : 0.35) : h >= 17 && h < 23 ? 1.6 : h >= 6 && h < 9 ? 1.3 : 0.7; }
  // 7-day synthetic warm-up, repeating the first available day; excluded from totals.
  for (let i = 0; i < 168; i++) hour(rows[i % Math.min(24, rows.length)], false);
  rows.forEach((w) => hour(w, true));
  const fullYear = rows.length === yearHours && new Date(rows[0].t).getUTCMonth() === 0 && new Date(rows[0].t).getUTCDate() === 1 && new Date(rows[0].t).getUTCHours() === 0;
  const irradiationWarnings = rows.filter((w) => { const so = sun(w.t, location.lat, location.lon, weather.timeStandard === "UTC" ? 0 : location.tz); return Math.abs(w.ghi - (w.dni * Math.max(0, so.up) + w.dhi)) > Math.max(100, w.ghi * 0.25); }).length;
  return {
    devices, totals, monthly, products: stats, hourly, automaticShadows: !!shadows, shadowMethod: shadows?.method, kwp: stats.reduce((a, s) => a + s.kwp, 0), peak, fullYear, period: [rows[0].t, rows.at(-1)!.t + 3600000], areaCapped, irradiationWarnings,
    Hbase: Hbase + Hground, Hnew: Hnew + Hground, electricSaving: totals.baseline - totals.load, selfConsumption: totals.pv ? totals.self / totals.pv : 0, selfSufficiency: totals.load ? totals.self / totals.load : 0,
  };
}

/* V24 preliminary AC-coupled PV + storage sizing. Generic assumptions, not a product catalogue. */
export const SYSTEM_ASSUMPTIONS = { maxDcAc: 1.3, maxClipping: 0.01, usableFraction: 0.9, roundTrip: 0.9, cRate: 0.5, target: 0.9 } as const;
const sum = (rows: HourlyRow[], key: string) => rows.reduce((a, r) => a + r[key], 0), roundUp = (x: number, stepSize: number) => Math.ceil((x - 1e-10) / stepSize) * stepSize;

export type SystemSettings = { inverterMode: "auto" | "manual"; inverter: number; batteryEnabled: boolean; batteryMode: "auto" | "manual"; batteryKWh: number; batteryKW: number };
export type SystemSizing = SystemSettings & {
  recommendedInverterKW: number; inverterKW: number; dcAcRatio: number; clippingKWh: number; clippingFraction: number; rawGenerationKWh: number;
  batteryNominalKWh: number; batteryUsableKWh: number; batteryPowerKW: number; recommendedBatteryKWh: number; recommendedBatteryKW: number;
  benchmarkDischargeKWh: number; targetDischargeKWh: number; sizingUpperKWh: number; storedEndKWh: number; initialUsableKWh: number;
  assumptions: typeof SYSTEM_ASSUMPTIONS; topology: "AC-coupled"; partial: boolean;
};

export function systemSettings(p: Partial<Parameters>): SystemSettings {
  return { inverterMode: p.inverterMode ?? ((p.inverter ?? 0) > 0 ? "manual" : "auto"), inverter: p.inverter ?? 0, batteryEnabled: p.batteryEnabled ?? false, batteryMode: p.batteryMode ?? "auto", batteryKWh: p.batteryKWh ?? 10, batteryKW: p.batteryKW ?? 5 };
}

export function validateSystem(s: SystemSettings) {
  if (!["auto", "manual"].includes(s.inverterMode) || !["auto", "manual"].includes(s.batteryMode) || typeof s.batteryEnabled !== "boolean") throw Error("Invalid inverter / battery selection");
  if (s.inverterMode === "manual" && (!Number.isFinite(s.inverter) || s.inverter <= 0 || s.inverter > 1e6)) throw Error("Manual inverter power must be > 0 kW");
  if (s.batteryEnabled && s.batteryMode === "manual") for (const k of ["batteryKWh", "batteryKW"] as const) if (!Number.isFinite(s[k]) || s[k] <= 0 || s[k] > 1e7) throw Error("Invalid battery capacity / power");
}

export function inverterSize(rows: HourlyRow[], kwp: number) {
  if (kwp <= 0) return 0;
  let lo = kwp / SYSTEM_ASSUMPTIONS.maxDcAc, hi = Math.max(lo, ...rows.map((r) => r.pv)); const energy = sum(rows, "pv");
  for (let i = 0; i < 32; i++) { const mid = (lo + hi) / 2, loss = rows.reduce((a, r) => a + Math.max(0, r.pv - mid), 0); if (energy && loss / energy > SYSTEM_ASSUMPTIONS.maxClipping) lo = mid; else hi = mid; }
  return +roundUp(hi, hi < 2 ? 0.1 : hi < 20 ? 0.5 : hi < 100 ? 1 : 5).toFixed(2);
}

export function dispatch(rows: HourlyRow[], nominal: number, power: number, collect = false) {
  const a = SYSTEM_ASSUMPTIONS, eta = Math.sqrt(a.roundTrip), usable = nominal * a.usableFraction; let stored = 0, delivered = 0; const out: Record<string, number>[] = [];
  for (const row of rows) {
    const direct = Math.min(row.pv, row.load), surplus = row.pv - direct, deficit = row.load - direct, charge = Math.max(0, Math.min(surplus, power, (usable - stored) / eta)); stored += charge * eta;
    const discharge = Math.max(0, Math.min(deficit, power, stored * eta)); stored -= discharge / eta; stored = Math.max(0, Math.min(usable, stored)); delivered += discharge;
    if (collect) out.push({ pv: row.pv, load: row.load, directSelf: direct, self: direct + discharge, grid: deficit - discharge, export: surplus - charge, batteryCharge: charge, batteryDischarge: discharge, batteryLoss: charge * (1 - eta) + discharge * (1 / eta - 1), batteryStored: stored, batterySOC: nominal ? (1 - a.usableFraction + stored / nominal) * 100 : 0, noBatteryGrid: deficit, noBatteryExport: surplus });
  }
  return { delivered, stored, rows: out };
}

export function batterySize(rows: HourlyRow[], inverter: number, offsetHours = 0) {
  const a = SYSTEM_ASSUMPTIONS, eta = Math.sqrt(a.roundTrip), days = new Map<number, { surplus: number; deficit: number }>();
  for (const r of rows) { const day = Math.floor((r.t + offsetHours * 3600000) / 86400000), d = days.get(day) || { surplus: 0, deficit: 0 }; d.surplus += Math.max(0, r.pv - r.load); d.deficit += Math.max(0, r.load - r.pv); days.set(day, d); }
  const maxSurplus = Math.max(0, ...Array.from(days.values()).map((d) => d.surplus)), maxDeficit = Math.max(0, ...Array.from(days.values()).map((d) => d.deficit));
  const upper = Math.min(maxSurplus * eta, maxDeficit / eta) / a.usableFraction, power = (n: number) => Math.min(inverter, n * a.cRate);
  if (upper <= 1e-8 || inverter <= 0) return { nominal: 0, power: 0, benchmark: 0, target: 0, upper: 0 };
  const benchmark = dispatch(rows, upper, power(upper)).delivered;
  if (benchmark < 0.01) return { nominal: 0, power: 0, benchmark, target: 0, upper };
  let lo = 0, hi = upper;
  for (let i = 0; i < 25; i++) { const mid = (lo + hi) / 2; if (dispatch(rows, mid, power(mid)).delivered < benchmark * a.target) lo = mid; else hi = mid; }
  const nominal = +roundUp(hi, hi < 20 ? 0.5 : hi < 100 ? 1 : 5).toFixed(2);
  return { nominal, power: +power(nominal).toFixed(3), benchmark, target: benchmark * a.target, upper };
}

function applySystem(base: SimulationResult, p: Partial<Parameters>, offsetHours = 0): SimulationResult {
  const s = systemSettings(p); validateSystem(s);
  const recommendedInverter = inverterSize(base.hourly, base.kwp), inverter = s.inverterMode === "auto" ? recommendedInverter : s.inverter;
  const rawEnergy = sum(base.hourly, "pv"), rows = base.hourly.map((r) => ({ ...r, pvAvailable: r.pv, pv: Math.min(r.pv, inverter) }) as HourlyRow);
  const recommendation = batterySize(rows, inverter, offsetHours), nominal = s.batteryEnabled ? (s.batteryMode === "auto" ? recommendation.nominal : s.batteryKWh) : 0, power = s.batteryEnabled ? (s.batteryMode === "auto" ? recommendation.power : s.batteryKW) : 0, actual = dispatch(rows, nominal, power, true);
  const keys = ["pv", "self", "grid", "export", "directSelf", "batteryCharge", "batteryDischarge", "batteryLoss", "noBatteryGrid", "noBatteryExport"];
  for (const obj of [base.totals, ...base.monthly]) for (const k of keys) obj[k] = 0;
  for (const prod of base.products) { prod.ac = 0; prod.monthlyAc = Array(12).fill(0); }
  rows.forEach((r, i) => {
    Object.assign(r, actual.rows[i]); const ratio = r.pvAvailable ? r.pv / r.pvAvailable : 0; const month = new Date(r.t).getUTCMonth();
    for (let n = 0; n < base.products.length; n++) { const value = (r.rawProductAC?.[n] || 0) * ratio; base.products[n].ac += value; base.products[n].monthlyAc[month] += value; }
    delete r.rawProductAC; const m = base.monthly[month]; for (const k of keys) { base.totals[k] += r[k]; m[k] += r[k]; }
  });
  base.hourly = rows; base.peak = Math.max(0, ...rows.map((r) => r.pv)); base.selfConsumption = base.totals.pv ? base.totals.self / base.totals.pv : 0; base.selfSufficiency = base.totals.load ? base.totals.self / base.totals.load : 0;
  base.systemSizing = {
    ...s, recommendedInverterKW: recommendedInverter, inverterKW: inverter, dcAcRatio: inverter ? base.kwp / inverter : 0, clippingKWh: Math.max(0, rawEnergy - base.totals.pv), clippingFraction: rawEnergy ? Math.max(0, rawEnergy - base.totals.pv) / rawEnergy : 0, rawGenerationKWh: rawEnergy,
    batteryNominalKWh: nominal, batteryUsableKWh: nominal * SYSTEM_ASSUMPTIONS.usableFraction, batteryPowerKW: power, recommendedBatteryKWh: recommendation.nominal, recommendedBatteryKW: recommendation.power, benchmarkDischargeKWh: recommendation.benchmark, targetDischargeKWh: recommendation.target, sizingUpperKWh: recommendation.upper,
    storedEndKWh: actual.stored, initialUsableKWh: 0, assumptions: { ...SYSTEM_ASSUMPTIONS }, topology: "AC-coupled", partial: !base.fullYear,
  };
  return base;
}

/** Equivalent of the customer runtime's `ModerniteEnergyCore.simulate` after `modernite-system-core` wraps it. */
export function simulate(p: Parameters, surfaces: Surface[], weather: Weather, location: Location, shadows: Shadows | null = null): SimulationResult {
  validateSystem(systemSettings(p));
  const base = simulateBase({ ...p, inverter: 0 }, surfaces, weather, location, shadows);
  return applySystem(base, p, weather.timeStandard === "UTC" ? location.tz : 0);
}
