import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  googleOAuthConfigured,
  googleOAuthRedirectUri,
} from "../server/control/google-oauth";

const KEYS = [
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "GOOGLE_OAUTH_REDIRECT_URI",
  "PUBLIC_BASE_URL",
] as const;

describe("google OAuth scaffolding", () => {
  const previous = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of KEYS) {
      previous.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of KEYS) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("is disabled until client id, secret, and a redirect base are set", () => {
    expect(googleOAuthConfigured()).toBe(false);
    process.env.GOOGLE_OAUTH_CLIENT_ID = "client";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "secret";
    expect(googleOAuthConfigured()).toBe(false);
    process.env.PUBLIC_BASE_URL = "https://modernite.example";
    expect(googleOAuthConfigured()).toBe(true);
  });

  it("builds the callback URI from PUBLIC_BASE_URL or an explicit override", () => {
    process.env.PUBLIC_BASE_URL = "https://modernite.example/";
    expect(googleOAuthRedirectUri()).toBe(
      "https://modernite.example/api/control/oauth/google/callback"
    );
    process.env.GOOGLE_OAUTH_REDIRECT_URI =
      "https://custom.example/oauth/callback";
    expect(googleOAuthRedirectUri()).toBe(
      "https://custom.example/oauth/callback"
    );
  });
});
