import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MARKET_TO_STUDIO_REGION, STUDIO_BUILDING_TYPES, roofFormsFor, studioTypeById, studioTypeLabel, studioTypesForRegion } from "../lib/studio-catalog";
import { regionName } from "../client/src/lib/region-names";

const studio = fs.readFileSync(path.resolve(import.meta.dirname, "../client/public/studio.html"), "utf8");

const studioEntry = (id: string) => {
  const start = studio.indexOf(`{id:"${id}",`);
  expect(start, `building type ${id} missing from studio.html`).toBeGreaterThan(-1);
  const next = studio.indexOf("{id:\"", start + 5);
  return studio.slice(start, next > -1 ? next : start + 4000);
};
const field = (entry: string, key: string) => entry.match(new RegExp(`[,{]${key}:("?)([^,"}]+)\\1`))?.[2];

describe("studio building catalog", () => {
  it("mirrors every building type of the customer Studio", () => {
    expect(STUDIO_BUILDING_TYPES).toHaveLength(27);
    for (const type of STUDIO_BUILDING_TYPES) {
      const entry = studioEntry(type.id);
      expect(field(entry, "region"), type.id).toBe(type.region);
      expect(Number(field(entry, "width")), type.id).toBe(type.width);
      expect(Number(field(entry, "depth")), type.id).toBe(type.depth);
      expect(Number(field(entry, "floors")), type.id).toBe(type.floors);
      expect(field(entry, "roofForm"), type.id).toBe(type.roofForm);
    }
  });

  it("covers each market region and offers a valid roof list", () => {
    for (const region of Object.values(MARKET_TO_STUDIO_REGION)) {
      const types = studioTypesForRegion(region);
      expect(types.length).toBeGreaterThan(0);
      for (const type of types) expect(roofFormsFor(type)).toContain(type.roofForm);
    }
    expect(studioTypeById("UK01")?.labelEn).toBe("Detached house");
    expect(studioTypeById("nope")).toBeUndefined();
  });

  it("names every building type in all seven interface languages, matching the Studio", () => {
    const languages = ["en", "zh", "zh-Hant", "fr", "ja", "es", "it"];
    for (const type of STUDIO_BUILDING_TYPES) {
      const names = languages.map((language) => studioTypeLabel(type.id, language));
      names.forEach((name) => expect(name, type.id).toBeTruthy());
      expect(new Set(names).size, type.id).toBeGreaterThanOrEqual(4);
    }
    expect(studioTypeLabel("UK02", "fr")).toBe("Maison jumelée");
    expect(studioTypeLabel("JP01", "zh")).toBe("两层一户建");
    expect(studioTypeLabel("JP01", "zh-Hant")).toBe("兩層一戶建");
    expect(studioTypeLabel("UK06", "en")).toBe("Low-rise apartment building");
    expect(studioTypeLabel("nope", "fr")).toBe("nope");
  });

  it("localises market and country names for display", () => {
    expect(regionName("UK", "fr", "United Kingdom")).toBe("Royaume-Uni");
    expect(regionName("EU", "ja", "Europe")).toBe("ヨーロッパ");
    expect(regionName("DE", "zh", "Germany")).toBe("德国");
    expect(regionName("??", "fr", "Fallback")).toBe("Fallback");
  });
});
