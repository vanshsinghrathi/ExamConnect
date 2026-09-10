import argon2 from "argon2";
import { Temporal } from "@js-temporal/polyfill";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { db } from "@examconnect/database";

const registerSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
});

export async function registerRoute(app: FastifyInstance) {
  app.post("/auth/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "INVALID_INPUT",
        message: "Please provide a valid email and password.",
      });
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const existingUser = await db.orm.public.User
      .where({ email: normalizedEmail })
      .first();

    if (existingUser) {
      return reply.code(409).send({
        error: "EMAIL_ALREADY_EXISTS",
        message: "An account with this email already exists.",
      });
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });

    const user = await db.orm.public.User.create({
      email: normalizedEmail,
      passwordHash,
      role: "STUDENT",
      isActive: true,
      updatedAt: Temporal.Now.instant(),
    });

    return reply.code(201).send({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  });
}