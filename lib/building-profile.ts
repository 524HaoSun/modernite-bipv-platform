/**
 * Combines the OpenStreetMap outline, the Google Solar roof model and Google ground elevation
 * into the parameters the customer Studio can take: building type, size, storeys, storey height,
 * roof form and pitch, and front orientation. Every value records its source so the user can
 * see what was measured and override anything that looks wrong.
 */
import type { BuildingFootprint, LatLng } from "./building-footprint";
import type { GoogleSolarReference, GoogleSolarRoofSegment } from "./google-solar";
import { studioTypeById, studioTypesForRegion, roofFormsFor, type StudioBuildingType, type StudioRegion, type StudioRoofForm } from "./studio-catalog";

export type ProfileSource = "osm" | "google-maps" | "google-solar" | "google-elevation" | "estimated" | "catalog";
export type ProfileField<T> = { value: T; source: ProfileSource };

export type BuildingProfile = {
  region: StudioRegion;
  detected: boolean;
  buildingTypeId: ProfileField<string>;
  /** Front width of the dwelling itself (not the whole terrace). */
  widthM: ProfileField<number>;
  depthM: ProfileField<number>;
  floors: ProfileField<number>;
  storeyHeightM: ProfileField<number>;
  roofForm: ProfileField<StudioRoofForm>;
  roofPitchDeg: ProfileField<number>;
  frontAzimuthDeg: ProfileField<number>;
  heightM?: ProfileField<number>;
  footprintAreaM2?: number;
  attachedSides?: number;
  osmId?: number;
  path?: LatLng[];
  roadName?: string;
  roofSegments: { pitchDeg: number; azimuthDeg: number; areaM2: number }[];
  /** Google Solar's own max panel layout for this roof (DC, Google's panel model). */
  solarPotential?: { panels: number; capacityKwp?: number; yearlyDcKwh?: number; sunshineHours?: number; arrayAreaM2?: number };
  sources: {
    osm: "ok" | "not-found" | "unavailable";
    googleSolar: "ok" | "not-found" | "unavailable" | "disabled";
    elevation: "ok" | "unavailable" | "disabled";
  };
};

export type BuildingProfileInput = {
  region: StudioRegion;
  site: LatLng;
  footprint?: BuildingFootprint | null;
  footprintStatus?: "ok" | "not-found" | "unavailable";
  solar?: GoogleSolarReference | null;
  groundElevationM?: number | null;
};

type XY = { x: number; y: number };
const M_PER_DEG_LAT = 110_540;
const projector = (origin: LatLng) => {
  const mPerDegLng = 111_320 * Math.cos((origin.lat * Math.PI) / 180);
  return (p: LatLng): XY => ({ x: (p.lng - origin.lng) * mPerDegLng, y: (p.lat - origin.lat) * M_PER_DEG_LAT });
};
const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const angleGap = (a: number, b: number) => {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return Math.min(d, 360 - d);
};

function distanceToPolygon(p: XY, poly: XY[]) {
  let inside = false, best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    const dx = b.x - a.x, dy = b.y - a.y, len = dx * dx + dy * dy;
    const t = len ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len, 0, 1) : 0;
    best = Math.min(best, Math.hypot(a.x + t * dx - p.x, a.y + t * dy - p.y));
  }
  return inside ? 0 : best;
}

/** Roof segments that belong to the chosen building (Google often models a whole terrace as one building). */
export function segmentsForBuilding(solar: GoogleSolarReference | null | undefined, footprint: BuildingFootprint | null | undefined, site: LatLng) {
  const segments = solar?.status === "ok" ? solar.roofSegments ?? [] : [];
  if (!segments.length) return [];
  const project = projector(site);
  if (footprint?.status === "ok" && footprint.path?.length) {
    const poly = footprint.path.map(project);
    const own = segments.filter((s) => s.center && distanceToPolygon(project(s.center), poly) <= 1.5);
    if (own.length) return own;
  }
  if ((solar?.distanceM ?? Infinity) > 15) return [];
  return segments.filter((s) => !s.center || Math.hypot(project(s.center).x, project(s.center).y) <= 25);
}

/** Roof form and pitch from the dominant roof planes. */
export function classifyRoof(segments: GoogleSolarRoofSegment[]): { form: StudioRoofForm; pitchDeg: number } | null {
  const total = segments.reduce((sum, s) => sum + s.areaM2, 0);
  if (total < 8) return null;
  const flatArea = segments.filter((s) => s.pitchDeg < 12).reduce((sum, s) => sum + s.areaM2, 0);
  if (flatArea / total >= 0.6) return { form: "flat", pitchDeg: 0 };
  const pitched = segments.filter((s) => s.pitchDeg >= 12 && s.areaM2 >= 0.08 * total);
  if (!pitched.length) return { form: "flat", pitchDeg: 0 };
  const pitchArea = pitched.reduce((sum, s) => sum + s.areaM2, 0);
  const pitchDeg = Math.round(clamp(pitched.reduce((sum, s) => sum + s.pitchDeg * s.areaM2, 0) / pitchArea, 10, 55));
  const clusters: number[] = [];
  for (const s of [...pitched].sort((a, b) => b.areaM2 - a.areaM2)) {
    if (!clusters.some((az) => angleGap(az, s.azimuthDeg) < 35)) clusters.push(s.azimuthDeg);
  }
  if (clusters.length === 1) return { form: "mono", pitchDeg };
  if (clusters.length === 2) return { form: angleGap(clusters[0], clusters[1]) > 140 ? "gable" : "hip", pitchDeg };
  return { form: "hip", pitchDeg };
}

/** Eaves height and storeys from roof-plane heights above sea level minus ground elevation. */
export function estimateHeight(segments: GoogleSolarRoofSegment[], groundElevationM: number, depthM: number, roof: { form: StudioRoofForm; pitchDeg: number }, storeyHeightM: number) {
  const heights = segments.filter((s) => Number.isFinite(s.planeHeightAslM) && (roof.form === "flat" || s.pitchDeg >= 12)).map((s) => s.planeHeightAslM! - groundElevationM).sort((a, b) => a - b);
  if (!heights.length) return null;
  const median = heights[Math.floor(heights.length / 2)];
  const rise = roof.form === "flat" ? 0 : (depthM / 2) * Math.tan((roof.pitchDeg * Math.PI) / 180);
  const eaves = median - rise / 2;
  if (!Number.isFinite(eaves) || eaves < 2 || eaves > 250) return null;
  return { eavesM: round1(eaves), heightM: round1(eaves + rise), floors: clamp(Math.round(eaves / storeyHeightM), 1, 60) };
}

const TYPE_BY_KIND: Record<StudioRegion, Record<string, string>> = {
  UK: { detached: "UK01", semi: "UK02", mid: "UK03", end: "UK04", bungalow: "UK05", lowrise: "UK06", tower: "UK07" },
  EU: { detached: "EU01", semi: "EU02", mid: "EU03", end: "EU04", bungalow: "EU01", lowrise: "EU05", tower: "EU06" },
  CA: { detached: "CA01", semi: "CA03", mid: "CA04", end: "CA05", bungalow: "CA02", lowrise: "CA07", tower: "CA08" },
  JP: { detached: "JP01", semi: "JP01", mid: "JP01", end: "JP01", bungalow: "JP02", lowrise: "JP03", tower: "JP05" },
};

export function chooseBuildingType(region: StudioRegion, facts: { floors?: number; footprintAreaM2?: number; attachedSides?: number; buildingTag?: string; widthM?: number }): string {
  const tag = facts.buildingTag ?? "";
  const floors = facts.floors;
  const area = facts.footprintAreaM2 ?? 0;
  const table = TYPE_BY_KIND[region];
  if ((floors ?? 0) >= 5) return region === "JP" && (floors ?? 0) < 8 ? "JP04" : table.tower;
  if (/^(apartments|residential|dormitory|commercial|office)$/.test(tag) || area >= 220) return region === "JP" && (floors ?? 2) >= 3 ? "JP04" : table.lowrise;
  const attached = facts.attachedSides ?? (tag === "semidetached_house" ? 1 : tag === "terrace" ? 2 : 0);
  if (attached >= 2) return table.mid;
  if (attached === 1) return tag === "terrace" ? table.end : table.semi;
  if (floors === 1 || tag === "bungalow") return table.bungalow;
  if (region === "JP" && floors === 3 && (facts.widthM ?? 99) < 7.5) return "JP01_3F";
  return table.detached;
}

export function buildProfile(input: BuildingProfileInput): BuildingProfile {
  const { region, site } = input;
  const footprint = input.footprint?.status === "ok" ? input.footprint : null;
  const solarOk = input.solar?.status === "ok" ? input.solar : null;
  const segments = segmentsForBuilding(solarOk, footprint, site);
  const roof = classifyRoof(segments);

  const outlineSource: ProfileSource = footprint?.source === "google" ? "google-maps" : "osm";
  let width: ProfileField<number> | null = footprint?.widthM ? { value: footprint.widthM, source: outlineSource } : null;
  let depth: ProfileField<number> | null = footprint?.depthM ? { value: footprint.depthM, source: outlineSource } : null;
  let front: ProfileField<number> | null = footprint?.frontAzimuthDeg !== undefined ? { value: footprint.frontAzimuthDeg, source: footprint.frontSource === "road" ? "osm" : "estimated" } : null;
  if ((!width || !depth) && solarOk?.boundingBox && (solarOk.distanceM ?? Infinity) <= 15) {
    const project = projector(site);
    const sw = project(solarOk.boundingBox.sw), ne = project(solarOk.boundingBox.ne);
    const ew = Math.abs(ne.x - sw.x), ns = Math.abs(ne.y - sw.y);
    const main = segments[0];
    const facesEastWest = main ? Math.abs(Math.sin((main.azimuthDeg * Math.PI) / 180)) > Math.abs(Math.cos((main.azimuthDeg * Math.PI) / 180)) : false;
    width ??= { value: round1(facesEastWest ? ns : ew), source: "google-solar" };
    depth ??= { value: round1(facesEastWest ? ew : ns), source: "google-solar" };
    if (!front && main) front = { value: Math.round(main.azimuthDeg), source: "estimated" };
  }

  const regionDefault = studioTypesForRegion(region)[0];
  const storeyGuess = region === "JP" ? 2.8 : 2.95;
  let floors: ProfileField<number> | null = footprint?.floors ? { value: footprint.floors, source: "osm" } : null;
  let heightM: ProfileField<number> | undefined = footprint?.heightM ? { value: footprint.heightM, source: "osm" } : undefined;
  if (roof && Number.isFinite(input.groundElevationM)) {
    const estimate = estimateHeight(segments, input.groundElevationM!, depth?.value ?? regionDefault.depth, roof, storeyGuess);
    if (estimate) {
      floors ??= { value: estimate.floors, source: "google-elevation" };
      heightM ??= { value: estimate.heightM, source: "google-elevation" };
    }
  }

  const typeId = chooseBuildingType(region, {
    floors: floors?.value,
    footprintAreaM2: footprint?.footprintAreaM2,
    attachedSides: footprint?.attachedSides,
    buildingTag: footprint?.buildingTag,
    widthM: width?.value,
  });
  const type: StudioBuildingType = studioTypeById(typeId) ?? regionDefault;
  const detected = Boolean(footprint || segments.length);
  const allowedRoofs = roofFormsFor(type);
  const roofForm: ProfileField<StudioRoofForm> = roof && allowedRoofs.includes(roof.form) ? { value: roof.form, source: "google-solar" } : { value: type.roofForm, source: "catalog" };
  const roofPitchDeg: ProfileField<number> = roof && roof.form !== "flat" && roofForm.source === "google-solar" ? { value: roof.pitchDeg, source: "google-solar" } : { value: type.pitch, source: "catalog" };

  return {
    region,
    detected,
    buildingTypeId: { value: type.id, source: detected ? "estimated" : "catalog" },
    widthM: width ?? { value: type.width, source: "catalog" },
    depthM: depth ?? { value: type.depth, source: "catalog" },
    floors: floors ?? { value: type.floors, source: "catalog" },
    storeyHeightM: { value: type.storeyHeight, source: "catalog" },
    roofForm,
    roofPitchDeg,
    frontAzimuthDeg: front ?? { value: 180, source: "catalog" },
    heightM,
    footprintAreaM2: footprint?.footprintAreaM2,
    attachedSides: footprint?.attachedSides,
    osmId: footprint?.osmId,
    path: footprint?.path,
    roadName: footprint?.roadName,
    roofSegments: segments.map((s) => ({ pitchDeg: s.pitchDeg, azimuthDeg: s.azimuthDeg, areaM2: s.areaM2 })),
    solarPotential: solarOk && segments.length && solarOk.maxArrayPanelsCount ? {
      panels: solarOk.maxArrayPanelsCount,
      capacityKwp: solarOk.maxArrayCapacityKwp,
      yearlyDcKwh: solarOk.maxArrayYearlyDcKwh,
      sunshineHours: solarOk.maxSunshineHoursPerYear,
      arrayAreaM2: solarOk.maxArrayAreaM2,
    } : undefined,
    sources: {
      osm: input.footprintStatus ?? (footprint ? "ok" : "not-found"),
      googleSolar: input.solar === undefined ? "disabled" : input.solar === null ? "disabled" : input.solar.status,
      elevation: input.groundElevationM === undefined ? "disabled" : Number.isFinite(input.groundElevationM) ? "ok" : "unavailable",
    },
  };
}

/**
 * Studio `setDimensions` payload for a building type. Studio widths cover every unit of an
 * attached row (semi = 2, terrace = 3), and must stay inside ModerniteBuildingCore.validate().
 */
export function studioDimensions(type: StudioBuildingType, values: { widthM: number; depthM: number; floors: number; storeyHeightM: number; roofForm: StudioRoofForm; roofPitchDeg: number }, wwr = 0.2) {
  const units = type.units || 1;
  return {
    width: round1(clamp(values.widthM * units, 4 * units, 150)),
    depth: round1(clamp(values.depthM, 4, 100)),
    floors: Math.round(clamp(values.floors, 1, 60)),
    storeyHeight: Math.round(clamp(values.storeyHeightM, 2.5, 5) * 100) / 100,
    wwr: clamp(wwr, 0, 0.7),
    roofForm: values.roofForm,
    pitch: Math.round(clamp(values.roofPitchDeg, 5, 55)),
  };
}
