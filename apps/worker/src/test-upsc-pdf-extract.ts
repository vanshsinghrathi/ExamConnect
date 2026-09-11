import { writeFile } from "node:fs/promises";

const url =
"https://www.upsc.gov.in/sites/default/files/Notif-CGSPE-2027-Engl-020926.pdf";

const response = await fetch(url, {
method: "GET",
redirect: "follow",
headers: {
"User-Agent":
"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
Accept:
"application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
"Accept-Language":
"en-IN,en;q=0.9",
Referer:
"https://www.upsc.gov.in/",
},
});

console.log("HTTP status:", response.status);
console.log(
"Content-Type:",
response.headers.get("content-type"),
);

if (!response.ok) {
throw new Error(
`PDF download failed: HTTP ${response.status}`,
);
}

const buffer = Buffer.from(
await response.arrayBuffer(),
);

const pdfPath =
"C:/Users/vansh rathi/OneDrive/Desktop/ExamConnect/apps/worker/tmp-upsc-notification.pdf";

await writeFile(pdfPath, buffer);

console.log(
"PDF saved to:",
pdfPath,
);

console.log(
"PDF size:",
buffer.length,
"bytes",
);

console.log(
"Next step: extract text from the saved PDF.",
);
