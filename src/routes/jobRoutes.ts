import { Hono } from "hono";
import type { AppVariables } from "../types/env.js";
import { prisma } from "../db/client.js";
import { apiKeyAuth } from "../middleware/auth.js";
import { NotFoundError } from "../utils/errors.js";

export const jobRoutes = new Hono<{
  Variables: AppVariables;
}>();

jobRoutes.use("*", apiKeyAuth);

jobRoutes.get("/documents/:id/jobs", async (c) => {
  const documentId = c.req.param("id");

  const document = await prisma.document.findUnique({
    where: { id: documentId, deletedAt: null },
    select: { id: true },
  });
  if (!document) {
    throw new NotFoundError(`Document ${documentId} not found`);
  }

  const jobs = await prisma.processingJob.findMany({
    where: { documentId },
    orderBy: { createdAt: "desc" },
  });
  return c.json({ data: jobs });
});

jobRoutes.get("/jobs/:id", async (c) => {
  const id = c.req.param("id");

  const job = await prisma.processingJob.findUnique({
    where: { id },
    include: {
      document: { select: { id: true, title: true, status: true } },
    },
  });
  if (!job) {
    throw new NotFoundError(`Job ${id} not found`);
  }

  return c.json(job);
});
