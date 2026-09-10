import type { FastifyInstance } from "fastify";
import {
  requireAuth,
  requireRole,
} from "./guards.js";

export async function protectedRoute(
  app: FastifyInstance,
) {
  app.get(
    "/student/profile",
    {
      preHandler: requireAuth,
    },
    async (request) => {
      return {
        status: "ok",
        message: "Student route accessed.",
        user: {
          id: request.authUser!.id,
          email: request.authUser!.email,
          role: request.authUser!.role,
        },
      };
    },
  );

  app.get(
    "/admin/test",
    {
      preHandler: [
        requireAuth,
        requireRole("ADMIN"),
      ],
    },
    async (request) => {
      return {
        status: "ok",
        message: "Admin route accessed.",
        user: {
          id: request.authUser!.id,
          email: request.authUser!.email,
          role: request.authUser!.role,
        },
      };
    },
  );
}