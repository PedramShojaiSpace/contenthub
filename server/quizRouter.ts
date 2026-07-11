/**
 * Diagnostic Quiz Router
 *
 * Powers the 5-question avatar diagnostic quiz at /quiz.
 * Flow:
 *   1. startSession  → creates a quiz_responses row with a sessionId
 *   2. submitAnswers → scores answers, assigns avatar, returns results
 *   3. captureEmail  → saves email, fires Kajabi tag, adds to ascension pipeline
 *
 * Avatar types:
 *   burned_out_executive  → Lights On (energy/stress)
 *   stressed_parent       → Lights On (stress/sleep)
 *   wellness_seeker       → Oral Biome (gut/oral health)
 *   performance_optimizer → Lights On Year 2 / advanced track
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
    text: "What is your biggest health challenge right now?",
    options: [
      { id: "a", text: "Constant exhaustion — I wake up tired no matter how much I sleep", scores: { burned_out_executive: 3, stressed_parent: 2, wellness_seeker: 0, performance_optimizer: 1 } },
      { id: "b", text: "I'm overwhelmed and can't turn my brain off", scores: { burned_out_executive: 2, stressed_parent: 3, wellness_seeker: 0, performance_optimizer: 1 } },
      { id: "c", text: "Digestive issues, bloating, or poor gut health", scores: { burned_out_executive: 0, stressed_parent: 0, wellness_seeker: 3, performance_optimizer: 1 } },
      { id: "d", text: "I want to perform at a higher level — mentally and physically", scores: { burned_out_executive: 1, stressed_parent: 0, wellness_seeker: 1, performance_optimizer: 3 } },
    ],
  },
  {
    id: "q2",
    text: "How would you describe your typical day?",
    options: [
      { id: "a", text: "Back-to-back meetings, decisions, and no time to breathe", scores: { burned_out_executive: 3, stressed_parent: 1, wellness_seeker: 0, performance_optimizer: 2 } },
      { id: "b", text: "Juggling family, work, and everyone else's needs before my own", scores: { burned_out_executive: 1, stressed_parent: 3, wellness_seeker: 1, performance_optimizer: 0 } },
      { id: "c", text: "I'm curious about health and wellness — I read, research, and try new things", scores: { burned_out_executive: 0, stressed_parent: 0, wellness_seeker: 3, performance_optimizer: 2 } },
      { id: "d", text: "Structured and goal-driven — I'm always optimizing my routines", scores: { burned_out_executive: 1, stressed_parent: 0, wellness_seeker: 1, performance_optimizer: 3 } },
    ],
  },
  {
    id: "q3",
    text: "When you think about your energy levels, which is most true?",
    options: [
      { id: "a", text: "I crash in the afternoon and rely on caffeine to get through the day", scores: { burned_out_executive: 3, stressed_parent: 2, wellness_seeker: 1, performance_optimizer: 0 } },
      { id: "b", text: "My energy is unpredictable — good days and bad days with no clear pattern", scores: { burned_out_executive: 1, stressed_parent: 3, wellness_seeker: 2, performance_optimizer: 1 } },
      { id: "c", text: "My gut and digestion affect my energy more than anything else", scores: { burned_out_executive: 0, stressed_parent: 0, wellness_seeker: 3, performance_optimizer: 1 } },
      { id: "d", text: "My energy is decent but I know there's a higher gear I haven't found yet", scores: { burned_out_executive: 1, stressed_parent: 0, wellness_seeker: 1, performance_optimizer: 3 } },
    ],
  },
  {
    id: "q4",
    text: "What does your relationship with sleep look like?",
    options: [
      { id: "a", text: "I can't fall asleep — my mind races with work and responsibilities", scores: { burned_out_executive: 3, stressed_parent: 1, wellness_seeker: 0, performance_optimizer: 1 } },
      { id: "b", text: "I fall asleep fine but wake up at 3am with anxiety", scores: { burned_out_executive: 1, stressed_parent: 3, wellness_seeker: 1, performance_optimizer: 0 } },
      { id: "c", text: "Poor sleep seems connected to what I eat or gut issues", scores: { burned_out_executive: 0, stressed_parent: 0, wellness_seeker: 3, performance_optimizer: 1 } },
      { id: "d", text: "I sleep okay but I want to optimize my recovery and deep sleep", scores: { burned_out_executive: 1, stressed_parent: 0, wellness_seeker: 1, performance_optimizer: 3 } },
    ],
  },
  {
    id: "q5",
    text: "What would a meaningful win look like for you in 90 days?",
    options: [
      { id: "a", text: "Waking up with real energy and not needing coffee to function", scores: { burned_out_executive: 3, stressed_parent: 2, wellness_seeker: 0, performance_optimizer: 1 } },
      { id: "b", text: "Feeling calm and present — not reactive and overwhelmed", scores: { burned_out_executive: 1, stressed_parent: 3, wellness_seeker: 1, performance_optimizer: 0 } },
      { id: "c", text: "Fixing my gut, reducing bloating, and feeling lighter", scores: { burned_out_executive: 0, stressed_parent: 0, wellness_seeker: 3, performance_optimizer: 1 } },
      { id: "d", text: "Measurable improvement in focus, output, and physical performance", scores: { burned_out_executive: 1, stressed_parent: 0, wellness_seeker: 1, performance_optimizer: 3 } },
    ],
  },
];

// ─── Avatar Profiles ──────────────────────────────────────────────────────────
export const AVATAR_PROFILES = {
  burned_out_executive: {
    label: "The Burned-Out Executive",
    headline: "You're running on fumes — and you know it.",
    description:
      "You've built something real, but the cost has been your energy, your presence, and your health. The good news: burnout isn't a character flaw — it's a systems problem. The Lights On program was built specifically for people like you.",
    recommendation: "Lights On",
    recommendationUrl: "/upstream",
    kajabi_tag: "quiz-avatar-burned_out_executive",
    primaryColor: "amber",
  },
  stressed_parent: {
    label: "The Stressed Parent",
    headline: "You give everything to everyone — except yourself.",
    description:
      "You're the anchor for your family, and that's beautiful. But you can't pour from an empty cup. The stress, the broken sleep, the constant mental load — these are signals your nervous system is sending. Let's address them at the root.",
    recommendation: "Lights On",
    recommendationUrl: "/upstream",
    kajabi_tag: "quiz-avatar-stressed_parent",
    primaryColor: "rose",
  },
  wellness_seeker: {
    label: "The Wellness Seeker",
    headline: "Your gut is trying to tell you something.",
    description:
      "You're already curious about your health — that's your biggest asset. The research is clear: the gut-brain axis is central to energy, mood, and immunity. The Oral Biome program addresses the upstream root of gut health that most people miss entirely.",
    recommendation: "Oral Biome",
    recommendationUrl: "/upstream/oral",
    kajabi_tag: "quiz-avatar-wellness_seeker",
    primaryColor: "emerald",
  },
  performance_optimizer: {
    label: "The Performance Optimizer",
    headline: "You're already good. You want to be exceptional.",
    description:
      "You're disciplined, structured, and goal-oriented. You don't need to be convinced that health matters — you need a system that matches your ambition. The Lights On advanced track is built for people who are already doing the work and want to go deeper.",
    recommendation: "Lights On Advanced",
    recommendationUrl: "/upstream",
    kajabi_tag: "quiz-avatar-performance_optimizer",
    primaryColor: "violet",
  },
};

// ─── Scoring Logic ────────────────────────────────────────────────────────────
export function scoreAnswers(answers: Record<string, string>): {
  scores: Record<string, number>;
  avatarType: keyof typeof AVATAR_PROFILES;
} {
  const scores: Record<string, number> = {
    burned_out_executive: 0,
    stressed_parent: 0,
    wellness_seeker: 0,
    performance_optimizer: 0,
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
