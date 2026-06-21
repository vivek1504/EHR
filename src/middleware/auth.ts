import type { Context, Next } from "hono";
import { prisma } from "../db/client.js";

const keyCache = new Map<
  string,
  {
    userId: string;
    role: string;
    expiresAt: number;
  }
>();

const CACHE_TTL_MS = 5 * 60 * 1000;

export async function apiKeyAuth(c: Context, next: Next) {
  const apiKey = c.req.header("X-API-Key");
  if (!apiKey) {
    return c.json({ error: "Missing X-API-Key header" }, 401);
  }

  const cached = keyCache.get(apiKey);
  if (cached && cached.expiresAt > Date.now()) {
    c.set("userId", cached.userId);
    c.set("userRole", cached.role);
    return next();
  }

  const user = await prisma.user.findUnique({
    where: { apiKey, isActive: true },
    select: { id: true, role: true },
  });
  if (!user) {
    return c.json({ error: "Invalid or inactive API key" }, 401);
  }

  keyCache.set(apiKey, {
    userId: user.id,
    role: user.role,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  c.set("userId", user.id);
  c.set("userRole", user.role);
  return next();
}

export function requireRole(...roles: string[]) {
  return async (c: Context, next: Next) => {
    const userRole = c.get("userRole") as string | undefined;

    if (!userRole || !roles.includes(userRole)) {
      return c.json({ error: "Insufficient permissions" }, 403);
    }
    return next();
  };
}
