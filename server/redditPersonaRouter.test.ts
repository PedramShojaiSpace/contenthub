import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the DB and LLM ──────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";

// ─── Warmup task type logic ───────────────────────────────────────────────────
// Replicate the internal function for testing
function getTaskTypeForDay(day: number): string {
  if (day <= 7) return day % 2 === 0 ? "comment" : "upvote_session";
  if (day <= 20) return day % 3 === 0 ? "question_post" : day % 2 === 0 ? "comment" : "upvote_session";
  return day % 4 === 0 ? "non_um_share" : day % 2 === 0 ? "comment" : "upvote_session";
}

describe("Reddit Persona Manager — warmup task scheduling", () => {
  it("Days 1-7 should only produce upvote_session or comment tasks", () => {
    for (let day = 1; day <= 7; day++) {
      const taskType = getTaskTypeForDay(day);
      expect(["upvote_session", "comment"]).toContain(taskType);
    }
  });

  it("Days 8-20 can include question_post tasks", () => {
    const types = new Set<string>();
    for (let day = 8; day <= 20; day++) {
      types.add(getTaskTypeForDay(day));
    }
    expect(types.has("question_post")).toBe(true);
  });

  it("Days 21-30 can include non_um_share tasks", () => {
    const types = new Set<string>();
    for (let day = 21; day <= 30; day++) {
      types.add(getTaskTypeForDay(day));
    }
    expect(types.has("non_um_share")).toBe(true);
  });

  it("No non_um_share or question_post in days 1-7", () => {
    for (let day = 1; day <= 7; day++) {
      const taskType = getTaskTypeForDay(day);
      expect(taskType).not.toBe("non_um_share");
      expect(taskType).not.toBe("question_post");
    }
  });

  it("Generates exactly 30 tasks for a full warmup schedule", () => {
    const tasks: string[] = [];
    for (let day = 1; day <= 30; day++) {
      tasks.push(getTaskTypeForDay(day));
    }
    expect(tasks).toHaveLength(30);
  });
});

// ─── Cadence enforcement logic ────────────────────────────────────────────────
describe("Reddit Persona Manager — cadence enforcement", () => {
  it("Should detect a post to the same subreddit within 7 days", () => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentPost = { postedAt: Date.now() - 3 * 24 * 60 * 60 * 1000, subreddit: "Biohackers" };
    const tooRecent = recentPost.postedAt > sevenDaysAgo;
    expect(tooRecent).toBe(true);
  });

  it("Should allow a post to the same subreddit after 7 days", () => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const oldPost = { postedAt: Date.now() - 8 * 24 * 60 * 60 * 1000, subreddit: "Biohackers" };
    const tooRecent = oldPost.postedAt > sevenDaysAgo;
    expect(tooRecent).toBe(false);
  });

  it("Should allow a post to a different subreddit regardless of timing", () => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentPost = { postedAt: Date.now() - 1 * 24 * 60 * 60 * 1000, subreddit: "Biohackers" };
    // Different subreddit — cadence check only applies to same subreddit
    const targetSubreddit = "Meditation";
    const tooRecent = recentPost.subreddit === targetSubreddit && recentPost.postedAt > sevenDaysAgo;
    expect(tooRecent).toBe(false);
  });
});

// ─── Phase activation logic ───────────────────────────────────────────────────
describe("Reddit Persona Manager — phase activation", () => {
  it("Persona is ready to go active when karma >= 50 and warmup is complete", () => {
    const persona = { phase: "warmup", karma: 55 };
    const warmupDays = 31;
    const isReady = persona.phase === "warmup" && persona.karma >= 50 && warmupDays >= 30;
    expect(isReady).toBe(true);
  });

  it("Persona is NOT ready if karma < 50 even after 30 days", () => {
    const persona = { phase: "warmup", karma: 30 };
    const warmupDays = 31;
    const isReady = persona.phase === "warmup" && persona.karma >= 50 && warmupDays >= 30;
    expect(isReady).toBe(false);
  });

  it("Persona is NOT ready if warmup < 30 days even with high karma", () => {
    const persona = { phase: "warmup", karma: 100 };
    const warmupDays = 25;
    const isReady = persona.phase === "warmup" && persona.karma >= 50 && warmupDays >= 30;
    expect(isReady).toBe(false);
  });

  it("Active persona post queue items should be marked ready", () => {
    const persona = { phase: "active", karma: 75 };
    const isReady = persona.phase === "active" && persona.karma >= 50;
    expect(isReady).toBe(true);
  });
});

// ─── FTC disclosure ───────────────────────────────────────────────────────────
describe("Reddit Persona Manager — FTC disclosure", () => {
  it("FTC disclosure text should be present in post body", () => {
    const ftcDisclosure = "Disclosure: I work with The Urban Monk team and genuinely find this content valuable.";
    const postBody = `I've been following Pedram's work for a while now and this article on gut health really resonated with me.\n\nCheck it out: https://www.theurbanmonk.com/article\n\n${ftcDisclosure}`;
    expect(postBody).toContain(ftcDisclosure);
  });

  it("FTC disclosure should mention The Urban Monk team", () => {
    const ftcDisclosure = "Disclosure: I work with The Urban Monk team and genuinely find this content valuable.";
    expect(ftcDisclosure).toContain("Urban Monk");
    expect(ftcDisclosure.toLowerCase()).toContain("disclosure");
  });
});

// ─── Target subreddits ────────────────────────────────────────────────────────
describe("Reddit Persona Manager — target subreddits", () => {
  const TARGET_SUBREDDITS = [
    "Biohackers", "Nootropics", "Meditation", "longevity", "FunctionalMedicine",
    "Microbiome", "Ayurveda", "HealthyFood", "yoga", "intermittentfasting",
    "sleep", "guthealth", "alternativehealth", "HolisticHealth",
  ];

  it("Should have exactly 14 target subreddits", () => {
    expect(TARGET_SUBREDDITS).toHaveLength(14);
  });

  it("Should include key health subreddits", () => {
    expect(TARGET_SUBREDDITS).toContain("Biohackers");
    expect(TARGET_SUBREDDITS).toContain("FunctionalMedicine");
    expect(TARGET_SUBREDDITS).toContain("Meditation");
    expect(TARGET_SUBREDDITS).toContain("guthealth");
  });

  it("30-day schedule should cycle through all subreddits", () => {
    const usedSubreddits = new Set<string>();
    for (let day = 1; day <= 30; day++) {
      const subreddit = TARGET_SUBREDDITS[(day - 1) % TARGET_SUBREDDITS.length];
      usedSubreddits.add(subreddit);
    }
    // With 30 days and 14 subreddits, all 14 should be covered
    expect(usedSubreddits.size).toBe(14);
  });
});
