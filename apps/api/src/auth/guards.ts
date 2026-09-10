import type {
  FastifyReply,
  FastifyRequest,
} from "fastify";

import {
  getSessionUser,
  sessionCookieName,
} from "./session.js";

export type AuthenticatedUser = {
  id: number;
  email: string;
  role: string;
  isActive: boolean;
};

declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthenticatedUser;
  }
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
) {
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

  request.authUser = {
    id: result.user.id,
    email: result.user.email,
    role: result.user.role,
    isActive: result.user.isActive,
  };
}

export function requireRole(role: string) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    if (!request.authUser) {
      return reply.code(401).send({
        error: "UNAUTHENTICATED",
        message: "Authentication required.",
      });
    }

    if (request.authUser.role !== role) {
      return reply.code(403).send({
        error: "FORBIDDEN",
        message: "You do not have permission to access this resource.",
      });
    }
  };
}