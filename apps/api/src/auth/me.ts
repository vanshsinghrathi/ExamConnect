import type { FastifyInstance } from "fastify";
import { requireAuth } from "./guards.js";

export async function meRoute(app: FastifyInstance) {
  app.get(
    "/auth/me",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const user = request.authUser!;

      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
    },
  );
}