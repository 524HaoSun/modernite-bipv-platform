import { describe, expect, it } from "vitest";
import { RESULTS_COPY } from "../client/src/lib/results-copy";

describe("results energy-flow copy", () => {
  it("keeps the customer-approved direct-use and stored-use concepts in every language", () => {
    for (const copy of Object.values(RESULTS_COPY)) {
      expect(copy.usedDirectly.trim()).not.toBe("");
      expect(copy.usedDirectlyDetail.trim()).not.toBe("");
      expect(copy.storedLater.trim()).not.toBe("");
      expect(copy.storedLaterDetail.trim()).not.toBe("");
    }
  });

  it("does not restore the retired energy-flow fields", () => {
    for (const copy of Object.values(RESULTS_COPY)) {
      expect(copy).not.toHaveProperty("usedHome");
      expect(copy).not.toHaveProperty("usedHomeDetail");
      expect(copy).not.toHaveProperty("batteryShift");
      expect(copy).not.toHaveProperty("batteryShiftOn");
    }
  });

  it("does not repeat the retired English labels in explanatory copy", () => {
    expect(RESULTS_COPY.en.chainDetail(50, 60)).not.toMatch(/used at home/i);
    expect(RESULTS_COPY.en.carbonNote(0.2)).not.toMatch(/used at home/i);
  });
});
