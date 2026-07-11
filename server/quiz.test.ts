import { describe, it, expect } from "vitest";
import { scoreAnswers, QUIZ_QUESTIONS, AVATAR_PROFILES } from "./quizRouter";
import {
  LIGHTS_ON_ANNUAL_CENTS,
  RETREAT_EARLY_BIRD_CENTS,
  RETREAT_STANDARD_CENTS,
  RETREATS_PER_YEAR,
  RETREAT_MIN_CAPACITY,
  computeRetreatPrice,
} from "./ascensionRouter";

// ─── Quiz Scoring Tests ───────────────────────────────────────────────────────
describe("scoreAnswers", () => {
  it("assigns burned_out_executive when all high-burnout options selected", () => {
    // All 'a' options are highest for burned_out_executive
    const answers: Record<string, string> = {};
    for (const q of QUIZ_QUESTIONS) answers[q.id] = "a";
    const { avatarType, scores } = scoreAnswers(answers);
    expect(avatarType).toBe("burned_out_executive");
    expect(scores.burned_out_executive).toBeGreaterThan(scores.stressed_parent);
    expect(scores.burned_out_executive).toBeGreaterThan(scores.wellness_seeker);
    expect(scores.burned_out_executive).toBeGreaterThan(scores.performance_optimizer);
  });

  it("assigns wellness_seeker when all gut/wellness options selected", () => {
    // All 'c' options are highest for wellness_seeker
    const answers: Record<string, string> = {};
    for (const q of QUIZ_QUESTIONS) answers[q.id] = "c";
    const { avatarType, scores } = scoreAnswers(answers);
    expect(avatarType).toBe("wellness_seeker");
    expect(scores.wellness_seeker).toBeGreaterThan(scores.burned_out_executive);
  });

  it("assigns performance_optimizer when all performance options selected", () => {
    // All 'd' options are highest for performance_optimizer
    const answers: Record<string, string> = {};
    for (const q of QUIZ_QUESTIONS) answers[q.id] = "d";
    const { avatarType, scores } = scoreAnswers(answers);
    expect(avatarType).toBe("performance_optimizer");
    expect(scores.performance_optimizer).toBeGreaterThan(scores.burned_out_executive);
  });

  it("assigns stressed_parent when all stressed-parent options selected", () => {
    // All 'b' options are highest for stressed_parent
    const answers: Record<string, string> = {};
    for (const q of QUIZ_QUESTIONS) answers[q.id] = "b";
    const { avatarType, scores } = scoreAnswers(answers);
    expect(avatarType).toBe("stressed_parent");
    expect(scores.stressed_parent).toBeGreaterThan(scores.wellness_seeker);
  });

  it("returns all four avatar scores", () => {
    const answers: Record<string, string> = {};
    for (const q of QUIZ_QUESTIONS) answers[q.id] = "a";
    const { scores } = scoreAnswers(answers);
    expect(Object.keys(scores)).toHaveLength(4);
    expect(scores).toHaveProperty("burned_out_executive");
    expect(scores).toHaveProperty("stressed_parent");
    expect(scores).toHaveProperty("wellness_seeker");
    expect(scores).toHaveProperty("performance_optimizer");
  });

  it("handles missing answers gracefully (skips missing questions)", () => {
    const answers = { q1: "a" }; // Only one answer
    const { scores, avatarType } = scoreAnswers(answers);
    expect(avatarType).toBeDefined();
    expect(scores.burned_out_executive).toBeGreaterThanOrEqual(0);
  });

  it("handles unknown option IDs gracefully", () => {
    const answers: Record<string, string> = {};
    for (const q of QUIZ_QUESTIONS) answers[q.id] = "z"; // Invalid option
    const { scores } = scoreAnswers(answers);
    // All scores should remain 0
    expect(Object.values(scores).every(s => s === 0)).toBe(true);
  });
});

// ─── Avatar Profiles Tests ────────────────────────────────────────────────────
describe("AVATAR_PROFILES", () => {
  it("has all four avatar types", () => {
    expect(AVATAR_PROFILES).toHaveProperty("burned_out_executive");
    expect(AVATAR_PROFILES).toHaveProperty("stressed_parent");
    expect(AVATAR_PROFILES).toHaveProperty("wellness_seeker");
    expect(AVATAR_PROFILES).toHaveProperty("performance_optimizer");
  });

  it("each profile has required fields", () => {
    for (const [, profile] of Object.entries(AVATAR_PROFILES)) {
      expect(profile.label).toBeTruthy();
      expect(profile.headline).toBeTruthy();
      expect(profile.description).toBeTruthy();
      expect(profile.recommendation).toBeTruthy();
      expect(profile.kajabi_tag).toMatch(/^quiz-avatar-/);
    }
  });

  it("wellness_seeker recommends Oral Biome", () => {
    expect(AVATAR_PROFILES.wellness_seeker.recommendation).toContain("Oral Biome");
  });
});

// ─── Ascension Pricing Tests ──────────────────────────────────────────────────
describe("Ascension pricing constants", () => {
  it("Lights On annual price is $369", () => {
    expect(LIGHTS_ON_ANNUAL_CENTS).toBe(36900);
  });

  it("Retreat early bird price is $850", () => {
    expect(RETREAT_EARLY_BIRD_CENTS).toBe(85000);
  });

  it("Retreat standard price is $1,250", () => {
    expect(RETREAT_STANDARD_CENTS).toBe(125000);
  });

  it("Two retreats per year", () => {
    expect(RETREATS_PER_YEAR).toBe(2);
  });

  it("Minimum retreat capacity is 100", () => {
    expect(RETREAT_MIN_CAPACITY).toBeGreaterThanOrEqual(100);
  });
});

describe("computeRetreatPrice", () => {
  const now = Date.now();

  it("returns early_bird price when deadline is in the future", () => {
    const event = {
      earlyBirdDeadline: now + 7 * 86_400_000, // 7 days from now
      earlyBirdPriceCents: RETREAT_EARLY_BIRD_CENTS,
      standardPriceCents: RETREAT_STANDARD_CENTS,
    };
    const { priceCents, priceType } = computeRetreatPrice(event as any);
    expect(priceType).toBe("early_bird");
    expect(priceCents).toBe(RETREAT_EARLY_BIRD_CENTS);
  });

  it("returns standard price when deadline has passed", () => {
    const event = {
      earlyBirdDeadline: now - 1000, // already passed
      earlyBirdPriceCents: RETREAT_EARLY_BIRD_CENTS,
      standardPriceCents: RETREAT_STANDARD_CENTS,
    };
    const { priceCents, priceType } = computeRetreatPrice(event as any);
    expect(priceType).toBe("standard");
    expect(priceCents).toBe(RETREAT_STANDARD_CENTS);
  });

  it("returns standard price when no early bird deadline set", () => {
    const event = {
      earlyBirdDeadline: null,
      earlyBirdPriceCents: RETREAT_EARLY_BIRD_CENTS,
      standardPriceCents: RETREAT_STANDARD_CENTS,
    };
    const { priceCents, priceType } = computeRetreatPrice(event as any);
    expect(priceType).toBe("standard");
    expect(priceCents).toBe(RETREAT_STANDARD_CENTS);
  });
});
