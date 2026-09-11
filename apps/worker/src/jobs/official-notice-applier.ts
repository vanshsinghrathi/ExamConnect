import { Temporal } from "@js-temporal/polyfill";
import { db } from "@examconnect/database";

import type { ParsedOfficialNotice } from "./official-notice-parser.js";

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
value: string | null | undefined,
): string | null {
if (!value) {
return null;
}

const normalized = value
.replace(/\s+/g, " ")
.trim()
.toLowerCase();

return normalized || null;
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

const now = Temporal.Now.instant();

const normalizedExamName =
normalize(notice.examName);

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
id: existingExam.id,
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
await db.orm.public.Exam.create({
name: notice.examName,
conductingBody:
notice.conductingBody,
examType:
notice.examType ?? undefined,
description:
notice.description ?? undefined,
officialWebsite:
notice.applicationUrl ?? undefined,
updatedAt: now,
});
}

let postId: number | null = null;

if (notice.postName) {
const existingPosts =
await db.orm.public.Post
.where({
examId: exam.id,
})
.all();

const normalizedPostName =
  normalize(notice.postName);

const existingPost =
  existingPosts.find(
    (item) =>
      normalize(item.name) ===
      normalizedPostName,
  );

let post;

if (existingPost) {
  const updatedPost =
    await db.orm.public.Post
      .where({
        id: existingPost.id,
      })
      .update({
        code:
          notice.postCode ??
          existingPost.code,
        updatedAt: now,
      });

  if (!updatedPost) {
    throw new Error(
      `Failed to update post ${existingPost.id}.`,
    );
  }

  post = updatedPost;
} else {
  post =
    await db.orm.public.Post.create({
      examId: exam.id,
      name: notice.postName,
      code:
        notice.postCode ?? undefined,
      updatedAt: now,
    });
}

postId = post.id;

}

let deadlineId: number | null = null;

const hasDeadlineData =
notice.applicationStart !== null ||
notice.applicationEnd !== null ||
notice.examDate !== null ||
notice.applicationUrl !== null;

if (hasDeadlineData) {
const deadlines =
await db.orm.public.ApplicationDeadline
.where({
examId: exam.id,
postId,
})
.all();

const normalizedApplicationEnd =
  notice.applicationEnd;

const existingDeadline =
  deadlines.find((item) => {
    if (
      item.applicationEnd === null &&
      normalizedApplicationEnd === null
    ) {
      return true;
    }

    if (
      item.applicationEnd === null ||
      normalizedApplicationEnd === null
    ) {
      return false;
    }

    return (
      item.applicationEnd.toString() ===
      normalizedApplicationEnd
    );
  });

let deadline;

if (existingDeadline) {
  const updatedDeadline =
    await db.orm.public.ApplicationDeadline
      .where({
        id: existingDeadline.id,
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
          notice.applicationEnd
            ? Temporal.Instant.from(
                notice.applicationEnd,
              )
            : existingDeadline.applicationEnd,
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

  deadline = updatedDeadline;
} else {
  deadline =
    await db.orm.public.ApplicationDeadline.create(
      {
        examId: exam.id,
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
          notice.applicationEnd
            ? Temporal.Instant.from(
                notice.applicationEnd,
              )
            : undefined,
        examDate:
          notice.examDate
            ? Temporal.Instant.from(
                notice.examDate,
              )
            : undefined,
        updatedAt: now,
      },
    );
}

deadlineId = deadline.id;

}

let rulesCreated = 0;
let rulesUpdated = 0;

for (const parsedRule of notice.eligibilityRules) {
const rules =
await db.orm.public.EligibilityRule
.where({
examId: exam.id,
postId,
})
.all();

const existingRule =
  rules.find(
    (item) =>
      normalize(item.name) ===
      normalize(parsedRule.name),
  );

if (!existingRule) {
  const rule =
    await db.orm.public.EligibilityRule.create({
      examId: exam.id,
      postId,
      ruleType:
        parsedRule.ruleType,
      name: parsedRule.name,
      description:
        parsedRule.expectedValue,
      updatedAt: now,
    });

  await db.orm.public.EligibilityRuleVersion.create(
    {
      eligibilityRuleId: rule.id,
      notificationSourceId: sourceId,
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
    (latest, version) =>
      version.versionNumber >
      latest.versionNumber
        ? version
        : latest,
    versions[0] ?? null,
  );

const updatedRule =
  await db.orm.public.EligibilityRule
    .where({
      id: existingRule.id,
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
      (latestVersion?.versionNumber ?? 0) +
      1,
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
examId: exam.id,
postId,
deadlineId,
rulesCreated,
rulesUpdated,
applied: true,
skipped: false,
reason: null,
};
}
