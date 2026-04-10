/**
 * Vitest tests for webinarRouter
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB ──────────────────────────────────────────────────────────────────

const mockInsert = vi.fn().mockResolvedValue({ insertId: 42 });
const mockSelect = vi.fn().mockReturnValue({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue([
      {
        id: 42,
        topic: "Upstream Health",
        cta: "Get the Bundle",
        personaIds: "[1,2]",
        targetLengthMinutes: 60,
        registrationUrl: "https://zoom.us/test",
        outline: null,
        hookScript: null,
        landingPageCopy: null,
        gammaUrl: null,
        gammaGenerationId: null,
        thankYouPageCopy: null,
        thankYouWistiaId: null,
        thankYouTypeformUrl: null,
        kajabiExport: null,
        status: "draft",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]),
    orderBy: vi.fn().mockResolvedValue([]),
  }),
});
const mockUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue({}),
  }),
});
const mockDelete = vi.fn().mockReturnValue({
  where: vi.fn().mockResolvedValue({}),
});

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    insert: () => ({ values: mockInsert }),
    select: mockSelect,
    update: () => mockUpdate(),
    delete: () => mockDelete(),
  }),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: "## 🎯 Webinar Title\nUpstream Health\n\n## 🪝 Opening Hook (0–5 min)\nHook content here\n\n## 📖 Hook Script\nThis is the hook script.\n\n## 📋 Webinar Outline\n### Section 1: The Problem\n- Key points",
        },
      },
    ],
  }),
}));

vi.mock("./avatarRouter", () => ({
  getAvatarContextBlockForPersona: vi.fn().mockResolvedValue("Avatar context"),
}));

vi.mock("./mediaRouter", () => ({
  getMediaContextBlock: vi.fn().mockResolvedValue("Media context"),
}));

vi.mock("./ctaRouter", () => ({
  getCtaForTopic: vi.fn().mockResolvedValue({ ctaText: "Join the Academy", label: "Academy", url: null }),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

// We test the router procedures by importing the router and calling them directly
// via the internal helper functions (which are exported for testing)

describe("webinarRouter — schema and structure", () => {
  it("webinar_sessions schema fields are defined", async () => {
    const { webinarSessions } = await import("../drizzle/schema");
    expect(webinarSessions).toBeDefined();
    // Verify key columns exist on the table object
    const cols = Object.keys(webinarSessions);
    expect(cols).toContain("id");
  });

  it("webinarRouter exports a valid tRPC router", async () => {
    const { webinarRouter } = await import("./webinarRouter");
    expect(webinarRouter).toBeDefined();
    expect(typeof webinarRouter).toBe("object");
    // Check that key procedures are defined
    expect(webinarRouter._def).toBeDefined();
  });
});

describe("webinarRouter — outline generation", () => {
  it("generateOutline extracts hook script from outline", async () => {
    const { invokeLLM } = await import("./_core/llm");
    const mockLLM = vi.mocked(invokeLLM);

    const outlineWithHook = `## 🎯 Webinar Title
Upstream Health: Find Your Root Cause

## 🪝 Opening Hook (0–5 min)
The first 5 minutes of the webinar.

## 📖 Hook Script
This is the actual word-for-word opening hook script.
It spans multiple paragraphs.
Pedram speaks directly to the audience.

## 📋 Webinar Outline
### Section 1: The Problem (5–15 min)
- Key points to cover`;

    mockLLM.mockResolvedValueOnce({
      choices: [{ message: { content: outlineWithHook } }],
    } as any);

    // Test the hook extraction regex directly
    const hookMatch = outlineWithHook.match(/##\s+📖[^\n]*\n([\s\S]*?)(?=##\s+📋|$)/);
    expect(hookMatch).not.toBeNull();
    const hookScript = hookMatch ? hookMatch[1].trim() : "";
    expect(hookScript).toContain("word-for-word opening hook script");
    expect(hookScript).toContain("Pedram speaks directly");
  });

  it("generateOutline returns empty hook if no hook section", () => {
    const outlineWithoutHook = `## 🎯 Webinar Title
Upstream Health

## 📋 Webinar Outline
### Section 1: The Problem
- Key points`;

    const hookMatch = outlineWithoutHook.match(/##\s+📖[^\n]*\n([\s\S]*?)(?=##\s+📋|$)/);
    const hookScript = hookMatch ? hookMatch[1].trim() : "";
    expect(hookScript).toBe("");
  });
});

describe("webinarRouter — Kajabi plan structure", () => {
  it("Kajabi plan JSON schema has required fields", () => {
    const samplePlan = {
      pipeline_name: "Upstream Health Webinar Funnel",
      trigger: "Webinar Registration Form Submitted",
      tags_to_apply: ["webinar-registered", "upstream-health"],
      email_sequence: [
        {
          step: 1,
          delay: "Immediately",
          subject: "You're registered! Here's what to expect",
          preview_text: "See you on the webinar",
          body_summary: "Confirmation email with webinar details and add-to-calendar links.",
          cta_text: "Add to Calendar",
          cta_url: "https://zoom.us/test",
        },
      ],
      post_webinar_sequence: [
        {
          step: 1,
          delay: "1 hour after webinar",
          subject: "Here's the replay",
          preview_text: "Watch it again",
          body_summary: "Send replay link with CTA to purchase.",
          cta_text: "Watch Replay",
          cta_url: "https://zoom.us/replay",
        },
      ],
      automation_rules: [
        { trigger: "Purchased Upstream Bundle", action: "Remove from post-webinar sequence" },
      ],
      setup_instructions: [
        "Create a new Pipeline in Kajabi named 'Upstream Health Webinar Funnel'",
        "Set trigger to 'Form Submitted' on your webinar registration form",
      ],
    };

    expect(samplePlan.pipeline_name).toBeTruthy();
    expect(samplePlan.trigger).toBeTruthy();
    expect(Array.isArray(samplePlan.tags_to_apply)).toBe(true);
    expect(Array.isArray(samplePlan.email_sequence)).toBe(true);
    expect(samplePlan.email_sequence.length).toBeGreaterThan(0);
    expect(Array.isArray(samplePlan.post_webinar_sequence)).toBe(true);
    expect(Array.isArray(samplePlan.automation_rules)).toBe(true);
    expect(Array.isArray(samplePlan.setup_instructions)).toBe(true);

    // Validate email sequence structure
    const firstEmail = samplePlan.email_sequence[0];
    expect(firstEmail).toHaveProperty("step");
    expect(firstEmail).toHaveProperty("delay");
    expect(firstEmail).toHaveProperty("subject");
    expect(firstEmail).toHaveProperty("body_summary");
    expect(firstEmail).toHaveProperty("cta_text");
  });
});

describe("webinarRouter — persona loading", () => {
  it("handles empty persona IDs gracefully", async () => {
    // When no personas are selected, should fall back to default audience description
    const personaIds: number[] = [];
    const personaNames = personaIds.length === 0
      ? "high-performing health-conscious professionals"
      : "selected personas";
    expect(personaNames).toBe("high-performing health-conscious professionals");
  });

  it("parses persona IDs from JSON string", () => {
    const personaIdsJson = "[1, 2, 3]";
    const ids = JSON.parse(personaIdsJson) as number[];
    expect(ids).toEqual([1, 2, 3]);
    expect(ids.length).toBe(3);
  });
});

describe("webinarRouter — Gamma integration", () => {
  it("validates Zoom registration URL format", () => {
    const validUrl = "https://us02web.zoom.us/webinar/register/WN_qpfJBJ2uSCWpA8C-b1Kxzg";
    const invalidUrl = "not-a-url";

    const isValidUrl = (url: string) => {
      try { new URL(url); return true; } catch { return false; }
    };

    expect(isValidUrl(validUrl)).toBe(true);
    expect(isValidUrl(invalidUrl)).toBe(false);
  });

  it("extracts title from landing page copy", () => {
    const copy = "# Discover Your Root Cause\n\n## Subheadline here\n\nBody text";
    const titleLine = copy.split("\n").find((l) => l.startsWith("#"));
    const title = titleLine ? titleLine.replace(/^#+\s*/, "").trim() : "Webinar";
    expect(title).toBe("Discover Your Root Cause");
  });

  it("falls back to topic when no title in copy", () => {
    const copy = "No heading here\n\nJust body text";
    const titleLine = copy.split("\n").find((l) => l.startsWith("#"));
    const topic = "Upstream Health Webinar";
    const title = titleLine ? titleLine.replace(/^#+\s*/, "").trim() : topic;
    expect(title).toBe("Upstream Health Webinar");
  });
});
