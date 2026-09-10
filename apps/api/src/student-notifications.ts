import type { FastifyInstance } from "fastify";
import { Temporal } from "@js-temporal/polyfill";
import { z } from "zod";
import { db } from "@examconnect/database";

import { requireAuth } from "./auth/guards.js";

const notificationIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export async function studentNotificationRoute(
  app: FastifyInstance,
) {
  /*
   * Get current student's notifications
   */
  app.get(
    "/student/notifications",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const userId = request.authUser!.id;

      const notifications =
        await db.orm.public.StudentNotification
          .where({
            userId,
          })
          .all();

      /*
       * Sort newest notifications first.
       */
      notifications.sort(
        (a, b) =>
          new Date(b.createdAt.toString()).getTime() -
          new Date(a.createdAt.toString()).getTime(),
      );

      return reply.send({
        notifications,
      });
    },
  );

  /*
   * Mark one notification as read
   */
  app.patch(
    "/student/notifications/:id/read",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const parsed =
        notificationIdSchema.safeParse(
          request.params,
        );

      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_ID",
          message:
            "Notification ID must be a positive integer.",
        });
      }

      const userId = request.authUser!.id;
      const notificationId = parsed.data.id;

      const notification =
        await db.orm.public.StudentNotification
          .where({
            id: notificationId,
            userId,
          })
          .first();

      if (!notification) {
        return reply.code(404).send({
          error: "NOTIFICATION_NOT_FOUND",
          message:
            "Notification not found.",
        });
      }

      const updated =
        await db.orm.public.StudentNotification
          .where({
            id: notificationId,
            userId,
          })
          .update({
            isRead: true,
            readAt: Temporal.Now.instant(),
          });

      return reply.send({
        notification: updated,
      });
    },
  );

  /*
   * Mark all current student's notifications as read
   */
  app.patch(
    "/student/notifications/read-all",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const userId = request.authUser!.id;

      const notifications =
        await db.orm.public.StudentNotification
          .where({
            userId,
            isRead: false,
          })
          .all();

      const now = Temporal.Now.instant();

      for (const notification of notifications) {
        await db.orm.public.StudentNotification
          .where({
            id: notification.id,
            userId,
          })
          .update({
            isRead: true,
            readAt: now,
          });
      }

      return reply.send({
        status: "ok",
        updatedCount: notifications.length,
      });
    },
  );
}