import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Temporal } from "@js-temporal/polyfill";
import { db } from "@examconnect/database";

import { requireAuth } from "./auth/guards.js";

const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().max(100).optional(),
  dateOfBirth: z.string().datetime().optional(),
  gender: z.string().trim().max(50).optional(),
  state: z.string().trim().max(100).optional(),
  category: z.string().trim().max(50).optional(),
});

const educationSchema = z.object({
  qualification: z.string().trim().min(1).max(100),
  courseName: z.string().trim().max(150).optional(),
  institutionName: z.string().trim().max(200).optional(),
  boardOrUniversity: z.string().trim().max(200).optional(),
  passingYear: z.number().int().min(1900).max(2100).optional(),
  percentage: z.number().min(0).max(100).optional(),
  stream: z.string().trim().max(100).optional(),
});

const educationUpdateSchema = educationSchema.partial();

export async function studentRoute(app: FastifyInstance) {
  app.get(
    "/student/profile",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const profile = await db.orm.public.StudentProfile
        .where({
          userId: request.authUser!.id,
        })
        .first();

      if (!profile) {
        return reply.code(404).send({
          error: "PROFILE_NOT_FOUND",
          message: "Student profile has not been created yet.",
        });
      }

      return reply.send({
        profile,
      });
    },
  );

  app.put(
    "/student/profile",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const parsed = profileSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_INPUT",
          message: "Invalid student profile data.",
        });
      }

      const userId = request.authUser!.id;

      const existingProfile = await db.orm.public.StudentProfile
        .where({
          userId,
        })
        .first();

      const data = {
        userId,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        dateOfBirth: parsed.data.dateOfBirth
          ? Temporal.Instant.from(parsed.data.dateOfBirth)
          : undefined,
        gender: parsed.data.gender,
        state: parsed.data.state,
        category: parsed.data.category,
        updatedAt: Temporal.Now.instant(),
      };

      if (!existingProfile) {
        const profile = await db.orm.public.StudentProfile.create(data);

        return reply.code(201).send({
          profile,
        });
      }

      const profile = await db.orm.public.StudentProfile
        .where({
          id: existingProfile.id,
        })
        .update(data);

      return reply.send({
        profile,
      });
    },
  );

  app.get(
    "/student/education",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const profile = await db.orm.public.StudentProfile
        .where({
          userId: request.authUser!.id,
        })
        .first();

      if (!profile) {
        return reply.code(404).send({
          error: "PROFILE_NOT_FOUND",
          message: "Student profile not found.",
        });
      }

      const records = await db.orm.public.EducationRecord
        .where({
          studentProfileId: profile.id,
        })
        .all();

      return reply.send({
        education: records,
      });
    },
  );

  app.post(
    "/student/education",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const parsed = educationSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_INPUT",
          message: "Invalid education data.",
        });
      }

      const profile = await db.orm.public.StudentProfile
        .where({
          userId: request.authUser!.id,
        })
        .first();

      if (!profile) {
        return reply.code(404).send({
          error: "PROFILE_NOT_FOUND",
          message: "Create your student profile first.",
        });
      }

      const record = await db.orm.public.EducationRecord.create({
        studentProfileId: profile.id,
        qualification: parsed.data.qualification,
        courseName: parsed.data.courseName,
        institutionName: parsed.data.institutionName,
        boardOrUniversity: parsed.data.boardOrUniversity,
        passingYear: parsed.data.passingYear,
        percentage: parsed.data.percentage,
        stream: parsed.data.stream,
        updatedAt: Temporal.Now.instant(),
      });

      return reply.code(201).send({
        education: record,
      });
    },
  );

  app.put(
    "/student/education/:id",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);

      if (!Number.isInteger(id) || id <= 0) {
        return reply.code(400).send({
          error: "INVALID_ID",
          message: "Education record ID must be a positive integer.",
        });
      }

      const parsed = educationUpdateSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_INPUT",
          message: "Invalid education data.",
        });
      }

      const profile = await db.orm.public.StudentProfile
        .where({
          userId: request.authUser!.id,
        })
        .first();

      if (!profile) {
        return reply.code(404).send({
          error: "PROFILE_NOT_FOUND",
          message: "Student profile not found.",
        });
      }

      const record = await db.orm.public.EducationRecord
        .where({
          id,
          studentProfileId: profile.id,
        })
        .first();

      if (!record) {
        return reply.code(404).send({
          error: "EDUCATION_NOT_FOUND",
          message: "Education record not found.",
        });
      }

      const updated = await db.orm.public.EducationRecord
        .where({
          id: record.id,
        })
        .update({
          ...parsed.data,
          updatedAt: Temporal.Now.instant(),
        });

      return reply.send({
        education: updated,
      });
    },
  );

  app.delete(
    "/student/education/:id",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);

      if (!Number.isInteger(id) || id <= 0) {
        return reply.code(400).send({
          error: "INVALID_ID",
          message: "Education record ID must be a positive integer.",
        });
      }

      const profile = await db.orm.public.StudentProfile
        .where({
          userId: request.authUser!.id,
        })
        .first();

      if (!profile) {
        return reply.code(404).send({
          error: "PROFILE_NOT_FOUND",
          message: "Student profile not found.",
        });
      }

      const record = await db.orm.public.EducationRecord
        .where({
          id,
          studentProfileId: profile.id,
        })
        .first();

      if (!record) {
        return reply.code(404).send({
          error: "EDUCATION_NOT_FOUND",
          message: "Education record not found.",
        });
      }

      await db.orm.public.EducationRecord
        .where({
          id: record.id,
        })
        .delete();

      return reply.send({
        status: "ok",
      });
    },
  );
}