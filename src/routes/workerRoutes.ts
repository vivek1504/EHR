import { Hono } from "hono";
import { analyzeDocument } from "../jobs/analyzeDocument.js";
import { analyzeWorkerBody } from "../types/index.js";
import { parseGcsEvent } from "../lib/eventarc.js";
import { dispatchAnalysisTask } from "../lib/tasks.js";
import { prisma } from "../db/client.js";
import { logger } from "../lib/monitoring.js";
import { ValidationError } from "../utils/errors.js";

export const workerRoutes = new Hono();

workerRoutes.post("/worker/analyze", async (c) => {
  const body = await c.req.json();

  const parsed = analyzeWorkerBody.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Invalid worker payload");
  }

  const { documentId, jobId } = parsed.data;

  logger.info("Worker received analysis task", { documentId, jobId });
  try {
    await analyzeDocument(documentId, jobId);
    return c.json({ success: true, documentId, jobId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("Worker analysis failed", {
      documentId,
      jobId,
      error: message,
    });
    return c.json({ success: false, error: message }, 500);
  }
});

workerRoutes.post("/eventarc/gcs", async (c) => {
  const body = await c.req.json();

  const event = parseGcsEvent(body);
  if (!event) {
    logger.warn("Received invalid GCS event, ignoring", { body });
    return c.json({ skipped: true, reason: "invalid event format" });
  }

  logger.info("Eventarc GCS event received", {
    bucket: event.bucket,
    key: event.key,
    documentId: event.documentId,
  });

  const job = await prisma.processingJob.create({
    data: {
      documentId: event.documentId,
      status: "PENDING",
    },
  });

  await dispatchAnalysisTask(event.documentId, job.id);

  return c.json({
    success: true,
    documentId: event.documentId,
    jobId: job.id,
  });
});
