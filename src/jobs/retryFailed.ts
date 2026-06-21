import { prisma } from "../db/client.js";
import { dispatchAnalysisTask } from "../lib/tasks.js";
import { logger } from "../lib/monitoring.js";

const MAX_ATTEMPTS = 3;

export async function retryFailedJobs(): Promise<number> {
  const failedJobs = await prisma.processingJob.findMany({
    where: {
      status: "FAILED",
      attempt: { lt: MAX_ATTEMPTS },
    },
    include: { document: { select: { deletedAt: true } } },
  });

  const retryable = failedJobs.filter((j) => j.document.deletedAt === null);
  let retried = 0;

  for (const job of retryable) {
    try {
      const newJob = await prisma.processingJob.create({
        data: {
          documentId: job.documentId,
          status: "PENDING",
          attempt: job.attempt + 1,
        },
      });

      await dispatchAnalysisTask(job.documentId, newJob.id);
      retried++;
      logger.info(`Retried failed job`, {
        documentId: job.documentId,
        attempt: newJob.attempt,
        originalJobId: job.id,
        newJobId: newJob.id,
      });
    } catch (err) {
      logger.error(`Failed to retry job`, {
        jobId: job.id,
        error: err instanceof Error ? err.message : "Unknown",
      });
    }
  }
  return retried;
}
