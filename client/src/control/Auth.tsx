import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import type { ControlUser } from "../../../shared/control";
import { api } from "./api";

function googleStartHref(email: string) {
  const params = new URLSearchParams(window.location.search);
  const query = new URLSearchParams();
  query.set("returnTo", "/account");
  if (email.trim()) query.set("email", email.trim().toLowerCase());
  const project = params.get("project");
  if (project) query.set("project", project);
  if (params.get("inquire") === "1") query.set("inquire", "1");
  return `/api/control/oauth/google/start?${query.toString()}`;
}

export function Auth({
  onLogin,
  staff = false,
  initialEmail = "",
}: {
  onLogin: (user: ControlUser) => void;
  staff?: boolean;
  initialEmail?: string;
}) {
  const oauthError = useMemo(
    () => new URLSearchParams(window.location.search).get("oauth_error") || "",
    []
  );
  const [email, setEmail] = useState(initialEmail),
    [code, setCode] = useState(""),
    [authenticator, setAuthenticator] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(oauthError),
    [notice, setNotice] = useState("");
  const [availability, setAvailability] = useState<{
    available: boolean;
    message: string;
    preview?: boolean;
    googleOAuth?: boolean;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    api("/login/status")
      .then(status => {
        if (!cancelled) setAvailability(status);
      })
      .catch(() => {
        if (!cancelled)
          setAvailability({
            available: false,
            message:
              "Unable to check sign-in availability. Please refresh the page to try again.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  async function send() {
    if (!availability?.available) return;
    setBusy(true);
    setError("");
    try {
      const r = await api("/login/request", { email });
      setSent(true);
      setNotice(r.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function openPreview(account: "admin" | "reviewer") {
    setBusy(true);
    setError("");
    try {
      const result = await api("/preview/login", { account });
      onLogin(result.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function verify() {
    setBusy(true);
    setError("");
    try {
      const r = await api("/login/verify", { email, code, authenticator });
      onLogin(r.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="control-auth">
      <a className="control-brand" href="/">
        <BrandLogo className="control-brand-logo" />
      </a>
      <div className="control-auth-card">
        <div className="control-kicker">
          <ShieldCheck size={16} />
          {staff ? "INTERNAL WORKSPACE" : "YOUR PROJECT WORKSPACE"}
        </div>
        <h1>
          {staff
            ? "A considered approach.\nComplete control."
            : "Keep your ideas moving."}
        </h1>
        <p>
          {staff
            ? "Manage products, review submitted changes and approve with confidence."
            : "Sign in to save designs, return to your projects and request a quotation."}
        </p>
        {availability && !availability.available && !availability.preview && (
          <div
            role="status"
            className="control-banner"
            style={{ marginTop: 20 }}
          >
            {availability.message}
          </div>
        )}
        {availability?.preview && (
          <div style={{ marginTop: 20 }}>
            {error && (
              <div role="alert" className="control-error">
                {error}
              </div>
            )}
            <div className="control-row">
              <button
                className="control-primary"
                disabled={busy}
                onClick={() => openPreview("admin")}
              >
                {busy ? "Opening demo…" : "Open as editor"}
                <ArrowRight size={17} />
              </button>
              {staff && (
                <button disabled={busy} onClick={() => openPreview("reviewer")}>
                  Open as reviewer
                </button>
              )}
            </div>
          </div>
        )}
        {!availability?.preview && (
          <>
            {availability?.googleOAuth && (
              <div style={{ marginTop: 20 }}>
                <a className="control-primary" href={googleStartHref(email)}>
                  Continue with Google
                  <ArrowRight size={17} />
                </a>
                <p className="control-help" style={{ marginTop: 10 }}>
                  Use the same Google account as the email on your saved project
                  when returning from a resume link.
                </p>
              </div>
            )}
            <form
              onSubmit={e => {
                e.preventDefault();
                void (sent ? verify() : send());
              }}
            >
              <label>
                Email address
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  disabled={busy || sent || !availability?.available}
                  onChange={e => setEmail(e.target.value)}
                />
              </label>
              {sent && (
                <>
                  <label>
                    Email verification code
                    <input
                      required
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={code}
                      onChange={e => setCode(e.target.value)}
                    />
                  </label>
                  <label>
                    Authenticator code {staff ? "" : "(staff accounts only)"}
                    <input
                      inputMode="numeric"
                      autoComplete="off"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={authenticator}
                      required={staff}
                      onChange={e => setAuthenticator(e.target.value)}
                    />
                  </label>
                </>
              )}
              {error && (
                <div role="alert" className="control-error">
                  {error}
                </div>
              )}
              {notice && (
                <div role="status" className="control-notice">
                  {notice}
                </div>
              )}
              <button
                className="control-primary"
                disabled={busy || !availability?.available}
              >
                {!availability
                  ? "Checking sign-in…"
                  : !availability.available
                    ? "Email sign-in unavailable"
                    : busy
                      ? "Please wait…"
                      : sent
                        ? "Sign in"
                        : "Send verification code"}
                <ArrowRight size={17} />
              </button>
              {sent && (
                <div className="control-row">
                  <button
                    type="button"
                    disabled={busy || !availability?.available}
                    onClick={send}
                  >
                    Resend code
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSent(false);
                      setCode("");
                      setAuthenticator("");
                      setNotice("");
                      setError("");
                    }}
                  >
                    Use a different email
                  </button>
                </div>
              )}
            </form>
          </>
        )}
        <a className="control-back" href="/">
          ← Return to Solar Studio
        </a>
      </div>
    </div>
  );
}
