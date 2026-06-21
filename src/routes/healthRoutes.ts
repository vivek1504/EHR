import { Hono } from "hono";
import { prisma } from "../db/client.js";
export const healthRoutes = new Hono();

healthRoutes.get("/", async (c) => {
  let dbStatus = "disconnected";

  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    dbStatus = "connected";
  } catch {
    dbStatus = "disconnected";
  }

  return c.json({
    status: "ok",
    framework: "hono",
    db: dbStatus,
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

healthRoutes.get("/ready", async (c) => {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    return c.json({ ready: true }, 200);
  } catch {
    return c.json({ ready: false, error: "Database unreachable" }, 503);
  }
});
