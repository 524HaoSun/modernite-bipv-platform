import { describe, expect, it } from "vitest";
import en from "../i18n/en.json";
import fr from "../i18n/fr.json";
import ja from "../i18n/ja.json";
import zh from "../i18n/zh.json";

describe("i18n dictionary parity (§20.6)", () => {
  const enKeys = Object.keys(en).sort();
  it("maintains identical key coverage across all four languages", () => {
    expect(Object.keys(fr).sort()).toEqual(enKeys);
    expect(Object.keys(ja).sort()).toEqual(enKeys);
    expect(Object.keys(zh).sort()).toEqual(enKeys);
  });
});
