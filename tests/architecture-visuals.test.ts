import { describe, expect, it } from "vitest";
import { ARCHETYPES } from "../data/archetypes";
import { visualKeyForArchetype } from "../client/src/data/architecture-visuals";

describe("architecture visual families", () => {
  it("keeps UK archetype previews visually distinct", () => {
    expect(visualKeyForArchetype(ARCHETYPES.UK01)).toBe("detached");
    expect(visualKeyForArchetype(ARCHETYPES.UK02)).toBe("semi");
    expect(visualKeyForArchetype(ARCHETYPES.UK03)).toBe("terrace");
    expect(visualKeyForArchetype(ARCHETYPES.UK04)).toBe("endTerrace");
    expect(visualKeyForArchetype(ARCHETYPES.UK05)).toBe("bungalow");
    expect(visualKeyForArchetype(ARCHETYPES.UK06)).toBe("lowrise");
    expect(visualKeyForArchetype(ARCHETYPES.UK07)).toBe("highrise");
  });
});
