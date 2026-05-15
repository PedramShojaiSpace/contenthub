/**
 * llmUtils.ts — Shared LLM error-handling utilities.
 *
 * Use `wrapLLM` to wrap any call that ultimately calls `invokeLLM`.
 * It converts SERVICE_UNAVAILABLE and RATE_LIMIT errors (thrown by invokeLLM
 * after retries are exhausted) into clean TRPCErrors so the client sees a
 * readable message instead of a raw JSON parse crash or opaque error string.
 *
 * Use `parseLLMJson` to safely parse JSON from LLM response content strings.
 * It strips markdown code fences, detects HTML error pages, and throws a clean
 * TRPCError instead of crashing with a raw JSON.parse error.
 *
 * Usage:
 *   const result = await wrapLLM(() => generateCommentary(article));
 *   const result = await wrapLLM(() => invokeLLM({ messages: [...] }));
 *   const data = parseLLMJson<MyType>(response.choices[0].message.content, "hook generation");
 */

import { TRPCError } from "@trpc/server";

/**
 * Safely parses JSON from an LLM response content string.
 * Strips markdown code fences, detects HTML error pages, and throws a clean
 * TRPCError instead of crashing with a raw JSON.parse error.
 */
export function parseLLMJson<T = unknown>(raw: string | null | undefined, label = "AI response"): T {
  const str = String(raw ?? "").trim();
  // Detect HTML error pages returned by degraded upstream services
  if (
    str.startsWith("<!DOCTYPE") ||
    str.startsWith("<!doctype") ||
    str.startsWith("<html") ||
    str.startsWith("<HTML") ||
    str.toLowerCase().includes("service unavailable") ||
    str.toLowerCase().includes("bad gateway")
  ) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "The AI service is temporarily unavailable. Please try again in a moment.",
    });
  }
  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  const cleaned = str
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `The AI service returned an invalid response for ${label}. Please try again.`,
    });
  }
}

/**
 * Wraps any async LLM call and converts SERVICE_UNAVAILABLE / RATE_LIMIT
 * errors into clean TRPCErrors so the client sees a readable message.
 */
export async function wrapLLM<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("SERVICE_UNAVAILABLE:")) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "The AI service is temporarily unavailable. Please try again in a moment.",
      });
    }
    if (msg.startsWith("RATE_LIMIT:")) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message:
          "AI generation limit reached. Please wait 30\u201360 seconds and try again.",
      });
    }
    throw err;
  }
}
