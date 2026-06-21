import { randomUUID } from "crypto";
import { Hono } from "hono";
import type { AppVariables } from "../types/env.js";
import { prisma } from "../db/client.js";
import { createUserBody } from "../types/index.js";
import { NotFoundError, ValidationError } from "../utils/errors.js";
import { apiKeyAuth, requireRole } from "../middleware/auth.js";

export const userRoutes = new Hono<{
  Variables: AppVariables;
}>();

userRoutes.use("*", apiKeyAuth);

userRoutes.post("/", requireRole("ADMIN"), async (c) => {
  const body = await c.req.json();
  const parsed = createUserBody.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(", "),
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });

  if (existing) {
    return c.json(
      {
        error: "Conflict",
        message: `User with email ${parsed.data.email} already exists`,
      },
      409,
    );
  }

  const user = await prisma.user.create({
    data: parsed.data as any,
  });

  return c.json(user, 201);
});

userRoutes.get("/", requireRole("ADMIN"), async (c) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      _count: { select: { documents: true, annotations: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return c.json({ data: users });
});

userRoutes.post("/:id/rotate-key", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");

  const userRole = c.get("userRole");
  if (userRole !== "ADMIN" && userId !== id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!user) {
    throw new NotFoundError(`User ${id} not found`);
  }

  const newApiKey = randomUUID();
  const updated = await prisma.user.update({
    where: { id },
    data: { apiKey: newApiKey },
  });

  return c.json({ id: updated.id, apiKey: updated.apiKey });
});
