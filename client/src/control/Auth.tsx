import { useEffect, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import type { ControlUser } from "../../../shared/control";
import { api } from "./api";
export function Auth({
  onLogin,
  staff = false,
}: {
  onLogin: (user: ControlUser) => void;
  staff?: boolean;
}) {
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [authenticator, setAuthenticator] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [availability, setAvailability] = useState<{
    available: boolean;
    message: string;
    preview?: boolean;
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
        <img
          src="/assets/modernite-logo.png"
          alt="Modernité by CarbonFutureX Group"
        />
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
        {availability && !availability.available && (
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
                    setNotice("");
                  }}
                >
                  Use another email
                </button>
              </div>
            )}
          </form>
        )}
        <small>
          {availability?.preview
            ? "Changes here affect sample data only. No real emails are sent."
            : "We use your email for account access and project services. Signing in does not subscribe you to marketing."}
        </small>
      </div>
      <a className="control-back" href="/">
        ← Return to Solar Studio
      </a>
    </div>
  );
}
