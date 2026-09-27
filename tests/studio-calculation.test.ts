import { describe, expect, it } from "vitest";
import { buildPlanningInput, mapStudioSnapshotToSurfaces } from "../lib/studio-calculation";

describe("Studio snapshot calculation mapping", () => {
  const snapshot = {
    building: { id: "UK01", width: 10.8, depth: 8.4, floors: 2, storeyHeight: 2.95, usage: "residential" as const },
    surfaces: [
      { id: "roof_tiles:front", product: "roof_tiles", profile: "windsor_colour", area: 26.5, tilt: 32, az: 180, enabled: true },
      { id: "facade:front", product: "facade", profile: "facade_grey", area: 9.2, tilt: 90, az: 180, enabled: true },
      { id: "ignored", product: "unknown", profile: "unknown", area: 4, tilt: 30, az: 180, enabled: true },
    ],
  };

  it("maps live customer Studio product snapshots onto the approved empirical catalogue", () => {
    expect(mapStudioSnapshotToSurfaces(snapshot)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "roof_tiles:front", productId: "tile-windsor", finishId: "graphite-grey", kind: "roof-plane" }),
      expect.objectContaining({ id: "facade:front", productId: "facade-grey", kind: "facade" }),
    ]));
    expect(mapStudioSnapshotToSurfaces(snapshot)).toHaveLength(2);
  });

  it("keeps the selected address and geometry in the server calculation input", () => {
    const input = buildPlanningInput({
      region: "UK",
      label: "10 Downing Street, London SW1A 2AA, UK",
      coordinates: { lat: 51.5034, lng: -0.1276 },
      snapshot,
    });
    expect(input.location).toMatchObject({ lat: 51.5034, lng: -0.1276, label: "10 Downing Street, London SW1A 2AA, UK" });
    expect(input.building).toMatchObject({ archetypeId: "UK01", widthM: 10.8, depthM: 8.4, storeys: 2 });
    expect(input.surfaces).toHaveLength(2);
  });
});
