import { describe, it, expect } from "vitest";

// ── Structural tests for webinarIntelligenceRouter ─────────────────────────

describe("webinarIntelligenceRouter structure", () => {
  it("exports a router object with all required procedures", async () => {
    const mod = await import("./webinarIntelligenceRouter");
    expect(mod.webinarIntelligenceRouter).toBeDefined();
    const router = mod.webinarIntelligenceRouter as any;
    // Core CRUD procedures
    expect(router._def?.procedures?.importResponses).toBeDefined();
    expect(router._def?.procedures?.extractIntelligence).toBeDefined();
    expect(router._def?.procedures?.listBySession).toBeDefined();
    expect(router._def?.procedures?.get).toBeDefined();
    // Return path: rewrite webinar outline from intelligence
    expect(router._def?.procedures?.rewriteOutlineFromIntelligence).toBeDefined();
  });

  it("exports getWebinarIntelligenceContextBlock helper function", async () => {
    const mod = await import("./webinarIntelligenceRouter");
    expect(typeof mod.getWebinarIntelligenceContextBlock).toBe("function");
  });

  it("getWebinarIntelligenceContextBlock returns a string", async () => {
    const { getWebinarIntelligenceContextBlock } = await import("./webinarIntelligenceRouter");
    const result = await getWebinarIntelligenceContextBlock("energy and fatigue");
    expect(typeof result).toBe("string");
  });

  it("getWebinarIntelligenceContextBlock returns empty string when no data available", async () => {
    const { getWebinarIntelligenceContextBlock } = await import("./webinarIntelligenceRouter");
    // With no DB data seeded, should return empty string gracefully
    const result = await getWebinarIntelligenceContextBlock("some topic");
    expect(result).toBe(""); // No data yet — returns empty, not an error
  });
});
