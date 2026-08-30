import { describe, expect, it } from "vitest";
import {
  MANUAL_AUDIENCE_TOTAL,
  META_AD_ACCOUNT_ID,
  manualAudienceCohorts,
} from "../scripts/lib/apolloManualAudienceCohorts.mjs";

describe("Apollo manual Custom Audience cohort definitions", () => {
  it("preserves the approved account, nine exclusive cohort names, and verified-email total", () => {
    expect(META_AD_ACCOUNT_ID).toBe("10207858653523297");
    expect(manualAudienceCohorts).toHaveLength(9);
    expect(MANUAL_AUDIENCE_TOTAL).toBe(5_880);
    expect(manualAudienceCohorts.map(cohort => cohort.expectedCount)).toEqual([
      989, 854, 352, 644, 724, 921, 482, 490, 424,
    ]);
    expect(manualAudienceCohorts.map(cohort => cohort.name)).toEqual([
      "UM Apollo — Medical Doctors",
      "UM Apollo — Dentists",
      "UM Apollo — Functional Medicine",
      "UM Apollo — Nutrition Professionals",
      "UM Apollo — Nurses & NPs",
      "UM Apollo — Longevity Professionals",
      "UM Apollo — Wellness Coaches",
      "UM Apollo — Stress & Burnout Coaches",
      "UM Apollo — Meditation & Yoga Professionals",
    ]);
  });

  it("uses a unique category and unique name for every manual audience", () => {
    expect(new Set(manualAudienceCohorts.map(cohort => cohort.category)).size).toBe(9);
    expect(new Set(manualAudienceCohorts.map(cohort => cohort.name)).size).toBe(9);
  });
});
