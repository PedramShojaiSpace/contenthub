/**
 * Diagnostic Quiz Router
 *
 * Powers the 5-question avatar diagnostic quiz at /quiz.
 * Flow:
 *   1. startSession  → creates a quiz_responses row with a sessionId
 *   2. submitAnswers → scores answers, assigns avatar, returns results
 *   3. captureEmail  → saves email, fires Kajabi tag, adds to ascension pipeline
 *
 * Avatar types (Typeform-verified, Urban Monk Audience Language Map v2, 5,485 responses):
 *   dismissed_patient      → The Dismissed Patient (labs normal, still feels terrible)
 *   high_performer_decline → The High-Performer in Decline (brain fog, cognitive decline)
 *   awakening_seeker       → The Awakening Seeker (already on the path, wants deeper integration)
 *   supplement_graveyard   → The Supplement Graveyard (bin full of things that didn't work)
 *
 * Kajabi tags fired on email capture:
 *   quiz-avatar-{avatarType}
 *   quiz-completed
 */

import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { quizResponses } from "../drizzle/schema";
import { eq, desc, and, isNotNull, gte } from "drizzle-orm";
import { kajabiCreateContact, kajabiAddTagByName } from "./kajabiApi";
import crypto from "crypto";

// ─── Quiz Questions ───────────────────────────────────────────────────────────
export const QUIZ_QUESTIONS = [
  {
    id: "q1",
    text: "When you describe your health situation to a doctor, what happens most often?",
    options: [
      { id: "a", text: "They run tests, say everything looks normal, and send me home — but I still feel terrible", scores: { dismissed_patient: 4, high_performer_decline: 1, awakening_seeker: 1, supplement_graveyard: 1 } },
      { id: "b", text: "They acknowledge something is off but only offer prescriptions to manage symptoms", scores: { dismissed_patient: 2, high_performer_decline: 2, awakening_seeker: 1, supplement_graveyard: 2 } },
      { id: "c", text: "I've mostly stopped going — conventional medicine doesn't have what I'm looking for", scores: { dismissed_patient: 1, high_performer_decline: 1, awakening_seeker: 3, supplement_graveyard: 2 } },
      { id: "d", text: "I track my own biomarkers and come in with data — I'm managing this myself", scores: { dismissed_patient: 0, high_performer_decline: 4, awakening_seeker: 1, supplement_graveyard: 1 } },
    ],
  },
  {
    id: "q2",
    text: "Which of these best describes your relationship with supplements?",
    options: [
      { id: "a", text: "I've tried dozens — a drawer or cabinet full of things that didn't really work", scores: { dismissed_patient: 1, high_performer_decline: 1, awakening_seeker: 0, supplement_graveyard: 4 } },
      { id: "b", text: "I take a few basics but I'm skeptical — I don't know if they're actually doing anything", scores: { dismissed_patient: 2, high_performer_decline: 1, awakening_seeker: 1, supplement_graveyard: 2 } },
      { id: "c", text: "I'm strategic about it — I want data before I spend money on anything", scores: { dismissed_patient: 1, high_performer_decline: 4, awakening_seeker: 0, supplement_graveyard: 1 } },
      { id: "d", text: "I prefer food, herbs, and lifestyle over pills — I'm looking for a more integrated approach", scores: { dismissed_patient: 0, high_performer_decline: 0, awakening_seeker: 4, supplement_graveyard: 1 } },
    ],
  },
  {
    id: "q3",
    text: "What is the symptom that bothers you most right now?",
    options: [
      { id: "a", text: "Fatigue and brain fog — I feel like I'm running at 60% and nobody can explain why", scores: { dismissed_patient: 3, high_performer_decline: 2, awakening_seeker: 1, supplement_graveyard: 1 } },
      { id: "b", text: "Performance decline — my focus, output, and decision-making aren't what they were", scores: { dismissed_patient: 1, high_performer_decline: 4, awakening_seeker: 0, supplement_graveyard: 1 } },
      { id: "c", text: "Gut issues — bloating, digestion problems, or just feeling inflamed and heavy", scores: { dismissed_patient: 2, high_performer_decline: 0, awakening_seeker: 1, supplement_graveyard: 3 } },
      { id: "d", text: "A general sense that something is off — energy, mood, sleep, or a feeling of disconnection", scores: { dismissed_patient: 1, high_performer_decline: 1, awakening_seeker: 4, supplement_graveyard: 1 } },
    ],
  },
  {
    id: "q4",
    text: "How would you describe your health journey so far?",
    options: [
      { id: "a", text: "Frustrating — I've been to multiple doctors and still don't have real answers", scores: { dismissed_patient: 4, high_performer_decline: 1, awakening_seeker: 0, supplement_graveyard: 2 } },
      { id: "b", text: "Expensive — I've spent a lot on tests, practitioners, and products with mixed results", scores: { dismissed_patient: 1, high_performer_decline: 2, awakening_seeker: 0, supplement_graveyard: 4 } },
      { id: "c", text: "Evolving — I've made progress but I know there's a deeper level I haven't reached yet", scores: { dismissed_patient: 0, high_performer_decline: 1, awakening_seeker: 4, supplement_graveyard: 1 } },
      { id: "d", text: "Declining — I used to perform at a high level and something has shifted in the last few years", scores: { dismissed_patient: 1, high_performer_decline: 4, awakening_seeker: 1, supplement_graveyard: 1 } },
    ],
  },
  {
    id: "q5",
    text: "What would a real win look like for you 90 days from now?",
    options: [
      { id: "a", text: "Finally having an explanation — and a real plan — for why I feel this way", scores: { dismissed_patient: 4, high_performer_decline: 1, awakening_seeker: 0, supplement_graveyard: 2 } },
      { id: "b", text: "Measurable improvement in focus, energy, and cognitive performance", scores: { dismissed_patient: 0, high_performer_decline: 4, awakening_seeker: 1, supplement_graveyard: 1 } },
      { id: "c", text: "Knowing exactly which supplements and protocols are right for my body — and stopping the guessing", scores: { dismissed_patient: 1, high_performer_decline: 1, awakening_seeker: 0, supplement_graveyard: 4 } },
      { id: "d", text: "A deeper integration of my health, energy, and sense of purpose — not just physical optimization", scores: { dismissed_patient: 0, high_performer_decline: 1, awakening_seeker: 4, supplement_graveyard: 0 } },
    ],
  },
];

// ─── Avatar Profiles ──────────────────────────────────────────────────────────
export const AVATAR_PROFILES = {
  dismissed_patient: {
    label: "The Dismissed Patient",
    headline: "Your labs are 'normal.' You are not.",
    description:
      "You've been through the system. You've had the tests. You've heard 'everything looks fine' while you feel anything but fine. That gap — between 'not diseased' and 'actually thriving' — is exactly where root cause medicine lives. You're not broken. You're just asking questions that standard panels weren't designed to answer.",
    recommendation: "Lights On Academy",
    recommendationUrl: "/upstream",
    kajabi_tag: "quiz-avatar-dismissed_patient",
    primaryColor: "amber",
  },
  high_performer_decline: {
    label: "The High-Performer in Decline",
    headline: "You built something real. The cost was your edge.",
    description:
      "Brain fog, decision fatigue, the sense that you're running on depleted systems — these aren't character flaws. They're biomarker problems. You're not looking for motivation. You're looking for the specific data that tells you exactly what's wrong and exactly how to fix it. That's what root cause medicine is designed to do.",
    recommendation: "Lights On Academy",
    recommendationUrl: "/upstream",
    kajabi_tag: "quiz-avatar-high_performer_decline",
    primaryColor: "violet",
  },
  awakening_seeker: {
    label: "The Awakening Seeker",
    headline: "You've done the physical work. Now let's go deeper.",
    description:
      "You already understand root cause concepts. You've done some of the work. What you're looking for now is the integration — the place where ancient wisdom and modern science meet, where Qigong and biomarkers coexist, where health is not just physical optimization but a complete way of living. That's the Urban Monk path.",
    recommendation: "Lights On Academy",
    recommendationUrl: "/upstream",
    kajabi_tag: "quiz-avatar-awakening_seeker",
    primaryColor: "emerald",
  },
  supplement_graveyard: {
    label: "The Supplement Graveyard",
    headline: "A bin full of things that didn't work is not a health plan.",
    description:
      "You've invested in your health. You've tried the protocols, the stacks, the cleanses. Some things helped a little. Most didn't. The problem isn't your commitment — it's that you've been guessing. Personalized root cause medicine starts with testing, not supplementing. Let's find out what your body actually needs.",
    recommendation: "Lights On Academy",
    recommendationUrl: "/upstream",
    kajabi_tag: "quiz-avatar-supplement_graveyard",
    primaryColor: "rose",
  },
};

// ─── Scoring Logic ────────────────────────────────────────────────────────────
export function scoreAnswers(answers: Record<string, string>): {
  scores: Record<string, number>;
  avatarType: keyof typeof AVATAR_PROFILES;
} {
  const scores: Record<string, number> = {
    dismissed_patient: 0,
    high_performer_decline: 0,
    awakening_seeker: 0,
    supplement_graveyard: 0,
  };

  for (const question of QUIZ_QUESTIONS) {
    const selectedOptionId = answers[question.id];
    if (!selectedOptionId) continue;
    const option = question.options.find(o => o.id === selectedOptionId);
    if (!option) continue;
    for (const [avatar, score] of Object.entries(option.scores)) {
      scores[avatar] = (scores[avatar] ?? 0) + score;
    }
  }

  // Pick the highest-scoring avatar (ties broken by order)
  const avatarType = (Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0]) as keyof typeof AVATAR_PROFILES;
  return { scores, avatarType };
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const quizRouter = router({
  // Start a quiz session (public — no auth required)
  startSession: publicProcedure
    .input(z.object({
      utmSource: z.string().optional(),
      utmCampaign: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const sessionId = crypto.randomBytes(24).toString("hex");
      await db.insert(quizResponses).values({
        sessionId,
        utmSource: input.utmSource,
        utmCampaign: input.utmCampaign,
        createdAt: Date.now(),
      });
      return { sessionId };
    }),

  // Submit answers and get avatar result (public)
  submitAnswers: publicProcedure
    .input(z.object({
      sessionId: z.string(),
      answers: z.record(z.string(), z.string()), // { q1: 'a', q2: 'c', ... }
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const { scores, avatarType } = scoreAnswers(input.answers);
      const profile = AVATAR_PROFILES[avatarType];
      const now = Date.now();

      await db.update(quizResponses)
        .set({
          answers: JSON.stringify(input.answers),
          scores: JSON.stringify(scores),
          avatarType,
          completedAt: now,
        })
        .where(eq(quizResponses.sessionId, input.sessionId));

      return {
        avatarType,
        scores,
        profile: {
          label: profile.label,
          headline: profile.headline,
          description: profile.description,
          recommendation: profile.recommendation,
          recommendationUrl: profile.recommendationUrl,
          primaryColor: profile.primaryColor,
        },
      };
    }),

  // Capture email after results shown (public — gated before showing full results)
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

      // Get the session
      const [session] = await db.select().from(quizResponses)
        .where(eq(quizResponses.sessionId, input.sessionId)).limit(1);
      if (!session) throw new Error("Session not found");

      await db.update(quizResponses)
        .set({ email: input.email, name: input.name, emailCapturedAt: now })
        .where(eq(quizResponses.sessionId, input.sessionId));

      // Fire Kajabi tag (non-fatal)
      let kajabiTagged = false;
      if (session.avatarType) {
        try {
          const profile = AVATAR_PROFILES[session.avatarType as keyof typeof AVATAR_PROFILES];
          // Create or update contact in Kajabi, get back contactId
          const contact = await kajabiCreateContact({ email: input.email, name: input.name });
          await kajabiAddTagByName({ contactId: contact.id, tagName: profile.kajabi_tag });
          await kajabiAddTagByName({ contactId: contact.id, tagName: "quiz-completed" });
          await db.update(quizResponses)
            .set({ kajabiTagged: true, kajabiTaggedAt: now })
            .where(eq(quizResponses.sessionId, input.sessionId));
          kajabiTagged = true;
        } catch (e) {
          console.warn("[quiz] Kajabi tag failed (non-fatal):", e);
        }
      }

      // Add to ascension pipeline if not already there
      try {
        const { ascensionMembers } = await import("../drizzle/schema");
        const existing = await db.select().from(ascensionMembers)
          .where(eq(ascensionMembers.email, input.email)).limit(1);
        if (existing.length === 0) {
          await db.insert(ascensionMembers).values({
            email: input.email,
            name: input.name,
            avatarType: session.avatarType as any,
            stage: "lights_on",
            lightsOnStartDate: now,
            renewalDueDate: now + 365 * 86_400_000,
            totalPaidCents: 0, // Not yet paid — lead capture only
            renewalCount: 0,
            createdAt: now,
            updatedAt: now,
          });
        }
      } catch (e) {
        console.warn("[quiz] Ascension pipeline insert failed (non-fatal):", e);
      }

      return {
        success: true,
        kajabiTagged,
        avatarType: session.avatarType,
        profile: session.avatarType
          ? AVATAR_PROFILES[session.avatarType as keyof typeof AVATAR_PROFILES]
          : null,
      };
    }),

  // ─── Admin: Quiz Analytics (protected) ──────────────────────────────────────
  getAnalytics: protectedProcedure
    .input(z.object({ windowDays: z.number().min(1).max(365).default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const since = Date.now() - input.windowDays * 86_400_000;

      const all = await db.select().from(quizResponses)
        .where(gte(quizResponses.createdAt, since))
        .orderBy(desc(quizResponses.createdAt));

      const completed = all.filter(r => r.completedAt);
      const emailCaptured = all.filter(r => r.emailCapturedAt);
      const kajabiTagged = all.filter(r => r.kajabiTagged);

      const byAvatar: Record<string, number> = {};
      for (const r of completed) {
        if (r.avatarType) byAvatar[r.avatarType] = (byAvatar[r.avatarType] ?? 0) + 1;
      }

      const bySource: Record<string, number> = {};
      for (const r of all) {
        const src = r.utmSource ?? "direct";
        bySource[src] = (bySource[src] ?? 0) + 1;
      }

      return {
        totalStarted: all.length,
        totalCompleted: completed.length,
        totalEmailCaptured: emailCaptured.length,
        totalKajabiTagged: kajabiTagged.length,
        completionRate: all.length > 0 ? Math.round((completed.length / all.length) * 100) : 0,
        emailCaptureRate: completed.length > 0 ? Math.round((emailCaptured.length / completed.length) * 100) : 0,
        byAvatar,
        bySource,
        recentResponses: all.slice(0, 20),
      };
    }),

  // ─── Get quiz questions (public) ─────────────────────────────────────────────
  getQuestions: publicProcedure.query(() => {
    return QUIZ_QUESTIONS.map(q => ({
      id: q.id,
      text: q.text,
      options: q.options.map(o => ({ id: o.id, text: o.text })), // strip scores
    }));
  }),
});
