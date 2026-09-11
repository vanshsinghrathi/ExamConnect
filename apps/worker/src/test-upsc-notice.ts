import { readFile } from "node:fs/promises";
import { parseOfficialNotice } from "./jobs/official-notice-parser.js";

const text = await readFile(
  "C:/Users/vansh rathi/OneDrive/Desktop/ExamConnect/apps/worker/tmp-upsc-notification.txt",
  "utf8",
);

const parsed = parseOfficialNotice(text);

console.log("\n=== Parsed UPSC PDF Notice ===");

console.log(
  JSON.stringify(
    parsed,
    null,
    2,
  ),
);