/**
 * Local demo workspace for product administration.
 * Only active when CONTROL_PREVIEW=1 and NODE_ENV is not production.
 * Never enable this on the live site.
 */
import { createHash, randomBytes } from "node:crypto";
import type { Response } from "express";
import type { Role } from "../../shared/control";
import { ControlStore, fail } from "./store";
import { emailLoginStatus, setSession, type LoginStatus } from "./auth";

export type PreviewLoginStatus = LoginStatus & { preview?: boolean };

const ACCOUNTS = {
  admin: {
    email: "editor@preview.local",
    name: "Demo editor",
    roles: ["product", "technical", "pricing", "sales", "super"] as Role[],
  },
  reviewer: {
    email: "reviewer@preview.local",
    name: "Demo reviewer",
    roles: ["product", "technical", "pricing"] as Role[],
  },
} as const;

export type PreviewAccount = keyof typeof ACCOUNTS;

export function isControlPreview() {
  return (
    process.env.CONTROL_PREVIEW === "1" &&
    process.env.NODE_ENV !== "production"
  );
}

export function previewLoginStatus(): PreviewLoginStatus {
  if (!isControlPreview()) return emailLoginStatus();
  return {
    available: false,
    preview: true,
    message:
      "Local demo workspace. Click below to open sample data — no emails are sent.",
  };
}

function ensurePreviewUser(store: ControlStore, account: PreviewAccount) {
  const spec = ACCOUNTS[account];
  const existing = store.byEmail(spec.email);
  if (existing) {
    store.db
      .prepare("UPDATE users SET name=?,roles=?,active=1 WHERE id=?")
      .run(spec.name, JSON.stringify(spec.roles), existing.id);
    return store.user(existing.id)!;
  }
  return store.createUser(spec.email, spec.name, spec.roles);
}

export function previewLogin(
  store: ControlStore,
  account: PreviewAccount,
  res: Response
) {
  if (!isControlPreview())
    fail(404, "Demo sign-in is not available on this server");
  if (!process.env.CONTROL_AUTH_KEY || process.env.CONTROL_AUTH_KEY.length < 32)
    fail(503, "Demo workspace needs CONTROL_AUTH_KEY (32+ characters)");

  const user = store.transaction(() => {
    const next = ensurePreviewUser(store, account);
    store.db.prepare("DELETE FROM sessions WHERE user_id=?").run(next.id);
    store.db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
    const token = randomBytes(32).toString("base64url");
    const expires = Date.now() + 8 * 3600000;
    store.db
      .prepare("INSERT INTO sessions VALUES(?,?,?)")
      .run(createHash("sha256").update(token).digest("hex"), next.id, expires);
    store.audit(next.id, "session.preview", next.id, null, { account });
    setSession(res, token, expires);
    return next;
  });
  return { user };
}
