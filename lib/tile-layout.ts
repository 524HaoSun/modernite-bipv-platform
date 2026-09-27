import { getProduct } from "../data/catalogue";

export const TILE_SIDE_LAP_MM = 25;
export const TILE_HEAD_LAP_MM = 45;

export function calculateTileLayout(productId: string, surfaceWidthM: number, surfaceLengthM: number) {
  const product = getProduct(productId);
  if (!product?.tileSizeMm) throw new Error("A tile product is required");
  const [tileWidthMm, tileLengthMm] = product.tileSizeMm.split("×").map((part) => Number(part.trim()));
  const horizontalStepM = (tileWidthMm - TILE_SIDE_LAP_MM) / 1000;
  const upSlopeStepM = (tileLengthMm - TILE_HEAD_LAP_MM) / 1000;
  const columns = Math.max(0, Math.floor(surfaceWidthM / horizontalStepM));
  const rows = Math.max(0, Math.floor(surfaceLengthM / upSlopeStepM));
  const footprintWidthM = columns * horizontalStepM;
  const footprintLengthM = rows * upSlopeStepM;
  return { columns, rows, wholeTiles: columns * rows, horizontalStepM, upSlopeStepM, offsetXM: Math.max(0, (surfaceWidthM - footprintWidthM) / 2), offsetYM: Math.max(0, (surfaceLengthM - footprintLengthM) / 2) };
}
