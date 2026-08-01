/**
 * Script Factory v2.2 — Part 1 regression tests for the five verified vidIQ defects.
 *
 * Each test encodes one defect. They are written against the SSE transport shape
 * that mcp.vidiq.com actually returns (captured live on 2026-08-01, raw output in
 * docs/build-reports/v22r/01-fixes-proof.txt), so a regression in the transport
 * handling fails here rather than silently in production.
 *
 * `fetch` is stubbed rather than mocked at module level because callVidIQTool
 * calls global fetch directly; this keeps the assertions on real parsing logic.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ENV is a plain object built once at import time, so assigning process.env
// inside a test runs too late. Stub the module instead — this also keeps the
// suite hermetic: it never reads the operator's real VIDIQ_API_KEY.
vi.mock("./_core/env", () => ({
  ENV: { vidiqApiKey: "test-key-for-unit-tests" },
}));

import {
  isVidIQToolError,
  spendableCredits,
  VidIQToolError,
  vidiqBalance,
  vidiqOutliers,
  vidiqTrendingVideos,
  type VidIQBalance,
} from "./vidiq";

/** Wrap a JSON-RPC result in the SSE envelope vidIQ actually sends. */
function sse(body: unknown): string {
  return `event: message\ndata: ${JSON.stringify(body)}\n\n`;
}

function stubFetch(responseBody: string, ok = true, status = 200) {
  const spy = vi.fn(async () => ({
    ok,
    status,
    text: async () => responseBody,
  })) as unknown as typeof fetch;
  globalThis.fetch = spy;
  return spy as unknown as ReturnType<typeof vi.fn>;
}

/** The last request body sent through the stubbed fetch, parsed. */
function lastRequestArgs(spy: any): Record<string, unknown> {
  const call = spy.mock.calls.at(-1);
  const init = call?.[1] as { body?: string } | undefined;
  const parsed = JSON.parse(init?.body ?? "{}");
  return parsed?.params?.arguments ?? {};
}

const realFetch = globalThis.fetch;

beforeEach(() => {
  // Nothing to arrange: the API key comes from the mocked ENV module above.
});

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe("v2.2 Part 1 fix 1 — result.isError is honoured", () => {
  it("throws VidIQToolError carrying the verbatim reason, not a JSON.parse SyntaxError", async () => {
    // This is the exact failure shape: HTTP 200, NO jsonrpc `error` member,
    // isError true, and the reason as plain prose (never valid JSON).
    const reason =
      "MCP error -32602: Invalid arguments for tool vidiq_outliers: contentType must be one of all, long, short";
    stubFetch(
      sse({
        jsonrpc: "2.0",
        id: 1,
        result: { content: [{ type: "text", text: reason }], isError: true },
      })
    );

    const err = await vidiqOutliers("leaky gut fatigue").then(
      () => null,
      (e) => e
    );

    expect(err).toBeInstanceOf(VidIQToolError);
    expect(isVidIQToolError(err)).toBe(true);
    // The whole point of the fix: the operator-visible reason survives.
    expect((err as VidIQToolError).rawMessage).toBe(reason);
    expect((err as VidIQToolError).tool).toBe("vidiq_outliers");
    // Pre-fix behaviour was an opaque SyntaxError from JSON.parse.
    expect((err as Error).name).not.toBe("SyntaxError");
  });

  it("still reports a tool error when isError is set but no text block exists", async () => {
    stubFetch(sse({ jsonrpc: "2.0", id: 1, result: { content: [], isError: true } }));
    const err = await vidiqBalance().then(
      () => null,
      (e) => e
    );
    expect(isVidIQToolError(err)).toBe(true);
    expect((err as VidIQToolError).rawMessage).toMatch(/no message body/i);
  });
});

describe("v2.2 Part 1 fix 2 — structuredContent is preferred over content[0].text", () => {
  it("returns structuredContent even when content[0].text is markdown prose", async () => {
    // The success-path defect: text is prose, so JSON.parse threw ON SUCCESS.
    stubFetch(
      sse({
        jsonrpc: "2.0",
        id: 1,
        result: {
          content: [{ type: "text", text: "## Trending videos\n\n- Some human-readable summary" }],
          structuredContent: {
            videos: [
              {
                videoId: "abc123",
                title: "Why You're Always Tired",
                channelTitle: "Some Channel",
                viewCount: 812_000,
                vph: 430,
                publishedAt: "2026-07-02T00:00:00Z",
              },
            ],
          },
          isError: false,
        },
      })
    );

    const videos = await vidiqTrendingVideos("chronic fatigue");
    expect(videos).toHaveLength(1);
    expect(videos[0].videoId).toBe("abc123");
    expect(videos[0].viewCount).toBe(812_000);
  });

  it("falls back to parsing content[0].text when it is valid JSON", async () => {
    stubFetch(
      sse({
        jsonrpc: "2.0",
        id: 1,
        result: {
          content: [{ type: "text", text: JSON.stringify({ videos: [{ videoId: "z9" }] }) }],
          isError: false,
        },
      })
    );
    const videos = await vidiqTrendingVideos("gut health");
    expect(videos[0]?.videoId).toBe("z9");
  });

  it("returns { _text } instead of throwing when the payload is prose with no structuredContent", async () => {
    stubFetch(
      sse({
        jsonrpc: "2.0",
        id: 1,
        result: { content: [{ type: "text", text: "No videos matched that query." }], isError: false },
      })
    );
    // vidiqTrendingVideos reads `.videos`, which is absent — it must degrade to
    // an empty list rather than crashing the whole research leg.
    await expect(vidiqTrendingVideos("nonsense query")).resolves.toEqual([]);
  });
});

describe("v2.2 Part 1 fixes 3 & 4 — live enum values are sent", () => {
  it("vidiq_outliers sends contentType from the live enum, never 'video'", async () => {
    const spy = stubFetch(
      sse({ jsonrpc: "2.0", id: 1, result: { structuredContent: { videos: [] }, isError: false } })
    );
    await vidiqOutliers("leaky gut fatigue", 5);
    const args = lastRequestArgs(spy);
    expect(args.contentType).toBe("long");
    expect(args.contentType).not.toBe("video");
    expect(["all", "long", "short"]).toContain(args.contentType);
  });

  it("vidiq_outliers honours an explicit contentType override", async () => {
    const spy = stubFetch(
      sse({ jsonrpc: "2.0", id: 1, result: { structuredContent: { videos: [] }, isError: false } })
    );
    await vidiqOutliers("morning routine", 5, "short");
    expect(lastRequestArgs(spy).contentType).toBe("short");
  });

  it("vidiq_trending_videos sends videoFormat from the live enum, never 'video'", async () => {
    const spy = stubFetch(
      sse({ jsonrpc: "2.0", id: 1, result: { structuredContent: { videos: [] }, isError: false } })
    );
    await vidiqTrendingVideos("chronic fatigue", 10);
    const args = lastRequestArgs(spy);
    expect(args.videoFormat).toBe("long");
    expect(args.videoFormat).not.toBe("video");
    // Deliberately narrower than contentType — "all" is NOT valid here.
    expect(["long", "short"]).toContain(args.videoFormat);
  });
});

describe("v2.2 Part 1 fix 5 — balance is read from totalCredits", () => {
  it("returns the live balance shape and spendableCredits reads totalCredits", async () => {
    const live: VidIQBalance = {
      type: "credits",
      totalCredits: 4820,
      renewableCredits: 4800,
      maxRenewableCredits: 5000,
      renewableResetsAt: "2026-08-15T00:00:00Z",
      addOnCredits: 20,
      maxAddOnCredits: 100,
    };
    stubFetch(sse({ jsonrpc: "2.0", id: 1, result: { structuredContent: live, isError: false } }));

    const balance = await vidiqBalance();
    expect(balance.totalCredits).toBe(4820);
    expect(spendableCredits(balance)).toBe(4820);
    // The key the old code read never existed.
    expect((balance as unknown as { credits?: number }).credits).toBeUndefined();
  });

  it("spendableCredits returns null for unusable shapes so guards cannot silently pass", () => {
    expect(spendableCredits(null)).toBeNull();
    expect(spendableCredits(undefined)).toBeNull();
    expect(spendableCredits({} as VidIQBalance)).toBeNull();
    expect(spendableCredits({ totalCredits: Number.NaN } as VidIQBalance)).toBeNull();
  });

  it("a low balance is now comparable, so a pre-flight guard can actually fire", () => {
    // Regression guard for the real production consequence: `undefined < needed`
    // is always false, so a doomed batch fired every call instead of stopping.
    const low = { totalCredits: 5 } as VidIQBalance;
    const credits = spendableCredits(low);
    expect(credits).toBe(5);
    expect(credits !== null && credits < 30).toBe(true);

    const brokenOldRead = (low as unknown as { credits?: number }).credits;
    expect(brokenOldRead === undefined).toBe(true);
    // This is the exact expression that used to gate the batch — always false.
    expect((brokenOldRead as unknown as number) < 30).toBe(false);
  });
});

/**
 * Fix 9 tests deliberately use payloads copied VERBATIM from the live probe
 * (docs/build-reports/v22r/probe_vidiq_fields.mjs, captured 2026-08-01) rather
 * than hand-written fixtures. Inventing the shape is exactly how this defect
 * survived: the earlier tests agreed with the wrong assumption.
 */
describe("v2.2 Part 1 fix 9 — real wire field names are mapped", () => {
  /** Verbatim vidiq_outliers videos[0] from the live capture. */
  const REAL_OUTLIER = {
    videoId: "CREAfc5QvuE",
    videoTitle: "Brud Sprunki EATS EVERYTHING, Then throws up... it's his hobby..",
    videoTags: [],
    videoTopics: ["Video game culture"],
    videoThumbnail: "https://i.ytimg.com/vi/CREAfc5QvuE/maxresdefault.jpg",
    videoPublishedAt: 1774063697,
    videoDuration: 636,
    channelId: "UC5MqEjDv-gyWlHphdviBvCg",
    channelTitle: "Ashimation",
    channelCountry: "AE",
    subscriberCount: 135000,
    mainCategory: "Film",
    viewCount: 329197,
    breakoutScore: 27.37,
    videoType: "long",
    engagementRate: 0.013,
    vph: 103.23,
    score: 0.1295151561498642,
    trendCategories: null,
  };

  /** Verbatim vidiq_trending_videos videos[0] from the live capture. */
  const REAL_TRENDING = {
    videoId: "0EM-JELwpjA",
    videoTitle: "This is Why Black Fatigue is Impossible to Ignore",
    videoTitleLanguage: "en",
    videoPublishedAt: "2026-07-28T14:52:05.000Z",
    videoDuration: 928,
    channelId: "UC86UHbl-iyV0M7e-PGc8D9Q",
    channelTitle: "Angry Unc ",
    channelCountry: "US",
    subscriberCount: 17100,
    viewCount: 56048,
    likeCount: 2702,
    commentCount: 974,
    engagementRate: 0.066,
    vph: 603.3153928955866,
    videoTags: [],
  };

  it("maps videoTitle to title — the field that printed as undefined", async () => {
    stubFetch(
      sse({ jsonrpc: "2.0", id: 1, result: { structuredContent: { videos: [REAL_OUTLIER] } } })
    );
    const [v] = await vidiqOutliers("leaky gut fatigue", 1);
    expect(v.title).toBe("Brud Sprunki EATS EVERYTHING, Then throws up... it's his hobby..");
    expect(v.title).not.toBe("Untitled");
    expect(v.title).not.toBeUndefined();
  });

  it("maps breakoutScore to outlierScore, since no outlierScore key exists", async () => {
    stubFetch(
      sse({ jsonrpc: "2.0", id: 1, result: { structuredContent: { videos: [REAL_OUTLIER] } } })
    );
    const [v] = await vidiqOutliers("leaky gut fatigue", 1);
    expect(v.outlierScore).toBe(27.37);
    // The old read produced 0 for every row, making the ranking sort a no-op.
    expect(v.outlierScore).not.toBe(0);
    expect(REAL_OUTLIER).not.toHaveProperty("outlierScore");
  });

  it("keeps channelId and subscriberCount, which were hardcoded to null", async () => {
    stubFetch(
      sse({ jsonrpc: "2.0", id: 1, result: { structuredContent: { videos: [REAL_OUTLIER] } } })
    );
    const [v] = await vidiqOutliers("leaky gut fatigue", 1);
    expect(v.channelId).toBe("UC5MqEjDv-gyWlHphdviBvCg");
    expect(v.subscriberCount).toBe(135000);
    expect(v.channelTitle).toBe("Ashimation");
    expect(v.viewCount).toBe(329197);
  });

  it("normalises outliers' unix-seconds publishedAt to ISO", async () => {
    stubFetch(
      sse({ jsonrpc: "2.0", id: 1, result: { structuredContent: { videos: [REAL_OUTLIER] } } })
    );
    const [v] = await vidiqOutliers("leaky gut fatigue", 1);
    expect(v.publishedAt).toBe(new Date(1774063697 * 1000).toISOString());
    expect(v.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("normalises trending's ISO publishedAt and maps its fields", async () => {
    stubFetch(
      sse({ jsonrpc: "2.0", id: 1, result: { structuredContent: { videos: [REAL_TRENDING] } } })
    );
    const [v] = await vidiqTrendingVideos("leaky gut fatigue", 1);
    expect(v.title).toBe("This is Why Black Fatigue is Impossible to Ignore");
    expect(v.publishedAt).toBe("2026-07-28T14:52:05.000Z");
    expect(v.vph).toBeCloseTo(603.3153928955866, 6);
    expect(v.viewCount).toBe(56048);
    expect(v.subscriberCount).toBe(17100);
    expect(v.durationSec).toBe(928);
  });

  it("tolerates the two tools disagreeing on the publishedAt type", async () => {
    // Outliers sends a number, trending sends a string, for the same field name.
    expect(typeof REAL_OUTLIER.videoPublishedAt).toBe("number");
    expect(typeof REAL_TRENDING.videoPublishedAt).toBe("string");

    stubFetch(
      sse({
        jsonrpc: "2.0",
        id: 1,
        result: {
          structuredContent: {
            videos: [
              { ...REAL_OUTLIER, videoPublishedAt: undefined },
              { ...REAL_OUTLIER, videoId: "x2", videoPublishedAt: "not a date" },
            ],
          },
        },
      })
    );
    const rows = await vidiqOutliers("k", 2);
    // Unparseable timestamps become null rather than "Invalid Date".
    expect(rows[0].publishedAt).toBeNull();
    expect(rows[1].publishedAt).toBeNull();
  });

  it("drops rows with no videoId rather than emitting empty records", async () => {
    stubFetch(
      sse({
        jsonrpc: "2.0",
        id: 1,
        result: { structuredContent: { videos: [REAL_OUTLIER, {}, { videoTitle: "orphan" }] } },
      })
    );
    const rows = await vidiqOutliers("k", 5);
    expect(rows).toHaveLength(1);
    expect(rows[0].videoId).toBe("CREAfc5QvuE");
  });
});
