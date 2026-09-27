import { INTERIM_CONVERSION_RULE } from "../data/constants";
import { baseEfficiency, REFERENCE_EFFICIENCY_AT_1000 } from "./efficiency";

export { INTERIM_CONVERSION_RULE };

export function convertedProductEfficiency(irradianceWm2: number, productWpPerM2: number): number {
  if (productWpPerM2 < 0) throw new Error("Product density cannot be negative");
  if (irradianceWm2 === 0) return 0;
  return (productWpPerM2 / 1000) * (baseEfficiency(irradianceWm2) / REFERENCE_EFFICIENCY_AT_1000);
}
