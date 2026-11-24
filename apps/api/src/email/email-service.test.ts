import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  canDeliverRealEmail,
  getEmailMode,
  isEtherealHost,
} from "./email-service.js";

const ENV_KEYS = ["NODE_ENV", "SMTP_HOST", "SMTP_PORT", "SMTP_FROM"] as const;

describe("Email Service — Ethereal / SMTP mode selection", () => {
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

  it("recognises the Ethereal SMTP host regardless of case and whitespace", () => {
    assert.equal(isEtherealHost("smtp.ethereal.email"), true);
    assert.equal(isEtherealHost("  SMTP.Ethereal.Email "), true);
    assert.equal(isEtherealHost("smtp.gmail.com"), false);
  });

  it("falls back to an on-demand Ethereal account in development when SMTP is blank", () => {
    process.env.NODE_ENV = "development";
    assert.equal(getEmailMode(), "ethereal");
    assert.equal(canDeliverRealEmail(), false);
  });

  it("reports Ethereal mode and refuses it as real delivery when SMTP points at Ethereal", () => {
    process.env.SMTP_HOST = "smtp.ethereal.email";
    process.env.SMTP_FROM = "ExamConnect <test@ethereal.email>";
    assert.equal(getEmailMode(), "ethereal");
    assert.equal(canDeliverRealEmail(), false);
  });

  it("treats a real SMTP provider as live delivery", () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_FROM = "ExamConnect <no-reply@example.com>";
    assert.equal(getEmailMode(), "smtp");
    assert.equal(canDeliverRealEmail(), true);
  });

  it("is unconfigured in production without SMTP (no Ethereal fallback)", () => {
    process.env.NODE_ENV = "production";
    assert.equal(getEmailMode(), "unconfigured");
    assert.equal(canDeliverRealEmail(), false);
  });
});
