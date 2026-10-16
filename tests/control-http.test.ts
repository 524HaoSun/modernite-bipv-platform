import express from "express";
import { createServer, type Server } from "node:http";
import {
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  describe,
  it,
  expect,
} from "vitest";
import { ControlStore } from "../server/control/store";
import { registerControlRoutes } from "../server/control/routes";
import { requestCode, verifyCode, seal, totp } from "../server/control/auth";
import type { Role } from "../shared/control";
let store: ControlStore, server: Server, origin: string, lastCode: string;
let deliveryAvailable = true;
const configuration = {
  market: "GB",
  address: "Private customer address",
  coordinates: { lat: 51.5, lng: -0.1 },
  studioSnapshot: {
    building: { id: "UK01" },
    surfaces: [
      {
        id: "s",
        product: "roof_tiles",
        profile: "windsor_black",
        area: 10,
        tilt: 30,
        az: 180,
      },
    ],
  },
};
beforeAll(async () => {
  process.env.CONTROL_AUTH_KEY = "test-key-for-http-only-32-characters-long";
  process.env.NODE_ENV = "test";
  delete process.env.PUBLIC_BASE_URL;
  const app = express();
  app.use(express.json());
  registerControlRoutes(
    app,
    () => store,
    async (_, code) => {
      lastCode = code;
    },
    () => ({
      available: deliveryAvailable,
      message: deliveryAvailable ? "" : "Email sign-in is not configured yet.",
    })
  );
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  origin = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
afterAll(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
});
beforeEach(() => {
  store = new ControlStore(":memory:");
  deliveryAvailable = true;
  lastCode = "";
});
afterEach(() => store.close());
async function req(
  path: string,
  body?: unknown,
  cookie = "",
  originHeader = origin
) {
  return fetch(`${origin}/api/control${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: originHeader,
      Cookie: cookie,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function login(email: string, roles: Role[] = ["customer"]) {
  const u = store.createUser(email, "", roles);
  const secret = "JBSWY3DPEHPK3PXP";
  if (roles.some(r => r !== "customer"))
    store.db
      .prepare("UPDATE users SET totp=? WHERE id=?")
      .run(seal(secret), u.id);
  let code = "";
  await requestCode(store, email, async (_, value) => {
    code = value;
  });
  const session = verifyCode(
    store,
    email,
    code,
    roles.includes("customer") ? "" : totp(secret)
  );
  return { user: u, cookie: `modernite_session=${session.token}` };
}
describe("control HTTP boundaries", () => {
  it("reports unavailable email and rejects requests without pretending to deliver", async () => {
    deliveryAvailable = false;
    const status = await (await req("/login/status")).json();
    expect(status).toMatchObject({ available: false });
    const response = await req("/login/request", {
      email: "undelivered@example.test",
    });
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("not configured");
    expect(lastCode).toBe("");
    expect(store.db.prepare("SELECT COUNT(*) AS n FROM codes").get()?.n).toBe(
      0
    );
  });

  it("exposes the public catalogue without internal pricing fields", async () => {
    const response = await req("/catalogue");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.products?.length).toBeGreaterThan(0);
    expect(body.products[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
        wp: expect.any(Number),
      })
    );
    expect(JSON.stringify(body)).not.toContain('"cost"');
    expect(JSON.stringify(body)).not.toContain('"markup"');
  });

  it("keeps Google OAuth start disabled until credentials are configured", async () => {
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const response = await req("/oauth/google/start?returnTo=/account");
    expect(response.status).toBe(503);
    expect((await response.json()).error).toMatch(/not configured/i);
  });

  it("sets secure session semantics and never returns the verification code", async () => {
    const sent = await req("/login/request", { email: "login@example.test" });
    expect(sent.status).toBe(200);
    expect(await sent.text()).not.toContain(lastCode);
    const verified = await req("/login/verify", {
      email: "login@example.test",
      code: lastCode,
    });
    expect(verified.status).toBe(200);
    const cookie = verified.headers.get("set-cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    const me = await req("/session", undefined, cookie.split(";")[0]);
    expect((await me.json()).user.email).toBe("login@example.test");
  });
  it("blocks unauthenticated administration, customer roles, and cross-origin writes", async () => {
    expect((await req("/admin/current")).status).toBe(401);
    const { cookie } = await login("customer@example.test");
    expect((await req("/admin/current", undefined, cookie)).status).toBe(403);
    expect(
      (
        await req(
          "/projects",
          { name: "Attack", configuration },
          cookie,
          "https://attacker.example"
        )
      ).status
    ).toBe(403);
  });
  it("filters admin domain responses and revokes suspended users immediately", async () => {
    const { cookie, user } = await login("technical@example.test", [
      "technical",
    ]);
    const result = await (
      await req("/admin/current", undefined, cookie)
    ).json();
    expect(Object.keys(result)).toEqual(["technical"]);
    expect(
      JSON.stringify(
        await (await req("/admin/releases", undefined, cookie)).json()
      )
    ).not.toContain('"cost"');
    expect((await req("/admin/users", undefined, cookie)).status).toBe(403);
    store.db.prepare("UPDATE users SET active=0 WHERE id=?").run(user.id);
    expect((await req("/admin/current", undefined, cookie)).status).toBe(401);
  });
  it("checks ownership for project reads, reports, inquiries and quotes", async () => {
    const a = await login("a@example.test"),
      b = await login("b@example.test");
    const saved = await (
      await req("/projects", { name: "Private", configuration }, a.cookie)
    ).json();
    expect(
      (await req(`/projects/${saved.id}`, undefined, b.cookie)).status
    ).toBe(404);
    expect(
      (
        await req(
          `/projects/${saved.id}/report.pdf?revision=1`,
          undefined,
          b.cookie
        )
      ).status
    ).toBe(404);
    expect(
      (await req(`/projects/${saved.id}/quote`, { revision: 1 }, b.cookie))
        .status
    ).toBe(404);
    expect(
      (
        await req(
          "/inquiries",
          {
            projectId: saved.id,
            revision: 1,
            name: "Attacker",
            preferredContact: "email",
            message: "Please quote",
          },
          b.cookie
        )
      ).status
    ).toBe(404);
  });
  it("rejects price tampering before quote computation", async () => {
    const a = await login("buyer@example.test"),
      saved = await (
        await req("/projects", { name: "Project", configuration }, a.cookie)
      ).json();
    expect(
      (
        await req(
          `/projects/${saved.id}/quote`,
          { revision: 1, total: 0, unitPrice: 1, discount: 1 },
          a.cookie
        )
      ).status
    ).toBe(400);
    expect(
      (await req(`/projects/${saved.id}/quote`, { revision: 1 }, a.cookie))
        .status
    ).toBe(409);
  });
  it("redacts unassigned inquiries and keeps notes from customers and other sales staff", async () => {
    const owner = await login("owner@example.test"),
      sales = await login("sales@example.test", ["sales"]),
      other = await login("other@example.test", ["sales"]);
    const project = await (
      await req("/projects", { name: "Inquiry", configuration }, owner.cookie)
    ).json();
    const inquiry = await (
      await req(
        "/inquiries",
        {
          projectId: project.id,
          revision: 1,
          name: "Customer",
          phone: "Test phone",
          preferredContact: "email",
          message: "Please quote this design",
        },
        owner.cookie
      )
    ).json();
    const queue = await (
      await req("/admin/inquiries", undefined, sales.cookie)
    ).json();
    expect(JSON.stringify(queue)).not.toContain("Test phone");
    expect(
      (
        await req(
          `/admin/inquiries/${inquiry.id}`,
          { claim: true },
          sales.cookie
        )
      ).status
    ).toBe(200);
    expect(
      (
        await req(
          `/admin/inquiries/${inquiry.id}`,
          { note: "Confidential staff note" },
          sales.cookie
        )
      ).status
    ).toBe(200);
    expect(
      (
        await req(
          `/admin/inquiries/${inquiry.id}`,
          { claim: true },
          other.cookie
        )
      ).status
    ).toBe(403);
    expect(
      JSON.stringify(
        await (await req("/admin/inquiries", undefined, other.cookie)).json()
      )
    ).not.toContain("Confidential");
    expect(
      JSON.stringify(
        await (await req("/inquiries", undefined, owner.cookie)).json()
      )
    ).not.toContain("Confidential");
  });
  it("creates a private PDF bound to its saved result revision", async () => {
    const a = await login("report@example.test"),
      saved = await (
        await req("/projects", { name: "Report", configuration }, a.cookie)
      ).json();
    const row = store.db
      .prepare("SELECT payload FROM project_versions WHERE project_id=?")
      .get(saved.id)!;
    const payload = JSON.parse(String(row.payload));
    payload.study = {
      result: {
        totalCapacityKwp: 1.406,
        range: { representative: 1200 },
        surfaces: [
          { productName: "Windsor Black", areaM2: 10, annualKwh: 1200 },
        ],
      },
      weather: { name: "Test weather", source: "Test fixture" },
    };
    store.db
      .prepare("UPDATE project_versions SET payload=? WHERE project_id=?")
      .run(JSON.stringify(payload), saved.id);
    const response = await req(
      `/projects/${saved.id}/report.pdf?revision=1`,
      undefined,
      a.cookie
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/pdf");
    expect((await response.text()).startsWith("%PDF-")).toBe(true);
    expect(
      store.db.prepare("SELECT revision FROM reports").get()?.revision
    ).toBe(1);
  });
  it("records anonymous website visits and exposes aggregate analytics to sales", async () => {
    const visitor = "6d7a2c1e-837e-4f14-b3d3-52aebcbb8567";
    expect(
      (
        await req("/analytics/visit", { visitor, path: "/" })
      ).status
    ).toBe(201);
    expect(
      (
        await req("/analytics/visit", { visitor, path: "/" })
      ).status
    ).toBe(201);
    const sales = await login("analytics-sales@example.test", ["sales"]);
    const analytics = await (
      await req("/admin/analytics", undefined, sales.cookie)
    ).json();
    expect(analytics.totals).toMatchObject({
      visits: 1,
      uniqueVisitors: 1,
      generatedReports: 0,
      savedCalculations: 0,
    });
    expect(analytics.daily).toHaveLength(1);
    expect(analytics.daily[0]).toMatchObject({ visits: 1, visitors: 1 });
  });
  it("creates password-based Editor and Approval accounts with separate access", async () => {
    const superUser = await login("super@example.test", ["super"]);
    const created = await req(
      "/admin/staff-accounts",
      {
        username: "editor",
        name: "Product editor",
        password: "Editor-password-2026",
        role: "editor",
      },
      superUser.cookie
    );
    expect(created.status).toBe(201);
    expect(
      (await (await req("/admin/users", undefined, superUser.cookie)).json()).some(
        (account: { username?: string }) => account.username === "editor"
      )
    ).toBe(true);
    await req(
      "/admin/staff-accounts",
      {
        username: "approval",
        name: "Release approver",
        password: "Approval-password-2026",
        role: "approval",
      },
      superUser.cookie
    );
    const editorLogin = await req("/login/password", {
      username: "editor",
      password: "Editor-password-2026",
    });
    expect(editorLogin.status).toBe(200);
    const editorCookie = editorLogin.headers.get("set-cookie") || "";
    expect((await req("/admin/users", undefined, editorCookie)).status).toBe(403);
    expect((await req("/admin/inquiries", undefined, editorCookie)).status).toBe(200);
    expect((await req("/admin/projects", undefined, editorCookie)).status).toBe(200);
    expect((await req("/admin/analytics", undefined, editorCookie)).status).toBe(200);
    const approvalLogin = await req("/login/password", {
      username: "approval",
      password: "Approval-password-2026",
    });
    expect(approvalLogin.status).toBe(200);
    const approvalCookie = approvalLogin.headers.get("set-cookie") || "";
    expect((await req("/admin/releases", undefined, approvalCookie)).status).toBe(200);
    const current = await (await req("/admin/current", undefined, approvalCookie)).json();
    expect((await req("/admin/inquiries", undefined, approvalCookie)).status).toBe(200);
    expect((await req("/admin/projects", undefined, approvalCookie)).status).toBe(200);
    expect((await req("/admin/analytics", undefined, approvalCookie)).status).toBe(200);
    const submission = {
      domain: "catalogue",
      data: current.catalogue.data,
      baseId: current.catalogue.id,
      reason: "Confirm catalogue values for release",
      source: "Internal product confirmation",
    };
    expect((await req("/admin/submissions", submission, approvalCookie)).status).toBe(403);
    const submitted = await (
      await req("/admin/submissions", submission, editorCookie)
    ).json();
    expect(
      (
        await req(`/admin/releases/${submitted.id}/approve`, {}, approvalCookie)
      ).status
    ).toBe(200);
  });
});
