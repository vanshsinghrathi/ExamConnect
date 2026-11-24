import type { FastifyInstance } from "fastify";
import { Temporal } from "@js-temporal/polyfill";
import { z } from "zod";
import { db } from "@examconnect/database";

import { requireAuth, requireRole } from "./auth/guards.js";
import { getEmailMode, isSmtpConfigured } from "./email/email-service.js";
import {
  calculateApplicationStatus,
  computeStudentEligibility,
} from "./eligibility/eligibility.js";
import { computeProfileCompletion } from "./student.js";
import { generateDeadlineNotifications } from "./notifications/deadline-notifications.js";

const adminPreHandler = [requireAuth, requireRole("ADMIN")];

const updateExamSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  conductingBody: z.string().trim().min(1).max(200).optional(),
  examType: z.string().trim().max(100).nullable().optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  officialWebsite: z.string().url().max(1000).nullable().optional(),
  isArchived: z.boolean().optional(),
});

const updatePostSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  code: z.string().trim().max(100).nullable().optional(),
  department: z.string().trim().max(200).nullable().optional(),
  vacancies: z.number().int().positive().nullable().optional(),
  qualification: z.string().trim().max(5000).nullable().optional(),
  description: z.string().trim().max(5000).nullable().optional(),
});

const updateRuleVersionSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "DRAFT"]).optional(),
  conditionField: z.string().trim().min(1).max(100).optional(),
  operator: z.string().trim().min(1).max(50).optional(),
  expectedValue: z.string().trim().min(1).max(500).optional(),
  logicGroup: z.string().trim().max(100).nullable().optional(),
  logicOperator: z.enum(["AND", "OR"]).optional(),
  effectiveFrom: z.string().datetime().nullable().optional(),
  effectiveTo: z.string().datetime().nullable().optional(),
  notificationSourceId: z.number().int().positive().nullable().optional(),
});

const updateDeadlineSchema = z.object({
  applicationUrl: z.string().url().max(1000).nullable().optional(),
  status: z.enum(["OPEN", "UPCOMING", "CLOSED", "NOTIFICATION_AWAITED"]).optional(),
  applicationStart: z.string().datetime().nullable().optional(),
  applicationEnd: z.string().datetime().nullable().optional(),
  examDate: z.string().datetime().nullable().optional(),
});

const updateSourceSchema = z.object({
  organization: z.string().trim().min(1).max(200).optional(),
  notificationTitle: z.string().trim().min(1).max(500).optional(),
  officialUrl: z.string().url().max(1000).optional(),
  notificationIdentifier: z.string().trim().max(200).nullable().optional(),
  notificationDate: z.string().datetime().nullable().optional(),
  markVerified: z.boolean().optional(),
});

const broadcastSchema = z.object({
  title: z.string().trim().min(3).max(200),
  message: z.string().trim().min(5).max(2000),
  type: z.string().trim().min(1).max(50).default("ANNOUNCEMENT"),
  examId: z.number().int().positive().optional(),
});

const studentStatusSchema = z.object({
  isActive: z.boolean(),
});

function parsePositiveInt(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function adminManagementRoute(app: FastifyInstance) {
  /*
   * GET /admin/dashboard
   * Aggregate metrics and per-exam eligible student counts
   */
  app.get(
    "/admin/dashboard",
    { preHandler: adminPreHandler },
    async (_request, reply) => {
      const [
        exams,
        posts,
        rules,
        deadlines,
        sources,
        users,
        profiles,
        notifications,
      ] = await Promise.all([
        db.orm.public.Exam.all(),
        db.orm.public.Post.all(),
        db.orm.public.EligibilityRule.all(),
        db.orm.public.ApplicationDeadline.all(),
        db.orm.public.NotificationSource.all(),
        db.orm.public.User.all(),
        db.orm.public.StudentProfile.all(),
        db.orm.public.StudentNotification.all(),
      ]);

      const activeExams = exams.filter((e) => !e.isArchived);
      const archivedExams = exams.filter((e) => e.isArchived);
      const studentUsers = users.filter((u) => u.role === "STUDENT");

      let openDeadlines = 0;
      let upcomingDeadlines = 0;
      let closedDeadlines = 0;
      for (const d of deadlines) {
        const status = calculateApplicationStatus(
          d.applicationStart ? d.applicationStart.toString() : null,
          d.applicationEnd ? d.applicationEnd.toString() : null,
          d.status,
        );
        if (status === "OPEN") openDeadlines += 1;
        else if (status === "UPCOMING" || status === "NOTIFICATION_AWAITED") {
          upcomingDeadlines += 1;
        } else if (status === "CLOSED") closedDeadlines += 1;
      }

      // Compute how many students qualify for each exam
      const eligibleStudentsByExamId = new Map<number, Set<number>>();
      for (const profile of profiles) {
        const { results } = await computeStudentEligibility(profile.userId, {
          createNotifications: false,
          includeArchived: true,
        });
        for (const item of results) {
          if (item.eligible) {
            const set = eligibleStudentsByExamId.get(item.exam.id) ?? new Set<number>();
            set.add(profile.userId);
            eligibleStudentsByExamId.set(item.exam.id, set);
          }
        }
      }

      const examSummaries = exams.map((exam) => ({
        id: exam.id,
        name: exam.name,
        conductingBody: exam.conductingBody,
        examType: exam.examType,
        isArchived: exam.isArchived,
        postCount: posts.filter((p) => p.examId === exam.id).length,
        ruleCount: rules.filter((r) => r.examId === exam.id).length,
        eligibleStudentCount: eligibleStudentsByExamId.get(exam.id)?.size ?? 0,
      }));

      return reply.send({
        metrics: {
          totalExams: exams.length,
          activeExams: activeExams.length,
          archivedExams: archivedExams.length,
          totalPosts: posts.length,
          totalRules: rules.length,
          totalStudents: studentUsers.length,
          completedProfiles: profiles.length,
          totalSources: sources.length,
          verifiedSources: sources.filter((s) => s.lastVerifiedAt !== null).length,
          unverifiedSources: sources.filter((s) => s.lastVerifiedAt === null).length,
          openDeadlines,
          upcomingDeadlines,
          closedDeadlines,
          totalNotifications: notifications.length,
        },
        examSummaries,
      });
    },
  );

  /*
   * GET /admin/exams
   */
  app.get(
    "/admin/exams",
    { preHandler: adminPreHandler },
    async (_request, reply) => {
      const [exams, posts, rules, deadlines, profiles] = await Promise.all([
        db.orm.public.Exam.all(),
        db.orm.public.Post.all(),
        db.orm.public.EligibilityRule.all(),
        db.orm.public.ApplicationDeadline.all(),
        db.orm.public.StudentProfile.all(),
      ]);

      const eligibleStudentsByExamId = new Map<number, Set<number>>();
      for (const profile of profiles) {
        const { results } = await computeStudentEligibility(profile.userId, {
          createNotifications: false,
          includeArchived: true,
        });
        for (const item of results) {
          if (item.eligible) {
            const set = eligibleStudentsByExamId.get(item.exam.id) ?? new Set<number>();
            set.add(profile.userId);
            eligibleStudentsByExamId.set(item.exam.id, set);
          }
        }
      }

      const enriched = exams.map((exam) => {
        const examDeadlines = deadlines.filter((d) => d.examId === exam.id);
        const computedStatuses = examDeadlines.map((d) =>
          calculateApplicationStatus(
            d.applicationStart ? d.applicationStart.toString() : null,
            d.applicationEnd ? d.applicationEnd.toString() : null,
            d.status,
          ),
        );
        return {
          ...exam,
          postCount: posts.filter((p) => p.examId === exam.id).length,
          ruleCount: rules.filter((r) => r.examId === exam.id).length,
          deadlineCount: examDeadlines.length,
          deadlineStatuses: computedStatuses,
          eligibleStudentCount: eligibleStudentsByExamId.get(exam.id)?.size ?? 0,
        };
      });

      return reply.send({ exams: enriched });
    },
  );

  /*
   * GET /admin/exams/:examId
   * Full detail for admin editing (posts, rules with versions, deadlines, sources)
   */
  app.get(
    "/admin/exams/:examId",
    { preHandler: adminPreHandler },
    async (request, reply) => {
      const examId = parsePositiveInt((request.params as { examId: string }).examId);
      if (!examId) {
        return reply.code(400).send({
          error: "INVALID_ID",
          message: "Exam ID must be a positive integer.",
        });
      }

      const exam = await db.orm.public.Exam.where({ id: examId }).first();
      if (!exam) {
        return reply.code(404).send({
          error: "EXAM_NOT_FOUND",
          message: "Exam not found.",
        });
      }

      const [posts, rules, allVersions, deadlines, sources] = await Promise.all([
        db.orm.public.Post.where({ examId }).all(),
        db.orm.public.EligibilityRule.where({ examId }).all(),
        db.orm.public.EligibilityRuleVersion.all(),
        db.orm.public.ApplicationDeadline.where({ examId }).all(),
        db.orm.public.NotificationSource.all(),
      ]);

      const ruleIds = new Set(rules.map((r) => r.id));
      const versionsByRuleId = new Map<number, typeof allVersions>();
      for (const v of allVersions) {
        if (!ruleIds.has(v.eligibilityRuleId)) continue;
        const list = versionsByRuleId.get(v.eligibilityRuleId) ?? [];
        list.push(v);
        versionsByRuleId.set(v.eligibilityRuleId, list);
      }

      const rulesWithVersions = rules.map((r) => ({
        ...r,
        versions: versionsByRuleId.get(r.id) ?? [],
      }));

      const formattedDeadlines = deadlines.map((d) => ({
        ...d,
        computedStatus: calculateApplicationStatus(
          d.applicationStart ? d.applicationStart.toString() : null,
          d.applicationEnd ? d.applicationEnd.toString() : null,
          d.status,
        ),
      }));

      return reply.send({
        exam,
        posts,
        rules: rulesWithVersions,
        deadlines: formattedDeadlines,
        sources,
      });
    },
  );

  /*
   * PATCH /admin/exams/:examId
   * Update exam or archive/unarchive
   */
  app.patch(
    "/admin/exams/:examId",
    { preHandler: adminPreHandler },
    async (request, reply) => {
      const examId = parsePositiveInt((request.params as { examId: string }).examId);
      if (!examId) {
        return reply.code(400).send({
          error: "INVALID_ID",
          message: "Exam ID must be a positive integer.",
        });
      }

      const parsed = updateExamSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_INPUT",
          message: parsed.error.issues[0]?.message ?? "Invalid exam update data.",
        });
      }

      const existing = await db.orm.public.Exam.where({ id: examId }).first();
      if (!existing) {
        return reply.code(404).send({
          error: "EXAM_NOT_FOUND",
          message: "Exam not found.",
        });
      }

      const updated = await db.orm.public.Exam
        .where({ id: examId })
        .update({
          ...parsed.data,
          updatedAt: Temporal.Now.instant(),
        });

      return reply.send({ exam: updated });
    },
  );

  /*
   * PATCH /admin/posts/:postId
   */
  app.patch(
    "/admin/posts/:postId",
    { preHandler: adminPreHandler },
    async (request, reply) => {
      const postId = parsePositiveInt((request.params as { postId: string }).postId);
      if (!postId) {
        return reply.code(400).send({
          error: "INVALID_ID",
          message: "Post ID must be a positive integer.",
        });
      }

      const parsed = updatePostSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_INPUT",
          message: parsed.error.issues[0]?.message ?? "Invalid post data.",
        });
      }

      const existing = await db.orm.public.Post.where({ id: postId }).first();
      if (!existing) {
        return reply.code(404).send({
          error: "POST_NOT_FOUND",
          message: "Post not found.",
        });
      }

      const updated = await db.orm.public.Post
        .where({ id: postId })
        .update({
          ...parsed.data,
          updatedAt: Temporal.Now.instant(),
        });

      return reply.send({ post: updated });
    },
  );

  /*
   * DELETE /admin/posts/:postId
   */
  app.delete(
    "/admin/posts/:postId",
    { preHandler: adminPreHandler },
    async (request, reply) => {
      const postId = parsePositiveInt((request.params as { postId: string }).postId);
      if (!postId) {
        return reply.code(400).send({
          error: "INVALID_ID",
          message: "Post ID must be a positive integer.",
        });
      }

      const existing = await db.orm.public.Post.where({ id: postId }).first();
      if (!existing) {
        return reply.code(404).send({
          error: "POST_NOT_FOUND",
          message: "Post not found.",
        });
      }

      // Safely remove dependent post-scoped rules and deadlines first
      const postRules = await db.orm.public.EligibilityRule.where({ postId }).all();
      for (const rule of postRules) {
        const versions = await db.orm.public.EligibilityRuleVersion
          .where({ eligibilityRuleId: rule.id })
          .all();
        for (const v of versions) {
          await db.orm.public.EligibilityRuleVersion.where({ id: v.id }).delete();
        }
        await db.orm.public.EligibilityRule.where({ id: rule.id }).delete();
      }

      const postDeadlines = await db.orm.public.ApplicationDeadline
        .where({ postId })
        .all();
      for (const d of postDeadlines) {
        await db.orm.public.ApplicationDeadline.where({ id: d.id }).delete();
      }

      await db.orm.public.Post.where({ id: postId }).delete();

      return reply.send({ status: "ok", deletedId: postId });
    },
  );

  /*
   * PATCH /admin/eligibility-rule-versions/:versionId
   */
  app.patch(
    "/admin/eligibility-rule-versions/:versionId",
    { preHandler: adminPreHandler },
    async (request, reply) => {
      const versionId = parsePositiveInt(
        (request.params as { versionId: string }).versionId,
      );
      if (!versionId) {
        return reply.code(400).send({
          error: "INVALID_ID",
          message: "Rule version ID must be a positive integer.",
        });
      }

      const parsed = updateRuleVersionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_INPUT",
          message: parsed.error.issues[0]?.message ?? "Invalid rule version data.",
        });
      }

      const existing = await db.orm.public.EligibilityRuleVersion
        .where({ id: versionId })
        .first();
      if (!existing) {
        return reply.code(404).send({
          error: "RULE_VERSION_NOT_FOUND",
          message: "Rule version not found.",
        });
      }

      const { effectiveFrom, effectiveTo, ...rest } = parsed.data;
      const updated = await db.orm.public.EligibilityRuleVersion
        .where({ id: versionId })
        .update({
          ...rest,
          ...(effectiveFrom !== undefined
            ? {
                effectiveFrom: effectiveFrom
                  ? Temporal.Instant.from(effectiveFrom)
                  : null,
              }
            : {}),
          ...(effectiveTo !== undefined
            ? {
                effectiveTo: effectiveTo
                  ? Temporal.Instant.from(effectiveTo)
                  : null,
              }
            : {}),
          updatedAt: Temporal.Now.instant(),
        });

      return reply.send({ version: updated });
    },
  );

  /*
   * PATCH /admin/deadlines/:deadlineId
   */
  app.patch(
    "/admin/deadlines/:deadlineId",
    { preHandler: adminPreHandler },
    async (request, reply) => {
      const deadlineId = parsePositiveInt(
        (request.params as { deadlineId: string }).deadlineId,
      );
      if (!deadlineId) {
        return reply.code(400).send({
          error: "INVALID_ID",
          message: "Deadline ID must be a positive integer.",
        });
      }

      const parsed = updateDeadlineSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_INPUT",
          message: parsed.error.issues[0]?.message ?? "Invalid deadline data.",
        });
      }

      const existing = await db.orm.public.ApplicationDeadline
        .where({ id: deadlineId })
        .first();
      if (!existing) {
        return reply.code(404).send({
          error: "DEADLINE_NOT_FOUND",
          message: "Deadline not found.",
        });
      }

      const { applicationStart, applicationEnd, examDate, ...rest } = parsed.data;
      const updated = await db.orm.public.ApplicationDeadline
        .where({ id: deadlineId })
        .update({
          ...rest,
          ...(applicationStart !== undefined
            ? {
                applicationStart: applicationStart
                  ? Temporal.Instant.from(applicationStart)
                  : null,
              }
            : {}),
          ...(applicationEnd !== undefined
            ? {
                applicationEnd: applicationEnd
                  ? Temporal.Instant.from(applicationEnd)
                  : null,
              }
            : {}),
          ...(examDate !== undefined
            ? {
                examDate: examDate ? Temporal.Instant.from(examDate) : null,
              }
            : {}),
          updatedAt: Temporal.Now.instant(),
        });

      return reply.send({ deadline: updated });
    },
  );

  /*
   * DELETE /admin/deadlines/:deadlineId
   */
  app.delete(
    "/admin/deadlines/:deadlineId",
    { preHandler: adminPreHandler },
    async (request, reply) => {
      const deadlineId = parsePositiveInt(
        (request.params as { deadlineId: string }).deadlineId,
      );
      if (!deadlineId) {
        return reply.code(400).send({
          error: "INVALID_ID",
          message: "Deadline ID must be a positive integer.",
        });
      }

      const existing = await db.orm.public.ApplicationDeadline
        .where({ id: deadlineId })
        .first();
      if (!existing) {
        return reply.code(404).send({
          error: "DEADLINE_NOT_FOUND",
          message: "Deadline not found.",
        });
      }

      await db.orm.public.ApplicationDeadline.where({ id: deadlineId }).delete();
      return reply.send({ status: "ok", deletedId: deadlineId });
    },
  );

  /*
   * GET /admin/notification-sources
   */
  app.get(
    "/admin/notification-sources",
    { preHandler: adminPreHandler },
    async (_request, reply) => {
      const sources = await db.orm.public.NotificationSource.all();
      sources.sort((a, b) => b.id - a.id);
      return reply.send({ notificationSources: sources });
    },
  );

  /*
   * PATCH /admin/notification-sources/:id
   */
  app.patch(
    "/admin/notification-sources/:id",
    { preHandler: adminPreHandler },
    async (request, reply) => {
      const id = parsePositiveInt((request.params as { id: string }).id);
      if (!id) {
        return reply.code(400).send({
          error: "INVALID_ID",
          message: "Notification source ID must be a positive integer.",
        });
      }

      const parsed = updateSourceSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_INPUT",
          message: parsed.error.issues[0]?.message ?? "Invalid notification source data.",
        });
      }

      const existing = await db.orm.public.NotificationSource.where({ id }).first();
      if (!existing) {
        return reply.code(404).send({
          error: "NOTIFICATION_SOURCE_NOT_FOUND",
          message: "Notification source not found.",
        });
      }

      const now = Temporal.Now.instant();
      const { notificationDate, markVerified, ...rest } = parsed.data;

      const updated = await db.orm.public.NotificationSource
        .where({ id })
        .update({
          ...rest,
          ...(notificationDate !== undefined
            ? {
                notificationDate: notificationDate
                  ? Temporal.Instant.from(notificationDate)
                  : null,
              }
            : {}),
          ...(markVerified ? { lastVerifiedAt: now } : {}),
          updatedAt: now,
        });

      return reply.send({ notificationSource: updated });
    },
  );

  /*
   * GET /admin/students (paginated, never exposes passwordHash)
   */
  app.get(
    "/admin/students",
    { preHandler: adminPreHandler },
    async (request, reply) => {
      const query = request.query as { page?: string; limit?: string; search?: string };
      const page = Math.max(1, Number(query.page ?? 1) || 1);
      const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25) || 25));
      const search = (query.search ?? "").trim().toLowerCase();

      const [users, profiles, educationRecords] = await Promise.all([
        db.orm.public.User.all(),
        db.orm.public.StudentProfile.all(),
        db.orm.public.EducationRecord.all(),
      ]);

      const profileByUserId = new Map(profiles.map((p) => [p.userId, p]));
      const eduCountByProfileId = new Map<number, number>();
      for (const edu of educationRecords) {
        eduCountByProfileId.set(
          edu.studentProfileId,
          (eduCountByProfileId.get(edu.studentProfileId) ?? 0) + 1,
        );
      }

      const allStudents = users
        .map((u) => {
          const profile = profileByUserId.get(u.id) ?? null;
          const eduCount = profile ? (eduCountByProfileId.get(profile.id) ?? 0) : 0;
          const completion = computeProfileCompletion(profile, eduCount);
          return {
            id: u.id,
            email: u.email,
            role: u.role,
            isActive: u.isActive,
            createdAt: u.createdAt,
            firstName: profile?.firstName ?? null,
            lastName: profile?.lastName ?? null,
            category: profile?.category ?? null,
            state: profile?.state ?? null,
            educationCount: eduCount,
            profileCompletion: completion.percentage,
          };
        })
        .filter((s) => {
          if (!search) return true;
          return (
            s.email.toLowerCase().includes(search) ||
            (s.firstName ?? "").toLowerCase().includes(search) ||
            (s.lastName ?? "").toLowerCase().includes(search) ||
            (s.category ?? "").toLowerCase().includes(search)
          );
        });

      const total = allStudents.length;
      const startIndex = (page - 1) * limit;
      const items = allStudents.slice(startIndex, startIndex + limit);

      return reply.send({
        students: items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    },
  );

  /*
   * PATCH /admin/students/:id/status
   */
  app.patch(
    "/admin/students/:id/status",
    { preHandler: adminPreHandler },
    async (request, reply) => {
      const id = parsePositiveInt((request.params as { id: string }).id);
      if (!id) {
        return reply.code(400).send({
          error: "INVALID_ID",
          message: "User ID must be a positive integer.",
        });
      }

      if (id === request.authUser!.id) {
        return reply.code(400).send({
          error: "CANNOT_MODIFY_SELF",
          message: "You cannot deactivate your own admin account.",
        });
      }

      const parsed = studentStatusSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_INPUT",
          message: "isActive boolean is required.",
        });
      }

      const user = await db.orm.public.User.where({ id }).first();
      if (!user) {
        return reply.code(404).send({
          error: "USER_NOT_FOUND",
          message: "User not found.",
        });
      }

      await db.orm.public.User.where({ id }).update({
        isActive: parsed.data.isActive,
        updatedAt: Temporal.Now.instant(),
      });

      // Revoke sessions immediately when deactivating a user
      if (!parsed.data.isActive) {
        const sessions = await db.orm.public.Session.where({ userId: id }).all();
        for (const s of sessions) {
          await db.orm.public.Session.where({ id: s.id }).delete();
        }
      }

      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          isActive: parsed.data.isActive,
        },
      });
    },
  );

  /*
   * GET /admin/notifications
   */
  app.get(
    "/admin/notifications",
    { preHandler: adminPreHandler },
    async (_request, reply) => {
      const notifications = await db.orm.public.StudentNotification.all();
      notifications.sort(
        (a, b) =>
          new Date(b.createdAt.toString()).getTime() -
          new Date(a.createdAt.toString()).getTime(),
      );
      return reply.send({
        notifications: notifications.slice(0, 100),
        total: notifications.length,
      });
    },
  );

  /*
   * POST /admin/notifications/broadcast
   */
  app.post(
    "/admin/notifications/broadcast",
    { preHandler: adminPreHandler },
    async (request, reply) => {
      const parsed = broadcastSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_INPUT",
          message: parsed.error.issues[0]?.message ?? "Invalid broadcast payload.",
        });
      }

      const users = await db.orm.public.User.where({
        role: "STUDENT",
        isActive: true,
      }).all();

      for (const user of users) {
        await db.orm.public.StudentNotification.create({
          userId: user.id,
          type: parsed.data.type,
          title: parsed.data.title,
          message: parsed.data.message,
          examId: parsed.data.examId,
          isRead: false,
        });
      }

      return reply.code(201).send({
        sentCount: users.length,
      });
    },
  );

  /*
   * POST /admin/notifications/run-reminders
   */
  app.post(
    "/admin/notifications/run-reminders",
    { preHandler: adminPreHandler },
    async (_request, reply) => {
      const result = await generateDeadlineNotifications();
      return reply.send({
        status: "ok",
        createdCount: result.createdCount,
      });
    },
  );

  /*
   * GET /admin/system-health
   */
  app.get(
    "/admin/system-health",
    { preHandler: adminPreHandler },
    async (_request, reply) => {
      let dbConnected = false;
      let counts = {
        users: 0,
        exams: 0,
        posts: 0,
        rules: 0,
        deadlines: 0,
        sources: 0,
        unverifiedSources: 0,
        activeSessions: 0,
      };

      try {
        const [users, exams, posts, rules, deadlines, sources, sessions] =
          await Promise.all([
            db.orm.public.User.all(),
            db.orm.public.Exam.all(),
            db.orm.public.Post.all(),
            db.orm.public.EligibilityRule.all(),
            db.orm.public.ApplicationDeadline.all(),
            db.orm.public.NotificationSource.all(),
            db.orm.public.Session.all(),
          ]);

        dbConnected = true;
        counts = {
          users: users.length,
          exams: exams.length,
          posts: posts.length,
          rules: rules.length,
          deadlines: deadlines.length,
          sources: sources.length,
          unverifiedSources: sources.filter((s) => s.lastVerifiedAt === null).length,
          activeSessions: sessions.length,
        };
      } catch {
        dbConnected = false;
      }

      return reply.send({
        status: dbConnected ? "healthy" : "degraded",
        environment: process.env.NODE_ENV ?? "development",
        nodeVersion: process.version,
        uptimeSeconds: Math.floor(process.uptime()),
        database: {
          connected: dbConnected,
        },
        email: {
          smtpConfigured: isSmtpConfigured(),
          mode: getEmailMode(),
        },
        redis: {
          configured: Boolean(process.env.REDIS_HOST || process.env.REDIS_URL),
        },
        counts,
      });
    },
  );
}
