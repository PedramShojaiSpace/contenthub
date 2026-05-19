/**
 * claudeLLM.test.ts
 *
 * Validates that the Anthropic API key is configured and that Claude
 * can return a basic text response. Uses a minimal prompt to keep cost low.
 */

import { describe, it, expect } from "vitest";
import { invokeClaude } from "./claudeLLM";

describe("invokeClaude", () => {
  it("should call Claude and return a non-empty text response", async () => {
    const result = await invokeClaude({
      systemPrompt: "You are a helpful assistant. Reply concisely.",
      messages: [
        {
          role: "user",
          content: "Reply with exactly the word: READY",
        },
      ],
      maxTokens: 20,
    });

    expect(typeof result).toBe("string");
    expect(result.trim().length).toBeGreaterThan(0);
    // Claude should echo back something containing READY
    expect(result.toUpperCase()).toContain("READY");
  }, 30000); // 30s timeout for API call
});
