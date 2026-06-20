import { z } from "zod";

export const listDocumentsQuery = z.object({
  status: z
    .enum(["UPLOADED", "QUEUED", "PROCESSING", "READY_FOR_REVIEW", "FAILED"])
    .optional(),
  category: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const createDocumentBody = z.object({
  title: z.string().min(1, "title is required").max(500),
  category: z.string().max(100).optional(),
  text: z.string().min(1, "text is required"),
});

export const listAnnotationsQuery = z.object({
  documentId: z.string().uuid("documentId must be a valid UUID"),
  source: z.enum(["HUMAN", "LLM"]).optional(),
  status: z.enum(["SUGGESTED", "ACCEPTED", "REJECTED", "CORRECTED"]).optional(),
});

export const createAnnotationBody = z
  .object({
    documentId: z.string().uuid("documentId must be a valid UUID"),
    text: z
      .string()
      .min(1, "text is required")
      .max(500, "text must be 500 characters or less"),
    label: z.enum([
      "CLINICAL_CONDITION",
      "MEDICATION_STATEMENT",
      "CLINICAL_FINDING",
      "MEDICAL_PROCEDURE",
    ]),
    startOffset: z
      .number()
      .int()
      .nonnegative("startOffset must be non-negative"),
    endOffset: z.number().int().nonnegative("endOffset must be non-negative"),
    source: z.enum(["HUMAN", "LLM"]),
    confidence: z.number().min(0).max(1).optional(),
  })
  .refine((data) => data.startOffset <= data.endOffset, {
    message: "startOffset must be ≤ endOffset",
    path: ["startOffset"],
  });

export const updateAnnotationBody = z.object({
  status: z.enum(["ACCEPTED", "REJECTED", "CORRECTED", "SUGGESTED"]).optional(),
  label: z
    .enum([
      "CLINICAL_CONDITION",
      "MEDICATION_STATEMENT",
      "CLINICAL_FINDING",
      "MEDICAL_PROCEDURE",
    ])
    .optional(),
  text: z.string().min(1).max(500).optional(),
});

export const bulkAcceptBody = z.object({
  documentId: z.string().uuid(),
  annotationIds: z.array(z.string().uuid()).min(1).max(500),
});

export const createUserBody = z.object({
  email: z.string().email("Invalid email"),
  name: z.string().min(1, "name is required").max(200),
  role: z
    .enum(["ADMIN", "ANNOTATOR", "REVIEWER", "VIEWER"])
    .default("ANNOTATOR"),
});

export const analyzeWorkerBody = z.object({
  documentId: z.string().uuid(),
  jobId: z.string().uuid(),
});

export const extractedEntitySchema = z.object({
  text: z.string().min(1).max(500),
  label: z.enum([
    "CLINICAL_CONDITION",
    "MEDICATION_STATEMENT",
    "CLINICAL_FINDING",
    "MEDICAL_PROCEDURE",
  ]),
  confidence: z.number().min(0).max(1),
});

export const llmResponseSchema = z.object({
  entities: z.array(extractedEntitySchema),
});

export type ExtractedEntity = z.infer<typeof extractedEntitySchema>;
