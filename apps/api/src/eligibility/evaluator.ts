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
  logicGroup?: string | null;
  logicOperator?: string | null;
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
    "bachelor of vocational studies":
      "bvoc",

    ma: "ma",
    "m a": "ma",
    "master of arts": "ma",

    msc: "msc",
    "m sc": "msc",
    "master of science": "msc",

    mcom: "mcom",
    "m com": "mcom",
    "master of commerce": "mcom",

    mtech: "mtech",
    "m tech": "mtech",
    "master of technology": "mtech",
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
        .zonedDateTimeISO(
          "Asia/Kolkata",
        )
        .toPlainDate();

  let age =
    targetDate.year -
    birthDate.year;

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

  const requiredSubjects =
    Object.entries(
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

    const studentHasMasters =
      /\b(m sc|msc|master of science|master|post graduate|postgraduate|mtech|m tech|master of technology|ma|m a|master of arts|mcom|m com|master of commerce)\b/i.test(
        studentText,
      );

    const studentHasBachelors =
      /\b(b voc|bvoc|b sc|bsc|b a|ba|b com|bcom|b tech|btech|bachelor)\b/i.test(
        studentText,
      );

    const requirementNeedsMasters =
      /\b(master'?s degree|master of science|m sc|msc|master of|mtech|m tech|ma|m a|mcom|m com)\b/i.test(
        normalizedRequirement,
      );

    const requirementNeedsBachelors =
      /\b(bachelor'?s degree|bachelor of|b sc|bsc|b tech|btech|b voc|bvoc)\b/i.test(
        normalizedRequirement,
      );

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

function findMatchingEducation(
  student: EligibilityStudent,
  requirement?: string | null,
): EligibilityStudent["education"][number] | null {
  if (!student.education.length) {
    return null;
  }

  if (!requirement) {
    return student.education[0];
  }

  for (const education of student.education) {
    if (
      qualificationSatisfiesRequirement(
        [education],
        requirement,
      )
    ) {
      return education;
    }
  }

  return student.education[0];
}

function formatEducation(
  education:
    | EligibilityStudent["education"][number]
    | null,
): string {
  if (!education) {
    return "No education record available";
  }

  const qualification =
    education.qualification?.trim();

  const stream =
    education.stream?.trim();

  if (
    qualification &&
    stream
  ) {
    return `${qualification} — ${stream}`;
  }

  return (
    qualification ||
    stream ||
    "Education details not available"
  );
}

function formatAgeRequirement(
  expectedValue: string,
): {
  minAge: number | null;
  maxAge: number | null;
  asOfDate: string | null;
} {
  const match = expectedValue
    .trim()
    .match(
      /^(\d+)\s*-\s*(\d+)(?:\s+as\s+of\s+(\d{4}-\d{2}-\d{2}))?$/i,
    );

  if (!match) {
    return {
      minAge: null,
      maxAge: null,
      asOfDate: null,
    };
  }

  return {
    minAge: Number(match[1]),
    maxAge: Number(match[2]),
    asOfDate: match[3] ?? null,
  };
}

/*
 * GENERIC CATEGORY NUMERIC RULE PARSER
 *
 * Supports:
 *
 * General:32,OBC:35,SC:37,ST:37,EWS:32
 *
 * General:60,OBC:55,SC:50,ST:50,EWS:55
 *
 * General:2027,OBC:2027,SC:2027,ST:2027,EWS:2027
 */
function parseCategoryNumericRequirement(
  expectedValue: string,
): Map<string, number> {
  const requirements =
    new Map<string, number>();

  for (const item of expectedValue.split(",")) {
    const trimmedItem =
      item.trim();

    if (!trimmedItem) {
      continue;
    }

    const separatorIndex =
      trimmedItem.indexOf(":");

    if (separatorIndex === -1) {
      continue;
    }

    const category =
      normalizeText(
        trimmedItem.slice(
          0,
          separatorIndex,
        ),
      );

    const value = Number(
      trimmedItem
        .slice(
          separatorIndex + 1,
        )
        .trim(),
    );

    if (
      category &&
      Number.isFinite(value)
    ) {
      requirements.set(
        category,
        value,
      );
    }
  }

  return requirements;
}

function formatRuleRequirement(
  rule: EligibilityRule,
): string {
  return rule.expectedValue
    .trim()
    .replace(/\s+/g, " ");
}

function buildSatisfiedReason(
  student: EligibilityStudent,
  rule: EligibilityRule,
): string {
  const {
    conditionField,
    operator,
    expectedValue,
  } = rule;

  /*
   * AGE
   */
  if (
    conditionField === "age"
  ) {
    if (!student.profile.dateOfBirth) {
      return `Requirement satisfied: ${rule.name}`;
    }

    /*
     * CATEGORY-SPECIFIC AGE
     */
    if (
      expectedValue.includes(":")
    ) {
      const category =
        student.profile.category;

      const age = calculateAge(
        student.profile.dateOfBirth,
      );

      if (!category) {
        return `Your age: ${age} years • Category not available`;
      }

      const categoryRules =
        parseCategoryNumericRequirement(
          expectedValue,
        );

      const maxAge =
        categoryRules.get(
          normalizeText(category),
        );

      if (maxAge !== undefined) {
        return `Your age: ${age} years • Category: ${category} • Maximum allowed age: ${maxAge} years`;
      }

      return `Your age: ${age} years • Category: ${category} • No age rule found for this category`;
    }

    /*
     * NORMAL AGE RULE
     */
    if (
      operator.trim() === "BETWEEN"
    ) {
      const {
        minAge,
        maxAge,
        asOfDate,
      } = formatAgeRequirement(
        expectedValue,
      );

      const age = calculateAge(
        student.profile.dateOfBirth,
        asOfDate ?? undefined,
      );

      if (
        minAge !== null &&
        maxAge !== null
      ) {
        return `Your age: ${age} years • Allowed age: ${minAge}-${maxAge} years${
          asOfDate
            ? ` as of ${asOfDate}`
            : ""
        }`;
      }

      return `Your age: ${age} years • Age requirement satisfied`;
    }

    const age = calculateAge(
      student.profile.dateOfBirth,
    );

    return `Your age: ${age} years • Required: ${operator} ${expectedValue}`;
  }

  /*
   * POST-SPECIFIC QUALIFICATION
   */
  if (
    conditionField ===
      "qualificationRequirement" &&
    rule.qualificationRequirement
  ) {
    const matchingEducation =
      findMatchingEducation(
        student,
        rule.qualificationRequirement,
      );

    const studentEducation =
      formatEducation(
        matchingEducation,
      );

    const required =
      formatRuleRequirement(rule);

    return `Your qualification: ${studentEducation} • Required: ${
      required.length > 180
        ? `${required.slice(0, 177)}...`
        : required
    }`;
  }

  /*
   * STANDARD QUALIFICATION
   */
  if (
    conditionField ===
    "qualification"
  ) {
    const matchingEducation =
      student.education.find(
        (education) =>
          normalizeQualification(
            education.qualification,
          ) ===
          normalizeQualification(
            expectedValue,
          ),
      ) ??
      student.education[0] ??
      null;

    return `Your qualification: ${formatEducation(
      matchingEducation,
    )} • Required: ${expectedValue}`;
  }

  /*
   * STREAM
   */
  if (
    conditionField === "stream"
  ) {
    const matchingEducation =
      student.education.find(
        (education) =>
          education.stream &&
          compareText(
            education.stream,
            operator,
            expectedValue,
          ),
      ) ??
      student.education.find(
        (education) =>
          education.stream,
      ) ??
      null;

    return `Your stream: ${
      matchingEducation?.stream ??
      "Not available"
    } • Required: ${expectedValue}`;
  }

  /*
   * PERCENTAGE
   */
  if (
    conditionField ===
    "percentage"
  ) {
    const matchingEducation =
      student.education.find(
        (education) =>
          education.percentage !==
          null,
      ) ?? null;

    const actual =
      matchingEducation?.percentage;

    /*
     * CATEGORY-SPECIFIC PERCENTAGE
     */
    if (
      expectedValue.includes(":")
    ) {
      const category =
        student.profile.category;

      if (
        actual === null ||
        actual === undefined
      ) {
        return `Percentage not available • Category: ${
          category ?? "Not available"
        }`;
      }

      if (!category) {
        return `Your percentage: ${actual}% • Category not available`;
      }

      const categoryRules =
        parseCategoryNumericRequirement(
          expectedValue,
        );

      const minPercentage =
        categoryRules.get(
          normalizeText(category),
        );

      if (
        minPercentage !==
        undefined
      ) {
        return `Your percentage: ${actual}% • Category: ${category} • Minimum required: ${minPercentage}%`;
      }

      return `Your percentage: ${actual}% • Category: ${category} • No percentage rule found for this category`;
    }

    /*
     * NORMAL PERCENTAGE
     */
    if (actual !== undefined) {
      return `Your percentage: ${actual}% • Required: ${operator} ${expectedValue}%`;
    }

    return `Percentage requirement satisfied: ${operator} ${expectedValue}%`;
  }

  /*
   * PASSING YEAR
   */
  if (
    conditionField ===
    "passingYear"
  ) {
    const matchingEducation =
      student.education.find(
        (education) =>
          education.passingYear !==
          null,
      ) ?? null;

    const actual =
      matchingEducation?.passingYear;

    /*
     * CATEGORY-SPECIFIC PASSING YEAR
     */
    if (
      expectedValue.includes(":")
    ) {
      const category =
        student.profile.category;

      if (
        actual === null ||
        actual === undefined
      ) {
        return `Passing year not available • Category: ${
          category ?? "Not available"
        }`;
      }

      if (!category) {
        return `Your passing year: ${actual} • Category not available`;
      }

      const categoryRules =
        parseCategoryNumericRequirement(
          expectedValue,
        );

      const requiredPassingYear =
        categoryRules.get(
          normalizeText(category),
        );

      if (
        requiredPassingYear !==
        undefined
      ) {
        return `Your passing year: ${actual} • Category: ${category} • Required passing year: ${requiredPassingYear}`;
      }

      return `Your passing year: ${actual} • Category: ${category} • No passing year rule found for this category`;
    }

    /*
     * NORMAL PASSING YEAR
     */
    if (actual !== undefined) {
      return `Your passing year: ${actual} • Required: ${operator} ${expectedValue}`;
    }

    return `Passing year requirement satisfied: ${operator} ${expectedValue}`;
  }

  /*
   * CATEGORY
   */
  if (
    conditionField === "category"
  ) {
    return `Your category: ${
      student.profile.category ??
      "Not available"
    } • Required: ${expectedValue}`;
  }

  /*
   * STATE
   */
  if (
    conditionField === "state"
  ) {
    return `Your state: ${
      student.profile.state ??
      "Not available"
    } • Required: ${expectedValue}`;
  }

  /*
   * FALLBACK
   */
  return `Requirement satisfied: ${rule.name}`;
}

function buildFailedReason(
  rule: EligibilityRule,
): string {
  return `Requirement not satisfied: ${rule.name}`;
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
   * CATEGORY-SPECIFIC AGE
   */
  if (
    conditionField ===
    "ageByCategory"
  ) {
    if (!student.profile.dateOfBirth) {
      return false;
    }

    if (!student.profile.category) {
      return false;
    }

    const categoryRules =
      parseCategoryNumericRequirement(
        expectedValue,
      );

    const maxAge =
      categoryRules.get(
        normalizeText(
          student.profile.category,
        ),
      );

    if (maxAge === undefined) {
      return false;
    }

    const age = calculateAge(
      student.profile.dateOfBirth,
    );

    return age <= maxAge;
  }

  /*
   * AGE
   */
  if (conditionField === "age") {
    if (!student.profile.dateOfBirth) {
      return false;
    }

    /*
     * CATEGORY-SPECIFIC AGE
     */
    if (
      expectedValue.includes(":")
    ) {
      if (!student.profile.category) {
        return false;
      }

      const categoryRules =
        parseCategoryNumericRequirement(
          expectedValue,
        );

      const maxAge =
        categoryRules.get(
          normalizeText(
            student.profile.category,
          ),
        );

      if (maxAge === undefined) {
        return false;
      }

      const age = calculateAge(
        student.profile.dateOfBirth,
      );

      return age <= maxAge;
    }

    /*
     * NORMAL AGE RULE
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

      const minAge = Number(
        match[1],
      );
      const maxAge = Number(
        match[2],
      );
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
   * POST-SPECIFIC QUALIFICATION
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
   * STANDARD EDUCATION RULES
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
         * QUALIFICATION
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
         * STREAM
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
         * PERCENTAGE
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

          /*
           * CATEGORY-SPECIFIC PERCENTAGE
           */
          if (
            expectedValue.includes(":")
          ) {
            if (
              !student.profile.category
            ) {
              return false;
            }

            const categoryRules =
              parseCategoryNumericRequirement(
                expectedValue,
              );

            const minPercentage =
              categoryRules.get(
                normalizeText(
                  student.profile.category,
                ),
              );

            if (
              minPercentage ===
              undefined
            ) {
              return false;
            }

            return (
              education.percentage >=
              minPercentage
            );
          }

          /*
           * NORMAL PERCENTAGE
           */
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
         * PASSING YEAR
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

          /*
           * CATEGORY-SPECIFIC PASSING YEAR
           */
          if (
            expectedValue.includes(":")
          ) {
            if (
              !student.profile.category
            ) {
              return false;
            }

            const categoryRules =
              parseCategoryNumericRequirement(
                expectedValue,
              );

            const requiredPassingYear =
              categoryRules.get(
                normalizeText(
                  student.profile.category,
                ),
              );

            if (
              requiredPassingYear ===
              undefined
            ) {
              return false;
            }

            return (
              education.passingYear ===
              requiredPassingYear
            );
          }

          /*
           * NORMAL PASSING YEAR
           */
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
   * CATEGORY
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

  /*
   * STATE
   */
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
   * UNKNOWN RULE
   */
  return false;
}

export function evaluateEligibility(
  student: EligibilityStudent,
  rules: EligibilityRule[],
): EligibilityResult {
  if (rules.length === 0) {
    return {
      eligible: false,
      reasons: [
        "No active eligibility rules found.",
      ],
    };
  }

  /*
   * A post-specific qualification requirement
   * is more specific than a generic qualification
   * rule.
   */
  const hasQualificationRequirement =
    rules.some(
      (rule) =>
        rule.conditionField ===
          "qualificationRequirement" &&
        Boolean(
          rule.qualificationRequirement,
        ),
    );

  /*
   * Remove generic qualification rules when
   * a specific post qualification exists.
   */
  const applicableRules =
    rules.filter(
      (rule) => {
        if (
          hasQualificationRequirement &&
          rule.conditionField ===
            "qualification"
        ) {
          return false;
        }

        return true;
      },
    );

  /*
   * Group rules.
   *
   * Rules with the same logicGroup are
   * evaluated together.
   *
   * Rules without logicGroup are treated
   * as individual AND conditions.
   */
  const groups = new Map<
    string,
    EligibilityRule[]
  >();

  for (let index = 0; index < applicableRules.length; index += 1) {
    const rule =
      applicableRules[index];

    const groupName =
      rule.logicGroup?.trim() ||
      `__single_${index}`;

    const existing =
      groups.get(groupName) ??
      [];

    existing.push(rule);

    groups.set(
      groupName,
      existing,
    );
  }

  const reasons: string[] = [];
  let allGroupsSatisfied = true;

  for (const groupRules of groups.values()) {
    const logicOperator =
      (
        groupRules[0]
          ?.logicOperator ??
        "AND"
      )
        .trim()
        .toUpperCase();

    const groupResults =
      groupRules.map((rule) => {
        const satisfied =
          evaluateRule(
            student,
            rule,
          );

        return {
          rule,
          satisfied,
        };
      });

    const groupSatisfied =
      logicOperator === "OR"
        ? groupResults.some(
            (item) =>
              item.satisfied,
          )
        : groupResults.every(
            (item) =>
              item.satisfied,
          );

    if (!groupSatisfied) {
      allGroupsSatisfied = false;
    }

    /*
     * OR GROUP
     *
     * Example:
     *
     * B.Sc Physics
     * OR
     * M.Sc Physics
     */
    if (
      logicOperator === "OR"
    ) {
      const satisfiedRule =
        groupResults.find(
          (item) =>
            item.satisfied,
        );

      if (satisfiedRule) {
        reasons.push(
          buildSatisfiedReason(
            student,
            satisfiedRule.rule,
          ),
        );
      } else {
        for (const item of groupResults) {
          reasons.push(
            buildFailedReason(
              item.rule,
            ),
          );
        }
      }

      continue;
    }

    /*
     * AND GROUP
     *
     * Every rule must pass.
     */
    for (const item of groupResults) {
      if (item.satisfied) {
        reasons.push(
          buildSatisfiedReason(
            student,
            item.rule,
          ),
        );
      } else {
        reasons.push(
          buildFailedReason(
            item.rule,
          ),
        );
      }
    }
  }

  if (reasons.length === 0) {
    return {
      eligible: false,
      reasons: [
        "No applicable eligibility requirements found.",
      ],
    };
  }

  return {
    eligible: allGroupsSatisfied,
    reasons,
  };
}