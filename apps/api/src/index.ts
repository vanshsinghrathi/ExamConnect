import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { db } from "@examconnect/database";

import { registerRoute } from "./auth/register.js";
import { loginRoute } from "./auth/login.js";
import { logoutRoute } from "./auth/logout.js";
import { meRoute } from "./auth/me.js";

const app = Fastify({
  logger: false,
});

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "127.0.0.1";

await db.connect();

await app.register(cookie);

app.get("/health", async () => {
  return {
    status: "ok",
    service: "api",
  };
});

app.get("/health/db", async () => {
  await db.orm.public.User.all();

  return {
    status: "ok",
    service: "database",
  };
});

await registerRoute(app);
await loginRoute(app);
await logoutRoute(app);
await meRoute(app);

const shutdown = async () => {
  await db.close();
  await app.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({
  port,
  host,
});