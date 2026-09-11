import { db } from "@examconnect/database";

type CreateEligibleExamNotificationInput = {
  userId: number;
  examId: number;
  postId?: number | null;
  examName: string;
  postName?: string | null;
};

export async function createNewEligibleExamNotification(
  input: CreateEligibleExamNotificationInput,
) {
  const existing =
    await db.orm.public.StudentNotification.where({
      userId: input.userId,
      type: "NEW_ELIGIBLE_EXAM",
      examId: input.examId,
      postId: input.postId ?? null,
    }).all();

  if (existing.length > 0) {
    return {
      created: false,
      notification: existing[0],
    };
  }

  const notification =
    await db.orm.public.StudentNotification.create({
      userId: input.userId,
      type: "NEW_ELIGIBLE_EXAM",
      title: "New eligible exam",
      message: input.postName
        ? `You are eligible for ${input.examName} - ${input.postName}.`
        : `You are eligible for ${input.examName}.`,
      examId: input.examId,
      postId: input.postId ?? null,
      isRead: false,
    });

  return {
    created: true,
    notification,
  };
}