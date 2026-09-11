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
console.log(
"Content-Length:",
response.headers.get("content-length"),
);

if (!response.ok) {
const body = await response.text();

console.error(
"PDF request failed. Response length:",
body.length,
);

process.exit(1);
}

const buffer = await response.arrayBuffer();

console.log(
"Downloaded bytes:",
buffer.byteLength,
);

const bytes = new Uint8Array(buffer);

const header = new TextDecoder()
.decode(bytes.slice(0, 20));

console.log(
"File header:",
JSON.stringify(header),
);

console.log(
"\nPDF download test succeeded.",
);
