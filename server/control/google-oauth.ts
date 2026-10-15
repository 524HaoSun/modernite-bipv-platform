/**
 * Google OAuth for Modernité control accounts (`/account`, `/admin` staff who are also customers).
 * Disabled until GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET are set.
 * Redirect URI defaults to `${PUBLIC_BASE_URL}/api/control/oauth/google/callback`.
 */
import { createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { parse } from "cookie";
import { ControlStore, fail } from "./store";
import { setSession } from "./auth";

export const GOOGLE_OAUTH_STATE_COOKIE = "modernite_google_oauth";
const STATE_TTL_MS = 10 * 60 * 1000;

export type GoogleOAuthState = {
  nonce: string;
  returnTo: string;
  emailHint?: string;
  projectId?: string;
  inquire?: boolean;
};

export function googleOAuthConfigured() {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() &&
      (process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() ||
        process.env.PUBLIC_BASE_URL?.trim())
  );
}

export function googleOAuthRedirectUri() {
  if (process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim())
    return process.env.GOOGLE_OAUTH_REDIRECT_URI.trim();
  const base = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (!base) fail(503, "Google sign-in needs PUBLIC_BASE_URL or GOOGLE_OAUTH_REDIRECT_URI");
  return `${base}/api/control/oauth/google/callback`;
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function beginGoogleOAuth(
  res: Response,
  input: { returnTo?: string; emailHint?: string; projectId?: string; inquire?: boolean }
) {
  if (!googleOAuthConfigured())
    fail(503, "Google sign-in is not configured yet");
  const nonce = randomBytes(24).toString("base64url");
  const state: GoogleOAuthState = {
    nonce,
    returnTo: safeReturnTo(input.returnTo),
    emailHint: input.emailHint?.trim().toLowerCase() || undefined,
    projectId: input.projectId?.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80) || undefined,
    inquire: Boolean(input.inquire),
  };
  const packed = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  // Express cookie `maxAge` is milliseconds (serialized as Max-Age seconds).
  res.cookie(GOOGLE_OAUTH_STATE_COOKIE, packed, cookieOptions(STATE_TTL_MS));
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_OAUTH_CLIENT_ID!);
  url.searchParams.set("redirect_uri", googleOAuthRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", packed);
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "select_account");
  if (state.emailHint) url.searchParams.set("login_hint", state.emailHint);
  return url.toString();
}

function safeReturnTo(value?: string) {
  if (!value) return "/account";
  if (!value.startsWith("/") || value.startsWith("//")) return "/account";
  return value.slice(0, 300);
}

function readState(req: Request): GoogleOAuthState | null {
  const cookie = parse(req.headers.cookie ?? "")[GOOGLE_OAUTH_STATE_COOKIE];
  const stateParam = typeof req.query.state === "string" ? req.query.state : "";
  if (!cookie || !stateParam || cookie !== stateParam) return null;
  try {
    return JSON.parse(Buffer.from(stateParam, "base64url").toString("utf8")) as GoogleOAuthState;
  } catch {
    return null;
  }
}

export async function finishGoogleOAuth(
  store: ControlStore,
  req: Request,
  res: Response
) {
  if (!googleOAuthConfigured())
    fail(503, "Google sign-in is not configured yet");
  const state = readState(req);
  res.clearCookie(GOOGLE_OAUTH_STATE_COOKIE, { path: "/" });
  if (!state?.nonce) fail(403, "Google sign-in expired. Please try again.");
  const code = typeof req.query.code === "string" ? req.query.code : "";
  if (!code) fail(400, "Google did not return an authorization code");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      redirect_uri: googleOAuthRedirectUri(),
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!tokenRes.ok) {
    console.warn("[google-oauth] token exchange failed", tokenRes.status);
    fail(502, "Google sign-in could not be completed");
  }
  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) fail(502, "Google sign-in could not be completed");

  const profileRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!profileRes.ok) fail(502, "Google profile could not be loaded");
  const profile = (await profileRes.json()) as {
    email?: string;
    email_verified?: boolean;
    name?: string;
    sub?: string;
  };
  const email = profile.email?.trim().toLowerCase();
  if (!email || profile.email_verified === false)
    fail(403, "A verified Google email address is required");
  if (state.emailHint && state.emailHint !== email)
    fail(403, "Sign in with the same Google account that matches the saved project email");

  const user =
    store.byEmail(email) ||
    store.createUser(email, profile.name?.trim() || email.split("@")[0] || "Customer");
  if (!user.active) fail(403, "This account is suspended");

  const token = randomBytes(32).toString("base64url");
  const expires = Date.now() + 14 * 24 * 3600 * 1000;
  store.transaction(() => {
    store.db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
    store.db
      .prepare("INSERT INTO sessions VALUES(?,?,?)")
      .run(createHash("sha256").update(token).digest("hex"), user.id, expires);
    store.audit(user.id, "session.google_oauth", user.id, null, {
      sub: profile.sub ?? null,
    });
  });
  setSession(res, token, expires);

  const dest = new URL(state.returnTo, "http://local.invalid");
  if (state.projectId) dest.searchParams.set("project", state.projectId);
  if (state.inquire) dest.searchParams.set("inquire", "1");
  return `${dest.pathname}${dest.search}`;
}
