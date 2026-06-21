import { Hono } from "hono";
import type { AppVariables } from "../types/env.js";
import { prisma } from "../db/client.js";
import { uploadDocument, downloadDocument } from "../lib/storage.js";
import { dispatchAnalysisTask } from "../lib/tasks.js";
import { sha256 } from "../utils/hash.js";
import { listDocumentsQuery, createDocumentBody } from "../types/index.js";
import { NotFoundError, ValidationError } from "../utils/errors.js";
import { apiKeyAuth, requireRole } from "../middleware/auth.js";
import { auditLog } from "../middleware/audit.js";
import { analyzeDocument } from "../jobs/analyzeDocument.js";
import { config } from "../config/index.js";

export const documentRoutes = new Hono<{
  Variables: AppVariables;
}>();

documentRoutes.use("*", apiKeyAuth);

documentRoutes.get("/", async (c) => {
  const rawQuery = {
    status: c.req.query("status"),
    category: c.req.query("category"),
    page: c.req.query("page"),
    limit: c.req.query("limit"),
  };

  const parsed = listDocumentsQuery.safeParse(rawQuery);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(", "),
    );
  }

  const { status, category, page, limit } = parsed.data;
  const skip = (page - 1) * limit;

  const where = {
    deletedAt: null as Date | null,
    ...(status ? { status: status as any } : {}),
    ...(category ? { category } : {}),
  };

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" as const },
      select: {
        id: true,
        title: true,
        category: true,
        status: true,
        wordCount: true,
        createdAt: true,
        uploadedBy: { select: { id: true, name: true } },
        _count: { select: { annotations: true } },
      },
    }),
    prisma.document.count({ where }),
  ]);

  return c.json({
    data: documents.map((d) => ({
      id: d.id,
      title: d.title,
      category: d.category,
      status: d.status,
      wordCount: d.wordCount,
      createdAt: d.createdAt,
      uploadedBy: d.uploadedBy,
      annotationCount: d._count.annotations,
    })),
    pagination: { page, limit, total },
  });
});

documentRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  const document = await prisma.document.findUnique({
    where: { id, deletedAt: null },
    include: {
      annotations: {
        orderBy: { startOffset: "asc" as const },
      },
      jobs: {
        orderBy: { createdAt: "desc" as const },
        take: 1,
      },
      uploadedBy: { select: { id: true, name: true } },
    },
  });

  if (!document) {
    throw new NotFoundError(`Document ${id} not found`);
  }

  let text: string | null = null;

  try {
    text = await downloadDocument(document.storageKey);
  } catch {
    text = null;
  }

  return c.json({
    id: document.id,
    title: document.title,
    category: document.category,
    status: document.status,
    storageKey: document.storageKey,
    wordCount: document.wordCount,
    createdAt: document.createdAt,
    uploadedBy: document.uploadedBy,
    text,
    annotations: document.annotations,
    latestJob: document.jobs[0] ?? null,
  });
});

documentRoutes.post(
  "/",
  auditLog("DOCUMENT_UPLOADED", "Document"),

  async (c) => {
    const body = await c.req.json();
    const parsed = createDocumentBody.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join(", "),
      );
    }

    const { title, category, text } = parsed.data;
    const userId = c.get("userId");
    const textHash = sha256(text);

    const existing = await prisma.document.findFirst({
      where: { textHash, deletedAt: null },
      select: { id: true, title: true },
    });

    if (existing) {
      return c.json(
        {
          error: "Duplicate document",
          message: `A document with identical content already exists: ${existing.title} (${existing.id})`,
          existingId: existing.id,
        },
        409,
      );
    }

    const document = await prisma.document.create({
      data: {
        title,
        category: category ?? null,
        storageKey: "",
        status: "UPLOADED",
        textHash,
        wordCount: text.split(/\s+/).length,
        uploadedById: userId,
      },
    });

    const storageKey = await uploadDocument(document.id, text);
    await prisma.document.update({
      where: { id: document.id },
      data: { storageKey },
    });

    c.set("createdEntityId", document.id);
    return c.json({ ...document, storageKey }, 201);
  },
);

documentRoutes.delete(
  "/:id",
  auditLog("DOCUMENT_DELETED", "Document"),

  async (c) => {
    const id = c.req.param("id");
    const userId = c.get("userId");
    const userRole = c.get("userRole");
    const document = await prisma.document.findUnique({
      where: { id, deletedAt: null },
      select: { uploadedById: true },
    });

    if (!document) {
      throw new NotFoundError(`Document ${id} not found`);
    }

    if (userRole !== "ADMIN" && document.uploadedById !== userId) {
      return c.json(
        { error: "Forbidden — only the owner or an admin can delete" },
        403,
      );
    }

    await prisma.document.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return c.json({ deleted: true });
  },
);

documentRoutes.post(
  "/:id/analyze",
  auditLog("ANALYSIS_TRIGGERED", "Document"),
  async (c) => {
    const id = c.req.param("id");
    if (!id) {
      throw new ValidationError("Missing document id");
    }

    const document = await prisma.document.findUnique({
      where: { id, deletedAt: null },
    });
    if (!document) {
      throw new NotFoundError(`Document ${id} not found`);
    }

    const job = await prisma.processingJob.create({
      data: {
        document: { connect: { id } },
        status: "PENDING",
      },
    });

    await prisma.document.update({
      where: { id },
      data: { status: "QUEUED" },
    });

    if (!config.CLOUD_TASKS_ENABLED) {
      try {
        await analyzeDocument(id, job.id);
      } catch {}
      const updatedJob = await prisma.processingJob.findUnique({
        where: { id: job.id },
      });
      return c.json(
        {
          jobId: job.id,
          status: updatedJob?.status ?? "UNKNOWN",
          message: "Analysis completed (dev mode — synchronous)",
        },
        200,
      );
    }

    await dispatchAnalysisTask(id, job.id);

    return c.json({ jobId: job.id, message: "Analysis queued" }, 202);
  },
);
