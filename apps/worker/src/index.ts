import { Worker } from "bullmq";
import { db } from "@examconnect/database";

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

async function scheduleNotificationSources() {
const sources =
await db.orm.public.NotificationSource.all();

const activeSourceSchedulerIds = new Set(
sources.map(
(source) => `source-ingestion-${source.id}`,
),
);

const existingSchedulers =
await notificationQueue.getJobSchedulers();

let removedSchedulers = 0;

for (const scheduler of existingSchedulers) {
if (
scheduler.name !==
NOTIFICATION_JOB_NAMES.SOURCE_INGESTION
) {
continue;
}

const schedulerKey = scheduler.key;

if (
  !activeSourceSchedulerIds.has(
    schedulerKey,
  )
) {
  const removed =
    await notificationQueue.removeJobScheduler(
      schedulerKey,
    );

  if (removed) {
    removedSchedulers++;

    console.log(
      "[source-registry] removed stale scheduler=" +
        schedulerKey,
    );
  }
}


}

console.log(
"[source-registry] found " +
sources.length +
" active notification source(s)",
);

for (const source of sources) {
const schedulerId =
`source-ingestion-${source.id}`;

await notificationQueue.upsertJobScheduler(
  schedulerId,
  {
    every: 60 * 60 * 1000,
  },
  {
    name:
      NOTIFICATION_JOB_NAMES.SOURCE_INGESTION,
    data: {
      sourceId: source.id,
    },
    opts: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
    },
  },
);

console.log(
  "[source-registry] scheduled sourceId=" +
    source.id +
    " scheduler=" +
    schedulerId +
    " url=" +
    source.officialUrl,
);

}

console.log(
"[source-registry] stale schedulers removed=" +
removedSchedulers,
);
}

async function refreshSourceRegistry() {
try {
console.log(
"[source-registry] refreshing registry",
);


await scheduleNotificationSources();


} catch (error) {
console.error(
"[source-registry] refresh failed:",
error,
);
}
}

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

await scheduleNotificationSources();

const SOURCE_REGISTRY_REFRESH_INTERVAL =
5 * 60 * 1000;

const sourceRegistryRefreshTimer = setInterval(
refreshSourceRegistry,
SOURCE_REGISTRY_REFRESH_INTERVAL,
);

console.log("ExamConnect worker started");

console.log(
"Deadline notification scheduler: every 1 hour",
);

console.log(
"Source registry scheduler: every 1 hour",
);

console.log(
"Source registry refresh: every 5 minutes",
);

console.log(
"Retry policy: 3 attempts with exponential backoff",
);

console.log(
"Notification job structure active",
);

const shutdown = async () => {
console.log("[worker] shutting down...");

clearInterval(sourceRegistryRefreshTimer);

await worker.close();
await notificationQueue.close();
await redisConnection.quit();

process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
