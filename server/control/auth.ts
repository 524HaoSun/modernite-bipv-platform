import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { parse } from "cookie";
import type { Request, Response } from "express";
import { ControlError, ControlStore, fail } from "./store";
import type { ControlUser } from "../../shared/control";
export const SESSION_COOKIE = "modernite_session";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
function key() {
  const secret = process.env.CONTROL_AUTH_KEY;
  if (!secret || secret.length < 32)
    fail(503, "Account services are not configured");
  return createHash("sha256").update(secret).digest();
}
export function seal(secret: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  return Buffer.concat([
    iv,
    cipher.update(secret),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
}
function unseal(value: string) {
  const data = Buffer.from(value, "base64"),
    cipher = createDecipheriv("aes-256-gcm", key(), data.subarray(0, 12));
  cipher.setAuthTag(data.subarray(-16));
  return Buffer.concat([
    cipher.update(data.subarray(12, -16)),
    cipher.final(),
  ]).toString();
}
export function totp(secret: string, step = Math.floor(Date.now() / 30000)) {
  if (!/^[A-Z2-7]{16,128}$/.test(secret))
    throw new Error("Invalid authenticator secret");
  const bits = secret
    .split("")
    .map(c =>
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(c).toString(2).padStart(5, "0")
    )
    .join("");
  const bytes = Buffer.from(
    (bits.match(/.{8}/g) || []).map(b => parseInt(b, 2))
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", bytes).update(counter).digest(),
    offset = digest[19] & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000)
    .toString()
    .padStart(6, "0");
}
const equal = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
function codeHash(email: string, code: string) {
  return createHmac("sha256", key()).update(`${email}:${code}`).digest("hex");
}
export function limit(
  store: ControlStore,
  id: string,
  max: number,
  windowMs: number
) {
  const now = Date.now();
  store.transaction(() => {
    const row = store.db
      .prepare("SELECT count,reset FROM limits WHERE key=?")
      .get(id) as any;
    if (row && row.reset > now && row.count >= max)
      fail(429, "Too many attempts. Please try again later.");
    store.db
      .prepare(
        "INSERT INTO limits VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET count=excluded.count,reset=excluded.reset"
      )
      .run(
        id,
        row && row.reset > now ? row.count + 1 : 1,
        row && row.reset > now ? row.reset : now + windowMs
      );
    store.db.prepare("DELETE FROM limits WHERE reset<?").run(now);
  });
}
export type LoginStatus = { available: boolean; message: string };
export function emailLoginStatus(): LoginStatus {
  const available = Boolean(
    process.env.CONTROL_AUTH_KEY &&
      process.env.CONTROL_AUTH_KEY.length >= 32 &&
      process.env.RESEND_API_KEY?.trim() &&
      process.env.LOGIN_EMAIL_FROM?.trim()
  );
  return {
    available,
    message: available
      ? ""
      : "Email sign-in is not configured yet. Please contact the site administrator to enable it.",
  };
}

export async function requestCode(
  store: ControlStore,
  email: string,
  send: (email: string, code: string) => Promise<void>
) {
  key();
  limit(store, `email:${hash(email)}`, 6, 3600000);
  const code = String(randomInt(100000, 1000000)),
    now = Date.now();
  store.transaction(() => {
    const old = store.db
      .prepare("SELECT sent FROM codes WHERE email=?")
      .get(email);
    if (old && Number(old.sent) > now - 60000)
      fail(429, "Please wait one minute before requesting another code");
    store.db
      .prepare(
        "INSERT INTO codes VALUES(?,?,?,0,?) ON CONFLICT(email) DO UPDATE SET hash=excluded.hash,expires=excluded.expires,attempts=0,sent=excluded.sent"
      )
      .run(email, codeHash(email, code), now + 600000, now);
  });
  try {
    await send(email, code);
  } catch (error) {
    store.db
      .prepare("DELETE FROM codes WHERE email=? AND hash=?")
      .run(email, codeHash(email, code));
    if (error instanceof ControlError) throw error;
    fail(
      503,
      "The sign-in email could not be sent. Please try again later or contact the site administrator."
    );
  }
}
export function verifyCode(
  store: ControlStore,
  email: string,
  code: string,
  secondFactor: string
) {
  limit(store, `verify:${hash(email)}`, 20, 3600000);
  // Commit failed-attempt counters as well as successful verification.
  const result = store.transaction(() => {
    const row = store.db
      .prepare("SELECT * FROM codes WHERE email=?")
      .get(email) as any;
    if (!row || row.expires < Date.now() || row.attempts >= 5) return null;
    store.db
      .prepare("UPDATE codes SET attempts=attempts+1 WHERE email=?")
      .run(email);
    if (!equal(row.hash, codeHash(email, code))) return null;
    let user = store.byEmail(email);
    if (user && !user.active) return null;
    if (user?.roles.some(r => r !== "customer")) {
      const factor = store.db
        .prepare("SELECT totp,totp_step FROM users WHERE id=?")
        .get(user.id) as any;
      if (!factor.totp) return null;
      const step = Math.floor(Date.now() / 30000),
        secret = unseal(factor.totp);
      const match = [step - 1, step, step + 1].find(
        s => s > factor.totp_step && equal(totp(secret, s), secondFactor)
      );
      if (match === undefined) return null;
      store.db
        .prepare("UPDATE users SET totp_step=? WHERE id=?")
        .run(match, user.id);
    }
    user ??= store.createUser(email);
    store.db.prepare("DELETE FROM codes WHERE email=?").run(email);
    const token = randomBytes(32).toString("base64url"),
      expires =
        Date.now() +
        (user.roles.some(r => r !== "customer") ? 4 : 24) * 3600000;
    store.db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
    store.db
      .prepare("INSERT INTO sessions VALUES(?,?,?)")
      .run(hash(token), user.id, expires);
    store.audit(user.id, "session.created", user.id);
    return { user, token, expires };
  });
  return (
    result ??
    fail(
      401,
      "The code is invalid or expired. Staff must also enter a valid authenticator code."
    )
  );
}
export function sessionUser(
  store: ControlStore,
  req: Request
): ControlUser | null {
  const token = parse(req.headers.cookie || "")[SESSION_COOKIE];
  if (!token) return null;
  const row = store.db
    .prepare("SELECT user_id FROM sessions WHERE hash=? AND expires>?")
    .get(hash(token), Date.now());
  const user = row ? store.user(String(row.user_id)) : null;
  return user?.active ? user : null;
}
export function logout(store: ControlStore, req: Request, res: Response) {
  const token = parse(req.headers.cookie || "")[SESSION_COOKIE];
  if (token)
    store.db.prepare("DELETE FROM sessions WHERE hash=?").run(hash(token));
  res.clearCookie(SESSION_COOKIE, {
    path: "/",
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
}
export function setSession(res: Response, token: string, expires: number) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: new Date(expires),
  });
}
export async function sendLoginEmail(email: string, code: string) {
  const status = emailLoginStatus();
  if (!status.available) fail(503, status.message);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.LOGIN_EMAIL_FROM,
      to: [email],
      subject: "Your Modernité sign-in code",
      text: `Your Modernité sign-in code is ${code}. It expires in 10 minutes and can be used once. If you did not request this, ignore this email.`,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    // Never log the recipient, code, key, or provider response body.
    console.warn("[auth] Email provider rejected delivery", {
      status: response.status,
    });
    if (response.status === 401 || response.status === 403) {
      fail(
        503,
        "Email delivery needs administrator attention. Please contact the site administrator."
      );
    }
    throw new Error("Email delivery failed");
  }
}
