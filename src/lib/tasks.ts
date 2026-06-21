import { config } from "../config/index.js";
import { logger } from "./monitoring.js";

export async function dispatchAnalysisTask(
  documentId: string,
  jobId: string,
): Promise<void> {
  if (!config.CLOUD_TASKS_ENABLED) {
    logger.info(
      "Cloud Tasks disabled — analysis must be triggered manually or inline",
      {
        documentId,
        jobId,
      },
    );
    return;
  }
  logger.info("Cloud Tasks dispatch not yet implemented", {
    documentId,
    jobId,
  });
}
