import {
  notificationQueue,
  redisConnection,
} from "../queue.js";

async function main() {
  const schedulers =
    await notificationQueue.getJobSchedulers();

  console.log("JOB SCHEDULERS:");
  console.log(
    JSON.stringify(schedulers, null, 2),
  );

  const jobs =
    await notificationQueue.getJobs([
      "waiting",
      "delayed",
      "failed",
      "active",
    ]);

  console.log("QUEUED JOBS:");

  for (const job of jobs) {
    console.log({
      id: job.id,
      name: job.name,
      data: job.data,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
    });
  }
}

await main();

await notificationQueue.close();
await redisConnection.quit();