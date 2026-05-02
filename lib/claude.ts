/**
 * Anthropic SDK wrapper for structured JSON extraction.
 *
 * Pattern: ask Claude to respond with a JSON object → strip optional code
 * fences → JSON.parse → Zod validate. On any failure (JSON parse error or Zod
 * mismatch), retry exactly once with the validation error appended to the user
 * message ("respond with valid JSON only"), then fail loud.
 *
 * Why JSON-in-text instead of tool use or `output_config.format`:
 *   - Tool use would require hand-writing JSON schemas alongside Zod schemas,
 *     duplicating the source of truth.
 *   - `output_config.format` + zodOutputFormat is the slickest option but
 *     pins us to a specific Zod major version + SDK helper compatibility, and
 *     is overkill for two well-understood structured calls.
 *   - JSON-in-text + Zod validate is what the brief describes, is dependable,
 *     and keeps Zod as the single source of truth.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

let _client: Anthropic | null = null;

function client(): Anthropic {
  if (_client) return _client;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. Add it to .env.local");
  }
  _client = new Anthropic();
  return _client;
}

// Latest Sonnet 4.x. The brief named claude-sonnet-4-20250514 (Sonnet 4.0)
// from May 2025 — we're on 4.6 (released Sep 2025), same pricing tier
// ($3/$15 per Mtok), strictly better. Documented in README.
export const CLAUDE_MODEL = "claude-sonnet-4-6";

export interface ClaudeMeta {
  input_tokens: number;
  output_tokens: number;
  model: string;
  attempts: number;
}

export interface ClaudeResult<T> {
  value: T;
  meta: ClaudeMeta;
}

export async function extractStructured<T>(args: {
  system: string;
  user: string;
  schema: z.ZodSchema<T>;
  maxTokens?: number;
}): Promise<ClaudeResult<T>> {
  const { system, user, schema, maxTokens = 4096 } = args;

  let lastErr: string | null = null;
  let lastRaw: string = "";

  for (let attempt = 1; attempt <= 2; attempt++) {
    const augmentedUser =
      attempt === 1
        ? user
        : [
            user,
            "",
            `IMPORTANT: Your previous response could not be parsed:`,
            lastErr,
            "",
            "Return ONLY a single valid JSON object matching the schema. No prose, no markdown code fences, no explanations.",
          ].join("\n");

    let raw: string;
    try {
      const response = await client().messages.create({
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: augmentedUser }],
      });

      raw = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      lastRaw = raw;

      const json = stripJsonFences(raw).trim();
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch (e) {
        lastErr = `JSON parse error: ${(e as Error).message}. Got: ${json.slice(0, 200)}`;
        continue;
      }

      const result = schema.safeParse(parsed);
      if (!result.success) {
        lastErr = `Schema validation failed: ${formatZodError(result.error)}`;
        continue;
      }

      return {
        value: result.data,
        meta: {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
          model: response.model,
          attempts: attempt,
        },
      };
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        // SDK errors (auth, rate limit, server) are not retryable in this loop.
        // The SDK already retried 5xx/429 internally per its default policy.
        throw new Error(`Anthropic API error (${err.status}): ${err.message}`);
      }
      throw err;
    }
  }

  throw new Error(
    `Claude structured extraction failed after 2 attempts. Last error: ${lastErr}\n\nLast raw response: ${lastRaw.slice(0, 500)}`
  );
}

function stripJsonFences(text: string): string {
  // Match optional ```json ... ``` or ``` ... ``` fences and return inner.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1];
  return text;
}

function formatZodError(err: z.ZodError): string {
  return err.issues
    .slice(0, 5)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}
