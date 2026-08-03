/**
 * Truncation guard tests (operator request, 2026-08-03).
 *
 * The failure this guards against: a response with finish_reason "length" is
 * structurally valid and reads as real prose, so every downstream check accepts
 * it and a script cut off mid-sentence gets persisted as complete.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./_core/env", () => ({
  ENV: {
    forgeApiKey: "test-key",
    forgeApiUrl: "https://api.example.com",
    ownerOpenId: "test-owner",
  },
}));

import { invokeLLM, LLMTruncatedError, LLM_MODEL } from "./_core/llm";

const envelope = (finishReason: string, content: string, completionTokens = 32768) => ({
  ok: true,
  status: 200,
  statusText: "OK",
  text: async () =>
    JSON.stringify({
      choices: [{ message: { role: "assistant", content }, finish_reason: finishReason }],
      usage: { completion_tokens: completionTokens, prompt_tokens: 900 },
    }),
});

describe("invokeLLM truncation guard", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("throws LLMTruncatedError when finish_reason is length", async () => {
    (globalThis.fetch as any).mockResolvedValue(
      envelope("length", "[HOOK] This opening is fine and then the sentence just stops mid-wor")
    );
    await expect(
      invokeLLM({ messages: [{ role: "user", content: "write" }] })
    ).rejects.toThrow(LLMTruncatedError);
  });

  it("does NOT return the truncated content to the caller", async () => {
    (globalThis.fetch as any).mockResolvedValue(envelope("length", "half a script"));
    let caught: unknown;
    try {
      await invokeLLM({ messages: [{ role: "user", content: "write" }] });
    } catch (err) {
      caught = err;
    }
    // The partial text is attached to the error for diagnostics, but the call
    // itself must not resolve — otherwise a caller could persist it.
    expect(caught).toBeInstanceOf(LLMTruncatedError);
    expect((caught as LLMTruncatedError).partialContent).toBe("half a script");
  });

  it("reports the token budget and usage so the message is actionable", async () => {
    (globalThis.fetch as any).mockResolvedValue(envelope("length", "x", 32768));
    try {
      await invokeLLM({ messages: [{ role: "user", content: "write" }] });
      throw new Error("should have thrown");
    } catch (err) {
      const e = err as LLMTruncatedError;
      expect(e.completionTokens).toBe(32768);
      expect(e.maxTokens).toBeGreaterThan(0);
      expect(e.message).toMatch(/ran out of output budget/i);
      expect(e.message).toMatch(/NOT saved/);
    }
  });

  it("does not retry a truncation — one call only", async () => {
    (globalThis.fetch as any).mockResolvedValue(envelope("length", "x"));
    await expect(
      invokeLLM({ messages: [{ role: "user", content: "write" }] })
    ).rejects.toThrow(LLMTruncatedError);
    // A retry would burn a second full-price generation for a guaranteed
    // identical outcome, since the budget is unchanged.
    expect((globalThis.fetch as any).mock.calls.length).toBe(1);
  });

  it("leaves a normal completion untouched", async () => {
    (globalThis.fetch as any).mockResolvedValue(envelope("stop", "a complete script"));
    const res = await invokeLLM({ messages: [{ role: "user", content: "write" }] });
    expect(res.choices[0].message.content).toBe("a complete script");
  });

  it("tool_calls finish reason is not treated as truncation", async () => {
    (globalThis.fetch as any).mockResolvedValue(envelope("tool_calls", "using a tool"));
    await expect(
      invokeLLM({ messages: [{ role: "user", content: "write" }] })
    ).resolves.toBeDefined();
  });

  it("model is a single-point config item, not a scattered hardcode", () => {
    expect(LLM_MODEL).toBeTruthy();
    expect(typeof LLM_MODEL).toBe("string");
  });
});
