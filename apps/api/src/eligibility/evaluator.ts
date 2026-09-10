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
};

export type EligibilityResult = {
  eligible: boolean;
  reasons: string[];
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeQualification(value: string): string {
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
  const normalizedActual = normalizeText(actual);

  const normalizedExpected = expected
    .split(",")
    .map((value) => normalizeText(value));

  switch (operator.trim()) {
    case "IN":
      return normalizedExpected.includes(normalizedActual);

    case "=":
    case "==":
    case "EQUALS":
      return normalizedActual === normalizeText(expected);

    default:
      return false;
  }
}

function calculateAge(dateOfBirth: string): number {
  const birthDate = Temporal.Instant
    .from(dateOfBirth)
    .toZonedDateTimeISO("Asia/Kolkata")
    .toPlainDate();

  const today = Temporal.Now
    .zonedDateTimeISO("Asia/Kolkata")
    .toPlainDate();

  let age = today.year - birthDate.year;

  const birthdayThisYear = birthDate.add({
    years: age,
  });

  if (
    Temporal.PlainDate.compare(
      today,
      birthdayThisYear,
    ) < 0
  ) {
    age -= 1;
  }

  return age;
}

function evaluateRule(
  student: EligibilityStudent,
  rule: EligibilityRule,
): boolean {
  const { conditionField, operator, expectedValue } = rule;

  /*
   * Age rules
   */
  if (conditionField === "age") {
    if (!student.profile.dateOfBirth) {
      return false;
    }

    const age = calculateAge(
      student.profile.dateOfBirth,
    );

    const expectedAge = Number(expectedValue);

    if (Number.isNaN(expectedAge)) {
      return false;
    }

    return compareNumbers(
      age,
      operator,
      expectedAge,
    );
  }

  /*
   * Education rules
   */
  if (
    conditionField === "qualification" ||
    conditionField === "stream" ||
    conditionField === "percentage" ||
    conditionField === "passingYear"
  ) {
    return student.education.some((education) => {
      if (conditionField === "qualification") {
        const actual = normalizeQualification(
          education.qualification,
        );

        const expected = expectedValue
          .split(",")
          .map((value) =>
            normalizeQualification(value),
          );

        switch (operator.trim()) {
          case "IN":
            return expected.includes(actual);

          case "=":
          case "==":
          case "EQUALS":
            return (
              actual ===
              normalizeQualification(expectedValue)
            );

          default:
            return false;
        }
      }

      if (conditionField === "stream") {
        if (!education.stream) {
          return false;
        }

        return compareText(
          education.stream,
          operator,
          expectedValue,
        );
      }

      if (conditionField === "percentage") {
        if (education.percentage === null) {
          return false;
        }

        const expectedPercentage = Number(
          expectedValue,
        );

        if (Number.isNaN(expectedPercentage)) {
          return false;
        }

        return compareNumbers(
          education.percentage,
          operator,
          expectedPercentage,
        );
      }

      if (conditionField === "passingYear") {
        if (education.passingYear === null) {
          return false;
        }

        const expectedPassingYear = Number(
          expectedValue,
        );

        if (Number.isNaN(expectedPassingYear)) {
          return false;
        }

        return compareNumbers(
          education.passingYear,
          operator,
          expectedPassingYear,
        );
      }

      return false;
    });
  }

  /*
   * Student profile rules
   */
  if (conditionField === "category") {
    if (!student.profile.category) {
      return false;
    }

    return compareText(
      student.profile.category,
      operator,
      expectedValue,
    );
  }

  if (conditionField === "state") {
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
      reasons: ["No active eligibility rules found."],
    };
  }

  for (const rule of rules) {
    const satisfied = evaluateRule(
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
    reasons.every((reason) =>
      reason.startsWith(
        "Requirement satisfied:",
      ),
    );

  return {
    eligible,
    reasons,
  };
}