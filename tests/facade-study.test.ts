import { describe, expect, it } from "vitest";
import { headingToFacadeDirection } from "../client/src/components/LocationMap";
import { canonicalSurfaces } from "../lib/estimate-engine";

describe("Street View facade study", () => {
  it("maps the panorama heading to the closest cardinal facade", () => {
    expect(headingToFacadeDirection(0)).toBe("north");
    expect(headingToFacadeDirection(44)).toBe("north");
    expect(headingToFacadeDirection(45)).toBe("east");
    expect(headingToFacadeDirection(135)).toBe("south");
    expect(headingToFacadeDirection(225)).toBe("west");
    expect(headingToFacadeDirection(315)).toBe("north");
    expect(headingToFacadeDirection(-90)).toBe("west");
  });

  it("provides an editable facade surface for every selectable direction", () => {
    const facades = canonicalSurfaces().filter((surface) => surface.kind === "facade");
    expect(facades.map((surface) => surface.id).sort()).toEqual([
      "facade-east",
      "facade-north",
      "facade-south",
      "facade-west",
    ]);
    expect(facades.every((surface) => surface.included === false && surface.productId === null)).toBe(true);
  });
});
