import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .url("DATABASE_URL must be a valid connection string"),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  GROQ_API_KEY: z.string().optional(),
  AI_PROVIDER: z.enum(["groq", "vertex"]).default("groq"),
  GCS_BUCKET_NAME: z.string().default("ehr-documents-dev"),
  GCS_EMULATOR: z.preprocess(
    (v) => v === "true" || v === true,
    z.boolean().default(true),
  ),

  STORAGE_PATH: z.string().default("./data/documents"),
  CLOUD_TASKS_ENABLED: z.preprocess(
    (v) => v === "true" || v === true,
    z.boolean().default(false),
  ),

  CLOUD_TASKS_QUEUE: z.string().default(""),
  CLOUD_TASKS_TARGET_URL: z.string().default(""),
  CORS_ORIGIN: z.string().default("*"),
  GCP_PROJECT_ID: z.string().default(""),
  GCP_REGION: z.string().default("asia-south1"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const config = parsed.data;
export type Config = z.infer<typeof envSchema>;
