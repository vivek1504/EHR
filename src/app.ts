import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import type { AppVariables } from "./types/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestId } from "./middleware/requestId.js";
import { rateLimiter } from "./middleware/rateLimiter.js";
import { healthRoutes } from "./routes/healthRoutes.js";
import { documentRoutes } from "./routes/documentRoutes.js";
import { annotationRoutes } from "./routes/annotationRoutes.js";
import { jobRoutes } from "./routes/jobRoutes.js";
import { userRoutes } from "./routes/userRoutes.js";
import { workerRoutes } from "./routes/workerRoutes.js";
import { config } from "./config/index.js";

export function createApp() {
  const app = new Hono<{ Variables: AppVariables }>();

  app.use("*", requestId);
  app.use("*", honoLogger());
  app.use(
    "*",
    cors({
      origin: config.CORS_ORIGIN,
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "X-API-Key", "X-Request-ID"],
    }),
  );

  app.use("*", errorHandler);
  app.use("*", rateLimiter);

  app.route("/health", healthRoutes);
  app.route("/documents", documentRoutes);
  app.route("/annotations", annotationRoutes);
  app.route("/users", userRoutes);
  app.route("/", jobRoutes);
  app.route("/internal", workerRoutes);

  app.notFound((c) => {
    return c.json(
      {
        error: "NotFound",
        message: `Route ${c.req.method} ${c.req.path} not found`,
      },
      404,
    );
  });

  return app;
}
