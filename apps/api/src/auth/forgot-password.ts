import { createHash, randomBytes } from "node:crypto";
import { Temporal } from "@js-temporal/polyfill";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { db } from "@examconnect/database";

import {
  canDeliverRealEmail,
  sendPasswordResetEmail,
} from "../email/email-service.js";
import { createRateLimiter } from "../security.js";

export const PASSWORD_RESET_TTL_MINUTES = 20;

const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(254),
});

export function generateSecureResetToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

/** Public frontend used in emailed links when APP_URL is not set. */
export const DEFAULT_PRODUCTION_APP_URL = "https://exam-connect-ivory.vercel.app";
const DEFAULT_DEVELOPMENT_APP_URL = "http://localhost:3000";

/**
 * Base URL of the frontend for links in emails (e.g. /reset-password).
 * APP_URL (or NEXT_PUBLIC_APP_URL) overrides; blank values are ignored.
 */
export function getAppBaseUrl(): string {
  const configured =
    process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  const fallback =
    process.env.NODE_ENV === "production"
      ? DEFAULT_PRODUCTION_APP_URL
      : DEFAULT_DEVELOPMENT_APP_URL;
  return (configured || fallback).replace(/\/+$/, "");
}

const GENERIC_SUCCESS_MESSAGE =
  "If an active account is registered with that email address, a password reset link has been sent.";

export async function forgotPasswordRoute(app: FastifyInstance) {
  const forgotRateLimiter = createRateLimiter({
    keyPrefix: "auth:forgot-password",
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
  });

  app.post(
    "/auth/forgot-password",
    {
      preHandler: forgotRateLimiter,
    },
    async (request, reply) => {
      const parsed = forgotPasswordSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_INPUT",
          message: "Please provide a valid email address.",
        });
      }

      // In production, never claim an email was sent when no real email provider is
      // configured. Ethereal captures mail without delivering it, so it is rejected too.
      if (process.env.NODE_ENV === "production" && !canDeliverRealEmail()) {
        app.log.error(
          "Password reset requested in production, but no real email provider is configured (set BREVO_API_KEY + EMAIL_FROM, or SMTP_* for a real SMTP server; Ethereal is not allowed).",
        );
        return reply.code(503).send({
          error: "EMAIL_SERVICE_UNCONFIGURED",
          message:
            "Password reset email delivery is not configured on this server. Please contact an administrator.",
        });
      }

      const normalizedEmail = parsed.data.email.toLowerCase();

      const user = await db.orm.public.User
        .where({
          email: normalizedEmail,
          isActive: true,
        })
        .first();

      // Prevent email/account enumeration: return the exact same response when user is absent
      if (!user) {
        return reply.code(200).send({
          message: GENERIC_SUCCESS_MESSAGE,
        });
      }

      // Invalidate previous unused tokens for this user
      const existingTokens = await db.orm.public.PasswordResetToken
        .where({ userId: user.id })
        .all();

      const now = Temporal.Now.instant();

      for (const existing of existingTokens) {
        if (existing.usedAt === null) {
          await db.orm.public.PasswordResetToken
            .where({ id: existing.id })
            .update({ usedAt: now });
        }
      }

      const rawToken = generateSecureResetToken();
      const tokenHash = hashResetToken(rawToken);
      const expiresAt = now.add({ minutes: PASSWORD_RESET_TTL_MINUTES });

      const createdToken = await db.orm.public.PasswordResetToken.create({
        userId: user.id,
        tokenHash,
        expiresAt,
      });

      const resetUrl = `${getAppBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;

      const delivery = await sendPasswordResetEmail({
        to: user.email,
        resetUrl,
        expiresMinutes: PASSWORD_RESET_TTL_MINUTES,
      });

      if (!delivery.delivered) {
        // Roll back the token if mail delivery failed; never claim email was sent
        await db.orm.public.PasswordResetToken
          .where({ id: createdToken.id })
          .delete();

        app.log.error(
          { mode: delivery.mode, error: delivery.error },
          "Password reset email delivery failed",
        );

        return reply.code(503).send({
          error: "EMAIL_DELIVERY_FAILED",
          message:
            "Unable to deliver the password reset email right now. Please try again later.",
        });
      }

      if (delivery.mode === "brevo") {
        app.log.info(
          { mode: delivery.mode, messageId: delivery.messageId },
          "Password reset email SENT via Brevo API and accepted for delivery.",
        );
      } else if (delivery.mode === "smtp") {
        app.log.info(
          { mode: delivery.mode, messageId: delivery.messageId },
          "Password reset email SENT via SMTP and accepted by the mail server.",
        );
      } else if (process.env.NODE_ENV !== "production" && delivery.mode === "ethereal") {
        app.log.info(
          { previewUrl: delivery.previewUrl, messageId: delivery.messageId },
          "Password reset email SENT to the Ethereal test inbox (Ethereal never forwards to the recipient's real mailbox). Open previewUrl to view it.",
        );
      }

      return reply.code(200).send({
        message: GENERIC_SUCCESS_MESSAGE,
      });
    },
  );
}
