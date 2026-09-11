
import { readFile } from "node:fs/promises";
import { parseOfficialNotice } from "./official-notice-parser.js";
import { applyParsedOfficialNotice } from "./official-notice-applier.js";

const noticePath = new URL(
  "../../tmp-upsc-notification.txt",
  import.meta.url,
);

async function main() {
  const noticeText = await readFile(
    noticePath,
    "utf8",
  );

  console.log(
    "=== Reading official UPSC notice ===",
  );

  const parsed = parseOfficialNotice(
    noticeText,
  );

  console.log(
    "\n=== Parsed notice ===",
  );

  console.log(
    JSON.stringify(
      parsed,
      null,
      2,
    ),
  );

  if (!parsed.examName) {
    throw new Error(
      "Parser did not extract examName.",
    );
  }

  if (!parsed.conductingBody) {
    throw new Error(
      "Parser did not extract conductingBody.",
    );
  }

  if (parsed.posts.length === 0) {
    throw new Error(
      "Parser did not extract any posts.",
    );
  }

  console.log(
    `\nExam: ${parsed.examName}`,
  );

  console.log(
    `Conducting body: ${parsed.conductingBody}`,
  );

  console.log(
    `Posts found: ${parsed.posts.length}`,
  );

  console.log(
    "\n=== Applying official notice ===",
  );

  const result =
    await applyParsedOfficialNotice(
      1,
      parsed,
    );

  console.log(
    "\n=== Applied notice result ===",
  );

  console.log(
    JSON.stringify(
      result,
      null,
      2,
    ),
  );
}

await main();
