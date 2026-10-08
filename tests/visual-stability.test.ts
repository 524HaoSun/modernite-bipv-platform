import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
const guardMarker = "Critical visual stability guard";
const guard = css.slice(css.lastIndexOf(guardMarker));

describe("visual stability guards", () => {
  it("keeps the customer loading image as the final calculation background", () => {
    expect(guard).toContain('url("/assets/modernite-loading-client-bg.png") center center / 100% 100% no-repeat !important');
    expect(guard).toContain(".calculation-page--cinematic .calculation-ambient");
    expect(guard).toContain(".calculation-page--cinematic .calculation-radar__arc");
    expect(guard).toContain("display: none !important");
  });

  it("keeps the Results hero customer image protected from later overrides", () => {
    expect(guard).toContain('--modernite-results-card-image: url("/assets/modernite-results-client-bg.png")');
    expect(guard).toContain("object-fit: contain !important");
    expect(guard).toContain("overflow: hidden !important");
    expect(guard).toContain("isolation: isolate !important");
  });

  it("keeps the Results hero stable on laptop and zoomed viewports", () => {
    expect(guard).toContain("@media (max-width: 1500px)");
    expect(guard).toContain("grid-template-columns: repeat(2, minmax(0, 1fr)) !important");
    expect(guard).toContain("@media (max-width: 980px)");
    expect(guard).toContain("width: min(430px, 86vw) !important");
    expect(guard).toContain("@media (max-width: 680px)");
    expect(guard).toContain("grid-template-columns: 1fr !important");
  });

  it("remains the final CSS block so visual fixes cannot be silently overridden", () => {
    expect(css.lastIndexOf(guardMarker)).toBeGreaterThan(0);
    expect(css.trimEnd().endsWith("}")).toBe(true);
    expect(css.slice(css.lastIndexOf(guardMarker))).toBe(guard);
  });
});
