import { ingestNotificationSource } from "./jobs/source-ingestion.js";

const SOURCE_ID = 1;

console.log(
`[test] starting source ingestion for sourceId=${SOURCE_ID}`,
);

const result =
await ingestNotificationSource(SOURCE_ID);

console.log("\n=== Source Ingestion Result ===");

console.log(
JSON.stringify(
result,
null,
2,
),
);

if (!result.success) {
console.error(
"\n[test] source ingestion failed:",
result.error,
);

process.exitCode = 1;
} else {
console.log(
"\n[test] source ingestion succeeded.",
);
}
