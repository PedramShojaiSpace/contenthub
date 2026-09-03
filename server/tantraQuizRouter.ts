/**
 * Public Desire & Vitality Check-In
 *
 * A short, educational questionnaire that preserves the established /quiz/tantra
 * route and first-party funnel measurement. It is not a diagnostic tool, does not
 * determine medication eligibility, and does not trigger messaging, CRM, ad, or
 * purchase side effects. Product suitability remains a clinical decision.
 */

import crypto from "crypto";
import { count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { tantraQuizLeads } from "../drizzle/schema";
import { TANTRA_CONTENT_SOURCE_KEYS } from "../shared/tantraContentAttribution";
import { getDb } from "./db";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";

export const TANTRA_QUIZ_QUESTIONS = [
  {
    id: "q_pathway",
    type: "single" as const,
    text: "Which product pathway are you exploring?",
    subtext: "Choose the pathway that best fits the person considering care.",
    options: [
      { id: "men", text: "Men’s pathway" },
      { id: "women", text: "Women’s pathway" },
      { id: "not_sure", text: "I’m not sure which pathway fits" },
    ],
  },
  {
    id: "q_focus",
    type: "multi" as const,
    text: "What feels most out of rhythm right now?",
    subtext: "Select any that feel relevant. This is a check-in, not a diagnosis.",
    options: [
      { id: "desire", text: "Desire or sexual interest" },
      { id: "energy", text: "Energy and stamina" },
      { id: "responsiveness", text: "Feeling present and responsive in my body" },
      { id: "stress", text: "Stress load or difficulty unwinding" },
      { id: "connection", text: "Connection or ease with intimacy" },
    ],
  },
  {
    id: "q_recovery",
    type: "single" as const,
    text: "How has your recovery capacity felt lately?",
    options: [
      { id: "steady", text: "Mostly steady" },
      { id: "inconsistent", text: "Inconsistent — I have good and flat days" },
      { id: "running_low", text: "I feel like I am running low most of the time" },
      { id: "not_sure", text: "I’m not sure" },
    ],
  },
  {
    id: "q_goal",
    type: "multi" as const,
    text: "What would you most like to support?",
    options: [
      { id: "desire", text: "A more connected sense of desire" },
      { id: "confidence", text: "Confidence and presence" },
      { id: "connection", text: "Connection with my partner" },
      { id: "vitality", text: "Overall vitality and resilience" },
    ],
  },
  {
    id: "q_safety",
    type: "multi" as const,
    text: "Is there any reason to speak with a qualified clinician before considering a product?",
    subtext: "Select any that apply. This screen does not determine eligibility or provide medical advice.",
    options: [
      { id: "pregnant_or_nursing", text: "Pregnant or nursing" },
      { id: "nitrate_medication", text: "Taking nitrate medication" },
      { id: "cardiovascular_concern", text: "A cardiovascular condition or uncontrolled blood pressure that concerns me" },
      { id: "not_sure", text: "I’m not sure" },
      { id: "none", text: "None of these apply to me" },
    ],
  },
] as const;

export const TANTRA_PRODUCTS = {
  tantra_him: {
    name: "Tantra Him",
    tagline: "A clinical pathway for established male patients",
    headline: "Explore the Tantra Him pathway with the clinical team.",
    subheadline:
      "This check-in can help you choose a starting conversation. A licensed clinician reviews your history and determines whether any product is appropriate.",
    description:
      "Tantra Him is a prescription compounded medication intended for established patients. A valid prescription and clinical history review are required before dispensing.",
    price: "$185",
    shopifyUrl: "https://shop.theurbanmonk.com/products/tantra-him",
    primaryColor: "#164E63",
  },
  tantra_her: {
    name: "Tantra Her",
    tagline: "A clinical pathway for established female patients",
    headline: "Explore the Tantra Her pathway with the clinical team.",
    subheadline:
      "This check-in can help you choose a starting conversation. A licensed clinician reviews your history and determines whether any product is appropriate.",
    description:
      "Tantra Her is a prescription compounded medication intended for established patients. A valid prescription and clinical history review are required before dispensing.",
    price: "$185",
    shopifyUrl: "https://shop.theurbanmonk.com/products/tantra-her",
    primaryColor: "#7C2D12",
  },
} as const;

export type TantraQuizResult = keyof typeof TANTRA_PRODUCTS | "pending";
export type TantraCarePath = "functional_foundations" | "clinical_review";

export interface TantraSegmentation {
  primaryPath: TantraCarePath;
  carePaths: TantraCarePath[];
  clinicianFollowUp: boolean;
}

const CLINICIAN_REVIEW_ANSWERS = new Set([
  "pregnant_or_nursing",
  "nitrate_medication",
  "cardiovascular_concern",
  "not_sure",
]);

function asArray(value: string | string[] | undefined) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

export function buildTantraSegmentation(safetyAnswers: string[] = []): TantraSegmentation {
  const clinicianFollowUp = safetyAnswers.some((answer) => CLINICIAN_REVIEW_ANSWERS.has(answer));
  const primaryPath: TantraCarePath = clinicianFollowUp ? "clinical_review" : "functional_foundations";

  return {
    primaryPath,
    carePaths: [primaryPath],
    clinicianFollowUp,
  };
}

export function routeToProduct(answers: Record<string, string | string[]>) {
  const pathway = answers.q_pathway ?? answers.q_who;
  const safetyAnswers = asArray(answers.q_safety);
  const pathwayNeedsReview = pathway === "not_sure" || pathway === "couple";
  const safetyNeedsReview = safetyAnswers.some((answer) => CLINICIAN_REVIEW_ANSWERS.has(answer));
  const requiresClinicalReview = pathwayNeedsReview || safetyNeedsReview;

  const gender = pathway === "women" || pathway === "me_female"
    ? "female"
    : pathway === "men" || pathway === "me_male"
      ? "male"
      : "unknown";

  const result: TantraQuizResult = requiresClinicalReview
    ? "pending"
    : gender === "female"
      ? "tantra_her"
      : gender === "male"
        ? "tantra_him"
        : "pending";

  const segmentation = buildTantraSegmentation(
    requiresClinicalReview ? [...safetyAnswers, "not_sure"] : safetyAnswers,
  );

  return {
    result,
    gender,
    requiresClinicalReview,
    safetyAnswers,
    segmentation,
  };
}

export const tantraQuizRouter = router({
  getQuestions: publicProcedure.query(() => ({ questions: TANTRA_QUIZ_QUESTIONS })),

  startSession: publicProcedure
    .input(z.object({
      utmSource: z.string().max(128).optional(),
      utmCampaign: z.string().max(128).optional(),
      utmMedium: z.string().max(128).optional(),
      sourcePage: z.enum(TANTRA_CONTENT_SOURCE_KEYS).optional(),
      sourceVisitorId: z.string().min(8).max(128).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const sessionId = crypto.randomBytes(24).toString("hex");
      await db.insert(tantraQuizLeads).values({
        sessionId,
        utmSource: input.utmSource,
        utmCampaign: input.utmCampaign,
        utmMedium: input.utmMedium,
        sourcePage: input.sourcePage,
        sourceVisitorId: input.sourceVisitorId,
        createdAt: Date.now(),
      });

      return { sessionId };
    }),

  submitAnswers: publicProcedure
    .input(z.object({
      sessionId: z.string().min(1).max(64),
      answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const route = routeToProduct(input.answers);
      const product = route.result === "pending" ? null : TANTRA_PRODUCTS[route.result];

      // Keep only version and pathway-level analytics in the first-party lead ledger.
      // No raw health-response inventory, product eligibility decision, or external sync occurs here.
      const storedSummary = JSON.stringify({
        questionnaireVersion: "functional-desire-v1",
        pathway: input.answers.q_pathway ?? null,
        completed: true,
      });

      await db.update(tantraQuizLeads)
        .set({
          answers: storedSummary,
          gender: route.gender,
          result: route.result,
          referralPath: route.segmentation.primaryPath,
          completedAt: Date.now(),
        })
        .where(eq(tantraQuizLeads.sessionId, input.sessionId));

      return {
        result: route.result,
        product,
        requiresClinicalReview: route.requiresClinicalReview,
        segmentation: route.segmentation,
      };
    }),

  captureEmail: publicProcedure
    .input(z.object({
      sessionId: z.string().min(1).max(64),
      email: z.string().email().max(255),
      name: z.string().trim().min(1).max(255).optional(),
      newsletterConsent: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const [session] = await db.select({ answers: tantraQuizLeads.answers })
        .from(tantraQuizLeads)
        .where(eq(tantraQuizLeads.sessionId, input.sessionId))
        .limit(1);

      if (!session) throw new Error("Quiz session not found");

      let existingSummary: Record<string, unknown> = {};
      try {
        existingSummary = session.answers ? JSON.parse(session.answers) : {};
      } catch {
        existingSummary = {};
      }

      await db.update(tantraQuizLeads)
        .set({
          email: input.email,
          name: input.name,
          emailCapturedAt: Date.now(),
          answers: JSON.stringify({ ...existingSummary, newsletterConsent: input.newsletterConsent }),
        })
        .where(eq(tantraQuizLeads.sessionId, input.sessionId));

      // Intentionally no email, CRM, ad platform, webhook, or owner-notification side effect.
      return { success: true, newsletterConsentRecorded: input.newsletterConsent };
    }),

  listLeads: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const leads = await db.select().from(tantraQuizLeads)
        .orderBy(desc(tantraQuizLeads.createdAt))
        .limit(input.limit)
        .offset(input.offset);
      return { leads };
    }),

  getFunnelStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const [totals] = await db.select({
      started: count(),
      completed: sql<number>`SUM(CASE WHEN ${tantraQuizLeads.completedAt} IS NOT NULL THEN 1 ELSE 0 END)`,
      emailCaptured: sql<number>`SUM(CASE WHEN ${tantraQuizLeads.email} IS NOT NULL THEN 1 ELSE 0 END)`,
      tantraHim: sql<number>`SUM(CASE WHEN ${tantraQuizLeads.result} = 'tantra_him' THEN 1 ELSE 0 END)`,
      tantraHer: sql<number>`SUM(CASE WHEN ${tantraQuizLeads.result} = 'tantra_her' THEN 1 ELSE 0 END)`,
      clinicalReview: sql<number>`SUM(CASE WHEN ${tantraQuizLeads.referralPath} = 'clinical_review' THEN 1 ELSE 0 END)`,
    }).from(tantraQuizLeads);

    return { totals };
  }),
});
