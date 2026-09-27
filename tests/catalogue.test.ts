import { describe, expect, it } from "vitest";
import { PRODUCTS, TILE_COLOURS, getProduct, getProductsForSurface } from "../data/catalogue";

describe("Product catalogue reference data (§13.2 & Acceptance #4, #16)", () => {
  it("loads all 13 products from Data Pack (§13.2)", () => {
    expect(PRODUCTS).toHaveLength(13);
  });

  it("loads exact peak power Wp/m² for all roof tiles (§13.2)", () => {
    const yorkshire = getProduct("tile-yorkshire")!;
    expect(yorkshire.wpPerM2).toBe(152.0);

    const windsor = getProduct("tile-windsor")!;
    expect(windsor.wpPerM2).toBe(140.6);

    const highland = getProduct("tile-highland")!;
    expect(highland.wpPerM2).toBe(139.2);

    const cotswold = getProduct("tile-cotswold")!;
    expect(cotswold.wpPerM2).toBe(133.2);
  });

  it("coloured roof tiles are exactly 70% of the black rating for all four models (Acceptance #4)", () => {
    const roofTiles = PRODUCTS.filter((p) => p.category === "roof");
    expect(roofTiles).toHaveLength(4);

    for (const tile of roofTiles) {
      expect(tile.colouredWpPerM2).toBeDefined();
      const expectedColoured = Math.round(tile.wpPerM2 * 0.7 * 100) / 100;
      expect(tile.colouredWpPerM2).toBe(expectedColoured);
    }

    expect(getProduct("tile-yorkshire")!.colouredWpPerM2).toBe(106.4);
    expect(getProduct("tile-windsor")!.colouredWpPerM2).toBe(98.42);
    expect(getProduct("tile-highland")!.colouredWpPerM2).toBe(97.44);
    expect(getProduct("tile-cotswold")!.colouredWpPerM2).toBe(93.24);
  });

  it("loads exact ratings for facade, window, railing and structures (§13.2)", () => {
    expect(getProduct("facade-black")!.wpPerM2).toBe(150.0);
    expect(getProduct("facade-grey")!.wpPerM2).toBe(120.0);
    expect(getProduct("facade-light")!.wpPerM2).toBe(100.0);
    expect(getProduct("skylight")!.wpPerM2).toBe(105.0);
    expect(getProduct("railing")!.wpPerM2).toBe(105.0);
    expect(getProduct("window-edge")!.wpPerM2).toBe(100.0);
    expect(getProduct("window-standard")!.wpPerM2).toBe(100.0);
    expect(getProduct("conservatory-roof")!.wpPerM2).toBe(100.0);
    expect(getProduct("canopy")!.wpPerM2).toBe(95.0);
  });

  it("includes all 10 tile colours from §13.4 with Graphite Grey recommended for UK", () => {
    expect(TILE_COLOURS).toHaveLength(10);
    const graphite = TILE_COLOURS.find((c) => c.id === "graphite-grey")!;
    expect(graphite.ral).toBe("7024");
    expect(graphite.recommendedUk).toBe(true);
    expect(graphite.hex).toBe("#616065");
  });

  it("correctly filters products applicable to surface kinds", () => {
    const roofProducts = getProductsForSurface("roof-plane");
    expect(roofProducts).toHaveLength(4);
    expect(roofProducts.map((p) => p.id)).toEqual([
      "tile-yorkshire",
      "tile-windsor",
      "tile-highland",
      "tile-cotswold",
    ]);

    const facadeProducts = getProductsForSurface("facade");
    expect(facadeProducts).toHaveLength(3);

    const railingProducts = getProductsForSurface("railing");
    expect(railingProducts).toHaveLength(1);
    expect(railingProducts[0].id).toBe("railing");
  });
});
