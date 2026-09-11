import type { Job } from "bullmq";

import { generateDeadlineNotifications } from "../notifications/deadline-notifications.js";
import { ingestNotificationSource } from "./source-ingestion.js";

export const NOTIFICATION_JOB_NAMES = {
  DEADLINE: "deadline-notifications",
  NEW_EXAM: "new-exam-notifications",
  ELIGIBILITY_RULE_CHANGED:
    "eligibility-rule-changed",
  NEW_ELIGIBLE_EXAM: "new-eligible-exam",
  SOURCE_INGESTION: "source-ingestion",
} as const;

type SourceIngestionJobData = {
  sourceId: number;
};

export async function processNotificationJob(
  job: Job,
) {
  console.log(
    "[worker] processing job=" +
      job.name +
      " attempt=" +
      job.attemptsMade,
  );

  switch (job.name) {
    case NOTIFICATION_JOB_NAMES.DEADLINE: {
      const result =
        await generateDeadlineNotifications();

      console.log(
        "[deadline-notifications] created=" +
          result.createdCount,
      );

      return result;
    }

    case NOTIFICATION_JOB_NAMES.SOURCE_INGESTION: {
      const data =
        job.data as SourceIngestionJobData;

      if (
        !data ||
        !Number.isInteger(data.sourceId) ||
        data.sourceId <= 0
      ) {
        throw new Error(
          "SOURCE_INGESTION requires a valid sourceId.",
        );
      }

      const result =
        await ingestNotificationSource(
          data.sourceId,
        );

      console.log(
        "[source-ingestion] sourceId=" +
          result.sourceId +
          " success=" +
          result.success +
          " statusCode=" +
          (result.statusCode ?? "none"),
      );

      if (!result.success) {
        throw new Error(
          result.error ??
            "Source ingestion failed.",
        );
      }

      return result;
    }

    case NOTIFICATION_JOB_NAMES.NEW_EXAM:
      console.log(
        "[new-exam-notifications] job received",
      );

      return {
        createdCount: 0,
      };

    case NOTIFICATION_JOB_NAMES.ELIGIBILITY_RULE_CHANGED:
      console.log(
        "[eligibility-rule-changed] job received",
      );

      return {
        createdCount: 0,
      };

    case NOTIFICATION_JOB_NAMES.NEW_ELIGIBLE_EXAM:
      console.log(
        "[new-eligible-exam] job received",
      );

      return {
        createdCount: 0,
      };

    default:
      console.log(
        "[worker] unknown job=" + job.name,
      );

      return null;
  }
}