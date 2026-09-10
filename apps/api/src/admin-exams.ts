import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Temporal } from "@js-temporal/polyfill";
import { db } from "@examconnect/database";

import {
  requireAuth,
  requireRole,
} from "./auth/guards.js";

const createExamSchema = z.object({
  name: z.string().trim().min(1).max(200),
  conductingBody: z.string().trim().min(1).max(200),
  examType: z.string().trim().max(100).optional(),
  description: z.string().trim().max(5000).optional(),
  officialWebsite: z.string().url().max(1000).optional(),
});

const createPostSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().max(100).optional(),
  description: z.string().trim().max(5000).optional(),
});

const createEligibilityRuleSchema = z.object({
  postId: z.number().int().positive().optional(),
  ruleType: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  versionNumber: z.number().int().positive().default(1),
  versionStatus: z.string().trim().min(1).max(50).default("ACTIVE"),
  conditionField: z.string().trim().min(1).max(100),
  operator: z.string().trim().min(1).max(50),
  expectedValue: z.string().trim().min(1).max(500),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().optional(),
});

const createDeadlineSchema = z.object({
  postId: z.number().int().positive().optional(),
  applicationUrl: z.string().url().max(1000).optional(),
  status: z.string().trim().min(1).max(50),
  applicationStart: z.string().datetime().optional(),
  applicationEnd: z.string().datetime().optional(),
  examDate: z.string().datetime().optional(),
});

const attachSourceSchema = z.object({
  notificationSourceId: z.number().int().positive(),
});

export async function adminExamRoute(app: FastifyInstance) {
  app.post(
    "/admin/exams",
    {
      preHandler: [
        requireAuth,
        requireRole("ADMIN"),
      ],
    },
    async (request, reply) => {
      const parsed = createExamSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_INPUT",
          message: "Invalid exam data.",
        });
      }

      const exam = await db.orm.public.Exam.create({
        name: parsed.data.name,
        conductingBody: parsed.data.conductingBody,
        examType: parsed.data.examType,
        description: parsed.data.description,
        officialWebsite: parsed.data.officialWebsite,
        updatedAt: Temporal.Now.instant(),
      });

      return reply.code(201).send({
        exam,
      });
    },
  );

  app.post(
    "/admin/exams/:examId/posts",
    {
      preHandler: [
        requireAuth,
        requireRole("ADMIN"),
      ],
    },
    async (request, reply) => {
      const examId = Number(
        (request.params as { examId: string }).examId,
      );

      if (!Number.isInteger(examId) || examId <= 0) {
        return reply.code(400).send({
          error: "INVALID_ID",
          message: "Exam ID must be a positive integer.",
        });
      }

      const parsed = createPostSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_INPUT",
          message: "Invalid post data.",
        });
      }

      const exam = await db.orm.public.Exam
        .where({
          id: examId,
        })
        .first();

      if (!exam) {
        return reply.code(404).send({
          error: "EXAM_NOT_FOUND",
          message: "Exam not found.",
        });
      }

      const post = await db.orm.public.Post.create({
        examId,
        name: parsed.data.name,
        code: parsed.data.code,
        description: parsed.data.description,
        updatedAt: Temporal.Now.instant(),
      });

      return reply.code(201).send({
        post,
      });
    },
  );

  app.post(
    "/admin/exams/:examId/eligibility-rules",
    {
      preHandler: [
        requireAuth,
        requireRole("ADMIN"),
      ],
    },
    async (request, reply) => {
      const examId = Number(
        (request.params as { examId: string }).examId,
      );

      if (!Number.isInteger(examId) || examId <= 0) {
        return reply.code(400).send({
          error: "INVALID_ID",
          message: "Exam ID must be a positive integer.",
        });
      }

      const parsed = createEligibilityRuleSchema.safeParse(
        request.body,
      );

      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_INPUT",
          message: "Invalid eligibility rule data.",
        });
      }

      const exam = await db.orm.public.Exam
        .where({
          id: examId,
        })
        .first();

      if (!exam) {
        return reply.code(404).send({
          error: "EXAM_NOT_FOUND",
          message: "Exam not found.",
        });
      }

      if (parsed.data.postId !== undefined) {
        const post = await db.orm.public.Post
          .where({
            id: parsed.data.postId,
            examId,
          })
          .first();

        if (!post) {
          return reply.code(404).send({
            error: "POST_NOT_FOUND",
            message: "Post not found for this exam.",
          });
        }
      }

      const now = Temporal.Now.instant();

      const rule = await db.orm.public.EligibilityRule.create({
        examId,
        postId: parsed.data.postId,
        ruleType: parsed.data.ruleType,
        name: parsed.data.name,
        description: parsed.data.description,
        updatedAt: now,
      });

      const version =
        await db.orm.public.EligibilityRuleVersion.create({
          eligibilityRuleId: rule.id,
          versionNumber: parsed.data.versionNumber,
          status: parsed.data.versionStatus,
          conditionField: parsed.data.conditionField,
          operator: parsed.data.operator,
          expectedValue: parsed.data.expectedValue,
          effectiveFrom: parsed.data.effectiveFrom
            ? Temporal.Instant.from(parsed.data.effectiveFrom)
            : undefined,
          effectiveTo: parsed.data.effectiveTo
            ? Temporal.Instant.from(parsed.data.effectiveTo)
            : undefined,
          updatedAt: now,
        });

      return reply.code(201).send({
        eligibilityRule: rule,
        version,
      });
    },
  );

  app.post(
    "/admin/exams/:examId/deadlines",
    {
      preHandler: [
        requireAuth,
        requireRole("ADMIN"),
      ],
    },
    async (request, reply) => {
      const examId = Number(
        (request.params as { examId: string }).examId,
      );

      if (!Number.isInteger(examId) || examId <= 0) {
        return reply.code(400).send({
          error: "INVALID_ID",
          message: "Exam ID must be a positive integer.",
        });
      }

      const parsed = createDeadlineSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_INPUT",
          message: "Invalid application deadline data.",
        });
      }

      const exam = await db.orm.public.Exam
        .where({
          id: examId,
        })
        .first();

      if (!exam) {
        return reply.code(404).send({
          error: "EXAM_NOT_FOUND",
          message: "Exam not found.",
        });
      }

      if (parsed.data.postId !== undefined) {
        const post = await db.orm.public.Post
          .where({
            id: parsed.data.postId,
            examId,
          })
          .first();

        if (!post) {
          return reply.code(404).send({
            error: "POST_NOT_FOUND",
            message: "Post not found for this exam.",
          });
        }
      }

      const deadline =
        await db.orm.public.ApplicationDeadline.create({
          examId,
          postId: parsed.data.postId,
          applicationUrl: parsed.data.applicationUrl,
          status: parsed.data.status,
          applicationStart: parsed.data.applicationStart
            ? Temporal.Instant.from(parsed.data.applicationStart)
            : undefined,
          applicationEnd: parsed.data.applicationEnd
            ? Temporal.Instant.from(parsed.data.applicationEnd)
            : undefined,
          examDate: parsed.data.examDate
            ? Temporal.Instant.from(parsed.data.examDate)
            : undefined,
          updatedAt: Temporal.Now.instant(),
        });

      return reply.code(201).send({
        deadline,
      });
    },
  );

  /*
   * Attach an official notification source
   * to an eligibility rule version.
   */
  app.patch(
    "/admin/eligibility-rule-versions/:versionId/source",
    {
      preHandler: [
        requireAuth,
        requireRole("ADMIN"),
      ],
    },
    async (request, reply) => {
      const versionId = Number(
        (request.params as { versionId: string }).versionId,
      );

      if (!Number.isInteger(versionId) || versionId <= 0) {
        return reply.code(400).send({
          error: "INVALID_ID",
          message:
            "Eligibility rule version ID must be a positive integer.",
        });
      }

      const parsed =
        attachSourceSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_INPUT",
          message:
            "Invalid notification source data.",
        });
      }

      const version =
        await db.orm.public.EligibilityRuleVersion
          .where({
            id: versionId,
          })
          .first();

      if (!version) {
        return reply.code(404).send({
          error: "RULE_VERSION_NOT_FOUND",
          message:
            "Eligibility rule version not found.",
        });
      }

      const source =
        await db.orm.public.NotificationSource
          .where({
            id: parsed.data.notificationSourceId,
          })
          .first();

      if (!source) {
        return reply.code(404).send({
          error: "NOTIFICATION_SOURCE_NOT_FOUND",
          message:
            "Notification source not found.",
        });
      }

      const updated =
        await db.orm.public.EligibilityRuleVersion
          .where({
            id: versionId,
          })
          .update({
            notificationSourceId:
              parsed.data.notificationSourceId,
            updatedAt: Temporal.Now.instant(),
          });

      return reply.send({
        version: updated,
        notificationSource: source,
      });
    },
  );
}