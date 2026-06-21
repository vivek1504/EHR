import { prisma } from "../db/client.js";
import { downloadDocument } from "../lib/storage.js";
import { extractMedicalEntities } from "../lib/ai.js";
import { calculateOffsets } from "../utils/offsetCalculator.js";
import { logger } from "../lib/monitoring.js";

export async function analyzeDocument(
  documentId: string,
  jobId: string,
): Promise<void> {
  const startTime = Date.now();
  await prisma.processingJob.update({
    where: { id: jobId },
    data: { status: "PROCESSING", startedAt: new Date() },
  });

  await prisma.document.update({
    where: { id: documentId },
    data: { status: "PROCESSING" },
  });

  try {
    const document = await prisma.document.findUnique({
      where: { id: documentId, deletedAt: null },
    });

    if (!document) {
      throw new Error(`Document ${documentId} not found or deleted`);
    }

    const text = await downloadDocument(document.storageKey);
    if (!text || text.trim().length === 0) {
      throw new Error(`Document ${documentId} has no text content`);
    }

    const entities = await extractMedicalEntities(text);
    const validEntities = entities
      .map((entity) => {
        const offsets = calculateOffsets(text, entity.text);
        if (!offsets) {
          logger.warn(`Entity text not found in document, skipping`, {
            documentId,
            entityText: entity.text,
          });
          return null;
        }
        return {
          ...entity,
          startOffset: offsets.start,
          endOffset: offsets.end,
        };
      })
      .filter(Boolean) as Array<{
      text: string;
      label:
        | "CLINICAL_CONDITION"
        | "MEDICATION_STATEMENT"
        | "CLINICAL_FINDING"
        | "MEDICAL_PROCEDURE";
      confidence: number;
      startOffset: number;
      endOffset: number;
    }>;

    await prisma.$transaction(async (tx) => {
      await tx.annotation.deleteMany({
        where: { documentId, source: "LLM" },
      });

      if (validEntities.length > 0) {
        await tx.annotation.createMany({
          data: validEntities.map((entity) => ({
            documentId,
            text: entity.text,
            label: entity.label,
            startOffset: entity.startOffset,
            endOffset: entity.endOffset,
            source: "LLM" as const,
            status: "SUGGESTED" as const,
            confidence: entity.confidence,
          })),
        });
      }

      await tx.document.update({
        where: { id: documentId },
        data: { status: "READY_FOR_REVIEW" },
      });

      await tx.processingJob.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          entityCount: validEntities.length,
          completedAt: new Date(),
        },
      });
    });

    const durationMs = Date.now() - startTime;
    logger.info(`Analysis completed for document ${documentId}`, {
      documentId,
      jobId,
      entityCount: validEntities.length,
      durationMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error(`Analysis failed for document ${documentId}`, {
      documentId,
      jobId,
      error: message,
    });

    await prisma.processingJob
      .update({
        where: { id: jobId },
        data: { status: "FAILED", error: message },
      })
      .catch(() => {});

    await prisma.document
      .update({
        where: { id: documentId },
        data: { status: "FAILED" },
      })
      .catch(() => {});
    throw err;
  }
}
