type DiscoveredNotice = {
title: string;
url: string;
};

function normalizeWhitespace(value: string): string {
return value.replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value: string): string {
return value
.replace(/&/gi, "&")
.replace(/"/gi, '"')
.replace(/'/gi, "'")
.replace(/</gi, "<")
.replace(/>/gi, ">");
}

function stripHtml(value: string): string {
return normalizeWhitespace(
decodeHtmlEntities(
value.replace(/<[^>]*>/g, " "),
),
);
}

function isExamNotification(title: string): boolean {
const normalized = title
.toLowerCase()
.trim();

if (
normalized === "examination" ||
normalized === "active examinations" ||
normalized === "forthcoming examinations" ||
normalized === "examination notifications" ||
normalized === "admit cards" ||
normalized === "written results" ||
normalized === "final results"
) {
return false;
}

const excludedPrefixes = [
"final result:",
"written result:",
"written result (",
"marks of recommended candidates",
"interview schedule:",
"examination time table:",
"e - admit card:",
"e-admit card:",
"press note:",
"addendum notice:",
"attention :",
"attention:",
];

for (const prefix of excludedPrefixes) {
if (normalized.startsWith(prefix)) {
return false;
}
}

return (
normalized.startsWith("exam notification:") ||
normalized.startsWith("notice:")
);
}

export function discoverUpscNotices(
html: string,
baseUrl: string,
): DiscoveredNotice[] {
const results: DiscoveredNotice[] = [];

const parts = html.split("<a");

for (let i = 1; i < parts.length; i++) {
const part = parts[i];

const endIndex = part.indexOf("</a>");

if (endIndex === -1) {
  continue;
}

const anchorContent =
  part.slice(0, endIndex);

const hrefMarker = "href=";
const hrefIndex =
  anchorContent.indexOf(hrefMarker);

if (hrefIndex === -1) {
  continue;
}

const hrefStart =
  hrefIndex + hrefMarker.length;

const quote =
  anchorContent[hrefStart];

if (
  quote !== '"' &&
  quote !== "'"
) {
  continue;
}

const hrefEnd =
  anchorContent.indexOf(
    quote,
    hrefStart + 1,
  );

if (hrefEnd === -1) {
  continue;
}

const href =
  anchorContent.slice(
    hrefStart + 1,
    hrefEnd,
  );

const titleStart =
  anchorContent.indexOf(">");

if (titleStart === -1) {
  continue;
}

const rawTitle =
  anchorContent.slice(
    titleStart + 1,
  );

const title =
  stripHtml(rawTitle);

if (!title || !href) {
  continue;
}

if (!isExamNotification(title)) {
  continue;
}

let url: string;

try {
  url = new URL(
    href,
    baseUrl,
  ).toString();
} catch {
  continue;
}

if (!url.includes("upsc.gov.in")) {
  continue;
}

const alreadyExists =
  results.some(
    (item) => item.url === url,
  );

if (alreadyExists) {
  continue;
}

results.push({
  title,
  url,
});

}

return results;
}
