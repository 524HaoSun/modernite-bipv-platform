import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { candidatesFromOverpass, type OverpassElement } from "../lib/building-footprint";
import { STUDIO_GUIDE_COPY } from "../client/src/lib/studio-guide-copy";

const projectRoot = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(projectRoot, file), "utf8");

const square = (id: number, lat: number, lng: number, sizeDeg: number, tags: Record<string, string>): OverpassElement => ({
  type: "way",
  id,
  tags,
  geometry: [
    { lat, lon: lng },
    { lat: lat + sizeDeg, lon: lng },
    { lat: lat + sizeDeg, lon: lng + sizeDeg * 1.6 },
    { lat, lon: lng + sizeDeg * 1.6 },
    { lat, lon: lng },
  ],
});

describe("building candidates around a searched address", () => {
  const site = { lat: 52.9334, lng: -1.2182 };

  it("lists houses nearest first with their OSM address and skips garages and sheds", () => {
    const elements = [
      square(1, site.lat + 0.0004, site.lng, 0.00008, { building: "house", "addr:housenumber": "22", "addr:street": "Clifford Avenue" }),
      square(2, site.lat, site.lng, 0.00008, { building: "semidetached_house", "addr:housenumber": "20", "addr:street": "Clifford Avenue" }),
      square(3, site.lat - 0.0002, site.lng, 0.00008, { building: "garage" }),
      square(4, site.lat - 0.0003, site.lng, 0.00002, { building: "yes" }),
      { type: "way", id: 5, tags: { highway: "residential" }, geometry: [{ lat: site.lat, lon: site.lng - 0.001 }, { lat: site.lat, lon: site.lng + 0.001 }] },
    ];
    const candidates = candidatesFromOverpass(elements, site);
    expect(candidates.map((candidate) => candidate.id)).toEqual([2, 1]);
    expect(candidates[0]).toMatchObject({ address: "20 Clifford Avenue", buildingTag: "semidetached_house" });
    expect(candidates[0]!.areaM2).toBeGreaterThan(30);
    expect(candidates[0]!.path).toHaveLength(4);
  });
});

describe("address-first location step", () => {
  it("asks for a postcode or address before loading the satellite map", () => {
    const app = read("client/src/App.tsx");
    expect(app).toContain("{addressSearch ? <AddressGate");
    expect(app).toContain("isSampleLocation(context.location) ? null : context.location");
    expect(app).toContain("trpc.site.nearbyBuildings.useQuery");
    expect(app).toContain("if (match.precise) setDetectKey(keyFor(match.coordinates));");
    expect(read("server/routers.ts")).toContain("nearbyBuildings: publicProcedure");
  });

  it("lets the user pick a building on the map, which becomes the detected outline", () => {
    const app = read("client/src/App.tsx");
    const map = read("client/src/components/ProjectLocationMap.tsx");
    expect(app).toContain('onAreaChange({ path: candidate.path, areaM2: candidate.areaM2, source: "detected" });');
    expect(map).toContain("buildingPicker.onPick(hit)");
    expect(map).toContain('toolStage === "pick"');
    expect(map).toContain("onChangeAddress");
  });

  it("reuses the area fetched for the candidates when the picked building is profiled", () => {
    const service = read("server/building-service.ts");
    expect(service).toContain("areaElements.find(");
    expect(service).toContain("REUSE_WITHIN_M");
  });
});

describe("Design Studio guide", () => {
  it("shows ordered steps, a first-visit tutorial and skips the duplicate address block", () => {
    const app = read("client/src/App.tsx");
    expect(app).toContain('className="studio-guide-steps"');
    expect(app).toContain("<StudioTour");
    expect(app).toContain("STUDIO_TOUR_STORAGE_KEY");
    expect(app).toContain(".mb-block:has(#mb-query)");
    expect(app).toContain('querySelectorAll<HTMLButtonElement>("nav.studio-tabs .studio-tab")[1]?.click()');
    expect(app).toContain("#host-detected-banner");
  });

  it("has guide and tutorial copy in every language", () => {
    for (const copy of Object.values(STUDIO_GUIDE_COPY)) {
      expect(copy.steps).toHaveLength(4);
      expect(copy.tour.items).toHaveLength(5);
      expect(copy.detectedBanner.length).toBeGreaterThan(10);
    }
    expect(Object.keys(STUDIO_GUIDE_COPY).sort()).toEqual(["en", "es", "fr", "it", "ja", "zh", "zh-Hant"]);
  });
});
