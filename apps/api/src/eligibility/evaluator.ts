
import { Temporal } from "@js-temporal/polyfill";

export type EligibilityStudent = {
  profile: {
    category: string | null;
    state: string | null;
    dateOfBirth: string | null;
  };
  education: Array<{
    qualification: string;
    percentage: number | null;
    passingYear: number | null;
    stream: string | null;
  }>;
};

export type EligibilityRule = {
  name: string;
  conditionField: string;
  operator: string;
  expectedValue: string;
  qualificationRequirement?: string | null;
};

export type EligibilityResult = {
  eligible: boolean;
  reasons: string[];
};

function normalizeText(
  value: string | null | undefined,
): string {
  return (value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeQualification(
  value: string,
): string {
  const normalized = normalizeText(value)
    .replace(/\./g, "")
    .replace(/\s+/g, " ");

  const aliases: Record<string, string> = {
    ba: "ba",
    "b a": "ba",
    "bachelor of arts": "ba",

    bsc: "bsc",
    "b sc": "bsc",
    "bachelor of science": "bsc",

    bcom: "bcom",
    "b com": "bcom",
    "bachelor of commerce": "bcom",

    btech: "btech",
    "b tech": "btech",
    "bachelor of technology": "btech",

    bvoc: "bvoc",
    "b voc": "bvoc",
    "bachelor of vocational studies": "bvoc",
  };

  return aliases[normalized] ?? normalized;
}

function compareNumbers(
  actual: number,
  operator: string,
  expected: number,
): boolean {
  switch (operator.trim()) {
    case ">=":
      return actual >= expected;

    case "<=":
      return actual <= expected;

    case ">":
      return actual > expected;

    case "<":
      return actual < expected;

    case "=":
    case "==":
    case "EQUALS":
      return actual === expected;

    default:
      return false;
  }
}

function compareText(
  actual: string,
  operator: string,
  expected: string,
): boolean {
  const normalizedActual =
    normalizeText(actual);

  const normalizedExpected = expected
    .split(",")
    .map((value) =>
      normalizeText(value),
    );

  switch (operator.trim()) {
    case "IN":
      return normalizedExpected.includes(
        normalizedActual,
      );

    case "=":
    case "==":
    case "EQUALS":
      return (
        normalizedActual ===
        normalizeText(expected)
      );

    default:
      return false;
  }
}

function calculateAge(
  dateOfBirth: string,
  asOfDate?: string,
): number {
  const birthDate = Temporal.Instant
    .from(dateOfBirth)
    .toZonedDateTimeISO("Asia/Kolkata")
    .toPlainDate();

  const targetDate = asOfDate
    ? Temporal.PlainDate.from(asOfDate)
    : Temporal.Now
        .zonedDateTimeISO("Asia/Kolkata")
        .toPlainDate();

  let age =
    targetDate.year - birthDate.year;

  const birthdayOnTargetDate =
    birthDate.add({
      years: age,
    });

  if (
    Temporal.PlainDate.compare(
      targetDate,
      birthdayOnTargetDate,
    ) < 0
  ) {
    age -= 1;
  }

  return age;
}

function qualificationSatisfiesRequirement(
  education: EligibilityStudent["education"],
  requirement: string,
): boolean {
  const normalizedRequirement =
    normalizeText(requirement)
      .replace(/[.,()]/g, " ")
      .replace(/'/g, "")
      .replace(/\s+/g, " ")
      .trim();

  /*
   * Subject aliases used in government
   * qualification descriptions.
   */
  const subjectAliases: Record<
    string,
    string[]
  > = {
    geology: [
      "geology",
      "geological science",
      "applied geology",
      "marine geology",
      "earth science",
      "geo exploration",
      "mineral exploration",
      "hydrogeology",
    ],

    geophysics: [
      "geophysics",
      "geophysicist",
      "exploration geophysics",
      "applied geophysics",
      "marine geophysics",
      "geo exploration",
    ],

    physics: [
      "physics",
      "applied physics",
    ],

    chemistry: [
      "chemistry",
      "applied chemistry",
      "analytical chemistry",
      "physical chemistry",
      "inorganic chemistry",
      "organic chemistry",
      "hydro chemistry",
      "industrial chemistry",
    ],
  };

  /*
   * Identify subjects present in the
   * official requirement.
   */
  const requiredSubjects = Object.entries(
    subjectAliases,
  )
    .filter(([, aliases]) =>
      aliases.some((alias) =>
        normalizedRequirement.includes(
          alias,
        ),
      ),
    )
    .map(([subject]) => subject);

  return education.some((item) => {
    const qualification =
      normalizeText(
        item.qualification,
      )
        .replace(/[.,()]/g, " ")
        .replace(/'/g, "")
        .replace(/\s+/g, " ")
        .trim();

    const stream = normalizeText(
      item.stream,
    )
      .replace(/[.,()]/g, " ")
      .replace(/'/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const studentText =
      `${qualification} ${stream}`.trim();

    /*
     * Determine the student's degree level.
     */
    const studentHasMasters =
      /\b(m sc|msc|master of science|master|post graduate|postgraduate)\b/i.test(
        studentText,
      );

    const studentHasBachelors =
      /\b(b voc|bvoc|b sc|bsc|b a|ba|b com|bcom|b tech|btech|bachelor)\b/i.test(
        studentText,
      );

    /*
     * Determine the degree level required.
     */
    const requirementNeedsMasters =
      /\b(master'?s degree|master of science|m sc|msc|master of)\b/i.test(
        normalizedRequirement,
      );

    const requirementNeedsBachelors =
      /\b(bachelor'?s degree|bachelor of|b sc|bsc|b tech|btech|b voc|bvoc)\b/i.test(
        normalizedRequirement,
      );

    /*
     * Reject immediately when the student does not
     * have the required degree level.
     */
    if (
      requirementNeedsMasters &&
      !studentHasMasters
    ) {
      return false;
    }

    if (
      requirementNeedsBachelors &&
      !studentHasBachelors &&
      !studentHasMasters
    ) {
      return false;
    }

    /*
     * Match student's stream to any subject required
     * by the official notification.
     */
    if (
      stream &&
      requiredSubjects.length > 0
    ) {
      for (const subject of requiredSubjects) {
        const aliases =
          subjectAliases[subject];

        if (
          aliases.some((alias) =>
            stream.includes(alias),
          )
        ) {
          return true;
        }
      }
    }

    /*
     * Match student's qualification itself to the
     * required subject.
     */
    if (
      requiredSubjects.length > 0
    ) {
      for (const subject of requiredSubjects) {
        const aliases =
          subjectAliases[subject];

        if (
          aliases.some((alias) =>
            qualification.includes(alias),
          )
        ) {
          return true;
        }
      }
    }

    /*
     * When the official requirement specifies only
     * a degree level and no specific subject, accept
     * a matching degree level.
     */
    if (
      requiredSubjects.length === 0 &&
      requirementNeedsMasters &&
      studentHasMasters
    ) {
      return true;
    }

    if (
      requiredSubjects.length === 0 &&
      requirementNeedsBachelors &&
      (studentHasBachelors ||
        studentHasMasters)
    ) {
      return true;
    }

    return false;
  });
}

function evaluateRule(
  student: EligibilityStudent,
  rule: EligibilityRule,
): boolean {
  const {
    conditionField,
    operator,
    expectedValue,
  } = rule;

  /*
   * Age rules
   */
  if (conditionField === "age") {
    if (!student.profile.dateOfBirth) {
      return false;
    }

    /*
     * Supports:
     *
     * 21-32
     * 21-32 as of 2027-01-01
     */
    if (
      operator.trim() === "BETWEEN"
    ) {
      const match = expectedValue
        .trim()
        .match(
          /^(\d+)\s*-\s*(\d+)(?:\s+as\s+of\s+(\d{4}-\d{2}-\d{2}))?$/i,
        );

      if (!match) {
        return false;
      }

      const minAge = Number(match[1]);
      const maxAge = Number(match[2]);
      const asOfDate = match[3];

      const age = calculateAge(
        student.profile.dateOfBirth,
        asOfDate,
      );

      return (
        age >= minAge &&
        age <= maxAge
      );
    }

    /*
     * Existing numeric age rules:
     *
     * <= 32
     * >= 21
     * = 25
     */
    const age = calculateAge(
      student.profile.dateOfBirth,
    );

    const expectedAge =
      Number(expectedValue);

    if (
      Number.isNaN(expectedAge)
    ) {
      return false;
    }

    return compareNumbers(
      age,
      operator,
      expectedAge,
    );
  }

  /*
   * Post-specific qualification requirement
   */
  if (
    conditionField ===
      "qualificationRequirement" &&
    rule.qualificationRequirement
  ) {
    return qualificationSatisfiesRequirement(
      student.education,
      rule.qualificationRequirement,
    );
  }

  /*
   * Standard education rules
   */
  if (
    conditionField === "qualification" ||
    conditionField === "stream" ||
    conditionField === "percentage" ||
    conditionField === "passingYear"
  ) {
    return student.education.some(
      (education) => {
        /*
         * Qualification
         */
        if (
          conditionField ===
          "qualification"
        ) {
          const actual =
            normalizeQualification(
              education.qualification,
            );

          const expected =
            expectedValue
              .split(",")
              .map((value) =>
                normalizeQualification(
                  value,
                ),
              );

          switch (
            operator.trim()
          ) {
            case "IN":
              return expected.includes(
                actual,
              );

            case "=":
            case "==":
            case "EQUALS":
              return (
                actual ===
                normalizeQualification(
                  expectedValue,
                )
              );

            default:
              return false;
          }
        }

        /*
         * Stream
         */
        if (
          conditionField ===
          "stream"
        ) {
          if (!education.stream) {
            return false;
          }

          return compareText(
            education.stream,
            operator,
            expectedValue,
          );
        }

        /*
         * Percentage
         */
        if (
          conditionField ===
          "percentage"
        ) {
          if (
            education.percentage ===
            null
          ) {
            return false;
          }

          const expectedPercentage =
            Number(expectedValue);

          if (
            Number.isNaN(
              expectedPercentage,
            )
          ) {
            return false;
          }

          return compareNumbers(
            education.percentage,
            operator,
            expectedPercentage,
          );
        }

        /*
         * Passing year
         */
        if (
          conditionField ===
          "passingYear"
        ) {
          if (
            education.passingYear ===
            null
          ) {
            return false;
          }

          const expectedPassingYear =
            Number(expectedValue);

          if (
            Number.isNaN(
              expectedPassingYear,
            )
          ) {
            return false;
          }

          return compareNumbers(
            education.passingYear,
            operator,
            expectedPassingYear,
          );
        }

        return false;
      },
    );
  }

  /*
   * Student profile rules
   */
  if (
    conditionField === "category"
  ) {
    if (
      !student.profile.category
    ) {
      return false;
    }

    return compareText(
      student.profile.category,
      operator,
      expectedValue,
    );
  }

  if (
    conditionField === "state"
  ) {
    if (!student.profile.state) {
      return false;
    }

    return compareText(
      student.profile.state,
      operator,
      expectedValue,
    );
  }

  /*
   * Unknown rule
   */
  return false;
}

export function evaluateEligibility(
  student: EligibilityStudent,
  rules: EligibilityRule[],
): EligibilityResult {
  const reasons: string[] = [];

  if (rules.length === 0) {
    return {
      eligible: false,
      reasons: [
        "No active eligibility rules found.",
      ],
    };
  }

  for (const rule of rules) {
    const satisfied =
      evaluateRule(
        student,
        rule,
      );

    if (satisfied) {
      reasons.push(
        `Requirement satisfied: ${rule.name}`,
      );
    } else {
      reasons.push(
        `Requirement not satisfied: ${rule.name}`,
      );
    }
  }

  const eligible =
    reasons.length > 0 &&
    reasons.every(
      (reason) =>
        reason.startsWith(
          "Requirement satisfied:",
        ),
    );

  return {
    eligible,
    reasons,
  };
}

