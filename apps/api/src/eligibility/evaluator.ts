import { Temporal } from "@js-temporal/polyfill";

export type EligibilityStudent = {
  profile: {
    category?: string | null;
    state?: string | null;
    dateOfBirth?: string | null;
  };

  education: {
    qualification: string;
    percentage?: number | null;
    passingYear?: number | null;
    stream?: string | null;
  }[];
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

function normalize(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeQualification(value: unknown): string {
  const normalized = normalize(value)
    .replace(/\./g, "")
    .replace(/\s+/g, " ");

  const aliases: Record<string, string> = {
    "ba": "ba",
    "bachelor of arts": "ba",

    "bsc": "bsc",
    "bachelor of science": "bsc",

    "bcom": "bcom",
    "bachelor of commerce": "bcom",

    "btech": "btech",
    "bachelor of technology": "btech",

    "bvoc": "bvoc",
    "bachelor of vocational studies": "bvoc",
  };

  return aliases[normalized] ?? normalized;
}

function compareNumber(
  actual: number,
  operator: string,
  expected: number,
): boolean {
  switch (operator.toUpperCase()) {
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
  actual: unknown,
  operator: string,
  expectedValue: string,
  normalizeValue: (value: unknown) => string = normalize,
): boolean {
  const normalizedActual = normalizeValue(actual);
  const normalizedOperator = operator.toUpperCase();

  if (normalizedOperator === "IN") {
    const expectedValues = expectedValue
      .split(",")
      .map((value) => normalizeValue(value))
      .filter(Boolean);

    return expectedValues.includes(normalizedActual);
  }

  if (
    normalizedOperator === "=" ||
    normalizedOperator === "==" ||
    normalizedOperator === "EQUALS"
  ) {
    return (
      normalizedActual === normalizeValue(expectedValue)
    );
  }

  return false;
}

function evaluateEducationRule(
  student: EligibilityStudent,
  rule: EligibilityRule,
): boolean {
  if (student.education.length === 0) {
    return false;
  }

  switch (rule.conditionField) {
    case "qualification":
      return student.education.some((record) =>
        compareText(
          record.qualification,
          rule.operator,
          rule.expectedValue,
          normalizeQualification,
        ),
      );

    case "stream":
      return student.education.some((record) =>
        compareText(
          record.stream,
          rule.operator,
          rule.expectedValue,
        ),
      );

    case "percentage": {
      const expected = Number(rule.expectedValue);

      if (!Number.isFinite(expected)) {
        return false;
      }

      return student.education.some(
        (record) =>
          record.percentage != null &&
          compareNumber(
            record.percentage,
            rule.operator,
            expected,
          ),
      );
    }

    case "passingYear": {
      const expected = Number(rule.expectedValue);

      if (!Number.isInteger(expected)) {
        return false;
      }

      return student.education.some(
        (record) =>
          record.passingYear != null &&
          compareNumber(
            record.passingYear,
            rule.operator,
            expected,
          ),
      );
    }

    default:
      return false;
  }
}

function evaluateProfileRule(
  student: EligibilityStudent,
  rule: EligibilityRule,
): boolean {
  let actual: unknown;

  switch (rule.conditionField) {
    case "category":
      actual = student.profile.category;
      break;

    case "state":
      actual = student.profile.state;
      break;

    default:
      return false;
  }

  return compareText(
    actual,
    rule.operator,
    rule.expectedValue,
  );
}

function calculateAge(
  dateOfBirth: string,
  referenceDate: Temporal.PlainDate,
): number {
  const birthDate = Temporal.PlainDate.from(
    dateOfBirth,
  );

  return referenceDate.since(birthDate, {
    largestUnit: "years",
  }).years;
}

function evaluateAgeRule(
  student: EligibilityStudent,
  rule: EligibilityRule,
): boolean {
  if (!student.profile.dateOfBirth) {
    return false;
  }

  const expected = Number(rule.expectedValue);

  if (!Number.isInteger(expected)) {
    return false;
  }

  const referenceDate = Temporal.Now.plainDateISO();

  const age = calculateAge(
    student.profile.dateOfBirth,
    referenceDate,
  );

  return compareNumber(
    age,
    rule.operator,
    expected,
  );
}

export function evaluateRule(
  student: EligibilityStudent,
  rule: EligibilityRule,
): boolean {
  switch (rule.conditionField) {
    case "qualification":
    case "percentage":
    case "passingYear":
    case "stream":
      return evaluateEducationRule(student, rule);

    case "category":
    case "state":
      return evaluateProfileRule(student, rule);

    case "age":
      return evaluateAgeRule(student, rule);

    default:
      return false;
  }
}

export function evaluateEligibility(
  student: EligibilityStudent,
  rules: EligibilityRule[],
): EligibilityResult {
  const reasons: string[] = [];

  for (const rule of rules) {
    const passed = evaluateRule(student, rule);

    if (passed) {
      reasons.push(
        `Requirement satisfied: ${rule.name}`,
      );
    } else {
      reasons.push(
        `Requirement not satisfied: ${rule.name}`,
      );
    }
  }

  return {
    eligible:
      rules.length > 0 &&
      reasons.every((reason) =>
        reason.startsWith(
          "Requirement satisfied:",
        ),
      ),
    reasons,
  };
}
