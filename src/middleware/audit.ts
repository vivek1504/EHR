import type { Context, Next } from "hono";
import type { AuditAction } from "../generated/prisma/client.js";
import { prisma } from "../db/client.js";

export function auditLog(action: AuditAction, entityType: string) {
  return async (c: Context, next: Next) => {
    await next();

    if (c.res.status >= 200 && c.res.status < 300) {
      const userId = c.get("userId") as string | undefined;

      const entityId =
        c.req.param("id") ??
        (c.get("createdEntityId") as string | undefined) ??
        "unknown";
      prisma.auditLog
        .create({
          data: {
            action,
            entityType,
            entityId,
            userId: userId ?? null,
            metadata: (c.get("auditMetadata") as object) ?? undefined,
          },
        })
        .catch((err) => {
          console.error("Failed to write audit log:", err);
        });
    }
  };
}
