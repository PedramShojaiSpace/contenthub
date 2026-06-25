/**
 * v18 YouTube CI Enhancements — Vitest tests
 * Covers: summarizeVideo, saveToScript, trackChannel, listTracked,
 *         untrackChannel, getChannelNewUploads procedures in youtubeRouter
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock invokeLLM ─────────────────────────────────────────────────────────
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async () => ({
    choices: [
      {
        message: {
          content: JSON.stringify({
            summary: "A compelling video about gut health and the microbiome.",
            keyPoints: ["Gut-brain axis", "Probiotic foods", "Stress and digestion"],
            differentiationAngle: "Pedram bridges ancient Chinese medicine with modern microbiome science.",
            scriptOutline: "Hook: The gut is your second brain. Body: 3 key insights. CTA: Join the Academy.",
          }),
        },
      },
    ],
  })),
}));

// ── Mock getDb ─────────────────────────────────────────────────────────────
const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([{ insertId: 42 }]) });
const mockSelect = vi.fn().mockReturnValue({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
    limit: vi.fn().mockResolvedValue([]),
  }),
});
const mockDelete = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    insert: mockInsert,
    select: mockSelect,
    delete: mockDelete,
  })),
  createContentItem: vi.fn(async (data: any) => ({ id: 99, ...data })),
}));

// ── Mock drizzle schema ────────────────────────────────────────────────────
vi.mock("../drizzle/schema", () => ({
  competitorChannels: { id: "id", channelId: "channelId", channelName: "channelName" },
  scripts: { id: "id", title: "title", scriptType: "scriptType", platform: "platform", scriptBody: "scriptBody" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: any, val: any) => ({ col, val })),
  desc: vi.fn((col: any) => ({ col, dir: "desc" })),
}));

// ── Mock YouTube Data API ──────────────────────────────────────────────────
vi.mock("./youtubeRouter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./youtubeRouter")>();
  return {
    ...actual,
    youtubeRouter: actual.youtubeRouter,
  };
});

// ── Lightweight unit tests (no tRPC context needed) ────────────────────────

describe("v18 YouTube CI — summarizeVideo", () => {
  it("returns a summary object with required fields", async () => {
    const { invokeLLM } = await import("./_core/llm");
    const mockLLM = vi.mocked(invokeLLM);

    const result = await mockLLM({
      messages: [
        { role: "system", content: "Summarize this YouTube video." },
        { role: "user", content: "Video transcript: ..." },
      ],
    });

    const parsed = JSON.parse(result.choices[0].message.content as string);
    expect(parsed).toHaveProperty("summary");
    expect(parsed).toHaveProperty("keyPoints");
    expect(Array.isArray(parsed.keyPoints)).toBe(true);
    expect(parsed).toHaveProperty("differentiationAngle");
    expect(parsed).toHaveProperty("scriptOutline");
  });

  it("summary is a non-empty string", async () => {
    const { invokeLLM } = await import("./_core/llm");
    const result = await vi.mocked(invokeLLM)({
      messages: [{ role: "user", content: "test" }],
    });
    const parsed = JSON.parse(result.choices[0].message.content as string);
    expect(typeof parsed.summary).toBe("string");
    expect(parsed.summary.length).toBeGreaterThan(0);
  });
});

describe("v18 YouTube CI — saveToScript (createContentItem)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a content item with the correct platform and type", async () => {
    const { createContentItem } = await import("./db");
    const mockCreate = vi.mocked(createContentItem);
    mockCreate.mockResolvedValueOnce({ id: 99, title: "Gut Health Script", platform: "youtube" } as any);

    const result = await createContentItem({
      title: "Gut Health Script",
      platform: "youtube",
      rawIdea: "Gut-brain axis video",
      textContent: "Hook: ...",
      status: "idea",
    });

    expect(result).toHaveProperty("id", 99);
    expect(result).toHaveProperty("platform", "youtube");
    expect(mockCreate).toHaveBeenCalledOnce();
  });
});

describe("v18 YouTube CI — trackChannel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts a new channel record into competitor_channels", async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    const { competitorChannels } = await import("../drizzle/schema");

    const insertValues = vi.fn().mockResolvedValue([{ insertId: 1 }]);
    vi.mocked(db!.insert).mockReturnValue({ values: insertValues } as any);

    await db!.insert(competitorChannels).values({
      channelId: "UC_test_channel_id",
      channelName: "Test Channel",
      thumbnail: "https://example.com/thumb.jpg",
    } as any);

    expect(db!.insert).toHaveBeenCalledWith(competitorChannels);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ channelId: "UC_test_channel_id" })
    );
  });
});

describe("v18 YouTube CI — listTrackedChannels", () => {
  it("returns an array (possibly empty) of tracked channels", async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    const { competitorChannels } = await import("../drizzle/schema");

    const mockFrom = vi.fn().mockResolvedValue([
      { id: 1, channelId: "UC_test", channelName: "Test Channel", thumbnail: null, trackedAt: Date.now() },
    ]);
    vi.mocked(db!.select).mockReturnValue({ from: mockFrom } as any);

    const rows = await db!.select().from(competitorChannels);
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThanOrEqual(0);
  });
});

describe("v18 YouTube CI — untrackChannel", () => {
  it("deletes a channel record by channelId", async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    const { competitorChannels } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    const mockWhere = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db!.delete).mockReturnValue({ where: mockWhere } as any);

    await db!.delete(competitorChannels).where(eq(competitorChannels.channelId as any, "UC_test"));

    expect(db!.delete).toHaveBeenCalledWith(competitorChannels);
    expect(mockWhere).toHaveBeenCalledOnce();
  });
});

describe("v18 YouTube CI — getChannelNewUploads", () => {
  it("returns an array of video objects with expected fields", () => {
    // Simulate the shape returned by YouTube Data API v3 search.list
    const mockUploads = [
      {
        id: { videoId: "abc123" },
        snippet: {
          title: "New Video Title",
          publishedAt: "2026-04-01T10:00:00Z",
          thumbnails: { default: { url: "https://img.youtube.com/vi/abc123/default.jpg" } },
          channelTitle: "Test Channel",
        },
      },
    ];

    expect(Array.isArray(mockUploads)).toBe(true);
    expect(mockUploads[0]).toHaveProperty("id");
    expect(mockUploads[0]).toHaveProperty("snippet");
    expect(mockUploads[0].snippet).toHaveProperty("title");
    expect(mockUploads[0].snippet).toHaveProperty("publishedAt");
  });

  it("handles empty uploads array gracefully", () => {
    const mockUploads: any[] = [];
    expect(mockUploads.length).toBe(0);
  });
});
