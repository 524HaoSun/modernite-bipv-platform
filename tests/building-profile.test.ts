import { describe, expect, it } from "vitest";
import { buildProfile, chooseBuildingType, classifyRoof, estimateHeight, studioDimensions } from "../lib/building-profile";
import type { GoogleSolarRoofSegment } from "../lib/google-solar";
import { studioTypeById } from "../lib/studio-catalog";

const seg = (azimuthDeg: number, pitchDeg: number, areaM2 = 30, planeHeightAslM?: number): GoogleSolarRoofSegment => ({
  azimuthDeg, pitchDeg, areaM2, groundAreaM2: areaM2, sunshineMedianHoursPerYear: null, planeHeightAslM,
});

describe("roof classification", () => {
  it("recognises gable, hip, mono and flat roofs from Google Solar planes", () => {
    expect(classifyRoof([seg(180, 35), seg(0, 35)])).toEqual({ form: "gable", pitchDeg: 35 });
    expect(classifyRoof([seg(180, 30), seg(0, 30), seg(90, 30, 12), seg(270, 30, 12)])?.form).toBe("hip");
    expect(classifyRoof([seg(170, 20)])?.form).toBe("mono");
    expect(classifyRoof([seg(180, 3, 80), seg(0, 30, 10)])).toEqual({ form: "flat", pitchDeg: 0 });
    expect(classifyRoof([seg(180, 30, 2)])).toBeNull();
  });

  it("derives storeys from plane height above ground", () => {
    const roof = { form: "gable" as const, pitchDeg: 35 };
    const height = estimateHeight([seg(180, 35, 30, 58.4), seg(0, 35, 30, 58.4)], 50, 8, roof, 2.95);
    expect(height?.floors).toBe(2);
    expect(height!.heightM).toBeGreaterThan(height!.eavesM);
    expect(estimateHeight([seg(180, 35)], 50, 8, roof, 2.95)).toBeNull();
  });
});

describe("building type selection", () => {
  it("maps attachment, storeys and size to the Studio catalog", () => {
    expect(chooseBuildingType("UK", { floors: 2 })).toBe("UK01");
    expect(chooseBuildingType("UK", { floors: 2, attachedSides: 1 })).toBe("UK02");
    expect(chooseBuildingType("UK", { floors: 2, attachedSides: 2 })).toBe("UK03");
    expect(chooseBuildingType("UK", { floors: 1 })).toBe("UK05");
    expect(chooseBuildingType("UK", { floors: 12 })).toBe("UK07");
    expect(chooseBuildingType("UK", { floors: 3, buildingTag: "apartments" })).toBe("UK06");
    expect(chooseBuildingType("JP", { floors: 3, widthM: 6 })).toBe("JP01_3F");
    expect(chooseBuildingType("JP", { floors: 6 })).toBe("JP04");
    for (const region of ["UK", "EU", "CA", "JP"] as const) {
      for (const facts of [{ floors: 1 }, { floors: 2 }, { attachedSides: 1 }, { attachedSides: 2 }, { floors: 4, buildingTag: "apartments" }, { floors: 20 }]) {
        expect(studioTypeById(chooseBuildingType(region, facts))?.region).toBe(region);
      }
    }
  });
});

describe("building profile", () => {
  it("falls back to the catalog when nothing is detected", () => {
    const profile = buildProfile({ region: "EU", site: { lat: 48.1, lng: 11.5 } });
    expect(profile.detected).toBe(false);
    expect(profile.buildingTypeId.source).toBe("catalog");
    expect(studioTypeById(profile.buildingTypeId.value)?.region).toBe("EU");
  });

  it("models joined blocks as one block of the same footprint area, without a measured roof", () => {
    const at = (east: number, north: number) => ({ lat: 51.5 + north / 110_540, lng: -0.12 + east / (111_320 * Math.cos((51.5 * Math.PI) / 180)) });
    const path = [at(-6, -5), at(6, -5), at(6, 0), at(0, 0), at(0, 5), at(-6, 5), at(-6, -5)];
    const footprint = { status: "ok" as const, source: "osm" as const, path, footprintAreaM2: 90, widthM: 12, depthM: 10, frontAzimuthDeg: 180, frontSource: "road" as const, attachedSides: 0, note: "" };
    const profile = buildProfile({ region: "UK", site: at(0, 0), footprint });
    expect(profile.composite).toEqual({ fill: 0.75, outlineWidthM: 12, outlineDepthM: 10 });
    expect(profile.widthM.value * profile.depthM.value).toBeCloseTo(90, 0);
    expect(profile.roofPlanes).toBeUndefined();
  });

  it("scales Studio dimensions by units and keeps them in range", () => {
    const semi = studioTypeById("UK02")!;
    const dims = studioDimensions(semi, { widthM: 6, depthM: 200, floors: 2.4, storeyHeightM: 9, roofForm: "gable", roofPitchDeg: 80 }, 0.25);
    expect(dims).toEqual({ width: 12, depth: 100, floors: 2, storeyHeight: 5, wwr: 0.25, roofForm: "gable", pitch: 55 });
    expect(studioDimensions(semi, { widthM: 6, depthM: 8, floors: 2, storeyHeightM: 3, roofForm: "hip", roofPitchDeg: 30, chimney: false })).toMatchObject({ chimney: false });
    expect(studioDimensions(semi, { widthM: 6, depthM: 8, floors: 2, storeyHeightM: 3, roofForm: "hip", roofPitchDeg: 30, chimney: true })).not.toHaveProperty("chimney");
  });
});
