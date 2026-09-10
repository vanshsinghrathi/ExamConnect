import argon2 from "argon2";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { db } from "@examconnect/database";

import {
  createSession,
  sessionCookieName,
} from "./session.js";

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
});

export async function loginRoute(app: FastifyInstance) {
  app.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "INVALID_INPUT",
        message: "Please provide a valid email and password.",
      });
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const user = await db.orm.public.User
      .where({
        email: normalizedEmail,
        isActive: true,
      })
      .first();

    if (!user || !user.passwordHash) {
      return reply.code(401).send({
        error: "INVALID_CREDENTIALS",
        message: "Invalid email or password.",
      });
    }

    const passwordMatches = await argon2.verify(
      user.passwordHash,
      password,
    );

    if (!passwordMatches) {
      return reply.code(401).send({
        error: "INVALID_CREDENTIALS",
        message: "Invalid email or password.",
      });
    }

    const session = await createSession(user.id);

    reply.setCookie(sessionCookieName, session.rawToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  });
}