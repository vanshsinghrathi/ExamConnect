import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_PRODUCTION_APP_URL, getAppBaseUrl } from "./forgot-password.js";

const ENV_KEYS = ["NODE_ENV", "APP_URL", "NEXT_PUBLIC_APP_URL"] as const;

describe("Password reset links — frontend base URL", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
    for (const key of ENV_KEYS) delete process.env[key];
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("defaults to the Vercel frontend in production", () => {
    process.env.NODE_ENV = "production";
    assert.equal(getAppBaseUrl(), "https://exam-connect-ivory.vercel.app");
    assert.equal(DEFAULT_PRODUCTION_APP_URL, "https://exam-connect-ivory.vercel.app");
  });

  it("defaults to localhost in development", () => {
    process.env.NODE_ENV = "development";
    assert.equal(getAppBaseUrl(), "http://localhost:3000");
  });

  it("uses APP_URL when set and strips trailing slashes", () => {
    process.env.NODE_ENV = "production";
    process.env.APP_URL = "https://example.com/";
    assert.equal(getAppBaseUrl(), "https://example.com");
  });

  it("ignores blank APP_URL instead of producing a relative link", () => {
    process.env.NODE_ENV = "production";
    process.env.APP_URL = "   ";
    assert.equal(getAppBaseUrl(), "https://exam-connect-ivory.vercel.app");
  });
});
