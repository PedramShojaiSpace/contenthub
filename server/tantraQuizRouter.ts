/**
 * Tantra Quiz Router
 *
 * Powers the sexual vitality quiz at /quiz/tantra.
 * Modeled on the InnerBalance cold-traffic quiz funnel architecture.
 *
 * Flow:
 *   1. startSession  → creates a tantra_quiz_leads row with sessionId
 *   2. submitAnswers → scores answers, routes by gender, returns product recommendation
 *   3. captureEmail  → saves email, fires Kajabi tag, adds to pipeline
 *
 * Gender routing:
 *   male   → Tantra Him ($185) — Oxytocin 40IU / Bremelanotide 2mg / Tadalafil 20mg
 *   female → Tantra Her ($185) — Oxytocin 40IU / Bremelanotide 2mg / Tadalafil 5mg
 *   couple → Tantra Bundle — Him & Her ($369)
 *
 * Downstream upsells (flagged by symptom screen):
 *   gut_flag   → Gut Test Kit ($399)
 *   sleep_flag → Sleep Test Kit ($399)
 *   oral_flag  → Oral Test Kit ($399)
 *
 * Shopify product URLs:
 *   Tantra Him:    shop.theurbanmonk.com/products/tantra-him
 *   Tantra Her:    shop.theurbanmonk.com/products/tantra-her
 *   Tantra Bundle: shop.theurbanmonk.com/products/tantra-bundle-him-her
 */

import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { tantraQuizLeads } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { kajabiCreateContact, kajabiAddTagByName } from "./kajabiApi";
import crypto from "crypto";

// ─── Quiz Questions ───────────────────────────────────────────────────────────

export const TANTRA_QUIZ_QUESTIONS = [
  {
    id: "q_who",
    type: "single" as const,
    screen: 2,
    text: "Are you taking this quiz for yourself, your partner, or both of you together?",
    subtext: "This helps us personalize your results.",
    options: [
      { id: "me_male",   text: "For myself — I'm a man",           gender: "male" },
      { id: "me_female", text: "For myself — I'm a woman",         gender: "female" },
      { id: "partner",   text: "My partner asked me to take it",   gender: "unknown" },
      { id: "couple",    text: "We're doing this together",        gender: "couple" },
    ],
  },
  {
    id: "q_age",
    type: "single" as const,
    screen: 3,
    text: "How old are you?",
    options: [
      { id: "under30", text: "Under 30" },
      { id: "30_44",   text: "30–44" },
      { id: "45_59",   text: "45–59" },
      { id: "60plus",  text: "60+" },
    ],
  },
  {
    id: "q_vitality",
    type: "single" as const,
    screen: 4,
    text: "How would you describe your overall vitality and life force right now?",
    options: [
      { id: "depleted",      text: "Depleted — I'm running on empty and I can feel it" },
      { id: "inconsistent",  text: "Inconsistent — some days I feel alive, other days flat" },
      { id: "disconnected",  text: "Physically okay but mentally and emotionally disconnected" },
      { id: "lost_spark",    text: "I have energy but I've lost my spark and drive" },
    ],
  },
  {
    id: "q_sexual_energy",
    type: "single" as const,
    screen: 5,
    text: "How has your sexual energy and desire felt over the past few months?",
    subtext: "In Eastern medicine, sexual energy is your life force — not just about sex.",
    options: [
      { id: "much_lower",    text: "Much lower than it used to be — I barely think about it" },
      { id: "desire_no_energy", text: "The desire is there but the energy to act on it isn't" },
      { id: "disconnected",  text: "I feel disconnected from my body and my partner" },
      { id: "unpredictable", text: "My drive comes and goes unpredictably" },
    ],
  },
  {
    id: "q_symptoms",
    type: "multi" as const,
    screen: 7,
    text: "Which of these do you experience? Select all that apply.",
    subtext: "This helps us identify the root cause — and the right path forward.",
    options: [
      { id: "low_libido",    text: "Low libido or reduced sexual desire" },
      { id: "fatigue",       text: "Fatigue that doesn't go away with rest" },
      { id: "brain_fog",     text: "Brain fog or difficulty concentrating" },
      { id: "poor_sleep",    text: "Poor sleep or waking unrefreshed",        flag: "sleep" },
      { id: "gut_issues",    text: "Digestive issues, bloating, or gut discomfort", flag: "gut" },
      { id: "oral_issues",   text: "Gum sensitivity, mouth inflammation, or dental issues", flag: "oral" },
      { id: "mood",          text: "Mood swings, irritability, or anxiety" },
      { id: "disconnected",  text: "Feeling disconnected from your partner or from intimacy" },
      { id: "creative_loss", text: "Loss of creative energy or motivation" },
      { id: "flat",          text: "Feeling 'flat' — less alive than you used to feel" },
    ],
  },
  {
    id: "q_connection",
    type: "single" as const,
    screen: 8,
    text: "How would you describe your connection to intimacy and your partner right now?",
    options: [
      { id: "going_through_motions", text: "Disconnected — we're going through the motions" },
      { id: "want_close",            text: "We want to feel close but something is blocking it" },
      { id: "cant_sustain",          text: "We feel present sometimes but can't sustain it" },
      { id: "lost_play",             text: "We've lost the sense of play and aliveness in our relationship" },
    ],
  },
  {
    id: "q_safety",
    type: "multi" as const,
    screen: 10,
    text: "Do any of these apply to you?",
    subtext: "This helps us make sure the Tantra formula is right for you.",
    options: [
      { id: "hormone_therapy",  text: "Currently taking hormone therapy or prescription medications for sexual health" },
      { id: "hormone_condition", text: "Diagnosed with a hormone-sensitive condition" },
      { id: "pregnant",         text: "Currently pregnant or nursing" },
      { id: "none",             text: "None of these" },
    ],
  },
  {
    id: "q_goals",
    type: "multi" as const,
    screen: 11,
    text: "What are you most hoping to restore? Select all that apply.",
    options: [
      { id: "sexual_vitality",  text: "Sexual desire and vitality" },
      { id: "physical_energy",  text: "Physical energy and stamina" },
      { id: "emotional_connection", text: "Emotional connection with my partner" },
      { id: "mental_clarity",   text: "Mental clarity and creative drive" },
      { id: "aliveness",        text: "A sense of aliveness and presence" },
      { id: "relationship_spark", text: "Our relationship's spark and playfulness" },
      { id: "all",              text: "All of the above" },
    ],
  },
];

// ─── Product Profiles ─────────────────────────────────────────────────────────

export const TANTRA_PRODUCTS = {
  tantra_him: {
    name: "Tantra Him",
    tagline: "Maximum Strength Formula for Men",
    headline: "Your life force is ready to come back online.",
    subheadline: "The East-West formula designed for men who are ready to feel fully alive again.",
    description: "Tantra Him combines Oxytocin (the bonding molecule), Bremelanotide (the arousal activator), and Tadalafil (the circulation enhancer) in a precision-compounded sublingual tablet — backed by 5,000 years of Taoist medicine and modern clinical science.",
    price: "$185",
    shopifyUrl: "https://shop.theurbanmonk.com/products/tantra-him",
    kajabi_tag: "tantra-quiz-him",
    primaryColor: "#B8860B", // dark gold
    accentColor: "#1a1a1a",
  },
  tantra_her: {
    name: "Tantra Her",
    tagline: "Maximum Strength Formula for Women",
    headline: "Your life force is ready to come back online.",
    subheadline: "The East-West formula designed for women who are ready to feel fully alive again.",
    description: "Tantra Her combines Oxytocin (the bonding molecule), Bremelanotide (the arousal activator), and Tadalafil 5mg (the circulation enhancer) in a precision-compounded sublingual tablet — backed by 5,000 years of Taoist medicine and modern clinical science.",
    price: "$185",
    shopifyUrl: "https://shop.theurbanmonk.com/products/tantra-her",
    kajabi_tag: "tantra-quiz-her",
    primaryColor: "#9B59B6", // violet
    accentColor: "#1a1a1a",
  },
  tantra_bundle: {
    name: "Tantra Bundle — Him & Her",
    tagline: "For Couples Ready to Restore Everything",
    headline: "The complete East-West life force restoration system for couples.",
    subheadline: "Both formulas. The Tantra Course included free. Everything you need — together.",
    description: "The Tantra Bundle includes Tantra Him + Tantra Her — both precision-compounded sublingual formulas — plus the complete Tantra Course ($199 value) included free. Designed for couples who want to do this together.",
    price: "$369",
    shopifyUrl: "https://shop.theurbanmonk.com/products/tantra-bundle-him-her",
    kajabi_tag: "tantra-quiz-bundle",
    primaryColor: "#8B6914", // warm gold
    accentColor: "#1a1a1a",
  },
};

// ─── Upsell Products ──────────────────────────────────────────────────────────

export const TANTRA_UPSELLS = {
  sleep: {
    name: "Sleep Test Kit",
    description: "Jing restoration happens during deep sleep. This kit identifies exactly what's disrupting your recovery.",
    price: "$399",
    flag: "sleep_flag" as const,
  },
  gut: {
    name: "Gut Health Test Kit",
    description: "Your gut microbiome directly regulates hormonal production. This kit reveals what's blocking your vitality at the root.",
    price: "$399",
    flag: "gut_flag" as const,
  },
  oral: {
    name: "Oral Health Test Kit",
    description: "Oral inflammation is the hidden driver of systemic hormone disruption. This kit finds it.",
    price: "$399",
    flag: "oral_flag" as const,
  },
};

// ─── Routing Logic ────────────────────────────────────────────────────────────

export function routeToProduct(
  answers: Record<string, string | string[]>
): { result: keyof typeof TANTRA_PRODUCTS; gender: "male" | "female" | "couple" | "unknown"; gutFlag: boolean; sleepFlag: boolean; oralFlag: boolean } {
  // Gender routing from q_who
  const whoAnswer = answers["q_who"] as string;
  let gender: "male" | "female" | "couple" | "unknown" = "unknown";
  if (whoAnswer === "me_male") gender = "male";
  else if (whoAnswer === "me_female") gender = "female";
  else if (whoAnswer === "couple") gender = "couple";
  else if (whoAnswer === "partner") {
    // If partner sent them, default to bundle — they're likely a couple
    gender = "couple";
  }

  // Product routing
  let result: keyof typeof TANTRA_PRODUCTS;
  if (gender === "male") result = "tantra_him";
  else if (gender === "female") result = "tantra_her";
  else result = "tantra_bundle"; // couple or unknown → bundle

  // Symptom flags from q_symptoms (multi-select)
  const symptoms = (answers["q_symptoms"] as string[] | string) ?? [];
  const symptomsArr = Array.isArray(symptoms) ? symptoms : [symptoms];
  const gutFlag = symptomsArr.includes("gut_issues");
  const sleepFlag = symptomsArr.includes("poor_sleep");
  const oralFlag = symptomsArr.includes("oral_issues");

  return { result, gender, gutFlag, sleepFlag, oralFlag };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const tantraQuizRouter = router({
  // Get quiz questions (public)
  getQuestions: publicProcedure.query(() => {
    return { questions: TANTRA_QUIZ_QUESTIONS };
  }),

  // Start a quiz session (public)
  startSession: publicProcedure
    .input(z.object({
      utmSource: z.string().optional(),
      utmCampaign: z.string().optional(),
      utmMedium: z.string().optional(),
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
        createdAt: Date.now(),
      });
      return { sessionId };
    }),

  // Submit answers and get product recommendation (public)
  submitAnswers: publicProcedure
    .input(z.object({
      sessionId: z.string(),
      answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const { result, gender, gutFlag, sleepFlag, oralFlag } = routeToProduct(input.answers);
      const product = TANTRA_PRODUCTS[result];
      const now = Date.now();

      await db.update(tantraQuizLeads)
        .set({
          answers: JSON.stringify(input.answers),
          gender,
          result,
          gutFlag,
          sleepFlag,
          oralFlag,
          completedAt: now,
        })
        .where(eq(tantraQuizLeads.sessionId, input.sessionId));

      // Build upsell list based on flags
      const upsells = [];
      if (gutFlag) upsells.push(TANTRA_UPSELLS.gut);
      if (sleepFlag) upsells.push(TANTRA_UPSELLS.sleep);
      if (oralFlag) upsells.push(TANTRA_UPSELLS.oral);

      return {
        result,
        gender,
        product,
        upsells,
        flags: { gutFlag, sleepFlag, oralFlag },
      };
    }),

  // Capture email after results shown (public)
  captureEmail: publicProcedure
    .input(z.object({
      sessionId: z.string(),
      email: z.string().email(),
      name: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const now = Date.now();

      // Look up session — if not found (e.g. local- fallback IDs), create a minimal one
      let [session] = await db.select().from(tantraQuizLeads)
        .where(eq(tantraQuizLeads.sessionId, input.sessionId)).limit(1);
      if (!session) {
        // Create a minimal session so the email is still captured
        await db.insert(tantraQuizLeads).values({
          sessionId: input.sessionId,
          createdAt: now,
        });
        [session] = await db.select().from(tantraQuizLeads)
          .where(eq(tantraQuizLeads.sessionId, input.sessionId)).limit(1);
        if (!session) throw new Error("Could not create session");
      }

      await db.update(tantraQuizLeads)
        .set({ email: input.email, name: input.name, emailCapturedAt: now })
        .where(eq(tantraQuizLeads.sessionId, input.sessionId));

      // Fire Kajabi tag (non-fatal)
      let kajabiTagged = false;
      if (session.result && session.result !== "pending") {
        try {
          const product = TANTRA_PRODUCTS[session.result as keyof typeof TANTRA_PRODUCTS];
          const contact = await kajabiCreateContact({ email: input.email, name: input.name });
          await kajabiAddTagByName({ contactId: contact.id, tagName: product.kajabi_tag });
          await kajabiAddTagByName({ contactId: contact.id, tagName: "tantra-quiz-completed" });
          // Flag-based tags for downstream sequences
          if (session.gutFlag) await kajabiAddTagByName({ contactId: contact.id, tagName: "tantra-flag-gut" });
          if (session.sleepFlag) await kajabiAddTagByName({ contactId: contact.id, tagName: "tantra-flag-sleep" });
          if (session.oralFlag) await kajabiAddTagByName({ contactId: contact.id, tagName: "tantra-flag-oral" });
          await db.update(tantraQuizLeads)
            .set({ kajabiTagged: true, kajabiTaggedAt: now })
            .where(eq(tantraQuizLeads.sessionId, input.sessionId));
          kajabiTagged = true;
        } catch (e) {
          console.warn("[tantraQuiz] Kajabi tag failed (non-fatal):", e);
        }
      }

      const product = session.result && session.result !== "pending"
        ? TANTRA_PRODUCTS[session.result as keyof typeof TANTRA_PRODUCTS]
        : null;

      const upsells = [];
      if (session.gutFlag) upsells.push(TANTRA_UPSELLS.gut);
      if (session.sleepFlag) upsells.push(TANTRA_UPSELLS.sleep);
      if (session.oralFlag) upsells.push(TANTRA_UPSELLS.oral);

      return {
        success: true,
        kajabiTagged,
        result: session.result,
        product,
        upsells,
      };
    }),

  // Admin: list all leads (protected)
  listLeads: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().default(0),
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
});
// tantra-quiz-fix-v2 Thu Jul 30 21:01:45 UTC 2026
