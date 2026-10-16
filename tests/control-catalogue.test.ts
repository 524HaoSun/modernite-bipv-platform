import { describe, expect, it } from "vitest";
import {
  applyCatalogueToStudio,
  type PublicCatalogue,
  type StudioEnergyCore,
} from "../client/src/lib/control-catalogue";

describe("applyCatalogueToStudio", () => {
  it("updates published names and Wp while leaving a/b coefficients untouched", () => {
    const energyCore: StudioEnergyCore = {
      PROFILES: {
        windsor_black: ["Legacy name", 100, 0.04156, 0.03889],
        canopy: ["Solar Canopy", 95, 0.02365, 0.02236],
        inactive_local: ["Should stay local-only", 50, 0.01, 0.01],
      },
    };
    const catalogue: PublicCatalogue = {
      catalogueVersion: "c1",
      parameterVersion: "t1",
      products: [
        {
          id: "windsor_black",
          name: "Windsor Broad · Black",
          description: "",
          wp: 140.6,
          role: "none",
          u: null,
          g: null,
          thermalBasis: "",
          areaBasis: "active",
        },
        {
          id: "canopy",
          name: "Solar Canopy",
          description: "",
          wp: 95,
          role: "none",
          u: null,
          g: null,
          thermalBasis: "",
          areaBasis: "active",
        },
      ],
    };

    const result = applyCatalogueToStudio(energyCore, catalogue);
    expect(result.updated).toBe(1);
    expect(result.inactiveBlocked).toEqual(["inactive_local"]);
    expect(energyCore.PROFILES.windsor_black).toEqual([
      "Windsor Broad · Black",
      140.6,
      0.04156,
      0.03889,
    ]);
    expect(energyCore.PROFILES.canopy).toEqual([
      "Solar Canopy",
      95,
      0.02365,
      0.02236,
    ]);
  });

  it("no-ops when catalogue or energy core is missing", () => {
    expect(applyCatalogueToStudio(null, null)).toEqual({
      updated: 0,
      inactiveBlocked: [],
    });
  });
});
