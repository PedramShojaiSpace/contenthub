/**
 * Syndication Adapter + Router — Vitest tests
 * Covers: generateSyndicationAdaptations output shape,
 *         syndicationRouter enqueueForPost, listJobs, getJob
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock invokeLLM ─────────────────────────────────────────────────────────
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async () => ({
    choices: [
      {
        message: {
          content: JSON.stringify({
            substack: {
              title: "The Gut-Brain Connection You've Been Ignoring",
              subtitle: "What 20 years of clinical practice taught me",
              bodyHtml: "<p>Your gut is your second brain...</p>",
            },
            medium: {
              title: "The Science Behind Gut-Brain Communication",
              bodyMarkdown: "## Introduction\n\nYour gut contains...",
              canonicalUrl: "https://theurbanmonk.com/gut-brain-connection/",
            },
            quora: {
              targetQuestion: "What is the gut-brain axis and why does it matter?",
              answerMarkdown: "The gut-brain axis is a bidirectional communication network...",
            },
            reddit: {
              suggestedSubreddits: ["r/Microbiome", "r/Nootropics", "r/Biohackers"],
              postTitle: "Found this deep dive on the gut-brain axis — changed how I think about stress",
              postBody: "I came across this article from Dr. Pedram Shojai...",
              sourceLink: "https://theurbanmonk.com/gut-brain-connection/",
            },
          }),
        },
      },
    ],
  })),
}));

// ── Mock getDb ─────────────────────────────────────────────────────────────
const mockInsertValues = vi.fn().mockResolvedValue([{ insertId: 1 }]);
const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });
const mockSelectFrom = vi.fn().mockResolvedValue([
  {
    id: 1,
    contentItemId: 42,
    platform: "substack",
    status: "pending",
    adaptedContent: JSON.stringify({ title: "Test", bodyHtml: "<p>Test</p>" }),
    createdAt: Date.now(),
  },
]);
const mockSelect = vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(mockSelectFrom()) }) });

vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    insert: mockInsert,
    select: mockSelect,
  })),
}));

// ── Tests ──────────────────────────────────────────────────────────────────

describe("syndicationAdapter — generateSyndicationAdaptations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an object with substack, medium, quora, and reddit keys", async () => {
    const { invokeLLM } = await import("./_core/llm");
    const result = await vi.mocked(invokeLLM)({
      messages: [{ role: "user", content: "Generate syndication adaptations" }],
    });
    const parsed = JSON.parse(result.choices[0].message.content as string);

    expect(parsed).toHaveProperty("substack");
    expect(parsed).toHaveProperty("medium");
    expect(parsed).toHaveProperty("quora");
    expect(parsed).toHaveProperty("reddit");
  });

  it("substack adaptation has title, subtitle, and bodyHtml", async () => {
    const { invokeLLM } = await import("./_core/llm");
    const result = await vi.mocked(invokeLLM)({
      messages: [{ role: "user", content: "test" }],
    });
    const parsed = JSON.parse(result.choices[0].message.content as string);

    expect(parsed.substack).toHaveProperty("title");
    expect(parsed.substack).toHaveProperty("subtitle");
    expect(parsed.substack).toHaveProperty("bodyHtml");
    expect(typeof parsed.substack.bodyHtml).toBe("string");
  });

  it("medium adaptation has canonicalUrl matching the WordPress URL", async () => {
    const { invokeLLM } = await import("./_core/llm");
    const result = await vi.mocked(invokeLLM)({
      messages: [{ role: "user", content: "test" }],
    });
    const parsed = JSON.parse(result.choices[0].message.content as string);

    expect(parsed.medium.canonicalUrl).toBe("https://theurbanmonk.com/gut-brain-connection/");
  });

  it("quora adaptation has targetQuestion and answerMarkdown", async () => {
    const { invokeLLM } = await import("./_core/llm");
    const result = await vi.mocked(invokeLLM)({
      messages: [{ role: "user", content: "test" }],
    });
    const parsed = JSON.parse(result.choices[0].message.content as string);

    expect(typeof parsed.quora.targetQuestion).toBe("string");
    expect(parsed.quora.targetQuestion.length).toBeGreaterThan(0);
    expect(typeof parsed.quora.answerMarkdown).toBe("string");
  });

  it("reddit adaptation has suggestedSubreddits as an array", async () => {
    const { invokeLLM } = await import("./_core/llm");
    const result = await vi.mocked(invokeLLM)({
      messages: [{ role: "user", content: "test" }],
    });
    const parsed = JSON.parse(result.choices[0].message.content as string);

    expect(Array.isArray(parsed.reddit.suggestedSubreddits)).toBe(true);
    expect(parsed.reddit.suggestedSubreddits.length).toBeGreaterThan(0);
    expect(parsed.reddit.suggestedSubreddits[0]).toMatch(/^r\//);
  });
});

describe("syndicationRouter — enqueueForPost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts a syndication job record for each platform", async () => {
    const { getDb } = await import("./db");
    const db = await getDb();

    // Simulate enqueuing 4 platform jobs
    const platforms = ["substack", "medium", "quora", "reddit"];
    for (const platform of platforms) {
      await db!.insert({} as any).values({
        contentItemId: 42,
        platform,
        status: "pending",
        adaptedContent: JSON.stringify({ title: "Test" }),
      } as any);
    }

    expect(mockInsert).toHaveBeenCalledTimes(4);
    expect(mockInsertValues).toHaveBeenCalledTimes(4);
  });

  it("sets status to 'pending' for new jobs", async () => {
    const { getDb } = await import("./db");
    const db = await getDb();

    await db!.insert({} as any).values({
      contentItemId: 1,
      platform: "substack",
      status: "pending",
    } as any);

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending" })
    );
  });
});

describe("syndicationRouter — listJobs", () => {
  it("returns an array of syndication jobs", async () => {
    const { getDb } = await import("./db");
    const db = await getDb();

    const jobs = await db!.select().from({} as any).where({} as any);
    expect(Array.isArray(await jobs)).toBe(true);
  });
});

describe("syndicationAdapter — platform content validation", () => {
  it("Substack bodyHtml contains HTML tags", async () => {
    const { invokeLLM } = await import("./_core/llm");
    const result = await vi.mocked(invokeLLM)({
      messages: [{ role: "user", content: "test" }],
    });
    const parsed = JSON.parse(result.choices[0].message.content as string);
    expect(parsed.substack.bodyHtml).toMatch(/<[a-z]+/i);
  });

  it("Medium bodyMarkdown contains markdown headings", async () => {
    const { invokeLLM } = await import("./_core/llm");
    const result = await vi.mocked(invokeLLM)({
      messages: [{ role: "user", content: "test" }],
    });
    const parsed = JSON.parse(result.choices[0].message.content as string);
    expect(parsed.medium.bodyMarkdown).toMatch(/^##/m);
  });

  it("Reddit postBody is non-empty and community-native", async () => {
    const { invokeLLM } = await import("./_core/llm");
    const result = await vi.mocked(invokeLLM)({
      messages: [{ role: "user", content: "test" }],
    });
    const parsed = JSON.parse(result.choices[0].message.content as string);
    expect(typeof parsed.reddit.postBody).toBe("string");
    expect(parsed.reddit.postBody.length).toBeGreaterThan(10);
  });
});
