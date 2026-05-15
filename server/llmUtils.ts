/**
 * llmUtils.ts — Shared LLM error-handling utilities.
 *
 * Use `wrapLLM` to wrap any call that ultimately calls `invokeLLM`.
 * It converts SERVICE_UNAVAILABLE and RATE_LIMIT errors (thrown by invokeLLM
 * after retries are exhausted) into clean TRPCErrors so the client sees a
 * readable message instead of a raw JSON parse crash or opaque error string.
 *
 * Usage:
 *   const result = await wrapLLM(() => generateCommentary(article));
 *   const result = await wrapLLM(() => invokeLLM({ messages: [...] }));
 */

import { TRPCError } from "@trpc/server";

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
