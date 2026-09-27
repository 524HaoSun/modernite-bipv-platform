import { ProductModel, TileColour } from "../types/solar";

export const PRODUCTS: ProductModel[] = [
  // --- Roof Tiles ---
  {
    id: "tile-yorkshire",
    name: "Yorkshire Longspan",
    wpPerM2: 152.0,
    colouredWpPerM2: 106.4,
    appliesTo: ["roof-plane"],
    category: "roof",
    tileSizeMm: "1250 × 450",
    glassSizeMm: "1200 × 400",
    thicknessMm: 44,
    descriptionKey: "products.tile_yorkshire_desc",
  },
  {
    id: "tile-windsor",
    name: "Windsor Broad",
    wpPerM2: 140.6,
    colouredWpPerM2: 98.42,
    appliesTo: ["roof-plane"],
    category: "roof",
    tileSizeMm: "480 × 670",
    glassSizeMm: "400 × 600",
    thicknessMm: 33,
    descriptionKey: "products.tile_windsor_desc",
  },
  {
    id: "tile-highland",
    name: "Highland Shingle",
    wpPerM2: 139.2,
    colouredWpPerM2: 97.44,
    appliesTo: ["roof-plane"],
    category: "roof",
    tileSizeMm: "840 × 290",
    glassSizeMm: "800 × 240",
    thicknessMm: 44,
    descriptionKey: "products.tile_highland_desc",
  },
  {
    id: "tile-cotswold",
    name: "Cotswold Slate",
    wpPerM2: 133.2,
    colouredWpPerM2: 93.24,
    appliesTo: ["roof-plane"],
    category: "roof",
    tileSizeMm: "370 × 480",
    glassSizeMm: "300 × 400",
    thicknessMm: 33,
    descriptionKey: "products.tile_cotswold_desc",
  },

  // --- Facade ---
  {
    id: "facade-black",
    name: "Solar Facade — Black Opaque",
    wpPerM2: 150.0,
    colouredWpPerM2: null,
    appliesTo: ["facade"],
    category: "facade",
    descriptionKey: "products.facade_black_desc",
  },
  {
    id: "facade-grey",
    name: "Solar Facade — Grey Coloured",
    wpPerM2: 120.0,
    colouredWpPerM2: null,
    appliesTo: ["facade"],
    category: "facade",
    descriptionKey: "products.facade_grey_desc",
  },
  {
    id: "facade-light",
    name: "Solar Facade — Light-Transmitting",
    wpPerM2: 100.0,
    colouredWpPerM2: null,
    appliesTo: ["facade"],
    category: "facade",
    descriptionKey: "products.facade_light_desc",
  },

  // --- Windows & Glass ---
  {
    id: "window-edge",
    name: "Solar Window — Edge",
    wpPerM2: 100.0,
    colouredWpPerM2: null,
    appliesTo: ["window"],
    category: "window",
    uValue: 0.4,
    gValue: 0.12,
    vltPercent: 30,
    maxGlassMm: "1200 × 1600",
    descriptionKey: "products.window_edge_desc",
  },
  {
    id: "window-standard",
    name: "Solar Window — Standard",
    wpPerM2: 100.0,
    colouredWpPerM2: null,
    appliesTo: ["window"],
    category: "window",
    uValue: 1.2,
    gValue: 0.25,
    vltPercent: 40,
    maxGlassMm: "1200 × 1600",
    descriptionKey: "products.window_standard_desc",
  },
  {
    id: "skylight",
    name: "Solar Skylight",
    wpPerM2: 105.0,
    colouredWpPerM2: null,
    appliesTo: ["skylight"],
    category: "window",
    uValue: 0.4,
    descriptionKey: "products.skylight_desc",
  },

  // --- Railing ---
  {
    id: "railing",
    name: "Solar Railing",
    wpPerM2: 105.0,
    colouredWpPerM2: null,
    appliesTo: ["railing"],
    category: "railing",
    vltPercent: 30,
    maxGlassMm: "1600 × 1200",
    thicknessMm: 22,
    descriptionKey: "products.railing_desc",
  },

  // --- Additional Structures ---
  {
    id: "conservatory-roof",
    name: "Solar Conservatory — Roof",
    wpPerM2: 100.0,
    colouredWpPerM2: null,
    appliesTo: ["conservatory-roof"],
    category: "structure",
    uValue: 0.5,
    gValue: 0.11,
    vltPercent: 19,
    maxGlassMm: "800 × 1200",
    descriptionKey: "products.conservatory_roof_desc",
  },
  {
    id: "canopy",
    name: "Solar Canopy",
    wpPerM2: 95.0,
    colouredWpPerM2: null,
    appliesTo: ["canopy"],
    category: "structure",
    vltPercent: 30,
    maxGlassMm: "800 × 1200",
    descriptionKey: "products.canopy_desc",
  },
];

export const TILE_COLOURS: TileColour[] = [
  { id: "black", name: "All Black", ral: null, hex: "#1e2124" },
  { id: "terracotta", name: "Terracotta", ral: "8004", hex: "#ae5d3e" },
  { id: "brick-red", name: "Brick Red", ral: "3011", hex: "#b35547" },
  { id: "burgundy", name: "Burgundy", ral: "3009", hex: "#8c4642" },
  { id: "silver-grey", name: "Silver Grey", ral: "9006", hex: "#b6b6b6" },
  { id: "dusty-grey", name: "Dusty Grey", ral: "7040", hex: "#949394" },
  {
    id: "graphite-grey",
    name: "Graphite Grey",
    ral: "7024",
    hex: "#616065",
    recommendedUk: true,
  },
  { id: "blue-grey", name: "Blue Grey", ral: "7031", hex: "#69758b" },
  { id: "steel-blue", name: "Steel Blue", ral: "5011", hex: "#636e80" },
  { id: "night-blue", name: "Night Blue", ral: "5022", hex: "#363d58" },
];

export const FRAME_FINISHES = [
  { id: "iceberg-white", name: "Iceberg White", hex: "#dfe4db" },
  { id: "moonlight-gold", name: "Moonlight Gold", hex: "#b8ac93" },
  { id: "milan-grey", name: "Milan Grey", hex: "#aeb0b3" },
  { id: "london-grey", name: "London Grey", hex: "#5a6268" },
  { id: "senegal-black", name: "Senegal Black", hex: "#3c3f41" },
  { id: "prague-black", name: "Prague Black", hex: "#2a3135" },
  { id: "english-grey-oak", name: "English Grey Oak", hex: "#c2b5a3" },
  { id: "california-peach-wood", name: "California Peach Wood", hex: "#a05f38" },
  { id: "brazilian-coffee", name: "Brazilian Coffee", hex: "#635349" },
  { id: "turkish-coffee", name: "Turkish Coffee", hex: "#46382f" },
] as const;

export function getProduct(id: string): ProductModel | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export function getProductsForSurface(kind: string): ProductModel[] {
  return PRODUCTS.filter((p) => p.appliesTo.includes(kind as any));
}

export function getTileColour(id: string): TileColour | undefined {
  return TILE_COLOURS.find((c) => c.id === id);
}
