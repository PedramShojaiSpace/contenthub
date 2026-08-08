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
import { pushTantraQuizLead } from "./klaviyo";
import { kajabiCreateContact, kajabiAddTagByName } from "./kajabiApi";
import { sendGmailOutreach, isGmailAuthorized } from "./gmail";
import crypto from "crypto";
import { notifyOwner } from "./_core/notification";
import { count, sql } from "drizzle-orm";

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
    description: "Tantra Him combines Oxytocin (the bonding molecule), Bremelanotide (the arousal activator), and Tadalafil (the circulation enhancer) in a precision-compounded sublingual tablet - backed by 5,000 years of Taoist medicine and modern clinical science.",
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
    description: "Tantra Her combines Oxytocin (the bonding molecule), Bremelanotide (the arousal activator), and Tadalafil 5mg (the circulation enhancer) in a precision-compounded sublingual tablet - backed by 5,000 years of Taoist medicine and modern clinical science.",
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
    shopifyUrl: "https://shop.theurbanmonk.com/products/dss-testing-tier-dss-entry",
    flag: "sleep_flag" as const,
  },
  gut: {
    name: "Gut Health Test Kit",
    description: "Your gut microbiome directly regulates hormonal production. This kit reveals what's blocking your vitality at the root.",
    price: "$399",
    shopifyUrl: "https://shop.theurbanmonk.com/products/kbmo-fit-22-gut-permeability-test-kit-with-consultation",
    flag: "gut_flag" as const,
  },
  oral: {
    name: "Oral Health Test Kit",
    description: "Oral inflammation is the hidden driver of systemic hormone disruption. This kit finds it.",
    price: "$399",
    shopifyUrl: "https://shop.theurbanmonk.com/products/orobiome-testing-package",
    flag: "oral_flag" as const,
  },
};

// ─── Always-on Upsells (shown to everyone) ────────────────────────────────────

export const TANTRA_COURSE = {
  name: "The Tantra Course",
  tagline: "The Ancient Practice Behind the Formula",
  description: "Dr. Pedram Shojai spent 10 years as a Taoist monk studying the traditions that treat sexual energy as the root of all vitality. This course is the complete East-West practice system - the philosophy, the breathwork, the rituals, and the science.",
  price: "$199",
  shopifyUrl: "https://shop.theurbanmonk.com/products/1710780",
};

export const LIGHTS_ON_COURSE = {
  name: "Lights On",
  tagline: "The Complete Vitality System",
  description: "Everything works better when your energy system is optimized. Lights On is Dr. Shojai's complete program for rebuilding your life force from the ground up - sleep, gut, hormones, mindset, and sexual vitality all in one place.",
  price: "$369/year",
  shopifyUrl: "https://shop.theurbanmonk.com/products/lights-on",
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

  // Product routing
  let result: keyof typeof TANTRA_PRODUCTS;
  if (gender === "male") result = "tantra_him";
  else if (gender === "female") result = "tantra_her";
  else result = "tantra_him"; // couple/unknown → tantra_him as primary; frontend detects couple gender and shows both SKUs

  // Symptom flags from q_symptoms (multi-select)
  const symptoms = (answers["q_symptoms"] as string[] | string) ?? [];
  const symptomsArr = Array.isArray(symptoms) ? symptoms : [symptoms];
  const gutFlag = symptomsArr.includes("gut_issues");
  const sleepFlag = symptomsArr.includes("poor_sleep");
  const oralFlag = symptomsArr.includes("oral_issues");

  return { result, gender, gutFlag, sleepFlag, oralFlag, isCouple: gender === "couple" };
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
          isCouple: gender === "couple",
          himProduct: gender === "couple" ? TANTRA_PRODUCTS.tantra_him : null,
          herProduct: gender === "couple" ? TANTRA_PRODUCTS.tantra_her : null,
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

      // Send results email (non-fatal)
      if (product && isGmailAuthorized()) {
        try {
          const isFemale = session.result === "tantra_her";
          const firstName = input.name ? input.name.split(" ")[0] : "there";
          const ingredientNote = isFemale
            ? "Tadalafil 5mg (circulation enhancer)"
            : "Tadalafil 20mg (circulation enhancer)";

          const upsellLines = upsells.map(u =>
            `* ${u.name} (${u.price}) - ${u.description.replace(/\u2014/g, '-').replace(/\u2013/g, '-')}\n  Order: ${u.shopifyUrl ?? "shop.theurbanmonk.com"}`
          ).join("\n\n");

          const emailBody = [
            `Hi ${firstName},`,
            ``,
            `Your Tantra Vitality Quiz results are ready.`,
            ``,
            `=====================================`,
            `YOUR RECOMMENDATION: ${product.name}`,
            `=====================================`,
            ``,
            `${product.description}`,
            ``,
            `ACTIVE INGREDIENTS:`,
            `* Oxytocin 40IU - the bonding molecule. Restores emotional connection and trust.`,
            `* Bremelanotide 2mg - the arousal activator. Reawakens desire at the neurological level.`,
            `* ${ingredientNote} - supports physical response and sensitivity.`,
            ``,
            `Price: ${product.price} per month`,
            `Order here: ${product.shopifyUrl}`,
            ``,
            `Shipping note: Your order ships under the Olympus brand name from Strive Pharmacy - same formula, same quality.`,
            ``,
            upsells.length > 0 ? `=====================================\nBASED ON YOUR SYMPTOMS, WE ALSO RECOMMEND:\n=====================================\n\n${upsellLines}\n` : ``,
            `=====================================`,
            `THE TANTRA COURSE - $199 value`,
            `=====================================`,
            ``,
            `The ancient practices that amplify everything the formula does. Breathwork, meditation, and the Taoist principles of sexual vitality - taught by Dr. Shojai from 20 years of study.`,
            `Learn more: ${TANTRA_COURSE.shopifyUrl}`,
            ``,
            `=====================================`,
            `LIGHTS ON - $369/year`,
            `=====================================`,
            ``,
            `Everything works better when your energy system is optimized. Lights On is Dr. Shojai's complete program for rebuilding your life force from the ground up.`,
            `Learn more: ${LIGHTS_ON_COURSE.shopifyUrl}`,
            ``,
            `-------------------------------------`,
            `Dr. Pedram Shojai, OMD`,
            `Physician | Former Taoist Monk | Author of The Urban Monk`,
            `Trained in Tantric Traditions`,
            ``,
            `This email was sent because you completed the Tantra Vitality Quiz at theurbanmonk.com.`,
            `To unsubscribe, reply with "unsubscribe" in the subject line.`,
          ].join("\n");

          await sendGmailOutreach({
            to: input.email,
            toName: input.name,
            subject: `Your Tantra Vitality Results - ${product.name} Recommended`,
            body: emailBody,
          });
        } catch (e) {
          console.warn("[tantraQuiz] Results email failed (non-fatal):", e);
        }
      }

      // Notify owner on quiz completion (non-fatal)
      try {
        const productName = product?.name ?? session.result ?? "unknown";
        const firstName = input.name ? input.name.split(" ")[0] : "Anonymous";
        const flags = [
          session.gutFlag ? "Gut" : null,
          session.sleepFlag ? "Sleep" : null,
          session.oralFlag ? "Oral" : null,
        ].filter(Boolean).join(", ") || "None";
        await notifyOwner({
          title: `🌿 Tantra Quiz Complete — ${productName}`,
          content: `${firstName} (${input.email}) completed the Tantra Vitality Quiz.\n\nRecommendation: ${productName}\nGender: ${session.gender}\nUpsell flags: ${flags}\nKajabi tagged: ${kajabiTagged ? "✅" : "❌"}\nUTM: ${session.utmCampaign ?? "direct"}`,
        });
      } catch (e) {
        console.warn("[tantraQuiz] notifyOwner failed (non-fatal):", e);
      }

      // Push to Klaviyo autoresponder list (non-fatal)
      try {
        await pushTantraQuizLead({
          email: input.email,
          firstName: input.name ? input.name.split(" ")[0] : undefined,
          result: session.result as "tantra_him" | "tantra_her" | "tantra_bundle" | "pending" | null,
          gutFlag: session.gutFlag ?? false,
          sleepFlag: session.sleepFlag ?? false,
          oralFlag: session.oralFlag ?? false,
        });
      } catch (e) {
        console.warn("[tantraQuiz] Klaviyo push failed (non-fatal):", e);
      }

      return {
        success: true,
        kajabiTagged,
        result: session.result,
        product,
        upsells,
        tantraCourse: TANTRA_COURSE,
        lightsOn: LIGHTS_ON_COURSE,
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

  // Admin: funnel drop-off stats
  getFunnelStats: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [totals] = await db.select({
        started:   count(),
        completed: sql<number>`SUM(CASE WHEN ${tantraQuizLeads.completedAt} IS NOT NULL THEN 1 ELSE 0 END)`,
        emailCaptured: sql<number>`SUM(CASE WHEN ${tantraQuizLeads.email} IS NOT NULL THEN 1 ELSE 0 END)`,
        kajabiTagged:  sql<number>`SUM(CASE WHEN ${tantraQuizLeads.kajabiTagged} = 1 THEN 1 ELSE 0 END)`,
        tantraHim:  sql<number>`SUM(CASE WHEN ${tantraQuizLeads.result} = 'tantra_him' THEN 1 ELSE 0 END)`,
        tantraHer:  sql<number>`SUM(CASE WHEN ${tantraQuizLeads.result} = 'tantra_her' THEN 1 ELSE 0 END)`,
        gutFlag:    sql<number>`SUM(CASE WHEN ${tantraQuizLeads.gutFlag} = 1 THEN 1 ELSE 0 END)`,
        sleepFlag:  sql<number>`SUM(CASE WHEN ${tantraQuizLeads.sleepFlag} = 1 THEN 1 ELSE 0 END)`,
        oralFlag:   sql<number>`SUM(CASE WHEN ${tantraQuizLeads.oralFlag} = 1 THEN 1 ELSE 0 END)`,
      }).from(tantraQuizLeads);

      // Recent completions (last 20)
      const recent = await db.select({
        id: tantraQuizLeads.id,
        name: tantraQuizLeads.name,
        email: tantraQuizLeads.email,
        result: tantraQuizLeads.result,
        gender: tantraQuizLeads.gender,
        gutFlag: tantraQuizLeads.gutFlag,
        sleepFlag: tantraQuizLeads.sleepFlag,
        oralFlag: tantraQuizLeads.oralFlag,
        completedAt: tantraQuizLeads.completedAt,
        emailCapturedAt: tantraQuizLeads.emailCapturedAt,
        utmCampaign: tantraQuizLeads.utmCampaign,
        createdAt: tantraQuizLeads.createdAt,
      }).from(tantraQuizLeads)
        .where(sql`${tantraQuizLeads.email} IS NOT NULL`)
        .orderBy(desc(tantraQuizLeads.emailCapturedAt))
        .limit(20);

      return { totals, recent };
    }),
});
// tantra-quiz-fix-v2 Thu Jul 30 21:01:45 UTC 2026
