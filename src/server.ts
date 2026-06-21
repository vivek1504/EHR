import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { config } from "./config/index.js";
import { logger } from "./lib/monitoring.js";

const app = createApp();

serve(
  {
    fetch: app.fetch,
    port: config.PORT,
  },
  (info) => {
    logger.info(`EHR Backend running`, {
      port: info.port,
      env: config.NODE_ENV,
      aiProvider: config.AI_PROVIDER,
      cloudTasks: config.CLOUD_TASKS_ENABLED,
      storage: config.GCS_EMULATOR ? "local" : "gcs",
    });

    console.log("EHR Backend → http://localhost:3000");
  },
);
