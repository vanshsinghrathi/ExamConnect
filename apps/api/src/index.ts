import Fastify from "fastify";
import { studentRoute } from "./student.js";
import cookie from "@fastify/cookie";
import { db } from "@examconnect/database";

import { registerRoute } from "./auth/register.js";
import { loginRoute } from "./auth/login.js";
import { logoutRoute } from "./auth/logout.js";
import { meRoute } from "./auth/me.js";
import { protectedRoute } from "./auth/protected.js";

const app = Fastify({
  logger: false,
});

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "127.0.0.1";

// Connect to PostgreSQL once when the API starts.
await db.connect();

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

await studentRoute(app);

// Protected student/admin routes.
await protectedRoute(app);

// Graceful shutdown.
const shutdown = async () => {
  await db.close();
  await app.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Start the API server.
await app.listen({
  port,
  host,
});