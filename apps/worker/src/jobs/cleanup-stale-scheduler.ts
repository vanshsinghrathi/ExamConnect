import {
  notificationQueue,
  redisConnection,
} from "../queue.js";

async function main() {
  const schedulerId =
    "source-ingestion-scheduler";

  const removed =
    await notificationQueue.removeJobScheduler(
      schedulerId,
    );

  console.log(
    "[scheduler-cleanup] " +
      schedulerId +
      " removed=" +
      removed,
  );
}

await main();

await notificationQueue.close();
await redisConnection.quit();