import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";

import { adminNotificationSourceRoute } from "./admin-notification-sources.js";
import { db } from "@examconnect/database";

import { registerRoute } from "./auth/register.js";
import { loginRoute } from "./auth/login.js";
import { logoutRoute } from "./auth/logout.js";
import { meRoute } from "./auth/me.js";
import { protectedRoute } from "./auth/protected.js";

import { studentRoute } from "./student.js";
import { eligibilityRoute } from "./eligibility/eligibility.js";
import { examRoute } from "./exams.js";
import { adminExamRoute } from "./admin-exams.js";
import { studentNotificationRoute } from "./student-notifications.js";

const app = Fastify({
  logger: true,
});

const port = Number(
  process.env.PORT ?? 4000,
);

const host =
  process.env.HOST ?? "127.0.0.1";

/*
 * Development CORS configuration.
 *
 * Allows the Next.js frontend to call the
 * API from either localhost or 127.0.0.1.
 *
 * credentials: true is required because
 * authentication uses cookies.
 */
await app.register(cors, {
  origin: (origin, callback) => {
    /*
     * Some requests such as curl/server-to-server
     * requests may not send an Origin header.
     */
    if (!origin) {
      callback(null, true);
      return;
    }

    const allowedOrigins = [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ];

    if (
      allowedOrigins.includes(origin)
    ) {
      callback(null, true);
      return;
    }

    callback(
      new Error(
        `CORS origin not allowed: ${origin}`,
      ),
      false,
    );
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
  ],
});

// Enable cookie parsing and cookie management.
await app.register(cookie);

// Basic API health check.
app.get("/health", async () => {
  return {
    status: "ok",
    service: "api",
  };
});

// Database health check.
app.get("/health/db", async () => {
  await db.orm.public.User.all();

  return {
    status: "ok",
    service: "database",
  };
});

// Authentication routes.
await registerRoute(app);
await loginRoute(app);
await logoutRoute(app);
await meRoute(app);

// Student routes.
await studentRoute(app);
await studentNotificationRoute(app);

// Eligibility routes.
await eligibilityRoute(app);

// Exam read routes.
await examRoute(app);

// Protected routes.
await protectedRoute(app);

// Admin exam routes.
await adminExamRoute(app);
await adminNotificationSourceRoute(app);

// Graceful shutdown.
const shutdown = async () => {
  try {
    await db.close();
    await app.close();
  } finally {
    process.exit(0);
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Start the API server.
await app.listen({
  port,
  host,
});