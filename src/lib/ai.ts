import { z } from "zod";
import { config } from "../config/index.js";
import { logger } from "./monitoring.js";
import { llmResponseSchema, type ExtractedEntity } from "../types/index.js";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";
const TIMEOUT_MS = 10000;
const MAX_TOKENS = 4096;

const SYSTEM_PROMPT = `You are a clinical NLP entity extraction system.
You extract medical entities from clinical notes and classify them into exactly 4 categories.
You MUST respond with a valid JSON object and nothing else.`;

function buildUserPrompt(text: string): string {
  return `Extract all medical entities from the clinical text below.

Categories (use EXACTLY these values):
- "CLINICAL_CONDITION" — diseases, disorders, syndromes
- "MEDICATION_STATEMENT" — drugs, dosages, prescriptions
- "CLINICAL_FINDING" — symptoms, signs, vital signs, lab results
- "MEDICAL_PROCEDURE" — tests, surgeries, therapies, examinations

Response format (strict JSON, no markdown):
{"entities": [{"text": "exact text from document", "label": "CATEGORY", "confidence": 0.0-1.0}]}

Rules:
- Extract the exact text as it appears in the document
- confidence must be a decimal between 0 and 1
- Return empty array if no entities found: {"entities": []}

Clinical Text:
---
${text}
---`;
}

export async function extractMedicalEntities(
  text: string,
): Promise<ExtractedEntity[]> {
  if (!config.GROQ_API_KEY) {
    logger.warn("GROQ_API_KEY not set — returning empty entities");
    return [];
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(text) },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      choices: Array<{
        message: {
          content: string;
        };
      }>;
    };

    let generatedText: string = data.choices[0]?.message?.content || "";

    const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      generatedText = jsonMatch[0];
    }

    let rawJson: unknown;
    try {
      rawJson = JSON.parse(generatedText);
    } catch {
      throw new Error(
        `Failed to parse LLM response as JSON: ${generatedText.substring(0, 200)}`,
      );
    }

    const parsed = llmResponseSchema.safeParse(rawJson);
    if (!parsed.success) {
      logger.error("LLM response failed Zod validation", {
        errors: parsed.error.issues,
        rawResponse: generatedText.substring(0, 500),
      });
      throw new Error("LLM returned invalid response format");
    }

    const CONFIDENCE_THRESHOLD = 0.5;

    const entities = parsed.data.entities.filter(
      (e) => e.confidence >= CONFIDENCE_THRESHOLD,
    );

    logger.info(
      `LLM extracted ${entities.length} entities (${parsed.data.entities.length} total, ${parsed.data.entities.length - entities.length} filtered by confidence)`,
      {
        model: MODEL,
        totalEntities: parsed.data.entities.length,
        filteredEntities: entities.length,
      },
    );
    return entities;
  } finally {
    clearTimeout(timeoutId);
  }
}
