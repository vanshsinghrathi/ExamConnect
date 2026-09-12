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
    const start = new Date(
      applicationStart,
    );

    if (now < start) {
      return "UPCOMING";
    }
  }

  if (applicationEnd) {
    const end = new Date(
      applicationEnd,
    );

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
 *
 * Example:
 *
 * General:32,OBC:35,SC:37,ST:37,EWS:32
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

export async function eligibilityRoute(
  app: FastifyInstance,
) {
  app.get(
    "/student/eligible-exams",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const userId =
        request.authUser!.id;

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
          message:
            "Student profile not found.",
        });
      }

      /*
       * Load all education records.
       */
      const educationRecords =
        await db.orm.public.EducationRecord
          .where({
            studentProfileId:
              profile.id,
          })
          .all();

      const student: EligibilityStudent =
        {
          profile: {
            category:
              profile.category,
            state:
              profile.state,
            dateOfBirth:
              profile.dateOfBirth
                ? profile.dateOfBirth.toString()
                : null,
          },

          education:
            educationRecords.map(
              (education) => ({
                qualification:
                  education.qualification,
                percentage:
                  education.percentage,
                passingYear:
                  education.passingYear,
                stream:
                  education.stream,
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

        const activeExamRules: EligibilityRule[] =
          [];

        const examSources: EligibilitySource[] =
          [];

        /*
         * Build exam-level rules and
         * official notification sources.
         */
        for (const rule of examRules) {
          const version =
            await db.orm.public.EligibilityRuleVersion
              .where({
                eligibilityRuleId:
                  rule.id,
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
                  ruleType:
                    rule.ruleType,
                  description:
                    rule.description,
                },
                version.expectedValue,
              ),

            logicGroup:
              version.logicGroup,

            logicOperator:
              version.logicOperator,
          });

          if (
            version.notificationSourceId
          ) {
            const source =
              await db.orm.public.NotificationSource
                .where({
                  id: version.notificationSourceId,
                })
                .first();

            if (source) {
              examSources.push({
                id: source.id,

                organization:
                  source.organization,

                notificationTitle:
                  source.notificationTitle,

                notificationDate:
                  source.notificationDate
                    ? source.notificationDate.toString()
                    : null,

                officialUrl:
                  source.officialUrl,

                notificationIdentifier:
                  source.notificationIdentifier,

                dateImported:
                  source.dateImported.toString(),

                lastVerifiedAt:
                  source.lastVerifiedAt
                    ? source.lastVerifiedAt.toString()
                    : null,
              });
            }
          }
        }

        /*
         * Remove duplicate exam-level sources.
         */
        const uniqueExamSources =
          Array.from(
            new Map(
              examSources.map(
                (source) => [
                  source.id,
                  source,
                ],
              ),
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
            deadlines.map(
              (deadline) => {
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

                  applicationUrl:
                    deadline.applicationUrl,

                  status:
                    calculateApplicationStatus(
                      applicationStart,
                      applicationEnd,
                    ),

                  applicationStart,

                  applicationEnd,

                  examDate:
                    deadline.examDate
                      ? deadline.examDate.toString()
                      : null,
                };
              },
            );

          results.push({
            exam: {
              id: exam.id,

              name: exam.name,

              conductingBody:
                exam.conductingBody,

              examType:
                exam.examType,

              description:
                exam.description,

              officialWebsite:
                exam.officialWebsite,
            },

            post: null,

            eligible:
              evaluation.eligible,

            reasons:
              evaluation.reasons,

            sources:
              uniqueExamSources,

            deadlines:
              formattedDeadlines,
          });

          if (evaluation.eligible) {
            await createNewEligibleExamNotification(
              {
                userId,

                examId:
                  exam.id,

                postId:
                  null,

                examName:
                  exam.name,

                postName:
                  null,
              },
            );
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

          const activePostRules: EligibilityRule[] =
            [];

          const postSources: EligibilitySource[] =
            [];

          /*
           * Build post-specific rules.
           */
          for (const rule of postRules) {
            const version =
              await db.orm.public.EligibilityRuleVersion
                .where({
                  eligibilityRuleId:
                    rule.id,

                  status:
                    "ACTIVE",
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
                    ruleType:
                      rule.ruleType,

                    description:
                      rule.description,
                  },

                  version.expectedValue,
                ),

              logicGroup:
                version.logicGroup,

              logicOperator:
                version.logicOperator,
            });

            if (
              version.notificationSourceId
            ) {
              const source =
                await db.orm.public.NotificationSource
                  .where({
                    id: version.notificationSourceId,
                  })
                  .first();

              if (source) {
                postSources.push({
                  id: source.id,

                  organization:
                    source.organization,

                  notificationTitle:
                    source.notificationTitle,

                  notificationDate:
                    source.notificationDate
                      ? source.notificationDate.toString()
                      : null,

                  officialUrl:
                    source.officialUrl,

                  notificationIdentifier:
                    source.notificationIdentifier,

                  dateImported:
                    source.dateImported.toString(),

                  lastVerifiedAt:
                    source.lastVerifiedAt
                      ? source.lastVerifiedAt.toString()
                      : null,
                });
              }
            }
          }

          /*
           * Add official qualification stored
           * directly on the Post.
           */
          if (post.qualification) {
            activePostRules.push({
              name:
                "Qualification Requirement",

              conditionField:
                "qualificationRequirement",

              operator:
                "REQUIRED",

              expectedValue:
                post.qualification,

              qualificationRequirement:
                post.qualification,

              /*
               * Post qualification is an
               * individual AND requirement.
               */
              logicGroup:
                null,

              logicOperator:
                "AND",
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
           * use exam-level deadline when
           * post-specific deadline doesn't exist.
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
            deadlines.map(
              (deadline) => {
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

                  applicationUrl:
                    deadline.applicationUrl,

                  status:
                    calculateApplicationStatus(
                      applicationStart,
                      applicationEnd,
                    ),

                  applicationStart,

                  applicationEnd,

                  examDate:
                    deadline.examDate
                      ? deadline.examDate.toString()
                      : null,
                };
              },
            );

          /*
           * Combine exam-level and
           * post-level official sources.
           */
          const combinedSources = [
            ...uniqueExamSources,
            ...postSources,
          ];

          const uniqueSources =
            Array.from(
              new Map(
                combinedSources.map(
                  (source) => [
                    source.id,
                    source,
                  ],
                ),
              ).values(),
            );

          /*
           * Return post information.
           */
          results.push({
            exam: {
              id: exam.id,

              name: exam.name,

              conductingBody:
                exam.conductingBody,

              examType:
                exam.examType,

              description:
                exam.description,

              officialWebsite:
                exam.officialWebsite,
            },

            post: {
              id: post.id,

              name: post.name,

              code: post.code,

              department:
                post.department,

              vacancies:
                post.vacancies,

              qualification:
                post.qualification,

              description:
                post.description,
            },

            eligible:
              evaluation.eligible,

            reasons:
              evaluation.reasons,

            sources:
              uniqueSources,

            deadlines:
              formattedDeadlines,
          });

          /*
           * Create notification when
           * student qualifies.
           */
          if (evaluation.eligible) {
            await createNewEligibleExamNotification(
              {
                userId,

                examId:
                  exam.id,

                postId:
                  post.id,

                examName:
                  exam.name,

                postName:
                  post.name,
              },
            );
          }
        }
      }

      return reply.send({
        results,
      });
    },
  );
}