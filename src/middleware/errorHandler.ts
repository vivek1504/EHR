import type { Context, Next } from "hono";
import { AppError } from "../utils/errors.js";
import { logger } from "../lib/monitoring.js";

export async function errorHandler(c: Context, next: Next) {
  try {
    await next();
  } catch (err) {
    if (err instanceof AppError) {
      return c.json(
        { error: err.name, message: err.message },
        err.statusCode as 400,
      );
    }

    const message =
      err instanceof Error ? err.message : "Internal server error";

    logger.error("Unhandled error", {
      error: message,
      stack: err instanceof Error ? err.stack : undefined,
      path: c.req.path,
      method: c.req.method,
    });

    return c.json(
      { error: "InternalServerError", message: "Internal server error" },
      500,
    );
  }
}
