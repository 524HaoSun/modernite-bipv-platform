export function degradationFactor(year: number): number {
  if (!Number.isInteger(year) || year < 1 || year > 25) throw new Error("Year must be an integer from 1 to 25");
  return year === 1 ? 0.95 : 0.95 - 0.004 * (year - 1);
}

export function degradedGeneration(firstYearKwh: number, year: number): number {
  return firstYearKwh * (degradationFactor(year) / degradationFactor(1));
}
