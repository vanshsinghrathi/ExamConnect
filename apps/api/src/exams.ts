import type { FastifyInstance } from "fastify";
import { db } from "@examconnect/database";

export async function examRoute(app: FastifyInstance) {
  /*
   * GET /exams
   * Returns all exams.
   */
  app.get("/exams", async (_request, reply) => {
    const exams = await db.orm.public.Exam.all();

    return reply.send({
      exams,
    });
  });

  /*
   * GET /exams/:id
   * Returns one exam.
   */
  app.get("/exams/:id", async (request, reply) => {
    const id = Number((request.params as { id: string }).id);

    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(400).send({
        error: "INVALID_ID",
        message: "Exam ID must be a positive integer.",
      });
    }

    const exam = await db.orm.public.Exam
      .where({ id })
      .first();

    if (!exam) {
      return reply.code(404).send({
        error: "EXAM_NOT_FOUND",
        message: "Exam not found.",
      });
    }

    return reply.send({
      exam,
    });
  });

  /*
   * GET /exams/:id/posts
   * Returns posts belonging to an exam.
   */
  app.get("/exams/:id/posts", async (request, reply) => {
    const examId = Number((request.params as { id: string }).id);

    if (!Number.isInteger(examId) || examId <= 0) {
      return reply.code(400).send({
        error: "INVALID_ID",
        message: "Exam ID must be a positive integer.",
      });
    }

    const exam = await db.orm.public.Exam
      .where({ id: examId })
      .first();

    if (!exam) {
      return reply.code(404).send({
        error: "EXAM_NOT_FOUND",
        message: "Exam not found.",
      });
    }

    const posts = await db.orm.public.Post
      .where({ examId })
      .all();

    return reply.send({
      posts,
    });
  });

  /*
   * GET /exams/:id/eligibility-rules
   * Returns eligibility rules belonging to an exam.
   */
  app.get(
    "/exams/:id/eligibility-rules",
    async (request, reply) => {
      const examId = Number(
        (request.params as { id: string }).id,
      );

      if (!Number.isInteger(examId) || examId <= 0) {
        return reply.code(400).send({
          error: "INVALID_ID",
          message: "Exam ID must be a positive integer.",
        });
      }

      const exam = await db.orm.public.Exam
        .where({ id: examId })
        .first();

      if (!exam) {
        return reply.code(404).send({
          error: "EXAM_NOT_FOUND",
          message: "Exam not found.",
        });
      }

      const rules = await db.orm.public.EligibilityRule
        .where({ examId })
        .all();

      return reply.send({
        eligibilityRules: rules,
      });
    },
  );

  /*
   * GET /exams/:id/deadlines
   * Returns application deadlines belonging to an exam.
   */
  app.get(
    "/exams/:id/deadlines",
    async (request, reply) => {
      const examId = Number(
        (request.params as { id: string }).id,
      );

      if (!Number.isInteger(examId) || examId <= 0) {
        return reply.code(400).send({
          error: "INVALID_ID",
          message: "Exam ID must be a positive integer.",
        });
      }

      const exam = await db.orm.public.Exam
        .where({ id: examId })
        .first();

      if (!exam) {
        return reply.code(404).send({
          error: "EXAM_NOT_FOUND",
          message: "Exam not found.",
        });
      }

      const deadlines = await db.orm.public.ApplicationDeadline
        .where({ examId })
        .all();

      return reply.send({
        deadlines,
      });
    },
  );
}