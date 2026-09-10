import { createHash, randomBytes } from "node:crypto";
import { Temporal } from "@js-temporal/polyfill";
import { db } from "@examconnect/database";

const SESSION_COOKIE = "examconnect_session";
const SESSION_TTL_DAYS = 7;

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: number) {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(rawToken);

  const now = Temporal.Now.instant();

  const expiresAt = now.add({
    hours: SESSION_TTL_DAYS * 24,
  });

  const session = await db.orm.public.Session.create({
    userId,
    tokenHash,
    expiresAt,
  });

  return {
    id: session.id,
    rawToken,
    expiresAt,
  };
}

export async function getSessionUser(token: string) {
  const tokenHash = hashSessionToken(token);

  const session = await db.orm.public.Session
    .where({ tokenHash })
    .first();

  if (!session) {
    return null;
  }

  const now = Temporal.Now.instant();

  const expiresAt = session.expiresAt as unknown as Temporal.Instant;

  if (Temporal.Instant.compare(expiresAt, now) <= 0) {
    await db.orm.public.Session
      .where({ id: session.id })
      .delete();

    return null;
  }

  const user = await db.orm.public.User
    .where({
      id: session.userId,
      isActive: true,
    })
    .first();

  if (!user) {
    return null;
  }

  return {
    user,
    session,
  };
}

export async function deleteSession(token: string) {
  const tokenHash = hashSessionToken(token);

  const session = await db.orm.public.Session
    .where({ tokenHash })
    .first();

  if (session) {
    await db.orm.public.Session
      .where({ id: session.id })
      .delete();
  }
}

export const sessionCookieName = SESSION_COOKIE;