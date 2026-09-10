import type { FastifyInstance } from "fastify";
import { db } from "@examconnect/database";

import { requireAuth } from "../auth/guards.js";
import {
  evaluateEligibility,
  type EligibilityRule,
  type EligibilityStudent,
} from "./evaluator.js";

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

export async function eligibilityRoute(app: FastifyInstance) {
  app.get(
    "/student/eligible-exams",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const userId = request.authUser!.id;

      const profile =
        await db.orm.public.StudentProfile
          .where({ userId })
          .first();

      if (!profile) {
        return reply.code(404).send({
          error: "PROFILE_NOT_FOUND",
          message: "Student profile not found.",
        });
      }

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
            qualification:
              education.qualification,
            percentage:
              education.percentage,
            passingYear:
              education.passingYear,
            stream: education.stream,
          }),
        ),
      };

      const exams = await db.orm.public.Exam.all();

      const results = [];

      for (const exam of exams) {
        const posts =
          await db.orm.public.Post
            .where({
              examId: exam.id,
            })
            .all();

        /*
         * Exam-level rules
         */
        const examRules =
          await db.orm.public.EligibilityRule
            .where({
              examId: exam.id,
              postId: null,
            })
            .all();

        const activeExamRules:
          EligibilityRule[] = [];

        const examSources:
          EligibilitySource[] = [];

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
            operator: version.operator,
            expectedValue:
              version.expectedValue,
          });

          if (version.notificationSourceId) {
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
         * No posts
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

          const formattedDeadlines:
            EligibilityDeadline[] =
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
              examType: exam.examType,
              description: exam.description,
              officialWebsite:
                exam.officialWebsite,
            },
            post: null,
            eligible: evaluation.eligible,
            reasons: evaluation.reasons,
            sources: uniqueExamSources,
            deadlines: formattedDeadlines,
          });

          continue;
        }

        /*
         * Exam has posts
         */
        for (const post of posts) {
          const postRules =
            await db.orm.public.EligibilityRule
              .where({
                examId: exam.id,
                postId: post.id,
              })
              .all();

          const activePostRules:
            EligibilityRule[] = [];

          const postSources:
            EligibilitySource[] = [];

          for (const rule of postRules) {
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

            activePostRules.push({
              name: rule.name,
              conditionField:
                version.conditionField,
              operator: version.operator,
              expectedValue:
                version.expectedValue,
            });

            if (version.notificationSourceId) {
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

          const combinedRules = [
            ...activeExamRules,
            ...activePostRules,
          ];

          const evaluation =
            evaluateEligibility(
              student,
              combinedRules,
            );

          /*
           * Load deadlines for this post.
           * If there is no post-specific deadline,
           * also check exam-level deadlines.
           */
          let deadlines =
            await db.orm.public.ApplicationDeadline
              .where({
                examId: exam.id,
                postId: post.id,
              })
              .all();

          if (deadlines.length === 0) {
            deadlines =
              await db.orm.public.ApplicationDeadline
                .where({
                  examId: exam.id,
                  postId: null,
                })
                .all();
          }

          const formattedDeadlines:
            EligibilityDeadline[] =
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

          results.push({
            exam: {
              id: exam.id,
              name: exam.name,
              conductingBody:
                exam.conductingBody,
              examType: exam.examType,
              description: exam.description,
              officialWebsite:
                exam.officialWebsite,
            },
            post: {
              id: post.id,
              name: post.name,
              code: post.code,
              description:
                post.description,
            },
            eligible: evaluation.eligible,
            reasons: evaluation.reasons,
            sources: uniqueSources,
            deadlines: formattedDeadlines,
          });
        }
      }

      return reply.send({
        results,
      });
    },
  );
}