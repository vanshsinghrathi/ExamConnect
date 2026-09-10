import type { FastifyInstance } from "fastify";
import { Temporal } from "@js-temporal/polyfill";
import { z } from "zod";
import { db } from "@examconnect/database";

import {
  requireAuth,
  requireRole,
} from "./auth/guards.js";

const notificationSourceSchema = z.object({
  organization: z.string().min(1),
  notificationTitle: z.string().min(1),
  notificationDate: z.string().datetime().optional(),
  officialUrl: z.string().url(),
  notificationIdentifier: z.string().optional(),
  lastVerifiedAt: z.string().datetime().optional(),
});

export async function adminNotificationSourceRoute(
  app: FastifyInstance,
) {
  app.post(
    "/admin/notification-sources",
    {
      preHandler: [
        requireAuth,
        requireRole("ADMIN"),
      ],
    },
    async (request, reply) => {
      const parsed =
        notificationSourceSchema.safeParse(
          request.body,
        );

      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_INPUT",
          message:
            "Invalid notification source data.",
        });
      }

      const data = parsed.data;

      const now = Temporal.Now.instant();

      const notificationDate =
        data.notificationDate
          ? Temporal.Instant.from(
              data.notificationDate,
            )
          : null;

      const lastVerifiedAt =
        data.lastVerifiedAt
          ? Temporal.Instant.from(
              data.lastVerifiedAt,
            )
          : null;

      const source =
        await db.orm.public.NotificationSource.create(
          {
            organization:
              data.organization,
            notificationTitle:
              data.notificationTitle,
            notificationDate,
            officialUrl:
              data.officialUrl,
            notificationIdentifier:
              data.notificationIdentifier ??
              null,
            dateImported: now,
            lastVerifiedAt,
            createdAt: now,
            updatedAt: now,
          },
        );

      return reply.code(201).send({
        notificationSource: source,
      });
    },
  );
}