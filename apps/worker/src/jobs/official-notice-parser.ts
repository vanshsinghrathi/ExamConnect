
export type ParsedOfficialPost = {
  name: string;
  department: string | null;
  vacancies: number | null;
  qualification: string | null;
};

export type ParsedOfficialNotice = {
  examName: string | null;
  notificationIdentifier: string | null;
  notificationDate: string | null;
  conductingBody: string | null;
  examType: string | null;
  description: string | null;
  applicationUrl: string | null;
  applicationStart: string | null;
  applicationEnd: string | null;
  examDate: string | null;
  postName: string | null;
  postCode: string | null;
  ageMin: number | null;
  ageMax: number | null;
  ageAsOf: string | null;
  posts: ParsedOfficialPost[];
  eligibilityRules: Array<{
    name: string;
    ruleType: string;
    conditionField: string;
    operator: string;
    expectedValue: string;
  }>;
};

type Department =
  | "Geological Survey of India"
  | "Central Ground Water Board";

type QualificationTarget = {
  name: string;
  department: Department | null;
};

type QualificationBlock = {
  targets: QualificationTarget[];
  qualification: string;
};

function normalizeWhitespace(
  value: string,
): string {
  return value
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(
  text: string,
): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim();
}

function normalizeLine(
  value: string,
): string {
  return value
    .replace(/[ \t]+/g, " ")
    .trim();
}

function parseDateValue(
  value: string | null,
): string | null {
  if (!value) {
    return null;
  }

  const numericMatch =
    value.match(
      /(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/,
    );

  if (numericMatch) {
    const day =
      numericMatch[1].padStart(2, "0");

    const month =
      numericMatch[2].padStart(2, "0");

    const year =
      numericMatch[3];

    return `${year}-${month}-${day}T00:00:00Z`;
  }

  const writtenMatch =
    value.match(
      /(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December),?\s+(\d{4})/i,
    );

  if (!writtenMatch) {
    return null;
  }

  const months: Record<
    string,
    string
  > = {
    january: "01",
    february: "02",
    march: "03",
    april: "04",
    may: "05",
    june: "06",
    july: "07",
    august: "08",
    september: "09",
    october: "10",
    november: "11",
    december: "12",
  };

  const month =
    months[
      writtenMatch[2].toLowerCase()
    ];

  if (!month) {
    return null;
  }

  const day =
    writtenMatch[1].padStart(2, "0");

  return `${writtenMatch[3]}-${month}-${day}T00:00:00Z`;
}

function parseAge(
  text: string,
): {
  min: number | null;
  max: number | null;
  asOf: string | null;
} {
  const explicitMatch =
    text.match(
      /must have attained the age of\s+(\d+)\s+years and must not have attained the\s+age of\s+(\d+)\s+years/i,
    );

  const asOfMatch =
    text.match(
      /as on\s+1st\s+January,?\s+(\d{4})/i,
    );

  return {
    min: explicitMatch
      ? Number(explicitMatch[1])
      : null,
    max: explicitMatch
      ? Number(explicitMatch[2])
      : null,
    asOf: asOfMatch
      ? `${asOfMatch[1]}-01-01T00:00:00Z`
      : null,
  };
}

/*
 * Convert every known UPSC post heading into one
 * stable canonical name.
 *
 * IMPORTANT:
 * Assistant posts are checked before plain
 * Geologist / Geophysicist / Chemist so that:
 *
 * Assistant Chemist
 * does NOT become:
 * Chemist
 */
function canonicalPostName(
  value: string,
): string | null {
  const cleaned =
    normalizeWhitespace(
      value
        .replace(
          /[`'"]/g,
          "",
        ),
    );

  if (
    /Assistant\s+Hydrogeologist/i.test(
      cleaned,
    )
  ) {
    return "Assistant Hydrogeologist";
  }

  if (
    /Assistant\s*\(\s*Hydrogeologist\s*\)/i.test(
      cleaned,
    )
  ) {
    return "Assistant Hydrogeologist";
  }

  if (
    /Assistant\s+Geophysicist/i.test(
      cleaned,
    )
  ) {
    return "Assistant Geophysicist";
  }

  if (
    /Assistant\s+Geologist/i.test(
      cleaned,
    )
  ) {
    return "Assistant Geologist";
  }

  if (
    /Assistant\s*\(\s*Chemist\s*\)/i.test(
      cleaned,
    )
  ) {
    return "Assistant Chemist";
  }

  if (
    /\bAssistant\s+Chemist\b/i.test(
      cleaned,
    )
  ) {
    return "Assistant Chemist";
  }

  if (
    /Scientist\s+B\s*\(\s*Hydrogeology\s*\)/i.test(
      cleaned,
    )
  ) {
    return "Scientist B Hydrogeology";
  }

  if (
    /Scientist\s+B\s*\(\s*Chemical\s*\)/i.test(
      cleaned,
    )
  ) {
    return "Scientist B Chemical";
  }

  if (
    /Scientist\s+B\s*\(\s*Geophysics\s*\)/i.test(
      cleaned,
    )
  ) {
    return "Scientist B Geophysics";
  }

  if (
    /\bGeophysicist\b/i.test(
      cleaned,
    )
  ) {
    return "Geophysicist";
  }

  if (
    /\bChemist\b/i.test(
      cleaned,
    )
  ) {
    return "Chemist";
  }

  if (
    /\bGeologist\b/i.test(
      cleaned,
    )
  ) {
    return "Geologist";
  }

  return null;
}

function normalizePostForMatching(
  value: string,
): string {
  const canonical =
    canonicalPostName(value);

  return normalizeWhitespace(
    (
      canonical ??
      value
    )
      .replace(
        /[`'"]/g,
        "",
      )
      .toLowerCase(),
  );
}

function detectDepartment(
  text: string,
): Department | null {
  const normalized =
    normalizeWhitespace(
      text.replace(
        /[`'"]/g,
        "",
      ),
    );

  if (
    /Geological Survey of India/i.test(
      normalized,
    ) ||
    /\bGSI\b/i.test(
      normalized,
    )
  ) {
    return "Geological Survey of India";
  }

  if (
    /Central Ground Water Board/i.test(
      normalized,
    ) ||
    /\bC\.G\.W\.B\./i.test(
      normalized,
    ) ||
    /\bCGWB\b/i.test(
      normalized,
    )
  ) {
    return "Central Ground Water Board";
  }

  return null;
}

function extractPostOccurrences(
  heading: string,
): Array<{
  name: string;
  index: number;
}> {
  const patterns: Array<{
    pattern: RegExp;
    canonical: string;
  }> = [
    {
      pattern:
        /Scientist\s+B\s*\(\s*Hydrogeology\s*\)/i,
      canonical:
        "Scientist B Hydrogeology",
    },
    {
      pattern:
        /Scientist\s+B\s*\(\s*Chemical\s*\)/i,
      canonical:
        "Scientist B Chemical",
    },
    {
      pattern:
        /Scientist\s+B\s*\(\s*Geophysics\s*\)/i,
      canonical:
        "Scientist B Geophysics",
    },
    {
      pattern:
        /Assistant\s*\(\s*Hydrogeologist\s*\)/i,
      canonical:
        "Assistant Hydrogeologist",
    },
    {
      pattern:
        /Assistant\s+Hydrogeologist/i,
      canonical:
        "Assistant Hydrogeologist",
    },
    {
      pattern:
        /Assistant\s*\(\s*Chemist\s*\)/i,
      canonical:
        "Assistant Chemist",
    },
    {
      pattern:
        /Assistant\s+Chemist/i,
      canonical:
        "Assistant Chemist",
    },
    {
      pattern:
        /Assistant\s+Geophysicist/i,
      canonical:
        "Assistant Geophysicist",
    },
    {
      pattern:
        /Assistant\s+Geologist/i,
      canonical:
        "Assistant Geologist",
    },
    {
      pattern:
        /\bGeophysicist\b/i,
      canonical:
        "Geophysicist",
    },
    {
      pattern:
        /\bChemist\b/i,
      canonical:
        "Chemist",
    },
    {
      pattern:
        /\bGeologist\b/i,
      canonical:
        "Geologist",
    },
  ];

  const occurrences: Array<{
    name: string;
    index: number;
  }> = [];

  for (
    const item of patterns
  ) {
    const match =
      item.pattern.exec(
        heading,
      );

    if (!match) {
      continue;
    }

    occurrences.push({
      name:
        item.canonical,
      index:
        match.index,
    });
  }

  return occurrences.sort(
    (a, b) =>
      a.index - b.index,
  );
}

function parseQualificationTargets(
  heading: string,
): QualificationTarget[] {
  const occurrences =
    extractPostOccurrences(
      heading,
    );

  const targets:
    QualificationTarget[] = [];

  for (
    let i = 0;
    i < occurrences.length;
    i++
  ) {
    const occurrence =
      occurrences[i];

    const nextIndex =
      occurrences[i + 1]?.index ??
      heading.length;

    const segment =
      heading.slice(
        occurrence.index,
        nextIndex,
      );

    /*
     * Example:
     *
     * Geophysicist Group A in GSI
     *
     * and
     *
     * Scientist B (Geophysics)
     * Group A in C.G.W.B.
     *
     * Looking at the segment belonging
     * to each post allows us to assign
     * the correct department.
     */
    let department =
      detectDepartment(
        segment,
      );

    /*
     * Sometimes the department is at
     * the beginning of the segment because
     * the PDF wraps text strangely.
     *
     * Look backwards a little as fallback.
     */
    if (!department) {
      const previousStart =
        Math.max(
          0,
          occurrence.index - 80,
        );

      const previousText =
        heading.slice(
          previousStart,
          occurrence.index,
        );

      department =
        detectDepartment(
          previousText,
        );
    }

    const alreadyExists =
      targets.some(
        (target) =>
          normalizePostForMatching(
            target.name,
          ) ===
            normalizePostForMatching(
              occurrence.name,
            ) &&
          target.department ===
            department,
      );

    if (!alreadyExists) {
      targets.push({
        name:
          occurrence.name,
        department,
      });
    }
  }

  return targets;
}

function looksLikeQualificationStart(
  line: string,
): boolean {
  return /^(?:Master|Master's|M\.Sc\.|M\. Sc\.|Integrated|Bachelor|B\.Sc\.|B\.Tech\.|Degree|M\.S\.|M\.Tech\.|Ph\.D\.)\b/i.test(
    line,
  );
}

function isQualificationHeadingContinuation(
  line: string,
): boolean {
  return (
    /Group\s+[`'"]?[AB][`'"]?/i.test(
      line,
    ) ||
    /\b(?:in|under)\s+(?:Geological Survey of India|GSI|Central Ground Water Board|C\.G\.W\.B\.|CGWB)\b/i.test(
      line,
    ) ||
    /^(?:Geophysics|Chemical|Hydrogeology|Hydrogeologist)\)/i.test(
      line,
    )
  );
}

function cleanQualification(
  value: string,
): string {
  let result =
    normalizeWhitespace(value);

  /*
   * Remove PDF extraction artefacts
   * that belong to the heading rather
   * than the qualification.
   */
  result =
    result
      .replace(
        /^.*?\bGroup\s+[`'"]?[AB][`'"]?\s+(?:in|under)\s+(?:C\.G\.W\.B\.|CGWB|Central Ground Water Board)\s*/i,
        "",
      )
      .replace(
        /^.*?\bGroup\s+[`'"]?[AB][`'"]?\s+(?:in|under)\s+(?:Geological Survey of India|GSI)\s*/i,
        "",
      )
      .replace(
        /^.*?\b(?:in|under)\s+(?:C\.G\.W\.B\.|CGWB|Central Ground Water Board)\s*/i,
        "",
      )
      .replace(
        /^.*?\b(?:in|under)\s+(?:Geological Survey of India|GSI)\s*/i,
        "",
      )
      .replace(
        /^`?B['’]?\s+in\s+C\.G\.W\.B\.\s*/i,
        "",
      )
      .replace(
        /^`?B['’]?\s+under\s+C\.G\.W\.B\.\s*/i,
        "",
      )
      .replace(
        /^12\s+/,
        "",
      );

  return result.trim();
}

function parseVacancyLines(
  text: string,
): ParsedOfficialPost[] {
  const lines =
    text
      .split("\n")
      .map(normalizeLine)
      .filter(Boolean);

  const result:
    ParsedOfficialPost[] = [];

  const vacancyStart =
    lines.findIndex(
      (line) =>
        /categories of posts to which recruitment is to be made/i.test(
          line,
        ),
    );

  const qualificationStart =
    lines.findIndex(
      (line) =>
        /minimum educational qualifications/i.test(
          line,
        ),
    );

  if (
    vacancyStart === -1 ||
    qualificationStart === -1
  ) {
    return result;
  }

  let currentDepartment:
    Department | null = null;

  const vacancySection =
    lines.slice(
      vacancyStart,
      qualificationStart,
    );

  for (
    const line of vacancySection
  ) {
    if (
      /^Category-I\b/i.test(
        line,
      )
    ) {
      currentDepartment =
        "Geological Survey of India";
      continue;
    }

    if (
      /^Category-II\b/i.test(
        line,
      )
    ) {
      currentDepartment =
        "Central Ground Water Board";
      continue;
    }

    const match =
      line.match(
        /^\(?[ivx]+\)?\s+(.+?)\s*:\s*(\d+)\s*$/i,
      );

    if (!match) {
      continue;
    }

    const name =
      canonicalPostName(
        match[1],
      );

    if (!name) {
      continue;
    }

    result.push({
      name,
      department:
        currentDepartment,
      vacancies:
        Number(match[2]),
      qualification: null,
    });
  }

  return result;
}

function parseQualificationBlocks(
  lines: string[],
  startIndex: number,
  endIndex: number,
): QualificationBlock[] {
  const section =
    lines.slice(
      startIndex + 1,
      endIndex,
    );

  const blocks:
    QualificationBlock[] = [];

  let index = 0;

  while (
    index < section.length
  ) {
    const headingMatch =
      section[index].match(
        /^\(([ivx]+)\)\s+For\s+(.+)$/i,
      );

    if (!headingMatch) {
      index++;
      continue;
    }

    let headingText =
      headingMatch[2];

    let cursor =
      index + 1;

    /*
     * Collect wrapped heading lines
     * until the actual qualification begins.
     */
    while (
      cursor < section.length
    ) {
      const line =
        section[cursor];

      if (
        /^\(([ivx]+)\)\s+For\s+/i.test(
          line,
        )
      ) {
        break;
      }

      if (
        /^NOTE\b/i.test(
          line,
        )
      ) {
        break;
      }

      if (
        looksLikeQualificationStart(
          line,
        )
      ) {
        break;
      }

      if (
        isQualificationHeadingContinuation(
          line,
        )
      ) {
        headingText =
          `${headingText} ${line}`;

        cursor++;
        continue;
      }

      /*
       * If the line contains another
       * known post name, it is very likely
       * a wrapped heading even when the
       * department wording is not present.
       */
      if (
        canonicalPostName(
          line,
        )
      ) {
        headingText =
          `${headingText} ${line}`;

        cursor++;
        continue;
      }

      break;
    }

    const targets =
      parseQualificationTargets(
        headingText,
      );

    const qualificationLines:
      string[] = [];

    while (
      cursor < section.length
    ) {
      const line =
        section[cursor];

      if (
        /^\(([ivx]+)\)\s+For\s+/i.test(
          line,
        )
      ) {
        break;
      }

      if (
        /^NOTE\b/i.test(
          line,
        )
      ) {
        break;
      }

      if (
        /^IV\.\s*PHYSICAL STANDARDS/i.test(
          line,
        )
      ) {
        break;
      }

      qualificationLines.push(
        line,
      );

      cursor++;
    }

    const qualification =
      cleanQualification(
        qualificationLines.join(
          " ",
        ),
      );

    if (
      targets.length > 0 &&
      qualification.length > 0
    ) {
      blocks.push({
        targets,
        qualification,
      });
    }

    index =
      Math.max(
        cursor,
        index + 1,
      );
  }

  /*
   * Safety fallback:
   *
   * The UPSC Geo-Scientist notice has
   * seven qualification groups. If PDF
   * extraction fails to preserve the
   * wrapped headings correctly, these
   * well-defined groups can still be
   * recovered from the actual post names.
   *
   * We only use this fallback for a
   * missing post, never to overwrite a
   * successfully parsed qualification.
   */

  return blocks;
}

function applyQualificationBlocks(
  posts: ParsedOfficialPost[],
  blocks: QualificationBlock[],
): void {
  for (
    const post of posts
  ) {
    const normalizedPostName =
      normalizePostForMatching(
        post.name,
      );

    const matchingBlocks =
      blocks.filter(
        (block) =>
          block.targets.some(
            (target) =>
              normalizePostForMatching(
                target.name,
              ) ===
                normalizedPostName &&
              (
                target.department ===
                  post.department ||
                target.department ===
                  null
              ),
          ),
      );

    /*
     * Prefer an exact department match.
     */
    const exactMatch =
      matchingBlocks.find(
        (block) =>
          block.targets.some(
            (target) =>
              normalizePostForMatching(
                target.name,
              ) ===
                normalizedPostName &&
              target.department ===
                post.department,
          ),
      );

    const fallbackMatch =
      matchingBlocks[0];

    const selected =
      exactMatch ??
      fallbackMatch ??
      null;

    if (selected) {
      post.qualification =
        selected.qualification;
    }
  }
}

function applyKnownGeoScientistFallbacks(
  posts: ParsedOfficialPost[],
): void {
  /*
   * These are the seven qualification
   * groups present in the Geo-Scientist
   * Examination notice.
   *
   * They are deliberately applied only
   * when the normal block parser did not
   * populate a post.
   */

  const findPost = (
    name: string,
    department: Department,
  ) =>
    posts.find(
      (post) =>
        normalizePostForMatching(
          post.name,
        ) ===
          normalizePostForMatching(
            name,
          ) &&
        post.department ===
          department,
    );

  const geologist =
    findPost(
      "Geologist",
      "Geological Survey of India",
    );

  const geophysicist =
    findPost(
      "Geophysicist",
      "Geological Survey of India",
    );

  const chemist =
    findPost(
      "Chemist",
      "Geological Survey of India",
    );

  const assistantGeologist =
    findPost(
      "Assistant Geologist",
      "Geological Survey of India",
    );

  const assistantGeophysicist =
    findPost(
      "Assistant Geophysicist",
      "Geological Survey of India",
    );

  const assistantChemist =
    findPost(
      "Assistant Chemist",
      "Geological Survey of India",
    );

  const scientistHydrogeology =
    findPost(
      "Scientist B Hydrogeology",
      "Central Ground Water Board",
    );

  const scientistChemical =
    findPost(
      "Scientist B Chemical",
      "Central Ground Water Board",
    );

  const scientistGeophysics =
    findPost(
      "Scientist B Geophysics",
      "Central Ground Water Board",
    );

  const assistantHydrogeologist =
    findPost(
      "Assistant Hydrogeologist",
      "Central Ground Water Board",
    );

  const cgwbAssistantChemist =
    findPost(
      "Assistant Chemist",
      "Central Ground Water Board",
    );

  const cgwbAssistantGeophysicist =
    findPost(
      "Assistant Geophysicist",
      "Central Ground Water Board",
    );

  /*
   * We cannot safely invent the full
   * text here. These fallbacks only
   * connect already-parsed blocks by
   * stream when another member of the
   * same official qualification group
   * was successfully extracted.
   */

  const copyQualification =
    (
      source:
        ParsedOfficialPost | undefined,
      target:
        ParsedOfficialPost | undefined,
    ) => {
      if (
        source?.qualification &&
        target &&
        !target.qualification
      ) {
        target.qualification =
          source.qualification;
      }
    };

  /*
   * Hydrogeology group:
   * Scientist B (Hydrogeology) +
   * Assistant Hydrogeologist
   */
  copyQualification(
    scientistHydrogeology,
    assistantHydrogeologist,
  );

  copyQualification(
    assistantHydrogeologist,
    scientistHydrogeology,
  );

  /*
   * Chemistry group:
   * Chemist + Scientist B (Chemical)
   *
   * Only use this if the official
   * parser already recovered the
   * Chemist qualification.
   */
  copyQualification(
    chemist,
    scientistChemical,
  );

  copyQualification(
    scientistChemical,
    chemist,
  );

  /*
   * Geophysics group:
   * Geophysicist +
   * Scientist B (Geophysics)
   */
  copyQualification(
    geophysicist,
    scientistGeophysics,
  );

  copyQualification(
    scientistGeophysics,
    geophysicist,
  );

  /*
   * Chemistry assistant pair.
   */
  copyQualification(
    assistantChemist,
    cgwbAssistantChemist,
  );

  copyQualification(
    cgwbAssistantChemist,
    assistantChemist,
  );

  /*
   * Geophysics assistant pair.
   */
  copyQualification(
    assistantGeophysicist,
    cgwbAssistantGeophysicist,
  );

  copyQualification(
    cgwbAssistantGeophysicist,
    assistantGeophysicist,
  );

  /*
   * Keep these variables referenced so
   * the mapping stays explicit and easy
   * to extend later when additional
   * official qualification blocks are
   * added.
   */
  void geologist;
  void assistantGeologist;
}

function parseQualifications(
  text: string,
  posts: ParsedOfficialPost[],
): ParsedOfficialPost[] {
  const lines =
    text
      .split("\n")
      .map(normalizeLine)
      .filter(Boolean);

  const startIndex =
    lines.findIndex(
      (line) =>
        /minimum educational qualifications/i.test(
          line,
        ),
    );

  if (startIndex === -1) {
    return posts;
  }

  const physicalStandardsIndex =
    lines.findIndex(
      (line, index) =>
        index > startIndex &&
        /^IV\.\s*PHYSICAL STANDARDS/i.test(
          line,
        ),
    );

  const endIndex =
    physicalStandardsIndex === -1
      ? lines.length
      : physicalStandardsIndex;

  const blocks =
    parseQualificationBlocks(
      lines,
      startIndex,
      endIndex,
    );

  applyQualificationBlocks(
    posts,
    blocks,
  );

  applyKnownGeoScientistFallbacks(
    posts,
  );

  return posts;
}

function parseApplicationUrl(
  text: string,
): string | null {
  if (
    /upsconline\.nic\.in/i.test(
      text,
    )
  ) {
    return "https://upsconline.nic.in";
  }

  for (
    const token of text.split(
      /\s+/,
    )
  ) {
    if (
      token.startsWith(
        "https://",
      ) ||
      token.startsWith(
        "http://",
      )
    ) {
      return token
        .replace(
          /[.,;]+$/,
          "",
        )
        .replace(
          /[)\]]+$/,
          "",
        );
    }
  }

  return null;
}

export function parseOfficialNotice(
  text: string,
): ParsedOfficialNotice {
  const normalizedText =
    normalizeText(text);

  const lines =
    normalizedText
      .split("\n")
      .map(normalizeLine)
      .filter(Boolean);

  let examName:
    string | null = null;

  for (
    const line of lines.slice(
      0,
      20,
    )
  ) {
    if (
      /EXAMINATION/i.test(
        line,
      ) &&
      !/^EXAMINATION NOTICE/i.test(
        line,
      ) &&
      line.length < 150
    ) {
      examName =
        line;
      break;
    }
  }

  const notificationIdentifierMatch =
    normalizedText.match(
      /EXAMINATION NOTICE\s*(?:NO\.?|NUMBER)?\s*([A-Z0-9./-]+)/i,
    );

  const notificationDateMatch =
    normalizedText.match(
      /Date of Notification(?: of Examination)?\s+(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})/i,
    );

  const applicationEndMatch =
    normalizedText.match(
      /Last date for filling up of Application\s+(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})/i,
    );

  const preliminaryExamMatch =
    normalizedText.match(
      /Date of \(Preliminary\) Examination\s+(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})/i,
    );

  const conductingBody =
    /Union Public Service Commission/i.test(
      normalizedText,
    )
      ? "Union Public Service Commission"
      : null;

  const applicationUrl =
    parseApplicationUrl(
      normalizedText,
    );

  const age =
    parseAge(
      normalizedText,
    );

  let posts =
    parseVacancyLines(
      normalizedText,
    );

  posts =
    parseQualifications(
      normalizedText,
      posts,
    );

  const eligibilityRules:
    ParsedOfficialNotice["eligibilityRules"] =
    [];

  if (
    age.min !== null &&
    age.max !== null
  ) {
    eligibilityRules.push({
      name:
        "Age Requirement",
      ruleType: "AGE",
      conditionField: "age",
      operator: "BETWEEN",
      expectedValue:
        `${age.min}-${age.max}${
          age.asOf
            ? ` as of ${age.asOf.slice(0, 10)}`
            : ""
        }`,
    });
  }

  return {
    examName,

    notificationIdentifier:
      notificationIdentifierMatch
        ? notificationIdentifierMatch[1]
        : null,

    notificationDate:
      parseDateValue(
        notificationDateMatch
          ? notificationDateMatch[1]
          : null,
      ),

    conductingBody,

    examType:
      "Government Recruitment Examination",

    description:
      examName
        ? `${examName} official notification`
        : null,

    applicationUrl,

    applicationStart:
      parseDateValue(
        notificationDateMatch
          ? notificationDateMatch[1]
          : null,
      ),

    applicationEnd:
      parseDateValue(
        applicationEndMatch
          ? applicationEndMatch[1]
          : null,
      ),

    examDate:
      parseDateValue(
        preliminaryExamMatch
          ? preliminaryExamMatch[1]
          : null,
      ),

    postName:
      posts.length === 1
        ? posts[0].name
        : null,

    postCode: null,

    ageMin: age.min,
    ageMax: age.max,
    ageAsOf: age.asOf,

    posts,

    eligibilityRules,
  };
}
