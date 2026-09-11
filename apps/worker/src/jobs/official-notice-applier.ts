
import { Temporal } from "@js-temporal/polyfill";
import { db } from "@examconnect/database";

import type {
  ParsedOfficialNotice,
  ParsedOfficialPost,
} from "./official-notice-parser.js";

type ApplyNoticeResult = {
  examId: number | null;
  postId: number | null;
  deadlineId: number | null;
  rulesCreated: number;
  rulesUpdated: number;
  applied: boolean;
  skipped: boolean;
  reason: string | null;
};

function normalize(
  value:
    | string
    | null
    | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const normalized =
    value
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  return normalized || null;
}

function sameInstant(
  left:
    | Temporal.Instant
    | string
    | null
    | undefined,
  right:
    | Temporal.Instant
    | string
    | null
    | undefined,
): boolean {
  if (
    left === null ||
    left === undefined ||
    right === null ||
    right === undefined
  ) {
    return (
      left === right
    );
  }

  return (
    left.toString() ===
    right.toString()
  );
}

async function upsertPost(
  examId: number,
  parsedPost: ParsedOfficialPost,
  now: Temporal.Instant,
): Promise<number> {
  const existingPosts =
    await db.orm.public.Post
      .where({
        examId,
      })
      .all();

  const normalizedName =
    normalize(
      parsedPost.name,
    );

  const normalizedDepartment =
    normalize(
      parsedPost.department,
    );

  const existingPost =
    existingPosts.find(
      (item) =>
        normalize(item.name) ===
          normalizedName &&
        normalize(
          item.department,
        ) ===
          normalizedDepartment,
    );

  if (existingPost) {
    const updatedPost =
      await db.orm.public.Post
        .where({
          id: existingPost.id,
        })
        .update({
          name:
            parsedPost.name,
          department:
            parsedPost.department ??
            existingPost.department,
          vacancies:
            parsedPost.vacancies ??
            existingPost.vacancies,
          qualification:
            parsedPost.qualification ??
            existingPost.qualification,
          updatedAt:
            now,
        });

    if (!updatedPost) {
      throw new Error(
        `Failed to update post ${existingPost.id}.`,
      );
    }

    return updatedPost.id;
  }

  const createdPost =
    await db.orm.public.Post.create({
      examId,
      name:
        parsedPost.name,
      department:
        parsedPost.department ??
        undefined,
      vacancies:
        parsedPost.vacancies ??
        undefined,
      qualification:
        parsedPost.qualification ??
        undefined,
      updatedAt: now,
    });

  return createdPost.id;
}

async function upsertDeadline(
  examId: number,
  postId: number,
  notice: ParsedOfficialNotice,
  now: Temporal.Instant,
): Promise<number | null> {
  const hasDeadlineData =
    notice.applicationStart !== null ||
    notice.applicationEnd !== null ||
    notice.examDate !== null ||
    notice.applicationUrl !== null;

  if (!hasDeadlineData) {
    return null;
  }

  const deadlines =
    await db.orm.public.ApplicationDeadline
      .where({
        examId,
        postId,
      })
      .all();

  const applicationEnd =
    notice.applicationEnd
      ? Temporal.Instant.from(
          notice.applicationEnd,
        )
      : null;

  const existingDeadline =
    deadlines.find(
      (item) =>
        sameInstant(
          item.applicationEnd,
          applicationEnd,
        ),
    );

  if (existingDeadline) {
    const updatedDeadline =
      await db.orm.public.ApplicationDeadline
        .where({
          id:
            existingDeadline.id,
        })
        .update({
          applicationUrl:
            notice.applicationUrl ??
            existingDeadline.applicationUrl,
          applicationStart:
            notice.applicationStart
              ? Temporal.Instant.from(
                  notice.applicationStart,
                )
              : existingDeadline.applicationStart,
          applicationEnd:
            applicationEnd ??
            existingDeadline.applicationEnd,
          examDate:
            notice.examDate
              ? Temporal.Instant.from(
                  notice.examDate,
                )
              : existingDeadline.examDate,
          updatedAt: now,
        });

    if (!updatedDeadline) {
      throw new Error(
        `Failed to update deadline ${existingDeadline.id}.`,
      );
    }

    return updatedDeadline.id;
  }

  const createdDeadline =
    await db.orm.public.ApplicationDeadline.create(
      {
        examId,
        postId,
        applicationUrl:
          notice.applicationUrl ??
          undefined,
        status: "ACTIVE",
        applicationStart:
          notice.applicationStart
            ? Temporal.Instant.from(
                notice.applicationStart,
              )
            : undefined,
        applicationEnd:
          applicationEnd ??
          undefined,
        examDate:
          notice.examDate
            ? Temporal.Instant.from(
                notice.examDate,
              )
            : undefined,
        updatedAt: now,
      },
    );

  return createdDeadline.id;
}

async function upsertEligibilityRule(
  examId: number,
  notice: ParsedOfficialNotice,
  sourceId: number,
  now: Temporal.Instant,
): Promise<{
  rulesCreated: number;
  rulesUpdated: number;
}> {
  let rulesCreated = 0;
  let rulesUpdated = 0;

  for (
    const parsedRule of
      notice.eligibilityRules
  ) {
    /*
     * Age in this parsed notice is an
     * examination-level rule, because
     * notice.postName is null and the
     * parser currently extracts age at
     * the notice level.
     */
    const postId: number | null =
      null;

    const rules =
      await db.orm.public.EligibilityRule
        .where({
          examId,
          postId,
        })
        .all();

    const existingRule =
      rules.find(
        (item) =>
          normalize(item.name) ===
          normalize(
            parsedRule.name,
          ),
      );

    if (!existingRule) {
      const rule =
        await db.orm.public.EligibilityRule.create(
          {
            examId,
            postId,
            ruleType:
              parsedRule.ruleType,
            name:
              parsedRule.name,
            description:
              parsedRule.expectedValue,
            updatedAt: now,
          },
        );

      await db.orm.public.EligibilityRuleVersion.create(
        {
          eligibilityRuleId:
            rule.id,
          notificationSourceId:
            sourceId,
          versionNumber: 1,
          status: "ACTIVE",
          conditionField:
            parsedRule.conditionField,
          operator:
            parsedRule.operator,
          expectedValue:
            parsedRule.expectedValue,
          effectiveFrom: now,
          updatedAt: now,
        },
      );

      rulesCreated++;
      continue;
    }

    const versions =
      await db.orm.public.EligibilityRuleVersion
        .where({
          eligibilityRuleId:
            existingRule.id,
        })
        .all();

    const latestVersion =
      versions.reduce(
        (
          latest,
          version,
        ) =>
          version.versionNumber >
          latest.versionNumber
            ? version
            : latest,
        versions[0] ??
          null,
      );

    const sameRule =
      latestVersion &&
      latestVersion.conditionField ===
        parsedRule.conditionField &&
      latestVersion.operator ===
        parsedRule.operator &&
      latestVersion.expectedValue ===
        parsedRule.expectedValue;

    if (sameRule) {
      continue;
    }

    const updatedRule =
      await db.orm.public.EligibilityRule
        .where({
          id:
            existingRule.id,
        })
        .update({
          ruleType:
            parsedRule.ruleType,
          description:
            parsedRule.expectedValue,
          updatedAt: now,
        });

    if (!updatedRule) {
      throw new Error(
        `Failed to update eligibility rule ${existingRule.id}.`,
      );
    }

    await db.orm.public.EligibilityRuleVersion.create(
      {
        eligibilityRuleId:
          existingRule.id,
        notificationSourceId:
          sourceId,
        versionNumber:
          (latestVersion?.versionNumber ??
            0) + 1,
        status: "ACTIVE",
        conditionField:
          parsedRule.conditionField,
        operator:
          parsedRule.operator,
        expectedValue:
          parsedRule.expectedValue,
        effectiveFrom: now,
        updatedAt: now,
      },
    );

    rulesUpdated++;
  }

  return {
    rulesCreated,
    rulesUpdated,
  };
}

export async function applyParsedOfficialNotice(
  sourceId: number,
  notice: ParsedOfficialNotice,
): Promise<ApplyNoticeResult> {
  if (
    !notice.examName ||
    !notice.conductingBody
  ) {
    return {
      examId: null,
      postId: null,
      deadlineId: null,
      rulesCreated: 0,
      rulesUpdated: 0,
      applied: false,
      skipped: true,
      reason:
        "Exam name and conducting body are required before applying official notice data.",
    };
  }

  /*
   * Validate that the notification source
   * actually exists before creating
   * EligibilityRuleVersion rows.
   */
  const source =
    await db.orm.public.NotificationSource
      .where({
        id: sourceId,
      })
      .all();

  if (source.length === 0) {
    return {
      examId: null,
      postId: null,
      deadlineId: null,
      rulesCreated: 0,
      rulesUpdated: 0,
      applied: false,
      skipped: true,
      reason:
        `Notification source ${sourceId} does not exist.`,
    };
  }

  const now =
    Temporal.Now.instant();

  const normalizedExamName =
    normalize(
      notice.examName,
    );

  const existingExams =
    await db.orm.public.Exam.all();

  const existingExam =
    existingExams.find(
      (item) =>
        normalize(item.name) ===
        normalizedExamName,
    );

  let exam;

  if (existingExam) {
    const updatedExam =
      await db.orm.public.Exam
        .where({
          id:
            existingExam.id,
        })
        .update({
          conductingBody:
            notice.conductingBody,
          examType:
            notice.examType ??
            existingExam.examType,
          description:
            notice.description ??
            existingExam.description,
          officialWebsite:
            notice.applicationUrl ??
            existingExam.officialWebsite,
          updatedAt: now,
        });

    if (!updatedExam) {
      throw new Error(
        `Failed to update exam ${existingExam.id}.`,
      );
    }

    exam = updatedExam;
  } else {
    exam =
      await db.orm.public.Exam.create(
        {
          name:
            notice.examName,
          conductingBody:
            notice.conductingBody,
          examType:
            notice.examType ??
            undefined,
          description:
            notice.description ??
            undefined,
          officialWebsite:
            notice.applicationUrl ??
            undefined,
          updatedAt: now,
        },
      );
  }

  /*
   * Support both:
   *
   * 1. Multiple posts from
   *    notice.posts[]
   *
   * 2. A single post from
   *    notice.postName
   *
   * The UPSC Geo-Scientist notice
   * uses notice.posts[].
   */
  let parsedPosts:
    ParsedOfficialPost[] = [];

  if (
    notice.posts.length > 0
  ) {
    parsedPosts =
      notice.posts;
  } else if (
    notice.postName
  ) {
    parsedPosts = [
      {
        name:
          notice.postName,
        department: null,
        vacancies: null,
        qualification: null,
      },
    ];
  }

  const postIds:
    number[] = [];

  let firstPostId:
    number | null = null;

  let firstDeadlineId:
    number | null = null;

  for (
    const parsedPost of parsedPosts
  ) {
    const postId =
      await upsertPost(
        exam.id,
        parsedPost,
        now,
      );

    postIds.push(
      postId,
    );

    if (
      firstPostId === null
    ) {
      firstPostId =
        postId;
    }

    const deadlineId =
      await upsertDeadline(
        exam.id,
        postId,
        notice,
        now,
      );

    if (
      firstDeadlineId ===
        null &&
      deadlineId !== null
    ) {
      firstDeadlineId =
        deadlineId;
    }
  }

  const {
    rulesCreated,
    rulesUpdated,
  } =
    await upsertEligibilityRule(
      exam.id,
      notice,
      sourceId,
      now,
    );

  /*
   * postIds is intentionally kept as
   * the complete list for future
   * post-specific rules/notifications.
   */
  void postIds;

  return {
    examId:
      exam.id,
    postId:
      firstPostId,
    deadlineId:
      firstDeadlineId,
    rulesCreated,
    rulesUpdated,
    applied: true,
    skipped: false,
    reason: null,
  };
}

