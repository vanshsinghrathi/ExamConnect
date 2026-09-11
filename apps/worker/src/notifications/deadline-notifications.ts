import { Temporal } from "@js-temporal/polyfill";
import { db } from "@examconnect/database";

const REMINDER_DAYS = 3;

export async function generateDeadlineNotifications() {
  const now = Temporal.Now.instant();

  const reminderDate = now.add({
    hours: REMINDER_DAYS * 24,
  });

  const deadlines =
    await db.orm.public.ApplicationDeadline.all();

  const profiles =
    await db.orm.public.StudentProfile.all();

  let createdCount = 0;

  for (const deadline of deadlines) {
    if (!deadline.applicationEnd) {
      continue;
    }

    const applicationEnd = Temporal.Instant.from(
      deadline.applicationEnd.toString(),
    );

    const isExpired =
      Temporal.Instant.compare(applicationEnd, now) <= 0;

    const isTooFarAway =
      Temporal.Instant.compare(applicationEnd, reminderDate) > 0;

    if (isExpired || isTooFarAway) {
      continue;
    }

    for (const profile of profiles) {
      const existingNotifications =
        await db.orm.public.StudentNotification.where({
          userId: profile.userId,
          deadlineId: deadline.id,
          type: "DEADLINE",
        }).all();

      if (existingNotifications.length > 0) {
        continue;
      }

      await db.orm.public.StudentNotification.create({
        userId: profile.userId,
        type: "DEADLINE",
        title: "Application deadline approaching",
        message:
          "An application deadline is approaching. Please check the exam details and apply before the deadline.",
        deadlineId: deadline.id,
        examId: deadline.examId,
        postId: deadline.postId,
        isRead: false,
      });

      createdCount++;
    }
  }

  return {
    createdCount,
  };
}