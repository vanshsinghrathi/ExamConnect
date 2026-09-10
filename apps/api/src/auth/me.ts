import type { FastifyInstance } from "fastify";
import "@fastify/cookie";

import {
  getSessionUser,
  sessionCookieName,
} from "./session.js";

export async function meRoute(app: FastifyInstance) {
  app.get("/auth/me", async (request, reply) => {
    const token = request.cookies[sessionCookieName];

    if (!token) {
      return reply.code(401).send({
        error: "UNAUTHENTICATED",
        message: "Authentication required.",
      });
    }

    const result = await getSessionUser(token);

    if (!result) {
      return reply.code(401).send({
        error: "UNAUTHENTICATED",
        message: "Authentication required.",
      });
    }

    const { user } = result;

    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  });
}