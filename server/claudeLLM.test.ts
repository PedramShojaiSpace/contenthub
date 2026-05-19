/**
 * claudeLLM.test.ts
 *
 * Validates that the Anthropic API key is configured and that Claude
 * can return a basic text response. Uses a minimal prompt to keep cost low.
 */

import { describe, it, expect } from "vitest";
import { invokeClaude, invokeClaudeJson } from "./claudeLLM";

describe("invokeClaude (Sonnet)", () => {
  it("should call Claude Sonnet and return a non-empty text response", async () => {
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
    expect(result.toUpperCase()).toContain("READY");
  }, 30000);
});

describe("invokeClaudeJson (Haiku)", () => {
  it("should call Claude Haiku and return parseable JSON", async () => {
    const result = await invokeClaudeJson({
      systemPrompt: "You are a JSON generator. Return only valid JSON, no commentary.",
      messages: [
        {
          role: "user",
          content: 'Return this JSON exactly: { "status": "ok" }',
        },
      ],
      maxTokens: 50,
    });

    expect(typeof result).toBe("string");
    const trimmed = result.trim();
    // Strip markdown code fences if present
    const jsonStr = trimmed.replace(/^```json\n?/, "").replace(/^```\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(jsonStr);
    expect(parsed).toHaveProperty("status", "ok");
  }, 30000);
});
