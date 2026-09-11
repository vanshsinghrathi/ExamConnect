import { db } from "@examconnect/database";

type CreateEligibleExamNotificationInput = {
  userId: number;
  examId: number;
  postId?: number | null;
  examName: string;
  postName?: string | null;
};

type CreateNewExamNotificationInput = {
  userId: number;
  examId: number;
  examName: string;
};

type CreateRuleChangeNotificationInput = {
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

export async function createNewExamNotification(
  input: CreateNewExamNotificationInput,
) {
  const existing =
    await db.orm.public.StudentNotification.where({
      userId: input.userId,
      type: "NEW_EXAM",
      examId: input.examId,
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
      type: "NEW_EXAM",
      title: "New exam available",
      message: `${input.examName} is now available on ExamConnect.`,
      examId: input.examId,
      isRead: false,
    });

  return {
    created: true,
    notification,
  };
}

export async function createEligibilityRuleChangedNotification(
  input: CreateRuleChangeNotificationInput,
) {
  const existing =
    await db.orm.public.StudentNotification.where({
      userId: input.userId,
      type: "ELIGIBILITY_RULE_CHANGED",
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
      type: "ELIGIBILITY_RULE_CHANGED",
      title: "Eligibility rule updated",
      message: input.postName
        ? `Eligibility information for ${input.examName} - ${input.postName} has been updated. Please review your eligibility.`
        : `Eligibility information for ${input.examName} has been updated. Please review your eligibility.`,
      examId: input.examId,
      postId: input.postId ?? null,
      isRead: false,
    });

  return {
    created: true,
    notification,
  };
}