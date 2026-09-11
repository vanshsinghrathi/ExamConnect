import { discoverUpscNotices } from "./jobs/upsc-discovery.js";

const response = await fetch(
  "https://www.upsc.gov.in",
  {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
      "Accept-Language":
        "en-IN,en;q=0.9",
    },
  },
);

if (!response.ok) {
  throw new Error(
    `UPSC request failed: HTTP ${response.status}`,
  );
}

const html = await response.text();

const notices = discoverUpscNotices(
  html,
  "https://www.upsc.gov.in",
);

console.log(
  "\n=== UPSC Discovered Notices ===",
);

console.log(
  "Total notices:",
  notices.length,
);

for (const [index, notice] of notices.entries()) {
  console.log(
    `\n${index + 1}. ${notice.title}`,
  );

  console.log(
    `   ${notice.url}`,
  );
}