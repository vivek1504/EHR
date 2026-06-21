import { Hono } from "hono";
import type { AppVariables } from "../types/env.js";
import { prisma } from "../db/client.js";
import {
  listAnnotationsQuery,
  createAnnotationBody,
  updateAnnotationBody,
  bulkAcceptBody,
} from "../types/index.js";
import { NotFoundError, ValidationError } from "../utils/errors.js";
import { apiKeyAuth } from "../middleware/auth.js";
import { auditLog } from "../middleware/audit.js";

export const annotationRoutes = new Hono<{
  Variables: AppVariables;
}>();

annotationRoutes.use("*", apiKeyAuth);

annotationRoutes.get("/", async (c) => {
  const rawQuery = {
    documentId: c.req.query("documentId"),
    source: c.req.query("source"),
    status: c.req.query("status"),
  };

  const parsed = listAnnotationsQuery.safeParse(rawQuery);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(", "),
    );
  }

  const { documentId, source, status } = parsed.data;

  const annotations = await prisma.annotation.findMany({
    where: {
      documentId,
      ...(source ? { source: source as any } : {}),
      ...(status ? { status: status as any } : {}),
    },
    orderBy: { startOffset: "asc" },
  });
  return c.json({ data: annotations });
});

annotationRoutes.post(
  "/",
  auditLog("ANNOTATION_CREATED", "Annotation"),

  async (c) => {
    const body = await c.req.json();

    const parsed = createAnnotationBody.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join(", "),
      );
    }

    const document = await prisma.document.findUnique({
      where: { id: parsed.data.documentId, deletedAt: null },
      select: { id: true },
    });

    if (!document) {
      throw new NotFoundError(`Document ${parsed.data.documentId} not found`);
    }

    const userId = c.get("userId");

    const annotation = await prisma.annotation.create({
      data: {
        ...parsed.data,
        status: parsed.data.source === "LLM" ? "SUGGESTED" : "ACCEPTED",
        createdById: userId,
      },
    });

    c.set("createdEntityId", annotation.id);
    return c.json(annotation, 201);
  },
);

annotationRoutes.patch(
  "/:id",
  auditLog("ANNOTATION_UPDATED", "Annotation"),
  async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json();

    const parsed = updateAnnotationBody.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join(", "),
      );
    }

    const existing = await prisma.annotation.findUnique({
      where: { id },
      select: { id: true, status: true, label: true, text: true },
    });
    if (!existing) {
      throw new NotFoundError(`Annotation ${id} not found`);
    }

    c.set("auditMetadata", {
      old: {
        status: existing.status,
        label: existing.label,
        text: existing.text,
      },
      new: parsed.data,
    });

    const updated = await prisma.annotation.update({
      where: { id },
      data: parsed.data as any,
    });

    return c.json(updated);
  },
);

annotationRoutes.post("/bulk-accept", async (c) => {
  const body = await c.req.json();
  const parsed = bulkAcceptBody.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(", "),
    );
  }

  const { documentId, annotationIds } = parsed.data;
  const result = await prisma.annotation.updateMany({
    where: {
      id: { in: annotationIds },
      documentId,
    },
    data: { status: "ACCEPTED" },
  });
  return c.json({ updated: result.count });
});

annotationRoutes.delete(
  "/:id",
  auditLog("ANNOTATION_DELETED", "Annotation"),

  async (c) => {
    const id = c.req.param("id");

    const existing = await prisma.annotation.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundError(`Annotation ${id} not found`);
    }

    await prisma.annotation.delete({ where: { id } });
    return c.json({ deleted: true });
  },
);
