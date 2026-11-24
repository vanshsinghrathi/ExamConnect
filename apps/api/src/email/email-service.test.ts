import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  BREVO_SEND_URL,
  canDeliverRealEmail,
  getEmailMode,
  isEtherealHost,
  parseEmailAddress,
  sendPasswordResetEmail,
  sendViaBrevo,
} from "./email-service.js";

const ENV_KEYS = [
  "NODE_ENV",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_FROM",
  "BREVO_API_KEY",
  "EMAIL_FROM",
] as const;

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

  it("prefers Brevo over SMTP when BREVO_API_KEY and a sender are set", () => {
    process.env.NODE_ENV = "production";
    process.env.BREVO_API_KEY = "xkeysib-test";
    process.env.EMAIL_FROM = "ExamConnect <sender@example.com>";
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_FROM = "Other <other@example.com>";
    assert.equal(getEmailMode(), "brevo");
    assert.equal(canDeliverRealEmail(), true);
  });

  it("falls back to SMTP_FROM as the Brevo sender when EMAIL_FROM is not set", () => {
    process.env.BREVO_API_KEY = "xkeysib-test";
    process.env.SMTP_FROM = "ExamConnect Security <sender@example.com>";
    assert.equal(getEmailMode(), "brevo");
  });

  it("refuses to send when BREVO_API_KEY is set without a valid sender", async () => {
    process.env.BREVO_API_KEY = "xkeysib-test";
    const result = await sendPasswordResetEmail({
      to: "student@example.com",
      resetUrl: "http://localhost:3000/reset-password?token=abc",
      expiresMinutes: 20,
    });
    assert.equal(result.delivered, false);
    assert.equal(result.mode, "brevo");
    assert.match(result.error ?? "", /EMAIL_FROM/);
  });
});

describe("Email Service — sender address parsing", () => {
  it("parses named, quoted and bare addresses", () => {
    assert.deepEqual(parseEmailAddress("ExamConnect Security <a@example.com>"), {
      name: "ExamConnect Security",
      email: "a@example.com",
    });
    assert.deepEqual(parseEmailAddress('"ExamConnect Security <a@example.com>"'), {
      name: "ExamConnect Security",
      email: "a@example.com",
    });
    assert.deepEqual(parseEmailAddress('"Exam Connect" <a@example.com>'), {
      name: "Exam Connect",
      email: "a@example.com",
    });
    assert.deepEqual(parseEmailAddress("a@example.com"), { email: "a@example.com" });
    assert.equal(parseEmailAddress("not an address"), null);
    assert.equal(parseEmailAddress(""), null);
  });
});

describe("Email Service — Brevo HTTPS API", () => {
  const config = {
    apiKey: "xkeysib-test",
    sender: { name: "ExamConnect", email: "sender@example.com" },
  };
  const message = { to: "student@example.com", subject: "Reset", html: "<p>Hi</p>" };

  it("POSTs the documented payload and returns the Brevo messageId", async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const fakeFetch = (async (url: string, init: RequestInit) => {
      captured = { url, init };
      return new Response(JSON.stringify({ messageId: "<id-1@smtp-relay.mailin.fr>" }), {
        status: 201,
      });
    }) as unknown as typeof fetch;

    const result = await sendViaBrevo(config, message, fakeFetch);

    assert.deepEqual(result, {
      delivered: true,
      mode: "brevo",
      messageId: "<id-1@smtp-relay.mailin.fr>",
    });
    assert.ok(captured);
    const { url, init } = captured as { url: string; init: RequestInit };
    assert.equal(url, BREVO_SEND_URL);
    assert.equal(init.method, "POST");
    const headers = init.headers as Record<string, string>;
    assert.equal(headers["api-key"], "xkeysib-test");
    assert.deepEqual(JSON.parse(String(init.body)), {
      sender: { name: "ExamConnect", email: "sender@example.com" },
      to: [{ email: "student@example.com" }],
      subject: "Reset",
      htmlContent: "<p>Hi</p>",
    });
  });

  it("reports Brevo's error code and message on rejection", async () => {
    const fakeFetch = (async () =>
      new Response(JSON.stringify({ code: "unauthorized", message: "Key not found" }), {
        status: 401,
      })) as unknown as typeof fetch;

    const result = await sendViaBrevo(config, message, fakeFetch);

    assert.equal(result.delivered, false);
    assert.equal(result.mode, "brevo");
    assert.match(result.error ?? "", /HTTP 401/);
    assert.match(result.error ?? "", /unauthorized: Key not found/);
  });

  it("reports network failures without throwing", async () => {
    const fakeFetch = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;

    const result = await sendViaBrevo(config, message, fakeFetch);

    assert.equal(result.delivered, false);
    assert.match(result.error ?? "", /Could not reach Brevo API: fetch failed/);
  });
});
