import { describe, expect, it } from "vitest";
import { ARCHETYPES, UK_ARCHETYPE_IDS, getArchetype } from "../data/archetypes";

describe("Archetypes reference data (§13.1 & Acceptance #15)", () => {
  it("contains all 7 UK archetypes UK01-UK07", () => {
    expect(UK_ARCHETYPE_IDS).toHaveLength(7);
    for (const id of UK_ARCHETYPE_IDS) {
      expect(ARCHETYPES[id]).toBeDefined();
    }
  });

  it("UK01 Detached house has exact parameters", () => {
    const uk01 = getArchetype("UK01")!;
    expect(uk01.baseModel).toBe(1);
    expect(uk01.region).toBe("UK");
    expect(uk01.widthM).toBe(10.8);
    expect(uk01.depthM).toBe(8.4);
    expect(uk01.floors).toBe(2);
    expect(uk01.roofForm).toBe("hip");
    expect(uk01.roofPitchDeg).toBe(34);
    expect(uk01.wallMaterial).toBe("render");
    expect(uk01.units).toBe(1);
    expect(uk01.storeyHeightM).toBe(2.95);
    expect(uk01.baseHeightM).toBe(0.18);
    expect(uk01.overhangM).toBe(0.32);
  });

  it("UK02 Semi-detached house has exact parameters", () => {
    const uk02 = getArchetype("UK02")!;
    expect(uk02.baseModel).toBe(2);
    expect(uk02.widthM).toBe(6.1);
    expect(uk02.depthM).toBe(8.4);
    expect(uk02.floors).toBe(2);
    expect(uk02.roofForm).toBe("hip");
    expect(uk02.roofPitchDeg).toBe(31);
    expect(uk02.wallMaterial).toBe("render");
    expect(uk02.units).toBe(2);
  });

  it("UK03 Mid-terrace house has exact parameters", () => {
    const uk03 = getArchetype("UK03")!;
    expect(uk03.baseModel).toBe(3);
    expect(uk03.widthM).toBe(5.2);
    expect(uk03.depthM).toBe(8.5);
    expect(uk03.floors).toBe(2);
    expect(uk03.roofForm).toBe("gable");
    expect(uk03.roofPitchDeg).toBe(34);
    expect(uk03.wallMaterial).toBe("brick");
    expect(uk03.units).toBe(3);
  });

  it("UK04 End-terrace house has exact parameters", () => {
    const uk04 = getArchetype("UK04")!;
    expect(uk04.baseModel).toBe(4);
    expect(uk04.widthM).toBe(5.2);
    expect(uk04.depthM).toBe(8.5);
    expect(uk04.floors).toBe(2);
    expect(uk04.roofForm).toBe("gable");
    expect(uk04.roofPitchDeg).toBe(32);
    expect(uk04.wallMaterial).toBe("render");
    expect(uk04.units).toBe(3);
  });

  it("UK05 Bungalow is base model 1 with floors=1 and pitch=25", () => {
    const uk05 = getArchetype("UK05")!;
    expect(uk05.baseModel).toBe(1);
    expect(uk05.widthM).toBe(11.4);
    expect(uk05.depthM).toBe(8.2);
    expect(uk05.floors).toBe(1);
    expect(uk05.roofForm).toBe("hip");
    expect(uk05.roofPitchDeg).toBe(25);
    expect(uk05.wallMaterial).toBe("brick");
  });

  it("UK06 Low-rise flats has flat roof 0 deg and 3 floors", () => {
    const uk06 = getArchetype("UK06")!;
    expect(uk06.baseModel).toBe(6);
    expect(uk06.widthM).toBe(19.0);
    expect(uk06.depthM).toBe(11.5);
    expect(uk06.floors).toBe(3);
    expect(uk06.roofForm).toBe("flat");
    expect(uk06.roofPitchDeg).toBe(0);
    expect(uk06.wallMaterial).toBe("brick");
  });

  it("UK07 High-rise apartment has flat roof 0 deg, 10 floors and concrete walls", () => {
    const uk07 = getArchetype("UK07")!;
    expect(uk07.baseModel).toBe(7);
    expect(uk07.widthM).toBe(17.0);
    expect(uk07.depthM).toBe(13.0);
    expect(uk07.floors).toBe(10);
    expect(uk07.roofForm).toBe("flat");
    expect(uk07.roofPitchDeg).toBe(0);
    expect(uk07.storeyHeightM).toBe(3.05);
    expect(uk07.wallMaterial).toBe("concrete");
  });

  it("stores all 20 Phase-Two archetypes as data rows without new geometry", () => {
    const euKeys = Object.keys(ARCHETYPES).filter((k) => k.startsWith("EU"));
    const caKeys = Object.keys(ARCHETYPES).filter((k) => k.startsWith("CA"));
    const jpKeys = Object.keys(ARCHETYPES).filter((k) => k.startsWith("JP"));

    expect(euKeys).toHaveLength(6);
    expect(caKeys).toHaveLength(8);
    expect(jpKeys).toHaveLength(6);
  });
});
