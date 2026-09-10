import type { FastifyInstance } from "fastify";
import { db } from "@examconnect/database";

import { requireAuth } from "../auth/guards.js";
import {
  evaluateEligibility,
  type EligibilityStudent,
  type EligibilityRule,
} from "./evaluator.js";

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

      const profile = await db.orm.public.StudentProfile
        .where({
          userId,
        })
        .first();

      if (!profile) {
        return reply.code(404).send({
          error: "PROFILE_NOT_FOUND",
          message: "Create your student profile first.",
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
          (record) => ({
            qualification: record.qualification,
            percentage: record.percentage,
            passingYear: record.passingYear,
            stream: record.stream,
          }),
        ),
      };

      const exams =
        await db.orm.public.Exam.all();

      const results = [];

      for (const exam of exams) {
        const posts =
          await db.orm.public.Post
            .where({
              examId: exam.id,
            })
            .all();

        if (posts.length === 0) {
          const rules =
            await db.orm.public.EligibilityRule
              .where({
                examId: exam.id,
              })
              .all();

          const evaluatorRules: EligibilityRule[] =
            [];

          for (const rule of rules) {
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

            evaluatorRules.push({
              name: rule.name,
              conditionField:
                version.conditionField,
              operator: version.operator,
              expectedValue:
                version.expectedValue,
            });
          }

          const eligibility =
            evaluateEligibility(
              student,
              evaluatorRules,
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
            eligible: eligibility.eligible,
            reasons: eligibility.reasons,
          });

          continue;
        }

        for (const post of posts) {
          const rules =
            await db.orm.public.EligibilityRule
              .where({
                examId: exam.id,
                postId: post.id,
              })
              .all();

          const evaluatorRules: EligibilityRule[] =
            [];

          for (const rule of rules) {
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

            evaluatorRules.push({
              name: rule.name,
              conditionField:
                version.conditionField,
              operator: version.operator,
              expectedValue:
                version.expectedValue,
            });
          }

          const eligibility =
            evaluateEligibility(
              student,
              evaluatorRules,
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
            eligible: eligibility.eligible,
            reasons: eligibility.reasons,
          });
        }
      }

      return reply.send({
        results,
      });
    },
  );
}
