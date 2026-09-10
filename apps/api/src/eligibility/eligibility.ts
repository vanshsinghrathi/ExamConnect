import type { FastifyInstance } from "fastify";
import { db } from "@examconnect/database";

import { requireAuth } from "../auth/guards.js";
import {
  evaluateEligibility,
  type EligibilityRule,
  type EligibilityStudent,
} from "./evaluator.js";

export async function eligibilityRoute(app: FastifyInstance) {
  app.get(
    "/student/eligible-exams",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const userId = request.authUser!.id;

      const profile = await db.orm.public.StudentProfile
        .where({ userId })
        .first();

      if (!profile) {
        return reply.code(404).send({
          error: "PROFILE_NOT_FOUND",
          message: "Student profile not found.",
        });
      }

      const educationRecords = await db.orm.public.EducationRecord
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
        education: educationRecords.map((education) => ({
          qualification: education.qualification,
          percentage: education.percentage,
          passingYear: education.passingYear,
          stream: education.stream,
        })),
      };

      const exams = await db.orm.public.Exam.all();

      const results = [];

      for (const exam of exams) {
        const posts = await db.orm.public.Post
          .where({
            examId: exam.id,
          })
          .all();

        /*
         * Exam-level rules:
         * postId = null
         */
        const examRules = await db.orm.public.EligibilityRule
          .where({
            examId: exam.id,
            postId: null,
          })
          .all();

        const activeExamRules: EligibilityRule[] = [];

        for (const rule of examRules) {
          const version = await db.orm.public.EligibilityRuleVersion
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
            conditionField: version.conditionField,
            operator: version.operator,
            expectedValue: version.expectedValue,
          });
        }

        /*
         * No posts:
         * evaluate exam-level rules directly.
         */
        if (posts.length === 0) {
          const evaluation = evaluateEligibility(
            student,
            activeExamRules,
          );

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
          });

          continue;
        }

        /*
         * Exam has posts:
         * combine exam-level rules + post-level rules.
         */
        for (const post of posts) {
          const postRules = await db.orm.public.EligibilityRule
            .where({
              examId: exam.id,
              postId: post.id,
            })
            .all();

          const activePostRules: EligibilityRule[] = [];

          for (const rule of postRules) {
            const version = await db.orm.public.EligibilityRuleVersion
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
              conditionField: version.conditionField,
              operator: version.operator,
              expectedValue: version.expectedValue,
            });
          }

          const combinedRules = [
            ...activeExamRules,
            ...activePostRules,
          ];

          const evaluation = evaluateEligibility(
            student,
            combinedRules,
          );

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
              description: post.description,
            },
            eligible: evaluation.eligible,
            reasons: evaluation.reasons,
          });
        }
      }

      return reply.send({
        results,
      });
    },
  );
}