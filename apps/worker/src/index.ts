import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";

import { generateDeadlineNotifications } from "./notifications/deadline-notifications.js";

const redisConnection = new Redis("redis://localhost:6379", {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    return Math.min(times * 500, 5000);
  },
});

redisConnection.on("connect", () => {
  console.log("[redis] connected");
});

redisConnection.on("ready", () => {
  console.log("[redis] ready");
});

redisConnection.on("error", (error) => {
  console.error("[redis] error:", error);
});

redisConnection.on("close", () => {
  console.log("[redis] connection closed");
});

const queue = new Queue("examconnect-notifications", {
  connection: redisConnection,
});

const worker = new Worker(
  "examconnect-notifications",
  async (job) => {
    console.log(
      "[worker] processing job=" + job.name,
    );

    if (job.name === "deadline-notifications") {
      const result =
        await generateDeadlineNotifications();

      console.log(
        "[deadline-notifications] created=" +
          result.createdCount,
      );

      return result;
    }

    return null;
  },
  {
    connection: redisConnection,
  },
);

worker.on("completed", (job) => {
  console.log(
    "[worker] completed job=" + job.name,
  );
});

worker.on("failed", (job, error) => {
  console.error(
    "[worker] failed job=" +
      (job?.name ?? "unknown") +
      ":",
    error,
  );
});

worker.on("error", (error) => {
  console.error("[worker] error:", error);
});

await queue.upsertJobScheduler(
  "deadline-notification-scheduler",
  {
    every: 60 * 60 * 1000,
  },
  {
    name: "deadline-notifications",
    data: {},
  },
);

console.log("ExamConnect worker started");
console.log(
  "Deadline notification scheduler: every 1 hour",
);
console.log(
  "Test schedule: deadline job every 10 seconds",
);

const shutdown = async () => {
  console.log("[worker] shutting down...");

  await worker.close();
  await queue.close();
  await redisConnection.quit();

  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);