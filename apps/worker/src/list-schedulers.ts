import { notificationQueue } from "./queue.js";

const schedulers =
  await notificationQueue.getJobSchedulers();

console.log("\n=== ExamConnect Job Schedulers ===");

for (const scheduler of schedulers) {
  console.log({
    key: scheduler.key,
    name: scheduler.name,
    next: scheduler.next,
    pattern: scheduler.pattern,
    every: scheduler.every,
  });
}

console.log(
  "\nTotal schedulers:",
  schedulers.length,
);

await notificationQueue.close();