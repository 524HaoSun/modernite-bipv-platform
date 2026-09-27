import { describe, expect, it } from "vitest";
import { calculateTileLayout, TILE_HEAD_LAP_MM, TILE_SIDE_LAP_MM } from "../lib/tile-layout";

describe("Tile layout (§13.3)", () => {
  it("uses 25mm side and 45mm head laps with whole tiles only", () => {
    const layout = calculateTileLayout("tile-windsor", 5.1, 6.2);
    expect(TILE_SIDE_LAP_MM).toBe(25);
    expect(TILE_HEAD_LAP_MM).toBe(45);
    expect(layout.horizontalStepM).toBeCloseTo(0.455, 4);
    expect(layout.upSlopeStepM).toBeCloseTo(0.625, 4);
    expect(Number.isInteger(layout.wholeTiles)).toBe(true);
  });
});
