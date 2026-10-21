import type { FastifyInstance } from "fastify";
import { db } from "@examconnect/database";

import { requireAuth } from "../auth/guards.js";
import {
  evaluateEligibility,
  type EligibilityRule,
  type EligibilityStudent,
} from "./evaluator.js";
import {
  createNewEligibleExamNotification,
} from "../notifications/notification-service.js";

type EligibilitySource = {
  id: number;
  organization: string;
  notificationTitle: string;
  notificationDate: string | null;
  officialUrl: string;
  notificationIdentifier: string | null;
  dateImported: string;
  lastVerifiedAt: string | null;
};

type EligibilityDeadline = {
  id: number;
  applicationUrl: string | null;
  status: string;
  applicationStart: string | null;
  applicationEnd: string | null;
  examDate: string | null;
};

function calculateApplicationStatus(
  applicationStart: string | null,
  applicationEnd: string | null,
): string {
  const now = new Date();

  if (applicationStart) {
    const start = new Date(applicationStart);

    if (now < start) {
      return "UPCOMING";
    }
  }

  if (applicationEnd) {
    const end = new Date(applicationEnd);

    if (now > end) {
      return "CLOSED";
    }
  }

  if (applicationStart || applicationEnd) {
    return "OPEN";
  }

  return "UNKNOWN";
}

/*
 * AGE RULE HELPER
 *
 * When an AGE rule contains category-specific
 * limits in EligibilityRule.description, use
 * that value instead of the old version value.
 */
function getRuleExpectedValue(
  rule: {
    ruleType: string;
    description: string | null;
  },
  versionExpectedValue: string,
): string {
  if (
    rule.ruleType === "AGE" &&
    rule.description &&
    rule.description.includes(":")
  ) {
    return rule.description.trim();
  }

  return versionExpectedValue;
}

/*
 * Return true for a development-only test source.
 *
 * These should not be displayed as official notices
 * for real government exams.
 */
function isDevelopmentTestSource(
  source: Pick<
    EligibilitySource,
    "notificationTitle"
  >,
): boolean {
  return /development\s+test|test\s+notification/i.test(
    source.notificationTitle,
  );
}

/*
 * Convert a database notification source into
 * the shape returned by the eligibility API.
 */
function formatNotificationSource(
  source: {
    id: number;
    organization: string;
    notificationTitle: string;
    notificationDate: {
      toString(): string;
    } | null;
    officialUrl: string;
    notificationIdentifier: string | null;
    dateImported: {
      toString(): string;
    };
    lastVerifiedAt: {
      toString(): string;
    } | null;
  },
): EligibilitySource {
  return {
    id: source.id,
    organization: source.organization,
    notificationTitle: source.notificationTitle,
    notificationDate: source.notificationDate
      ? source.notificationDate.toString()
      : null,
    officialUrl: source.officialUrl,
    notificationIdentifier:
      source.notificationIdentifier,
    dateImported: source.dateImported.toString(),
    lastVerifiedAt: source.lastVerifiedAt
      ? source.lastVerifiedAt.toString()
      : null,
  };
}

export async function eligibilityRoute(
  app: FastifyInstance,
) {
  app.get(
    "/student/eligible-exams",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const userId = request.authUser!.id;

      /*
       * Load student's profile.
       */
      const profile =
        await db.orm.public.StudentProfile
          .where({
            userId,
          })
          .first();

      if (!profile) {
        return reply.code(404).send({
          error: "PROFILE_NOT_FOUND",
          message: "Student profile not found.",
        });
      }

      /*
       * Load all education records.
       */
      const educationRecords =
        await db.orm.public.EducationRecord
          .where({
            studentProfileId: profile.id,
          })
          .all();

      const student: EligibilityStudent = {
        profile: {
          category: profile.category,
          state: profile.state,
          dateOfBirth: profile.dateOfBirth
            ? profile.dateOfBirth.toString()
            : null,
        },

        education: educationRecords.map(
          (education) => ({
            qualification: education.qualification,
            percentage: education.percentage,
            passingYear: education.passingYear,
            stream: education.stream,
          }),
        ),
      };

      /*
       * Load all exams.
       */
      const exams =
        await db.orm.public.Exam.all();

      const results = [];

      for (const exam of exams) {
        const normalizedExamName =
          exam.name.trim().toLowerCase();

        const normalizedExamOrganization =
          exam.conductingBody
            .trim()
            .toLowerCase();

        /*
         * Load all posts for this exam.
         */
        const posts =
          await db.orm.public.Post
            .where({
              examId: exam.id,
            })
            .all();

        /*
         * Load exam-level eligibility rules.
         */
        const examRules =
          await db.orm.public.EligibilityRule
            .where({
              examId: exam.id,
              postId: null,
            })
            .all();

        const activeExamRules: EligibilityRule[] = [];
        const examSources: EligibilitySource[] = [];

        /*
         * Build exam-level rules and sources
         * explicitly linked to those rule versions.
         */
        for (const rule of examRules) {
          const version =
            await db.orm.public.EligibilityRuleVersion
              .where({
                eligibilityRuleId: rule.id,
                status: "ACTIVE",
              })
              .first();

          if (!version) {
            continue;
          }

          activeExamRules.push({
            name: rule.name,

            conditionField:
              version.conditionField,

            operator:
              version.operator,

            expectedValue:
              getRuleExpectedValue(
                {
                  ruleType: rule.ruleType,
                  description: rule.description,
                },
                version.expectedValue,
              ),

            logicGroup:
              version.logicGroup,

            logicOperator:
              version.logicOperator,
          });

          if (version.notificationSourceId) {
            const source =
              await db.orm.public.NotificationSource
                .where({
                  id: version.notificationSourceId,
                })
                .first();

            if (source) {
              examSources.push(
                formatNotificationSource(source),
              );
            }
          }
        }

        /*
         * Find notification sources that match this
         * exam's conducting body and notification title.
         *
         * Example:
         * Exam:
         * Combined Higher Secondary (10+2) Level
         * Examination, 2026
         *
         * Notification:
         * Notice of Combined Higher Secondary (10+2)
         * Level Examination, 2026
         *
         * This lets the API return the SSC PDF even
         * when no rule version has sourceId attached.
         */
        const organizationSources =
          await db.orm.public.NotificationSource
            .where({
              organization: exam.conductingBody,
            })
            .all();

        const matchingExamSources: EligibilitySource[] =
          organizationSources
            .filter((source) => {
              const title =
                source.notificationTitle
                  .trim()
                  .toLowerCase();

              return (
                title.includes(normalizedExamName) &&
                !isDevelopmentTestSource(source)
              );
            })
            .map((source) =>
              formatNotificationSource(source),
            );

        /*
         * Keep explicitly linked sources only if
         * they belong to this exam's organization and
         * are not generic development test sources.
         */
        const relevantLinkedExamSources =
          examSources.filter((source) => {
            const normalizedSourceOrganization =
              source.organization
                .trim()
                .toLowerCase();

            return (
              normalizedSourceOrganization ===
                normalizedExamOrganization &&
              !isDevelopmentTestSource(source)
            );
          });

        /*
         * Merge and deduplicate exam-level sources.
         */
        const uniqueExamSources =
          Array.from(
            new Map(
              [
                ...relevantLinkedExamSources,
                ...matchingExamSources,
              ].map((source) => [
                source.id,
                source,
              ]),
            ).values(),
          );

        /*
         * =====================================================
         * EXAM WITH NO POSTS
         * =====================================================
         */
        if (posts.length === 0) {
          const evaluation =
            evaluateEligibility(
              student,
              activeExamRules,
            );

          const deadlines =
            await db.orm.public.ApplicationDeadline
              .where({
                examId: exam.id,
              })
              .all();

          const formattedDeadlines: EligibilityDeadline[] =
            deadlines.map((deadline) => {
              const applicationStart =
                deadline.applicationStart
                  ? deadline.applicationStart.toString()
                  : null;

              const applicationEnd =
                deadline.applicationEnd
                  ? deadline.applicationEnd.toString()
                  : null;

              return {
                id: deadline.id,
                applicationUrl: deadline.applicationUrl,

                status: calculateApplicationStatus(
                  applicationStart,
                  applicationEnd,
                ),

                applicationStart,
                applicationEnd,

                examDate: deadline.examDate
                  ? deadline.examDate.toString()
                  : null,
              };
            });

          results.push({
            exam: {
              id: exam.id,
              name: exam.name,
              conductingBody: exam.conductingBody,
              examType: exam.examType,
              description: exam.description,
              officialWebsite: exam.officialWebsite,
            },

            post: null,

            eligible: evaluation.eligible,
            reasons: evaluation.reasons,
            sources: uniqueExamSources,
            deadlines: formattedDeadlines,
          });

          if (evaluation.eligible) {
            await createNewEligibleExamNotification({
              userId,
              examId: exam.id,
              postId: null,
              examName: exam.name,
              postName: null,
            });
          }

          continue;
        }

        /*
         * =====================================================
         * EXAM WITH POSTS
         * =====================================================
         */
        for (const post of posts) {
          /*
           * Load post-specific rules.
           */
          const postRules =
            await db.orm.public.EligibilityRule
              .where({
                examId: exam.id,
                postId: post.id,
              })
              .all();

          const activePostRules: EligibilityRule[] = [];
          const postSources: EligibilitySource[] = [];

          /*
           * Build post-specific rules and their
           * explicitly linked notification sources.
           */
          for (const rule of postRules) {
            const version =
              await db.orm.public.EligibilityRuleVersion
                .where({
                  eligibilityRuleId: rule.id,
                  status: "ACTIVE",
                })
                .first();

            if (!version) {
              continue;
            }

            activePostRules.push({
              name: rule.name,

              conditionField:
                version.conditionField,

              operator:
                version.operator,

              expectedValue:
                getRuleExpectedValue(
                  {
                    ruleType: rule.ruleType,
                    description: rule.description,
                  },
                  version.expectedValue,
                ),

              logicGroup:
                version.logicGroup,

              logicOperator:
                version.logicOperator,
            });

            if (version.notificationSourceId) {
              const source =
                await db.orm.public.NotificationSource
                  .where({
                    id: version.notificationSourceId,
                  })
                  .first();

              if (source) {
                postSources.push(
                  formatNotificationSource(source),
                );
              }
            }
          }

          /*
           * Add the qualification requirement stored
           * directly on the Post.
           */
          if (post.qualification) {
            activePostRules.push({
              name: "Qualification Requirement",

              conditionField:
                "qualificationRequirement",

              operator: "REQUIRED",

              expectedValue:
                post.qualification,

              qualificationRequirement:
                post.qualification,

              logicGroup: null,
              logicOperator: "AND",
            });
          }

          /*
           * Combine exam-level and post-level rules.
           */
          const combinedRules = [
            ...activeExamRules,
            ...activePostRules,
          ];

          /*
           * Evaluate student's eligibility.
           */
          const evaluation =
            evaluateEligibility(
              student,
              combinedRules,
            );

          /*
           * Load post-level application deadlines.
           */
          let deadlines =
            await db.orm.public.ApplicationDeadline
              .where({
                examId: exam.id,
                postId: post.id,
              })
              .all();

          /*
           * Backward compatibility:
           * use the exam-level deadline if no
           * post-specific deadline exists.
           */
          if (deadlines.length === 0) {
            deadlines =
              await db.orm.public.ApplicationDeadline
                .where({
                  examId: exam.id,
                  postId: null,
                })
                .all();
          }

          /*
           * Format deadlines.
           */
          const formattedDeadlines: EligibilityDeadline[] =
            deadlines.map((deadline) => {
              const applicationStart =
                deadline.applicationStart
                  ? deadline.applicationStart.toString()
                  : null;

              const applicationEnd =
                deadline.applicationEnd
                  ? deadline.applicationEnd.toString()
                  : null;

              return {
                id: deadline.id,
                applicationUrl: deadline.applicationUrl,

                status: calculateApplicationStatus(
                  applicationStart,
                  applicationEnd,
                ),

                applicationStart,
                applicationEnd,

                examDate: deadline.examDate
                  ? deadline.examDate.toString()
                  : null,
              };
            });

          /*
           * Keep only relevant post-level sources.
           * This avoids displaying development test
           * notices as if they were official notices.
           */
          const relevantPostSources =
            postSources.filter((source) => {
              const normalizedSourceOrganization =
                source.organization
                  .trim()
                  .toLowerCase();

              return (
                normalizedSourceOrganization ===
                  normalizedExamOrganization &&
                !isDevelopmentTestSource(source)
              );
            });

          /*
           * Combine exam-level and post-level sources.
           */
          const combinedSources = [
            ...uniqueExamSources,
            ...relevantPostSources,
          ];

          const uniqueSources =
            Array.from(
              new Map(
                combinedSources.map((source) => [
                  source.id,
                  source,
                ]),
              ).values(),
            );

          /*
           * Return post information and eligibility.
           */
          results.push({
            exam: {
              id: exam.id,
              name: exam.name,
              conductingBody: exam.conductingBody,
              examType: exam.examType,
              description: exam.description,
              officialWebsite: exam.officialWebsite,
            },

            post: {
              id: post.id,
              name: post.name,
              code: post.code,
              department: post.department,
              vacancies: post.vacancies,
              qualification: post.qualification,
              description: post.description,
            },

            eligible: evaluation.eligible,
            reasons: evaluation.reasons,
            sources: uniqueSources,
            deadlines: formattedDeadlines,
          });

          /*
           * Create notification when the student
           * qualifies for this exam post.
           */
          if (evaluation.eligible) {
            await createNewEligibleExamNotification({
              userId,
              examId: exam.id,
              postId: post.id,
              examName: exam.name,
              postName: post.name,
            });
          }
        }
      }

      return reply.send({
        results,
      });
    },
  );
}