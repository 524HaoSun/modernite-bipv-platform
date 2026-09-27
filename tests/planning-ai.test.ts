import { describe, expect, it } from "vitest";
import { createPlanningAIProvider, OfflinePlanningAIProvider } from "../server/planning-ai";

const demandInput = {
  householdSize: 3,
  daytimeOccupancy: "usually" as const,
  electricHeating: false,
  heatPump: true,
  electricHotWater: false,
  evCharger: true,
  deterministicFallbackKwh: 7_500,
};

describe("planning AI provider boundary", () => {
  it("uses the deterministic offline provider when requested", async () => {
    const provider = createPlanningAIProvider("offline");
    const result = await provider.estimateAnnualDemand(demandInput);

    expect(provider).toBeInstanceOf(OfflinePlanningAIProvider);
    expect(result).toMatchObject({ annualDemandKwh: 7_500, provider: "offline-fallback" });
  });

  it("keeps an explicit hosted-provider composition path for the current deployment", () => {
    expect(createPlanningAIProvider("manus").id).toBe("manus");
  });
});
