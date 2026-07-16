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
  it("assigns dismissed_patient when all dismissed-patient options selected", () => {
    // All 'a' options are highest for dismissed_patient
    const answers: Record<string, string> = {};
    for (const q of QUIZ_QUESTIONS) answers[q.id] = "a";
    const { avatarType, scores } = scoreAnswers(answers);
    expect(avatarType).toBe("dismissed_patient");
    expect(scores.dismissed_patient).toBeGreaterThan(scores.high_performer_decline);
    expect(scores.dismissed_patient).toBeGreaterThan(scores.awakening_seeker);
    expect(scores.dismissed_patient).toBeGreaterThan(scores.supplement_graveyard);
  });

  it("assigns awakening_seeker when all 'd' options selected", () => {
    // All 'd' options are highest for awakening_seeker
    const answers: Record<string, string> = {};
    for (const q of QUIZ_QUESTIONS) answers[q.id] = "d";
    const { avatarType, scores } = scoreAnswers(answers);
    expect(avatarType).toBe("awakening_seeker");
    expect(scores.awakening_seeker).toBeGreaterThan(scores.dismissed_patient);
  });

  it("assigns high_performer_decline when all 'b' options selected", () => {
    // All 'b' options are highest for high_performer_decline
    const answers: Record<string, string> = {};
    for (const q of QUIZ_QUESTIONS) answers[q.id] = "b";
    const { avatarType, scores } = scoreAnswers(answers);
    expect(avatarType).toBe("high_performer_decline");
    expect(scores.high_performer_decline).toBeGreaterThan(scores.dismissed_patient);
  });

  it("assigns supplement_graveyard when all 'c' options selected", () => {
    // All 'c' options are highest for supplement_graveyard
    const answers: Record<string, string> = {};
    for (const q of QUIZ_QUESTIONS) answers[q.id] = "c";
    const { avatarType, scores } = scoreAnswers(answers);
    expect(avatarType).toBe("supplement_graveyard");
    expect(scores.supplement_graveyard).toBeGreaterThan(scores.awakening_seeker);
  });

  it("returns all four avatar scores", () => {
    const answers: Record<string, string> = {};
    for (const q of QUIZ_QUESTIONS) answers[q.id] = "a";
    const { scores } = scoreAnswers(answers);
    expect(Object.keys(scores)).toHaveLength(4);
    expect(scores).toHaveProperty("dismissed_patient");
    expect(scores).toHaveProperty("high_performer_decline");
    expect(scores).toHaveProperty("awakening_seeker");
    expect(scores).toHaveProperty("supplement_graveyard");
  });

  it("handles missing answers gracefully (skips missing questions)", () => {
    const answers = { q1: "a" }; // Only one answer
    const { scores, avatarType } = scoreAnswers(answers);
    expect(avatarType).toBeDefined();
    expect(scores.dismissed_patient).toBeGreaterThanOrEqual(0);
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
  it("has all four Typeform-verified avatar types", () => {
    expect(AVATAR_PROFILES).toHaveProperty("dismissed_patient");
    expect(AVATAR_PROFILES).toHaveProperty("high_performer_decline");
    expect(AVATAR_PROFILES).toHaveProperty("awakening_seeker");
    expect(AVATAR_PROFILES).toHaveProperty("supplement_graveyard");
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

  it("all profiles recommend Lights On Academy", () => {
    for (const [, profile] of Object.entries(AVATAR_PROFILES)) {
      expect(profile.recommendation).toContain("Lights On");
    }
  });

  it("dismissed_patient headline references labs/normal", () => {
    expect(AVATAR_PROFILES.dismissed_patient.headline.toLowerCase()).toMatch(/normal|labs/);
  });

  it("supplement_graveyard headline references bin or didn't work", () => {
    const h = AVATAR_PROFILES.supplement_graveyard.headline.toLowerCase();
    expect(h.match(/bin|graveyard|didn't work|guessing/)).toBeTruthy();
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
