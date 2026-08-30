export const META_AD_ACCOUNT_ID = "10207858653523297";

/**
 * These definitions are deliberately limited to professional-role cohorts.
 * They do not encode a recipient's health status, condition, treatment,
 * testing history, or other sensitive information.
 */
export const manualAudienceCohorts = [
  { category: "medical_doctor", name: "UM Apollo — Medical Doctors", expectedCount: 989 },
  { category: "dentist", name: "UM Apollo — Dentists", expectedCount: 854 },
  { category: "functional_med", name: "UM Apollo — Functional Medicine", expectedCount: 352 },
  { category: "nutritionist", name: "UM Apollo — Nutrition Professionals", expectedCount: 644 },
  { category: "nurse", name: "UM Apollo — Nurses & NPs", expectedCount: 724 },
  { category: "biohacker", name: "UM Apollo — Longevity Professionals", expectedCount: 921 },
  { category: "wellness_coach", name: "UM Apollo — Wellness Coaches", expectedCount: 482 },
  { category: "burnout", name: "UM Apollo — Resilience & Workplace Wellbeing Professionals", expectedCount: 490 },
  { category: "meditation_teacher", name: "UM Apollo — Meditation & Yoga Professionals", expectedCount: 424 },
];

export const MANUAL_AUDIENCE_TOTAL = manualAudienceCohorts.reduce(
  (total, cohort) => total + cohort.expectedCount,
  0,
);

export const categoryPriority = new Map(
  manualAudienceCohorts.map((cohort, index) => [cohort.category, index + 1]),
);
