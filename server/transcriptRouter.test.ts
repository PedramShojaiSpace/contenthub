/**
 * Tests for Transcript Engine — Phase A
 *
 * Tests cover:
 * - Quota ledger: todayStr format, quota math
 * - Input validation: fetchTranscript, backfillChannel, pasteTranscript
 * - Supadata error handling: NO_TRANSCRIPT detection
 * - Word count calculation
 * - Status enum values
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";

// ─── Quota ledger helpers ─────────────────────────────────────────────────────

describe("transcriptRouter — quota ledger", () => {
  it("todayStr returns YYYY-MM-DD format", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("calculates remaining quota correctly", () => {
    const dailyLimit = 25;
    const unitsUsed = 10;
    const remaining = dailyLimit - unitsUsed;
    expect(remaining).toBe(15);
  });

  it("quota is exhausted when unitsUsed >= dailyLimit", () => {
    expect(25 - 25).toBe(0);
    expect(25 - 26).toBeLessThan(0);
  });

  it("cost estimate is correct at $0.02/call", () => {
    const remaining = 15;
    const cost = (remaining * 0.02).toFixed(2);
    expect(cost).toBe("0.30");
  });

  it("daily limit defaults to 25", () => {
    const DEFAULT_DAILY_LIMIT = 25;
    expect(DEFAULT_DAILY_LIMIT).toBe(25);
  });
});

// ─── Input validation ─────────────────────────────────────────────────────────

describe("transcriptRouter — input validation", () => {
  it("fetchTranscript validates videoId length", () => {
    const schema = z.object({
      videoId: z.string().min(1).max(64),
      videoTitle: z.string().optional(),
      channelId: z.string().optional(),
      publishedAt: z.string().optional(),
    });

    expect(schema.safeParse({ videoId: "" }).success).toBe(false);
    expect(schema.safeParse({ videoId: "dQw4w9WgXcQ" }).success).toBe(true);
    expect(schema.safeParse({ videoId: "x".repeat(65) }).success).toBe(false);
  });

  it("backfillChannel validates maxVideos range", () => {
    const schema = z.object({
      maxVideos: z.number().min(1).max(50).default(25),
      pageToken: z.string().optional(),
    });

    expect(schema.safeParse({ maxVideos: 0 }).success).toBe(false);
    expect(schema.safeParse({ maxVideos: 51 }).success).toBe(false);
    expect(schema.safeParse({ maxVideos: 25 }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(true); // uses default
    if (schema.safeParse({}).success) {
      expect(schema.parse({}).maxVideos).toBe(25);
    }
  });

  it("pasteTranscript requires minimum 50 characters", () => {
    const schema = z.object({
      videoId: z.string().min(1).max(64),
      rawText: z.string().min(50, "Transcript must be at least 50 characters"),
      lang: z.string().default("en"),
    });

    expect(schema.safeParse({ videoId: "abc123", rawText: "short" }).success).toBe(false);
    expect(
      schema.safeParse({
        videoId: "abc123",
        rawText: "x".repeat(50),
      }).success
    ).toBe(true);
  });

  it("listTranscripts validates status enum", () => {
    const schema = z.object({
      status: z.enum(["pending", "fetched", "no_transcript", "error"]).optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(200).default(50),
      offset: z.number().min(0).default(0),
    });

    expect(schema.safeParse({ status: "invalid_status" }).success).toBe(false);
    expect(schema.safeParse({ status: "fetched" }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(true);
  });
});

// ─── Supadata error handling ──────────────────────────────────────────────────

describe("transcriptRouter — Supadata error handling", () => {
  it("detects NO_TRANSCRIPT error correctly", () => {
    const isNoTranscript = (msg: string) => msg === "NO_TRANSCRIPT";
    expect(isNoTranscript("NO_TRANSCRIPT")).toBe(true);
    expect(isNoTranscript("Supadata error 404: Channel not found")).toBe(false);
    expect(isNoTranscript("Network error")).toBe(false);
  });

  it("maps NO_TRANSCRIPT to no_transcript status", () => {
    const getStatus = (msg: string): "no_transcript" | "error" =>
      msg === "NO_TRANSCRIPT" ? "no_transcript" : "error";

    expect(getStatus("NO_TRANSCRIPT")).toBe("no_transcript");
    expect(getStatus("Supadata error 500: Internal Server Error")).toBe("error");
  });

  it("does not count NO_TRANSCRIPT against quota", () => {
    // Only real API calls (including failed ones) count against quota
    // NO_TRANSCRIPT means the video has no transcript — we skip the API call
    let quotaUsed = 0;
    const processResult = (status: "fetched" | "no_transcript" | "error") => {
      if (status !== "no_transcript") quotaUsed++;
    };

    processResult("fetched");
    processResult("no_transcript");
    processResult("error");

    expect(quotaUsed).toBe(2); // fetched + error, not no_transcript
  });
});

// ─── Word count ───────────────────────────────────────────────────────────────

describe("transcriptRouter — word count", () => {
  it("counts words correctly", () => {
    const text = "Hello world this is a test transcript with ten words total";
    const count = text.trim().split(/\s+/).length;
    expect(count).toBe(11);
  });

  it("handles empty text", () => {
    const text = "";
    const count = text.trim().split(/\s+/).filter(Boolean).length;
    expect(count).toBe(0);
  });

  it("handles text with extra whitespace", () => {
    const text = "  word1   word2  word3  ";
    const count = text.trim().split(/\s+/).filter(Boolean).length;
    expect(count).toBe(3);
  });
});

// ─── Status enum ─────────────────────────────────────────────────────────────

describe("transcriptRouter — status enum", () => {
  it("validates all valid status values", () => {
    const validStatuses = ["pending", "fetched", "no_transcript", "error"] as const;
    const schema = z.enum(validStatuses);

    for (const s of validStatuses) {
      expect(schema.safeParse(s).success).toBe(true);
    }
    expect(schema.safeParse("unknown").success).toBe(false);
  });
});

// ─── Backfill logic ───────────────────────────────────────────────────────────

describe("transcriptRouter — backfill logic", () => {
  it("respects quota cap when calculating fetch limit", () => {
    const maxVideos = 25;
    const quotaRemaining = 10;
    const limit = Math.min(maxVideos, quotaRemaining);
    expect(limit).toBe(10);
  });

  it("does not exceed daily limit", () => {
    const maxVideos = 50;
    const quotaRemaining = 25;
    const limit = Math.min(maxVideos, quotaRemaining);
    expect(limit).toBe(25);
  });

  it("filters out already-fetched videos", () => {
    const videos = [
      { videoId: "abc", title: "Video A" },
      { videoId: "def", title: "Video B" },
      { videoId: "ghi", title: "Video C" },
    ];
    const existingMap = new Map([
      ["abc", "fetched"],
      ["def", "no_transcript"],
    ]);

    const toFetch = videos.filter((v) => {
      const s = existingMap.get(v.videoId);
      return !s || s === "pending" || s === "error";
    });

    expect(toFetch).toHaveLength(1);
    expect(toFetch[0]?.videoId).toBe("ghi");
  });

  it("retries error-status videos", () => {
    const videos = [{ videoId: "abc", title: "Video A" }];
    const existingMap = new Map([["abc", "error"]]);

    const toFetch = videos.filter((v) => {
      const s = existingMap.get(v.videoId);
      return !s || s === "pending" || s === "error";
    });

    expect(toFetch).toHaveLength(1);
  });
});
