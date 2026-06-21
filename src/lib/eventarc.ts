import { z } from "zod";

const gcsEventSchema = z.object({
  bucket: z.string(),
  name: z.string(),
});

export function parseGcsEvent(body: unknown): {
  bucket: string;
  key: string;
  documentId: string;
} | null {
  const parsed = gcsEventSchema.safeParse(body);
  if (!parsed.success) return null;

  const key = parsed.data.name;
  const match = key.match(/^documents\/(.+)\.txt$/);
  if (!match?.[1]) return null;

  return {
    bucket: parsed.data.bucket,
    key,
    documentId: match[1],
  };
}
