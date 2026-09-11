import { Queue } from "bullmq";
import { Redis } from "ioredis";

export const redisConnection = new Redis(
  "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
    retryStrategy(times) {
      return Math.min(times * 500, 5000);
    },
  },
);

export const notificationQueue =
  new Queue("examconnect-notifications", {
    connection: redisConnection,
  });