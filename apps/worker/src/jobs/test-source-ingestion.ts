import { ingestNotificationSource } from "./source-ingestion.js";

async function main() {
  const result =
    await ingestNotificationSource(2);

  console.log("Source ingestion result:");
  console.log(result);

  if (result.success) {
    console.log(
      "Readable content was extracted successfully.",
    );

    console.log(
      "Content hash:",
      result.contentHash,
    );
  } else {
    process.exitCode = 1;
  }
}

await main();