import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ControlStore, ControlError } from "../server/control/store";
import {
  requestCode,
  verifyCode,
  seal,
  totp,
  emailLoginStatus,
  sendLoginEmail,
} from "../server/control/auth";
import {
  isControlPreview,
  previewLogin,
  previewLoginStatus,
} from "../server/control/preview";
import {
  submitRelease,
  transition,
  publicCatalogue,
  quoteLines,
  impact,
} from "../server/control/releases";
import { calculationRuntime } from "../server/control/runtime";
import {
  savePrivateProject,
  projectVersion,
  quoteProject,
} from "../server/control/projects";
import {
  technicalSchema,
  pricingSchema,
  type Technical,
  type Pricing,
} from "../shared/control";
import { PROFILES, pv } from "../lib/customer-energy-core";

let store: ControlStore;
const configuration = {
  market: "GB",
  address: "Test project",
  coordinates: { lat: 51.5, lng: -0.1 },
  studioSnapshot: {
    building: { id: "UK01", width: 10, depth: 8, floors: 2 },
    surfaces: [
      {
        id: "test-roof",
        product: "roof_tiles",
        profile: "windsor_black",
        area: 10,
        tilt: 30,
        az: 180,
        u: 9,
        g: 0.9,
        role: "window",
      },
    ],
  },
};
beforeEach(() => {
  process.env.CONTROL_AUTH_KEY = "unit-test-auth-key-32-characters-long-only";
  store = new ControlStore(":memory:");
});
afterEach(() => store.close());
function actors() {
  return {
    author: store.createUser("author@example.test", "", [
      "technical",
      "pricing",
      "product",
    ]),
    reviewer: store.createUser("reviewer@example.test", "", [
      "technical",
      "pricing",
      "product",
    ]),
    customer: store.createUser("customer@example.test"),
  };
}
function approve(domain: "technical" | "pricing" | "catalogue", data: unknown) {
  const { author, reviewer } = actors();
  const submission = submitRelease(store, author, {
    domain,
    data,
    baseId: store.current(domain).id,
    reason: "Updated test data",
    source: "Test certificate",
  });
  return transition(store, reviewer, submission.id, "approve");
}
describe("administration and customer security", () => {
  it("migrates the 17 exact power and temperature profiles and marks missing prices unset", () => {
    const t = store.current("technical").data as Technical;
    expect(t.products).toHaveLength(17);
    for (const p of t.products)
      expect([p.wp, p.a, p.b]).toEqual(PROFILES[p.id].slice(1));
    expect(t.products.find(p => p.id === "standard")?.g).toBe(0.2);
    expect(t.products.find(p => p.id === "canopy")?.u).toBeNull();
    expect(
      (store.current("pricing").data as Pricing).every(
        p => p.cost === null && p.sale === null
      )
    ).toBe(true);
  });
  it("keeps confidential fields out of public product responses", () => {
    const body = JSON.stringify(publicCatalogue(store));
    for (const field of [
      '"a":',
      '"b":',
      '"cost":',
      '"margin":',
      '"gamma":',
      '"model":',
      '"rate":',
    ])
      expect(body).not.toContain(field);
    expect(publicCatalogue(store).products).toHaveLength(17);
  });
  it("requires roles, separate approval, and a current base version", () => {
    const { author, reviewer, customer } = actors();
    const input = {
      domain: "technical" as const,
      data: store.current("technical").data,
      baseId: store.current("technical").id,
      reason: "Technical review",
      source: "Certificate 123",
    };
    expect(() => submitRelease(store, customer, input)).toThrow("role");
    const submission = submitRelease(store, author, input);
    expect(submission.status).toBe("submitted");
    expect(() => transition(store, author, submission.id, "approve")).toThrow(
      "different"
    );
    const other = submitRelease(store, author, input);
    transition(store, reviewer, submission.id, "approve");
    expect(() => transition(store, reviewer, other.id, "approve")).toThrow(
      "active version changed"
    );
    expect(store.release(submission.id)).toMatchObject({
      status: "approved",
      version: 2,
    });
    expect(store.db.prepare("SELECT count(*) AS n FROM audit").get()?.n).toBe(
      3
    );
  });
  it("prevents product admins from changing the calculation model or prices", () => {
    const product = store.createUser("product@example.test", "", ["product"]),
      data = structuredClone(store.current("technical").data as Technical);
    data.model.gamma = -0.002;
    expect(() =>
      submitRelease(store, product, {
        domain: "technical",
        data,
        baseId: store.current("technical").id,
        reason: "Model change",
        source: "Review",
      })
    ).toThrow("Only technical");
    expect(() =>
      submitRelease(store, product, {
        domain: "pricing",
        data: [],
        baseId: "baseline-pricing",
        reason: "Price change",
        source: "Review",
      })
    ).toThrow("role");
  });
  it("does not let an inactive reviewer approve a submitted change", () => {
    const { author, reviewer } = actors(),
      d = submitRelease(store, author, {
        domain: "technical",
        data: store.current("technical").data,
        baseId: "baseline-technical",
        reason: "Technical change",
        source: "Review",
      });
    store.db.prepare("UPDATE users SET active=0 WHERE id=?").run(reviewer.id);
    expect(() => transition(store, reviewer, d.id, "approve")).toThrow(
      "role cannot"
    );
  });
  it("applies only approved parameters, overrides client thermal fields, and preserves historical versions", () => {
    const old = calculationRuntime(store, configuration.studioSnapshot),
      data = structuredClone(store.current("technical").data as Technical);
    data.products[0].wp = 200;
    approve("technical", data);
    const latest = calculationRuntime(store, configuration.studioSnapshot),
      history = calculationRuntime(
        store,
        configuration.studioSnapshot,
        old.versions
      );
    expect(latest.productRuntime.profiles.windsor_black[1]).toBe(200);
    expect(history.productRuntime.profiles.windsor_black[1]).toBe(140.6);
    expect(latest.snapshot.surfaces[0]).toMatchObject({
      role: "none",
      u: 0,
      g: 0,
    });
  });
  it("handles zero, threshold boundaries and reference irradiance with finite model results", () => {
    const data = store.current("technical").data as Technical,
      result = impact(data, data);
    for (const product of result)
      for (const p of product.points) {
        expect(Number.isFinite(p.afterWatts)).toBe(true);
        expect(p.afterWatts).toBe(p.beforeWatts);
        if (p.irradiance === 0) expect(p.afterWatts).toBe(0);
      }
    const runtime = calculationRuntime(
      store,
      configuration.studioSnapshot
    ).productRuntime;
    for (const g of [0, 139.999, 140, 140.001, 1000])
      expect(
        pv("windsor_black", 10, 25, g * 0.8, g * 0.2, 0, 0.9, runtime).ac
      ).toBeCloseTo(pv("windsor_black", 10, 25, g * 0.8, g * 0.2, 0).ac, 5);
  });
  it("rejects incomplete mappings and inconsistent thermal applicability", () => {
    const t = structuredClone(store.current("technical").data as Technical);
    t.products.pop();
    expect(() => technicalSchema.parse(t)).toThrow();
    const t2 = structuredClone(store.current("technical").data as Technical);
    t2.products[0].u = 0;
    expect(() => technicalSchema.parse(t2)).toThrow();
  });
  it("cannot read or update another customer's project and preserves conflicting revisions", () => {
    const a = store.createUser("a@example.test"),
      b = store.createUser("b@example.test"),
      saved = savePrivateProject(store, a, { name: "First", configuration });
    expect(() => projectVersion(store, b, saved.id)).toThrow("not found");
    expect(() =>
      savePrivateProject(store, b, {
        id: saved.id,
        name: "Attack",
        expectedRevision: 1,
        configuration,
      })
    ).toThrow("not found");
    savePrivateProject(store, a, {
      id: saved.id,
      name: "Updated",
      expectedRevision: 1,
      configuration,
    });
    expect(() =>
      savePrivateProject(store, a, {
        id: saved.id,
        name: "Stale",
        expectedRevision: 1,
        configuration,
      })
    ).toThrow("changed");
    expect(projectVersion(store, a, saved.id, 1).payload.input.address).toBe(
      "Test project"
    );
    expect(projectVersion(store, a, saved.id).revision).toBe(2);
  });
  it("strips injected coefficients and private pricing keys from saved project inputs", () => {
    const u = store.createUser("a@example.test"),
      saved = savePrivateProject(store, u, {
        name: "Safe",
        configuration: {
          ...configuration,
          cost: 1,
          model: { gamma: 12 },
          studioSnapshot: {
            ...configuration.studioSnapshot,
            surfaces: [
              {
                ...configuration.studioSnapshot.surfaces[0],
                a: 99,
                b: 99,
                cost: 1,
              },
            ],
          },
        },
      });
    const body = JSON.stringify(projectVersion(store, u, saved.id).payload);
    expect(body).not.toContain('"cost"');
    expect(body).not.toContain('"gamma"');
    expect(body).not.toContain('"a"');
  });
  it("never quotes missing or zero prices", () => {
    expect(() =>
      quoteLines(store, [{ id: "windsor_black", quantity: 10, unit: "m2" }])
    ).toThrow("approved price");
    const p = structuredClone(store.current("pricing").data as Pricing);
    p[0].sale = 0;
    expect(() => pricingSchema.parse(p)).toThrow();
  });
  it("distinguishes markup and margin, enforces units, and keeps costs out of quote output", () => {
    const p = structuredClone(store.current("pricing").data as Pricing);
    p[0] = {
      ...p[0],
      cost: 100,
      method: "markup",
      rate: 0.25,
      effectiveFrom: "2020-01-01T00:00:00.000Z",
    };
    p[1] = {
      ...p[1],
      cost: 100,
      method: "margin",
      rate: 0.25,
      effectiveFrom: "2020-01-01T00:00:00.000Z",
    };
    approve("pricing", p);
    expect(
      quoteLines(store, [{ id: "windsor_black", quantity: 2, unit: "m2" }])
        .total
    ).toBe(250);
    expect(
      quoteLines(store, [{ id: "windsor_colour", quantity: 2, unit: "m2" }])
        .total
    ).toBe(266.67);
    expect(() =>
      quoteLines(store, [{ id: "windsor_black", quantity: 2, unit: "piece" }])
    ).toThrow("unit");
    const quote = JSON.stringify(
      quoteLines(store, [{ id: "windsor_black", quantity: 2, unit: "m2" }])
    );
    expect(quote).not.toContain('"cost"');
    expect(quote).not.toContain('"rate"');
  });
  it("validates margin, overlapping tiers, expiry and minimum margins", () => {
    const p = structuredClone(store.current("pricing").data as Pricing);
    p[0].method = "margin";
    p[0].rate = 1;
    expect(() => pricingSchema.parse(p)).toThrow();
    p[0].rate = 0.2;
    p[0].tiers = [
      { from: 0, to: 10, sale: 100 },
      { from: 9, to: null, sale: 90 },
    ];
    expect(() => pricingSchema.parse(p)).toThrow();
    p[0].tiers = [];
    p[0].cost = 100;
    p[0].minimumMargin = 0.5;
    p[0].effectiveFrom = "2020-01-01T00:00:00.000Z";
    approve("pricing", p);
    expect(() =>
      quoteLines(store, [{ id: "windsor_black", quantity: 1, unit: "m2" }])
    ).toThrow("pricing review");
  });
  it("stores customer quote snapshots without internal data", () => {
    const p = structuredClone(store.current("pricing").data as Pricing);
    p[0] = { ...p[0], sale: 200, effectiveFrom: "2020-01-01T00:00:00.000Z" };
    approve("pricing", p);
    const a = store.createUser("buyer@example.test"),
      project = savePrivateProject(store, a, { name: "Quote", configuration });
    const quote = quoteProject(store, a, project.id, 1);
    expect(quote.total).toBe(2000);
    expect(
      store.db.prepare("SELECT payload FROM quotes WHERE id=?").get(quote.id)
        ?.payload
    ).not.toContain('"cost"');
  });
  it("persists approved records across database restarts", () => {
    const dir = mkdtempSync(join(tmpdir(), "modernite-test-"));
    try {
      const disk = new ControlStore(join(dir, "test.sqlite"));
      disk.createUser("persistent@example.test");
      disk.close();
      const reopened = new ControlStore(join(dir, "test.sqlite"));
      expect(reopened.byEmail("persistent@example.test")).not.toBeNull();
      expect(reopened.current("technical").version).toBe(1);
      reopened.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
describe("email verification and stronger staff authentication", () => {
  it("makes codes single-use and stores only their hash", async () => {
    let code = "";
    await requestCode(store, "a@example.test", async (_, c) => {
      code = c;
    });
    expect(store.db.prepare("SELECT hash FROM codes").get()?.hash).not.toBe(
      code
    );
    const result = verifyCode(store, "a@example.test", code, "");
    expect(result.user.roles).toEqual(["customer"]);
    expect(() => verifyCode(store, "a@example.test", code, "")).toThrow(
      "invalid or expired"
    );
  });
  it("limits resends and failed attempts and rejects expired codes", async () => {
    let code = "";
    await requestCode(store, "a@example.test", async (_, c) => {
      code = c;
    });
    await expect(
      requestCode(store, "a@example.test", async () => {})
    ).rejects.toThrow("one minute");
    for (let i = 0; i < 5; i++)
      expect(() => verifyCode(store, "a@example.test", "000000", "")).toThrow();
    expect(() => verifyCode(store, "a@example.test", code, "")).toThrow();
    store.db.prepare("UPDATE codes SET attempts=0,expires=0").run();
    expect(() => verifyCode(store, "a@example.test", code, "")).toThrow();
  });
  it("requires TOTP for staff and prevents replay across email challenges", async () => {
    const user = store.createUser("staff@example.test", "", ["technical"]),
      secret = "JBSWY3DPEHPK3PXP";
    store.db
      .prepare("UPDATE users SET totp=? WHERE id=?")
      .run(seal(secret), user.id);
    let code = "";
    await requestCode(store, user.email, async (_, c) => {
      code = c;
    });
    expect(() => verifyCode(store, user.email, code, "")).toThrow();
    verifyCode(store, user.email, code, totp(secret));
    store.db.prepare("DELETE FROM codes").run();
    await requestCode(store, user.email, async (_, c) => {
      code = c;
    });
    expect(() => verifyCode(store, user.email, code, totp(secret))).toThrow();
  });
  it("rejects disabled accounts and fails closed without configuration", async () => {
    const user = store.createUser("disabled@example.test");
    store.db.prepare("UPDATE users SET active=0 WHERE id=?").run(user.id);
    let code = "";
    await requestCode(store, user.email, async (_, c) => {
      code = c;
    });
    expect(() => verifyCode(store, user.email, code, "")).toThrow();
    delete process.env.CONTROL_AUTH_KEY;
    await expect(
      requestCode(store, "new@example.test", async () => {})
    ).rejects.toThrow("not configured");
  });
});

describe("email delivery configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  it("does not call a provider or claim delivery when configuration is missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("LOGIN_EMAIL_FROM", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(emailLoginStatus().available).toBe(false);
    await expect(
      requestCode(store, "user@example.test", sendLoginEmail)
    ).rejects.toThrow("not configured");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.db.prepare("SELECT COUNT(*) AS n FROM codes").get()?.n).toBe(
      0
    );
  });
  it("reports provider authorization failures without exposing credentials or codes", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-provider-key");
    vi.stubEnv("LOGIN_EMAIL_FROM", "sender@example.test");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response("provider diagnostic", { status: 403 }))
    );
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(emailLoginStatus().available).toBe(true);
    await expect(
      requestCode(store, "user@example.test", sendLoginEmail)
    ).rejects.toThrow("administrator attention");
    expect(store.db.prepare("SELECT COUNT(*) AS n FROM codes").get()?.n).toBe(
      0
    );
    expect(warning).toHaveBeenCalledWith(
      "[auth] Email provider rejected delivery",
      { status: 403 }
    );
  });
});

describe("local admin demo workspace", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  it("stays off unless CONTROL_PREVIEW=1", () => {
    vi.stubEnv("CONTROL_PREVIEW", "");
    expect(isControlPreview()).toBe(false);
    expect(previewLoginStatus().preview).toBeUndefined();
    vi.stubEnv("CONTROL_PREVIEW", "1");
    vi.stubEnv("NODE_ENV", "production");
    expect(isControlPreview()).toBe(true);
    expect(previewLoginStatus()).toMatchObject({
      available: false,
      preview: true,
    });
  });
  it("opens editor and reviewer sessions against sample users", () => {
    vi.stubEnv("CONTROL_PREVIEW", "1");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("CONTROL_AUTH_KEY", "local-preview-auth-key-for-demo-only-32chars");
    const cookies: string[] = [];
    const res = {
      cookie: (...args: unknown[]) => {
        cookies.push(String(args[0]));
      },
    } as any;
    const editor = previewLogin(store, "admin", res);
    const reviewer = previewLogin(store, "reviewer", res);
    expect(editor.user.email).toBe("editor@preview.local");
    expect(editor.user.roles).toContain("super");
    expect(reviewer.user.email).toBe("reviewer@preview.local");
    expect(reviewer.user.id).not.toBe(editor.user.id);
    expect(cookies).toEqual(["modernite_session", "modernite_session"]);
  });
});
