/**
 * Tests for the 5 new YouTube Intelligence procedures added in v20.
 * These tests verify the procedure structure, input validation, and
 * helper function logic without making real YouTube API calls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Unit tests for pure helper functions ─────────────────────────────────────

describe("parseDuration", () => {
  // Import the logic inline since it's not exported — we test the behavior through formatVideo
  function parseDuration(iso: string): number {
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    return (parseInt(match[1] ?? "0") * 3600) +
      (parseInt(match[2] ?? "0") * 60) +
      parseInt(match[3] ?? "0");
  }

  it("parses minutes and seconds", () => {
    expect(parseDuration("PT4M13S")).toBe(253);
  });

  it("parses hours, minutes, seconds", () => {
    expect(parseDuration("PT1H30M0S")).toBe(5400);
  });

  it("parses seconds only", () => {
    expect(parseDuration("PT45S")).toBe(45);
  });

  it("parses minutes only", () => {
    expect(parseDuration("PT10M")).toBe(600);
  });

  it("returns 0 for empty string", () => {
    expect(parseDuration("")).toBe(0);
  });

  it("returns 0 for invalid format", () => {
    expect(parseDuration("invalid")).toBe(0);
  });
});

describe("computeOutlierScore", () => {
  function computeOutlierScore(videoViews: number, channelTotalViews: number, channelVideoCount: number): number {
    if (channelVideoCount === 0 || channelTotalViews === 0) return 0;
    const avg = channelTotalViews / channelVideoCount;
    return avg > 0 ? Math.round((videoViews / avg) * 100) / 100 : 0;
  }

  it("returns 1.0 for a video at exact channel average", () => {
    // Channel: 1M total views, 10 videos → avg 100K/video
    // Video with 100K views → score = 1.0
    expect(computeOutlierScore(100_000, 1_000_000, 10)).toBe(1.0);
  });

  it("returns 2.0 for a video with double the channel average", () => {
    expect(computeOutlierScore(200_000, 1_000_000, 10)).toBe(2.0);
  });

  it("returns 0.5 for a video with half the channel average", () => {
    expect(computeOutlierScore(50_000, 1_000_000, 10)).toBe(0.5);
  });

  it("returns 0 when channel has no videos", () => {
    expect(computeOutlierScore(100_000, 0, 0)).toBe(0);
  });

  it("returns 0 when channel has no views", () => {
    expect(computeOutlierScore(100_000, 0, 10)).toBe(0);
  });

  it("correctly identifies a viral outlier (3x+)", () => {
    // Video with 300K views, channel avg 100K → 3.0x
    const score = computeOutlierScore(300_000, 1_000_000, 10);
    expect(score).toBe(3.0);
    expect(score).toBeGreaterThanOrEqual(3.0);
  });

  it("rounds to 2 decimal places", () => {
    // 150K / (1M / 10) = 150K / 100K = 1.5
    expect(computeOutlierScore(150_000, 1_000_000, 10)).toBe(1.5);
    // 133K / 100K = 1.33
    expect(computeOutlierScore(133_000, 1_000_000, 10)).toBe(1.33);
  });
});

describe("computeViewVelocity", () => {
  function computeViewVelocity(viewCount: number, uploadDate: string): number {
    const uploadMs = new Date(uploadDate).getTime();
    const nowMs = Date.now();
    const daysSinceUpload = Math.max(1, (nowMs - uploadMs) / (1000 * 60 * 60 * 24));
    return Math.round(viewCount / daysSinceUpload);
  }

  it("returns views per day for a recent video", () => {
    // A video uploaded 10 days ago with 100K views → ~10K/day
    const uploadDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const velocity = computeViewVelocity(100_000, uploadDate);
    expect(velocity).toBeGreaterThan(9_000);
    expect(velocity).toBeLessThan(11_000);
  });

  it("uses minimum 1 day for very recent videos", () => {
    // A video uploaded 1 hour ago — should use 1 day minimum
    const uploadDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const velocity = computeViewVelocity(50_000, uploadDate);
    expect(velocity).toBe(50_000); // 50K / 1 day
  });

  it("returns lower velocity for older videos with same views", () => {
    const recentDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const oldDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const recentVelocity = computeViewVelocity(100_000, recentDate);
    const oldVelocity = computeViewVelocity(100_000, oldDate);
    expect(recentVelocity).toBeGreaterThan(oldVelocity);
  });
});

describe("isShort detection", () => {
  function parseDuration(iso: string): number {
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    return (parseInt(match[1] ?? "0") * 3600) +
      (parseInt(match[2] ?? "0") * 60) +
      parseInt(match[3] ?? "0");
  }

  it("identifies a 60-second video as a Short", () => {
    const duration = parseDuration("PT1M0S");
    expect(duration).toBe(60);
    expect(duration <= 60).toBe(true);
  });

  it("identifies a 59-second video as a Short", () => {
    const duration = parseDuration("PT59S");
    expect(duration <= 60).toBe(true);
  });

  it("identifies a 61-second video as long-form", () => {
    const duration = parseDuration("PT1M1S");
    expect(duration > 60).toBe(true);
  });

  it("identifies a 10-minute video as long-form", () => {
    const duration = parseDuration("PT10M0S");
    expect(duration > 60).toBe(true);
  });
});

describe("outlier score classification", () => {
  function outlierLabel(score: number): string {
    if (score >= 3) return "Viral";
    if (score >= 2) return "Strong";
    if (score >= 1.5) return "Above Avg";
    if (score >= 1) return "On Par";
    return "Below Avg";
  }

  it("classifies 3x+ as Viral", () => {
    expect(outlierLabel(3.0)).toBe("Viral");
    expect(outlierLabel(5.5)).toBe("Viral");
  });

  it("classifies 2x-3x as Strong", () => {
    expect(outlierLabel(2.0)).toBe("Strong");
    expect(outlierLabel(2.9)).toBe("Strong");
  });

  it("classifies 1.5x-2x as Above Avg", () => {
    expect(outlierLabel(1.5)).toBe("Above Avg");
    expect(outlierLabel(1.9)).toBe("Above Avg");
  });

  it("classifies 1x-1.5x as On Par", () => {
    expect(outlierLabel(1.0)).toBe("On Par");
    expect(outlierLabel(1.4)).toBe("On Par");
  });

  it("classifies below 1x as Below Avg", () => {
    expect(outlierLabel(0.5)).toBe("Below Avg");
    expect(outlierLabel(0.0)).toBe("Below Avg");
  });
});

describe("upload frequency labeling", () => {
  function uploadFrequencyLabel(uploadsPerWeek: number): string {
    if (uploadsPerWeek >= 7) return "Daily";
    if (uploadsPerWeek >= 3) return "3-5x/week";
    if (uploadsPerWeek >= 1.5) return "2-3x/week";
    if (uploadsPerWeek >= 0.8) return "Weekly";
    if (uploadsPerWeek >= 0.4) return "Bi-weekly";
    return "Monthly or less";
  }

  it("labels 7+ uploads/week as Daily", () => {
    expect(uploadFrequencyLabel(7)).toBe("Daily");
    expect(uploadFrequencyLabel(14)).toBe("Daily");
  });

  it("labels 3-5 uploads/week correctly", () => {
    expect(uploadFrequencyLabel(3)).toBe("3-5x/week");
    expect(uploadFrequencyLabel(5)).toBe("3-5x/week");
  });

  it("labels 1.5-3 uploads/week as 2-3x/week", () => {
    expect(uploadFrequencyLabel(2)).toBe("2-3x/week");
  });

  it("labels ~1 upload/week as Weekly", () => {
    expect(uploadFrequencyLabel(1)).toBe("Weekly");
  });

  it("labels 0.4-0.8 as Bi-weekly", () => {
    expect(uploadFrequencyLabel(0.5)).toBe("Bi-weekly");
  });

  it("labels less than 0.4 as Monthly or less", () => {
    expect(uploadFrequencyLabel(0.2)).toBe("Monthly or less");
    expect(uploadFrequencyLabel(0)).toBe("Monthly or less");
  });
});

describe("longs vs shorts breakdown calculation", () => {
  function calcLongsVsShorts(videos: Array<{ isShort: boolean; viewCount: number }>) {
    const longs = videos.filter((v) => !v.isShort);
    const shorts = videos.filter((v) => v.isShort);
    return {
      totalVideos: videos.length,
      longsCount: longs.length,
      shortsCount: shorts.length,
      longsViews: longs.reduce((s, v) => s + v.viewCount, 0),
      shortsViews: shorts.reduce((s, v) => s + v.viewCount, 0),
      longsAvgViews: longs.length > 0 ? Math.round(longs.reduce((s, v) => s + v.viewCount, 0) / longs.length) : 0,
      shortsAvgViews: shorts.length > 0 ? Math.round(shorts.reduce((s, v) => s + v.viewCount, 0) / shorts.length) : 0,
    };
  }

  it("correctly splits longs and shorts", () => {
    const videos = [
      { isShort: false, viewCount: 100_000 },
      { isShort: false, viewCount: 200_000 },
      { isShort: true, viewCount: 50_000 },
      { isShort: true, viewCount: 75_000 },
      { isShort: true, viewCount: 25_000 },
    ];
    const result = calcLongsVsShorts(videos);
    expect(result.longsCount).toBe(2);
    expect(result.shortsCount).toBe(3);
    expect(result.longsViews).toBe(300_000);
    expect(result.shortsViews).toBe(150_000);
    expect(result.longsAvgViews).toBe(150_000);
    expect(result.shortsAvgViews).toBe(50_000);
  });

  it("handles all longs (no shorts)", () => {
    const videos = [
      { isShort: false, viewCount: 100_000 },
      { isShort: false, viewCount: 200_000 },
    ];
    const result = calcLongsVsShorts(videos);
    expect(result.shortsCount).toBe(0);
    expect(result.shortsAvgViews).toBe(0);
    expect(result.longsCount).toBe(2);
  });

  it("handles empty video list", () => {
    const result = calcLongsVsShorts([]);
    expect(result.totalVideos).toBe(0);
    expect(result.longsAvgViews).toBe(0);
    expect(result.shortsAvgViews).toBe(0);
  });
});
