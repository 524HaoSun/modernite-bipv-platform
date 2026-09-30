import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");
const appPath = path.join(projectRoot, "client/src/App.tsx");
const publicRuntime = path.join(projectRoot, "client/public/studio.html");
const runtimeInventory = path.join(projectRoot, "docs/handoff/studio-runtime-inventory.txt");

describe("customer V31 Studio runtime", () => {
  it("uses the uploaded customer studio as the application runtime", () => {
    const app = fs.readFileSync(appPath, "utf8");
    expect(app).toContain('CUSTOMER_STUDIO_URL = publicPath("studio.html")');
    expect(app).toContain("customer-studio-frame");
    expect(fs.existsSync(publicRuntime)).toBe(true);
  });

  it("preserves the verified V31 runtime shipped in the handoff", () => {
    const runtime = fs.readFileSync(publicRuntime);
    const runtimeText = runtime.toString("utf8");
    const expectedHash = fs.readFileSync(runtimeInventory, "utf8").split(/\s+/)[0];
    const actualHash = crypto.createHash("sha256").update(runtime).digest("hex");
    expect(actualHash).toBe(expectedHash);
    expect(runtimeText).toContain("facade_grey:['Solar Facade Grey',120,.03806,.03515]");
    expect(runtimeText).toContain("V31");
    expect(runtimeText).toContain("UK01");
    expect(runtimeText).toContain("CA01");
    expect(runtimeText).toContain("JP01");
    expect(runtimeText).toContain("Generate Report");
    expect(runtimeText).toContain("THREE");
    expect(runtimeText).toContain("Inverter & battery sizing");
    expect(runtimeText).toContain("Gas boiler");
  });
});
