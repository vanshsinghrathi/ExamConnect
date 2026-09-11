const url =
  "https://www.upsc.gov.in/examinations/Combined%20Geo-Scientist%20%28Preliminary%29%20Examination%2C%202027";

const response = await fetch(url, {
  method: "GET",
  redirect: "follow",
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
    "Accept-Language":
      "en-IN,en;q=0.9",
    Referer:
      "https://www.upsc.gov.in/",
  },
});

console.log("HTTP status:", response.status);

if (!response.ok) {
  console.error(
    "UPSC request failed:",
    response.status,
  );
  process.exit(1);
}

const html = await response.text();

console.log("HTML length:", html.length);

const anchorRegex =
  /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

console.log("\n=== Links on examination page ===");

let count = 0;

for (const match of html.matchAll(anchorRegex)) {
  const href = match[1];
  const rawText = match[2];

  if (!href || !rawText) {
    continue;
  }

  const title = rawText
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!title) {
    continue;
  }

  let absoluteUrl: string;

  try {
    absoluteUrl = new URL(
      href,
      url,
    ).toString();
  } catch {
    continue;
  }

  const lower = title.toLowerCase();

  if (
    lower.includes("notice") ||
    lower.includes("download") ||
    lower.includes("notification") ||
    absoluteUrl.toLowerCase().includes(".pdf")
  ) {
    count++;

    console.log(`\n${count}. ${title}`);
    console.log(`   ${absoluteUrl}`);
  }
}

console.log("\nTotal matching links:", count);