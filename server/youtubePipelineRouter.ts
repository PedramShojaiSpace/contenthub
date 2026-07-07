/**
 * youtubePipelineRouter.ts
 * YouTube Operations Bible — server-side procedures.
 */
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";
import { eq, desc } from "drizzle-orm";

const pillarEnum = z.enum([
  "gut_health_metabolism",
  "nervous_system_stress",
  "consciousness_longevity",
]);

const statusEnum = z.enum([
  "scripting",
  "qc_scoring",
  "scheduled",
  "live",
  "day7_review",
  "day30_review",
  "reviewed",
]);

async function getTable() {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const { youtubePipelineVideos } = await import("../drizzle/schema");
  return { db, t: youtubePipelineVideos };
}

async function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });
  const content = res?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts = content as Array<{ type: string; text?: string }>;
    const textPart = parts.find((c) => c.type === "text");
    return textPart?.text ?? "";
  }
  return "";
}

function computeDay7Diagnosis(ctr: number, impressions: number, avgViewPct: number) {
  if (ctr < 2 && avgViewPct >= 30) {
    return {
      diagnosis: "thumbnail_title_problem",
      prescribedAction:
        "CTR is below 2% but retention is strong — the content is good but the packaging is failing. A/B test a new thumbnail (different emotion/angle) and rewrite the title using a specific health outcome or named condition. Do NOT change the video content.",
    };
  }
  if (ctr >= 2 && avgViewPct < 25) {
    return {
      diagnosis: "hook_retention_problem",
      prescribedAction:
        "CTR is acceptable but retention is below 25% — viewers are clicking but leaving early. Rewrite the cold open: name a specific health condition in the first sentence, create a knowledge gap, keep it under 35 seconds. Do NOT change the thumbnail.",
    };
  }
  if (ctr < 2 && avgViewPct < 25) {
    return {
      diagnosis: "thumbnail_title_problem",
      prescribedAction:
        "Both CTR and retention are below threshold. Fix the thumbnail/title first (one change at a time), then reassess retention after 7 days. Never change both simultaneously.",
    };
  }
  if (impressions < 500) {
    return {
      diagnosis: "discoverability_problem",
      prescribedAction:
        "Impressions are below 500 — YouTube is not distributing this video. Add 3-5 keyword-rich tags, update the description with the primary keyword in the first 2 sentences, and add it to a relevant playlist.",
    };
  }
  return {
    diagnosis: "on_track",
    prescribedAction: "Video is performing within acceptable range. Monitor at Day 30.",
  };
}

function computeDay30Diagnosis(
  breakoutScore: number,
  ctr: number,
  avgViewPct: number,
  impressions: number,
  searchPct: number
) {
  if (breakoutScore >= 10) {
    return {
      diagnosis: "outperforming",
      prescribedAction:
        "This video is outperforming channel average by 10x+. Create a sequel or companion video on the same topic. Analyze the title/thumbnail formula and replicate it in the next 3 videos.",
    };
  }
  if (breakoutScore >= 3) {
    return {
      diagnosis: "on_track",
      prescribedAction: "Video is on track (3x+ breakout score). No action needed.",
    };
  }
  if (ctr < 2) {
    return {
      diagnosis: "thumbnail_title_problem",
      prescribedAction:
        "Breakout score is below 3x and CTR is under 2%. Test a new thumbnail with a different emotional expression. Rewrite the title to lead with a specific health outcome.",
    };
  }
  if (avgViewPct < 25) {
    return {
      diagnosis: "hook_retention_problem",
      prescribedAction:
        "Breakout score is below 3x and average view percentage is under 25%. The hook is not holding viewers. Generate a new cold open script.",
    };
  }
  if (searchPct < 20) {
    return {
      diagnosis: "discoverability_problem",
      prescribedAction:
        "Low search traffic percentage suggests poor keyword optimization. Update description with primary keyword in first 2 sentences and add keyword-rich tags.",
    };
  }
  return {
    diagnosis: "marginal_underperformer",
    prescribedAction:
      "Video is a marginal underperformer. Archive learnings and move on. Focus energy on the next video with improved packaging.",
  };
}

export const youtubePipelineRouter = router({
  list: protectedProcedure.query(async () => {
    const { db, t } = await getTable();
    return db.select().from(t).orderBy(desc(t.createdAt));
  }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(512),
      pillar: pillarEnum,
      primaryKeyword: z.string().max(256).optional(),
    }))
    .mutation(async ({ input }) => {
      const { db, t } = await getTable();
      const now = Date.now();
      const [result] = await db.insert(t).values({
        title: input.title,
        pillar: input.pillar,
        primaryKeyword: input.primaryKeyword ?? null,
        status: "scripting",
        actionApplied: false,
        createdAt: now,
        updatedAt: now,
      });
      return { id: (result as any).insertId };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).max(512).optional(),
      videoId: z.string().max(64).optional(),
      pillar: pillarEnum.optional(),
      primaryKeyword: z.string().max(256).optional(),
      status: statusEnum.optional(),
      publishDate: z.number().optional(),
      preTitleScore: z.number().min(0).max(100).optional(),
      preThumbnailScore: z.number().min(0).max(100).optional(),
      actionApplied: z.boolean().optional(),
      notes: z.string().max(2000).optional(),
    }))
    .mutation(async ({ input }) => {
      const { db, t } = await getTable();
      const { id, ...rest } = input;
      await db.update(t).set({ ...rest, updatedAt: Date.now() }).where(eq(t.id, id));
      return { ok: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { db, t } = await getTable();
      await db.delete(t).where(eq(t.id, input.id));
      return { ok: true };
    }),

  scoreTitle: protectedProcedure
    .input(z.object({ title: z.string().min(1).max(512) }))
    .mutation(async ({ input }) => {
      const systemPrompt = `You are a YouTube title optimization expert for The Urban Monk channel (Dr. Pedram Shojai).
Score the given title on a 0-100 scale:
- Specificity: names a specific health condition or measurable outcome (+30)
- Curiosity gap: creates a knowledge gap without summarizing (+20)
- Search intent: matches how people actually search (+20)
- Clarity: immediately understandable (+15)
- Emotional resonance: speaks to pain points (+15)
Respond with JSON: {"score": number, "feedback": "one sentence", "rewrite": "improved title if score < 80 or null"}`;
      const raw = await callLLM(systemPrompt, `Title: "${input.title}"`);
      try {
        const parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, "").trim());
        return { score: Math.round(parsed.score ?? 0), feedback: parsed.feedback ?? "", rewrite: parsed.rewrite ?? null };
      } catch {
        return { score: 0, feedback: "Could not parse score", rewrite: null };
      }
    }),

  scoreHook: protectedProcedure
    .input(z.object({ hookScript: z.string().min(1).max(2000) }))
    .mutation(async ({ input }) => {
      const systemPrompt = `You are a YouTube retention expert for The Urban Monk (Dr. Pedram Shojai).
Score this cold open on 0-100:
- Specific health condition named in first sentence (+25)
- Knowledge gap created (+25)
- Under 80 words (+20)
- No summarizing (+15)
- Natural handoff (+15)
Deductions: abstract language -20, starts with "Today we're going to" -20, summarizes video -20
Respond with JSON: {"score": number, "verdict": "PASS"|"NEEDS WORK"|"FAIL", "issues": ["issue1"], "rewrite": "improved version or null"}`;
      const raw = await callLLM(systemPrompt, `Hook script:\n"${input.hookScript}"`);
      try {
        const parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, "").trim());
        return { score: Math.round(parsed.score ?? 0), verdict: parsed.verdict ?? "NEEDS WORK", issues: parsed.issues ?? [], rewrite: parsed.rewrite ?? null };
      } catch {
        return { score: 0, verdict: "FAIL" as const, issues: ["Parse error"], rewrite: null };
      }
    }),

  generateColdOpen: protectedProcedure
    .input(z.object({
      videoTitle: z.string().min(1).max(512),
      pillar: pillarEnum,
      primaryKeyword: z.string().max(256).optional(),
      isRetentionFix: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const pillarContext: Record<string, string> = {
        gut_health_metabolism: "gut health, microbiome, digestion, metabolism, inflammation",
        nervous_system_stress: "nervous system regulation, stress response, cortisol, sleep, anxiety",
        consciousness_longevity: "consciousness, longevity, meditation, cellular health, aging",
      };
      const retentionNote = input.isRetentionFix
        ? "\n\nIMPORTANT: This is a RETENTION FIX. Make it dramatically more specific and curiosity-driven. Start with a shocking or counterintuitive health fact."
        : "";
      const systemPrompt = `You are writing a cold open for Dr. Pedram Shojai (The Urban Monk) — doctor of Oriental Medicine, Taoist monk, bestselling author.
Audience: health-conscious adults 35-65 dealing with chronic symptoms, low energy, brain fog, gut issues, or stress.

COLD OPEN RULES:
1. Name a specific health condition or measurable outcome in the FIRST sentence
2. Create a knowledge gap — make the viewer NEED to watch to get the answer
3. Under 80 words / 35 seconds when spoken
4. End with a natural handoff line
5. NEVER start with "Today we're going to..."
6. NEVER use abstract language ("explore", "find balance", "dive deep")
7. NEVER summarize the video${retentionNote}

Write ONLY the cold open script. No intro, no explanation.`;
      const script = await callLLM(
        systemPrompt,
        `Video title: "${input.videoTitle}"\nContent pillar: ${pillarContext[input.pillar]}\nPrimary keyword: ${input.primaryKeyword ?? "not specified"}`
      );
      return { script: script.trim() };
    }),

  diagnoseDay7: protectedProcedure
    .input(z.object({
      id: z.number(),
      ctr: z.number(),
      impressions: z.number(),
      avgViewPct: z.number(),
    }))
    .mutation(async ({ input }) => {
      const { db, t } = await getTable();
      const { diagnosis, prescribedAction } = computeDay7Diagnosis(input.ctr, input.impressions, input.avgViewPct);
      await db.update(t).set({
        day7Ctr: input.ctr,
        day7Impressions: input.impressions,
        day7AvgViewPct: input.avgViewPct,
        day7Diagnosis: diagnosis as any,
        prescribedAction,
        actionApplied: false,
        status: "day7_review",
        updatedAt: Date.now(),
      }).where(eq(t.id, input.id));
      return { diagnosis, prescribedAction };
    }),

  diagnoseDay30: protectedProcedure
    .input(z.object({
      id: z.number(),
      breakoutScore: z.number(),
      ctr: z.number(),
      avgViewPct: z.number(),
      impressions: z.number(),
      searchPct: z.number(),
    }))
    .mutation(async ({ input }) => {
      const { db, t } = await getTable();
      const { diagnosis, prescribedAction } = computeDay30Diagnosis(
        input.breakoutScore, input.ctr, input.avgViewPct, input.impressions, input.searchPct
      );
      await db.update(t).set({
        day30BreakoutScore: input.breakoutScore,
        day30Ctr: input.ctr,
        day30AvgViewPct: input.avgViewPct,
        day30Impressions: input.impressions,
        day30SearchPct: input.searchPct,
        day30Diagnosis: diagnosis as any,
        prescribedAction,
        actionApplied: false,
        status: "day30_review",
        updatedAt: Date.now(),
      }).where(eq(t.id, input.id));
      return { diagnosis, prescribedAction };
    }),

  getChannelHealth: protectedProcedure.query(async () => {
    const { db, t } = await getTable();
    const videos = await db.select().from(t);
    const live = videos.filter((v) =>
      ["live", "day7_review", "day30_review", "reviewed"].includes(v.status)
    );
    const needsAction = videos.filter(
      (v) =>
        v.prescribedAction &&
        !v.actionApplied &&
        v.day7Diagnosis != null &&
        v.day7Diagnosis !== "pending" &&
        v.day7Diagnosis !== "outperforming" &&
        v.day7Diagnosis !== "on_track"
    );
    const outperforming = videos.filter(
      (v) => v.day30Diagnosis === "outperforming" || v.day7Diagnosis === "outperforming"
    );
    const withDay7Ctr = videos.filter((v) => v.day7Ctr != null);
    const avgDay7Ctr =
      withDay7Ctr.length > 0
        ? Math.round((withDay7Ctr.reduce((s, v) => s + (v.day7Ctr ?? 0), 0) / withDay7Ctr.length) * 10) / 10
        : 0;
    const withRetention = videos.filter((v) => v.day7AvgViewPct != null);
    const avgDay7Retention =
      withRetention.length > 0
        ? Math.round(withRetention.reduce((s, v) => s + (v.day7AvgViewPct ?? 0), 0) / withRetention.length)
        : 0;

    let recoveryScore = 50;
    if (avgDay7Ctr >= 3) recoveryScore += 20;
    else if (avgDay7Ctr >= 2) recoveryScore += 5;
    else if (avgDay7Ctr > 0) recoveryScore -= 15;
    if (avgDay7Retention >= 30) recoveryScore += 20;
    else if (avgDay7Retention >= 25) recoveryScore += 5;
    else if (avgDay7Retention > 0) recoveryScore -= 15;
    recoveryScore += outperforming.length * 5;
    recoveryScore -= needsAction.length * 8;
    recoveryScore = Math.max(0, Math.min(100, recoveryScore));

    const inDoghouse =
      recoveryScore < 40 ||
      (avgDay7Ctr > 0 && avgDay7Ctr < 2) ||
      (avgDay7Retention > 0 && avgDay7Retention < 25);

    return {
      live: live.length,
      needsAction: needsAction.length,
      outperforming: outperforming.length,
      avgDay7Ctr,
      avgDay7Retention,
      recoveryScore,
      inDoghouse,
    };
  }),

  getRecoveryQueue: protectedProcedure.query(async () => {
    const { db, t } = await getTable();
    const videos = await db.select().from(t);
    return videos.filter(
      (v) =>
        v.prescribedAction &&
        !v.actionApplied &&
        v.day7Diagnosis != null &&
        v.day7Diagnosis !== "pending" &&
        v.day7Diagnosis !== "outperforming" &&
        v.day7Diagnosis !== "on_track"
    );
  }),
});
