import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { STUDIO_ADVISOR_PATH, studioAdvisorInputSchema, studioAdvisorMessages } from "../server/studio-advisor";

const projectRoot = path.resolve(import.meta.dirname, "..");

describe("studio advisor online mode", () => {
  it("accepts the payload the customer studio sends", () => {
    const parsed = studioAdvisorInputSchema.parse({
      message: "Which roof product suits this house?",
      language: "zh",
      history: [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }],
      context: "Modernite configuration\nUK01 / UK / Residential",
    });
    const messages = studioAdvisorMessages(parsed);
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("Simplified Chinese");
    expect(messages[0].content).toContain("UK01 / UK / Residential");
    expect(messages.slice(1).map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(messages.at(-1)?.content).toBe("Which roof product suits this house?");
  });

  it("rejects oversized or malformed requests", () => {
    expect(studioAdvisorInputSchema.safeParse({ message: "x".repeat(2001) }).success).toBe(false);
    expect(studioAdvisorInputSchema.safeParse({ message: "ok", history: Array.from({ length: 9 }, () => ({ role: "user", content: "a" })) }).success).toBe(false);
    expect(studioAdvisorInputSchema.safeParse({ message: "ok", history: [{ role: "system", content: "a" }] }).success).toBe(false);
  });

  it("lets the patched studio call the same-origin endpoint", () => {
    const runtime = fs.readFileSync(path.join(projectRoot, "client/public/studio.html"), "utf8");
    expect(runtime).toContain('R.protocol!=="https:"&&R.origin!==location.origin');
    const app = fs.readFileSync(path.join(projectRoot, "client/src/App.tsx"), "utf8");
    expect(app).toContain('publicPath("api/studio-advisor")');
    expect(STUDIO_ADVISOR_PATH).toBe("/api/studio-advisor");
  });
});
