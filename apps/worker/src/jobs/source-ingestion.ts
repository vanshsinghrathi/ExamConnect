import { createHash } from "node:crypto";
import { Temporal } from "@js-temporal/polyfill";
import { db } from "@examconnect/database";

type SourceIngestionResult = {
sourceId: number;
url: string;
success: boolean;
statusCode: number | null;
contentType: string | null;
contentLength: number;
textLength: number;
contentHash: string | null;
previousContentHash: string | null;
contentChanged: boolean;
firstFetch: boolean;
notificationsCreated: number;
fetchedAt: string;
error: string | null;
};

function extractReadableText(html: string): string {
let text = html;

text = text.replace(
new RegExp("<script[\s\S]*?</script>", "gi"),
" ",
);

text = text.replace(
new RegExp("<style[\s\S]*?</style>", "gi"),
" ",
);

text = text.replace(
new RegExp("<noscript[\s\S]*?</noscript>", "gi"),
" ",
);

text = text.replace(
new RegExp("<[^>]*>", "g"),
" ",
);

text = text
.replace(/ /gi, " ")
.replace(/&/gi, "&")
.replace(/</gi, "<")
.replace(/>/gi, ">")
.replace(/"/gi, '"')
.replace(/'/gi, "'");

return text
.replace(/\s+/g, " ")
.trim();
}

function createContentHash(text: string): string {
return createHash("sha256")
.update(text, "utf8")
.digest("hex");
}

async function createSourceChangeNotifications(
sourceId: number,
): Promise<number> {
const linkedRuleVersions =
await db.orm.public.EligibilityRuleVersion
.where({
notificationSourceId: sourceId,
})
.all();

if (linkedRuleVersions.length === 0) {
return 0;
}

const profiles =
await db.orm.public.StudentProfile.all();

const notifiedRules = new Set<string>();

let notificationsCreated = 0;

for (const version of linkedRuleVersions) {
const rule =
await db.orm.public.EligibilityRule
.where({
id: version.eligibilityRuleId,
})
.first();

if (!rule) {
  continue;
}

const exam =
  await db.orm.public.Exam
    .where({
      id: rule.examId,
    })
    .first();

if (!exam) {
  continue;
}

const ruleKey =
  rule.examId + ":" + (rule.postId ?? "exam");

if (notifiedRules.has(ruleKey)) {
  continue;
}

notifiedRules.add(ruleKey);

let postName: string | null = null;

if (rule.postId !== null) {
  const post =
    await db.orm.public.Post
      .where({
        id: rule.postId,
        examId: rule.examId,
      })
      .first();

  postName = post?.name ?? null;
}

for (const profile of profiles) {
  await db.orm.public.StudentNotification.create({
    userId: profile.userId,
    type: "ELIGIBILITY_RULE_CHANGED",
    title: "Eligibility rule updated",
    message: postName
      ? `Eligibility information for ${exam.name} - ${postName} has been updated. Please review your eligibility.`
      : `Eligibility information for ${exam.name} has been updated. Please review your eligibility.`,
    examId: rule.examId,
    postId: rule.postId,
    isRead: false,
  });

  notificationsCreated++;
}

}

return notificationsCreated;
}

export async function ingestNotificationSource(
sourceId: number,
): Promise<SourceIngestionResult> {
const source =
await db.orm.public.NotificationSource
.where({
id: sourceId,
})
.first();

const fetchedAt =
Temporal.Now.instant().toString();

if (!source) {
return {
sourceId,
url: "",
success: false,
statusCode: null,
contentType: null,
contentLength: 0,
textLength: 0,
contentHash: null,
previousContentHash: null,
contentChanged: false,
firstFetch: false,
notificationsCreated: 0,
fetchedAt,
error: "NOTIFICATION_SOURCE_NOT_FOUND",
};
}

try {
const response = await fetch(
source.officialUrl,
{
method: "GET",
redirect: "follow",
headers: {
"User-Agent":
"ExamConnect-Bot/1.0",
Accept:
"text/html,application/xhtml+xml,application/pdf,text/plain;q=0.9,*/*;q=0.8",
},
},
);

const contentType =
  response.headers.get("content-type");

const rawContent =
  await response.text();

if (!response.ok) {
  return {
    sourceId: source.id,
    url: source.officialUrl,
    success: false,
    statusCode: response.status,
    contentType,
    contentLength: rawContent.length,
    textLength: 0,
    contentHash: null,
    previousContentHash:
      source.contentHash,
    contentChanged: false,
    firstFetch:
      source.contentHash === null,
    notificationsCreated: 0,
    fetchedAt,
    error:
      "HTTP_" + response.status,
  };
}

const readableText =
  extractReadableText(rawContent);

const contentHash =
  createContentHash(readableText);

const previousContentHash =
  source.contentHash;

const firstFetch =
  previousContentHash === null;

const contentChanged =
  !firstFetch &&
  previousContentHash !== contentHash;

const verifiedAt =
  Temporal.Now.instant();

await db.orm.public.NotificationSource
  .where({
    id: source.id,
  })
  .update({
    contentHash,
    lastVerifiedAt: verifiedAt,
    updatedAt: verifiedAt,
  });

let notificationsCreated = 0;

if (contentChanged) {
  notificationsCreated =
    await createSourceChangeNotifications(
      source.id,
    );

  console.log(
    "[source-ingestion] source changed; notificationsCreated=" +
      notificationsCreated,
  );
}

return {
  sourceId: source.id,
  url: source.officialUrl,
  success: true,
  statusCode: response.status,
  contentType,
  contentLength: rawContent.length,
  textLength: readableText.length,
  contentHash,
  previousContentHash,
  contentChanged,
  firstFetch,
  notificationsCreated,
  fetchedAt,
  error: null,
};

} catch (error) {
return {
sourceId: source.id,
url: source.officialUrl,
success: false,
statusCode: null,
contentType: null,
contentLength: 0,
textLength: 0,
contentHash: null,
previousContentHash:
source.contentHash,
contentChanged: false,
firstFetch:
source.contentHash === null,
notificationsCreated: 0,
fetchedAt,
error:
error instanceof Error
? error.message
: "UNKNOWN_ERROR",
};
}
}
