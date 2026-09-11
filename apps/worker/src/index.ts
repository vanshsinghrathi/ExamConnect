import { Worker } from "bullmq";

import {
  notificationQueue,
  redisConnection,
} from "./queue.js";

import {
  NOTIFICATION_JOB_NAMES,
  processNotificationJob,
} from "./jobs/notification-jobs.js";

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

const worker = new Worker(
  "examconnect-notifications",
  processNotificationJob,
  {
    connection: redisConnection,
  },
);

worker.on("completed", (job) => {
  console.log(
    "[worker] completed job=" +
      job.name +
      " attempts=" +
      job.attemptsMade,
  );
});

worker.on("failed", (job, error) => {
  console.error(
    "[worker] failed job=" +
      (job?.name ?? "unknown") +
      " attempts=" +
      (job?.attemptsMade ?? 0) +
      ":",
    error,
  );
});

worker.on("error", (error) => {
  console.error("[worker] error:", error);
});

await notificationQueue.upsertJobScheduler(
  "deadline-notification-scheduler",
  {
    every: 60 * 60 * 1000,
  },
  {
    name: NOTIFICATION_JOB_NAMES.DEADLINE,
    data: {},
    opts: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
    },
  },
);

console.log("ExamConnect worker started");
console.log(
  "Deadline notification scheduler: every 1 hour",
);
console.log(
  "Retry policy: 3 attempts with exponential backoff",
);
console.log("Notification job structure active");

const shutdown = async () => {
  console.log("[worker] shutting down...");

  await worker.close();
  await notificationQueue.close();
  await redisConnection.quit();

  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);