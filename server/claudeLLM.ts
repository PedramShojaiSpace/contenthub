/**
 * claudeLLM.ts
 *
 * Direct Anthropic Claude integration for high-quality long-form prose generation.
 * Used exclusively for ebook chapter writing where narrative quality matters most.
 * Structured JSON tasks (outlines, voice profiles, etc.) continue to use invokeLLM (Gemini Flash).
 */

import Anthropic from "@anthropic-ai/sdk";
import { ENV } from "./_core/env";

// Best model for long-form creative/narrative prose
const CLAUDE_MODEL = "claude-sonnet-4-5";

// Max retries for transient errors
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1500;

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeParams {
  systemPrompt: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
}

/**
 * Call Claude directly via the Anthropic SDK for prose generation.
 * Returns the full text response as a string.
 */
export async function invokeClaude(
  params: ClaudeParams,
  _retryCount = 0
): Promise<string> {
  const apiKey = ENV.anthropicApiKey;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not configured. Please add it in project secrets."
    );
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: params.maxTokens ?? 8192,
      system: params.systemPrompt,
      messages: params.messages,
    });

    // Extract text from the response
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Claude returned no text content in response");
    }

    return textBlock.text;
  } catch (err) {
    // Retry on transient Anthropic errors (overload, server errors)
    if (err instanceof Anthropic.APIError) {
      const isTransient =
        err.status === 529 || // overloaded
        err.status === 503 ||
        err.status === 502 ||
        err.status === 504 ||
        err.status === 500;

      if (isTransient && _retryCount < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, _retryCount);
        console.warn(
          `[invokeClaude] ${err.status} transient error — retrying in ${delay}ms (attempt ${_retryCount + 1}/${MAX_RETRIES})`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return invokeClaude(params, _retryCount + 1);
      }

      if (err.status === 401) {
        throw new Error(
          "ANTHROPIC_API_KEY is invalid or expired. Please update it in project secrets."
        );
      }

      if (err.status === 429) {
        throw new Error(
          "RATE_LIMIT: Claude API rate limit reached. Please wait a moment and try again."
        );
      }
    }

    throw err;
  }
}
