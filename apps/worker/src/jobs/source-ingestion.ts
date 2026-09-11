import { createHash } from "node:crypto";
import { Temporal } from "@js-temporal/polyfill";
import { db } from "@examconnect/database";

import { parseOfficialNotice } from "./official-notice-parser.js";
import { applyParsedOfficialNotice } from "./official-notice-applier.js";

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
rulesCreated: number;
rulesUpdated: number;
examId: number | null;
postId: number | null;
deadlineId: number | null;
parsedExamName: string | null;
parsedApplicationEnd: string | null;
parsedExamDate: string | null;
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
.replace(/ /gi, " ")
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
  rule.examId +
  ":" +
  (rule.postId ?? "exam");

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

type FetchResult = {
response: Response;
rawContent: string;
};

async function fetchOfficialSource(
url: string,
): Promise<FetchResult> {
const headers = {
"User-Agent":
"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
Accept:
"text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf,text/plain;q=0.8,*/*;q=0.7",
"Accept-Language":
"en-IN,en;q=0.9",
"Cache-Control":
"no-cache",
Pragma:
"no-cache",
"Upgrade-Insecure-Requests":
"1",
Referer:
"https://www.upsc.gov.in/",
};

let response = await fetch(url, {
method: "GET",
redirect: "follow",
headers,
});

let rawContent = await response.text();

if (response.status === 403) {
console.log(
"[source-ingestion] received HTTP 403; retrying with browser headers",
);

response = await fetch(url, {
  method: "GET",
  redirect: "follow",
  headers: {
    ...headers,
    Referer: url,
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-User": "?1",
  },
});

rawContent = await response.text();

}

return {
response,
rawContent,
};
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
rulesCreated: 0,
rulesUpdated: 0,
examId: null,
postId: null,
deadlineId: null,
parsedExamName: null,
parsedApplicationEnd: null,
parsedExamDate: null,
fetchedAt,
error: "NOTIFICATION_SOURCE_NOT_FOUND",
};
}

try {
const fetchResult =
await fetchOfficialSource(
source.officialUrl,
);

const response = fetchResult.response;
const rawContent = fetchResult.rawContent;

const contentType =
  response.headers.get("content-type");

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
    rulesCreated: 0,
    rulesUpdated: 0,
    examId: null,
    postId: null,
    deadlineId: null,
    parsedExamName: null,
    parsedApplicationEnd: null,
    parsedExamDate: null,
    fetchedAt,
    error:
      "HTTP_" + response.status,
  };
}

const readableText =
  extractReadableText(rawContent);

const parsedNotice =
  parseOfficialNotice(readableText);

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
let rulesCreated = 0;
let rulesUpdated = 0;
let examId: number | null = null;
let postId: number | null = null;
let deadlineId: number | null = null;

const shouldApplyNotice =
  firstFetch || contentChanged;

if (
  shouldApplyNotice &&
  parsedNotice.examName &&
  parsedNotice.conductingBody
) {
  const applyResult =
    await applyParsedOfficialNotice(
      source.id,
      parsedNotice,
    );

  if (!applyResult.skipped) {
    examId = applyResult.examId;
    postId = applyResult.postId;
    deadlineId = applyResult.deadlineId;
    rulesCreated =
      applyResult.rulesCreated;
    rulesUpdated =
      applyResult.rulesUpdated;
  }

  console.log(
    "[source-ingestion] parsed notice applied; examId=" +
      (examId ?? "none") +
      " postId=" +
      (postId ?? "none") +
      " deadlineId=" +
      (deadlineId ?? "none") +
      " rulesCreated=" +
      rulesCreated +
      " rulesUpdated=" +
      rulesUpdated,
  );
}

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
  rulesCreated,
  rulesUpdated,
  examId,
  postId,
  deadlineId,
  parsedExamName:
    parsedNotice.examName,
  parsedApplicationEnd:
    parsedNotice.applicationEnd,
  parsedExamDate:
    parsedNotice.examDate,
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
rulesCreated: 0,
rulesUpdated: 0,
examId: null,
postId: null,
deadlineId: null,
parsedExamName: null,
parsedApplicationEnd: null,
parsedExamDate: null,
fetchedAt,
error:
error instanceof Error
? error.message
: "UNKNOWN_ERROR",
};
}
}
