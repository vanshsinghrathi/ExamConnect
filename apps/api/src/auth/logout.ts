import type { FastifyInstance } from "fastify";
import "@fastify/cookie";

import {
  deleteSession,
  sessionCookieName,
} from "./session.js";

export async function logoutRoute(app: FastifyInstance) {
  app.post("/auth/logout", async (request, reply) => {
    const token = request.cookies[sessionCookieName];

    if (token) {
      await deleteSession(token);
    }

    reply.clearCookie(sessionCookieName, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    });

    return reply.send({
      status: "ok",
    });
  });
}