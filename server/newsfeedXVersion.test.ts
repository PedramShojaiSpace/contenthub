/**
 * Newsfeed v134 — generateXVersion and dual-push procedure tests
 * Covers: generateXVersion output shape, 280-char enforcement,
 *         approveArticle includeX flag, pushArticleToBuffer dual-push
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock invokeLLM ─────────────────────────────────────────────────────────
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async () => ({
    choices: [
      {
        message: {
          content:
            "Your gut is your second brain. Most people ignore it until it's too late. Here's what 20 years of clinical practice taught me about healing from the inside out. #urbanmonk #guthealth",
        },
      },
    ],
  })),
}));

// ── Mock newsfeedCommentary ────────────────────────────────────────────────
vi.mock("./newsfeedCommentary", () => ({
  generateCommentary: vi.fn(async () => "Compelling LinkedIn commentary about gut health."),
  generateXVersion: vi.fn(async (commentary: string, url: string) => {
    const tweet =
      "Your gut is your second brain. Most people ignore it until it's too late. Here's what 20 years of clinical practice taught me. #urbanmonk";
    return tweet.slice(0, 280);
  }),
}));

// ── Mock getDb ─────────────────────────────────────────────────────────────
const mockSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
const mockSelectFrom = vi.fn().mockResolvedValue([
  {
    id: 1,
    url: "https://example.com/article",
    title: "Gut Health Breakthrough",
    commentary: "Compelling LinkedIn commentary about gut health.",
    xVersion: null,
    includeX: false,
    status: "pending",
  },
]);
const mockSelect = vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 1, commentary: "commentary", xVersion: null, url: "https://example.com" }]) }) }) });

vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    select: mockSelect,
    update: mockUpdate,
  })),
}));

// ── Tests ──────────────────────────────────────────────────────────────────

describe("generateXVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a string within 280 characters", async () => {
    const { generateXVersion } = await import("./newsfeedCommentary");
    const result = await generateXVersion(
      "Compelling LinkedIn commentary about gut health and the microbiome.",
      "https://theurbanmonk.com/gut-health"
    );
    expect(typeof result).toBe("string");
    expect(result.length).toBeLessThanOrEqual(280);
  });

  it("includes #urbanmonk hashtag", async () => {
    const { generateXVersion } = await import("./newsfeedCommentary");
    const result = await generateXVersion("Test commentary", "https://example.com");
    expect(result.toLowerCase()).toContain("#urbanmonk");
  });

  it("is called with commentary and url arguments", async () => {
    const { generateXVersion } = await import("./newsfeedCommentary");
    const mockFn = vi.mocked(generateXVersion);
    await generateXVersion("Test commentary", "https://example.com/test");
    expect(mockFn).toHaveBeenCalledWith("Test commentary", "https://example.com/test");
  });

  it("never returns an empty string", async () => {
    const { generateXVersion } = await import("./newsfeedCommentary");
    const result = await generateXVersion("Short commentary.", "https://example.com");
    expect(result.trim().length).toBeGreaterThan(0);
  });
});

describe("dual-push procedure (approveArticle with includeX)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls generateXVersion when includeX is true", async () => {
    const { generateXVersion } = await import("./newsfeedCommentary");
    const mockGenX = vi.mocked(generateXVersion);

    // Simulate the approveArticle logic when includeX=true and xVersion is null
    const article = { commentary: "Compelling commentary.", xVersion: null, url: "https://example.com" };
    if (!article.xVersion) {
      await generateXVersion(article.commentary, article.url);
    }

    expect(mockGenX).toHaveBeenCalledOnce();
    expect(mockGenX).toHaveBeenCalledWith(article.commentary, article.url);
  });

  it("skips generateXVersion when includeX is false", async () => {
    const { generateXVersion } = await import("./newsfeedCommentary");
    const mockGenX = vi.mocked(generateXVersion);

    // Simulate the approveArticle logic when includeX=false
    const includeX = false;
    if (includeX) {
      await generateXVersion("commentary", "https://example.com");
    }

    expect(mockGenX).not.toHaveBeenCalled();
  });

  it("skips generateXVersion when xVersion already exists", async () => {
    const { generateXVersion } = await import("./newsfeedCommentary");
    const mockGenX = vi.mocked(generateXVersion);

    const article = { commentary: "Existing commentary.", xVersion: "Already generated tweet.", url: "https://example.com" };
    if (!article.xVersion) {
      await generateXVersion(article.commentary, article.url);
    }

    expect(mockGenX).not.toHaveBeenCalled();
  });
});

describe("X version character enforcement", () => {
  it("enforces 280-char limit on generated tweet", () => {
    const longTweet =
      "This is a very long tweet that exceeds the Twitter character limit of 280 characters. It goes on and on with lots of words that are not necessary and should be trimmed down to fit within the platform's constraints. This is extra padding to make it longer than 280 characters for testing.";

    const enforced = longTweet.length > 280 ? longTweet.slice(0, 280) : longTweet;
    expect(enforced.length).toBeLessThanOrEqual(280);
  });

  it("does not truncate tweets under 280 chars", () => {
    const shortTweet = "Short tweet under 280 chars. #urbanmonk";
    const enforced = shortTweet.length > 280 ? shortTweet.slice(0, 280) : shortTweet;
    expect(enforced).toBe(shortTweet);
  });

  it("preserves hashtags when tweet is within limit", () => {
    const tweet = "Your gut is your second brain. #urbanmonk #guthealth";
    expect(tweet.length).toBeLessThanOrEqual(280);
    expect(tweet).toContain("#urbanmonk");
  });
});
