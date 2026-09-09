import Fastify from "fastify";

const app = Fastify({
  logger: false
});

app.get("/health", async () => {
  return {
    status: "ok",
    service: "api"
  };
});

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "127.0.0.1";

await app.listen({
  port,
  host
});
