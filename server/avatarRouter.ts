/**
 * Avatar Intelligence Router
 * Provides access to pain points, personas, messaging frameworks, and objections
 * from the Avatar Intelligence Engine (seeded from real discovery call transcripts).
 */

import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  avatarPainPoints,
  avatarPersonas,
  avatarMessagingFrameworks,
  avatarObjections,
  AvatarPainPoint,
  AvatarPersona,
  AvatarMessagingFramework,
  AvatarObjection,
} from "../drizzle/schema";
import { asc } from "drizzle-orm";

export const avatarRouter = router({
  // ── Pain Points ────────────────────────────────────────────────────────────
  listPainPoints: publicProcedure
    .input(z.object({ stage: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const all: AvatarPainPoint[] = await db
        .select()
        .from(avatarPainPoints)
        .orderBy(asc(avatarPainPoints.stage), asc(avatarPainPoints.category));
      if (input?.stage) {
        return all.filter((p) => p.stage === input.stage);
      }
      return all;
    }),

  // ── Personas ───────────────────────────────────────────────────────────────
  listPersonas: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(avatarPersonas).orderBy(asc(avatarPersonas.name)) as Promise<AvatarPersona[]>;
  }),

  // ── Messaging Frameworks ───────────────────────────────────────────────────
  listFrameworks: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(avatarMessagingFrameworks).orderBy(asc(avatarMessagingFrameworks.name)) as Promise<AvatarMessagingFramework[]>;
  }),

  // ── Objections ─────────────────────────────────────────────────────────────
  listObjections: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(avatarObjections).orderBy(asc(avatarObjections.objection)) as Promise<AvatarObjection[]>;
  }),

  // ── Stats ──────────────────────────────────────────────────────────────────
  getStats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalPainPoints: 0, totalPersonas: 0, totalFrameworks: 0, totalObjections: 0, stages: [], stageBreakdown: [] };
    const [painPoints, personas, frameworks, objections] = await Promise.all([
      db.select().from(avatarPainPoints) as Promise<AvatarPainPoint[]>,
      db.select().from(avatarPersonas) as Promise<AvatarPersona[]>,
      db.select().from(avatarMessagingFrameworks) as Promise<AvatarMessagingFramework[]>,
      db.select().from(avatarObjections) as Promise<AvatarObjection[]>,
    ]);
    const stageSet = new Set(painPoints.map((p) => p.stage));
    const stages = Array.from(stageSet);
    return {
      totalPainPoints: painPoints.length,
      totalPersonas: personas.length,
      totalFrameworks: frameworks.length,
      totalObjections: objections.length,
      stages,
      stageBreakdown: stages.map((s) => ({
        stage: s,
        count: painPoints.filter((p) => p.stage === s).length,
      })),
    };
  }),

  /**
   * Get a rich avatar context block for a given topic and optional journey stage.
   * Used by all AI generation procedures to inject avatar intelligence into prompts.
   */
  getContextBlock: publicProcedure
    .input(
      z.object({
        topic: z.string(),
        journeyStage: z
          .enum(["surface", "practitioner_maze", "deep_pain", "root_cause"])
          .optional(),
        personaName: z.string().optional(),
        frameworkName: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { contextBlock: "", persona: null, painPoints: [], framework: null, objections: [] };

      const [allPainPoints, allPersonas, allFrameworks, allObjections] = await Promise.all([
        db.select().from(avatarPainPoints) as Promise<AvatarPainPoint[]>,
        db.select().from(avatarPersonas) as Promise<AvatarPersona[]>,
        db.select().from(avatarMessagingFrameworks) as Promise<AvatarMessagingFramework[]>,
        db.select().from(avatarObjections) as Promise<AvatarObjection[]>,
      ]);

      const topicLower = input.topic.toLowerCase();
      const keywords = topicLower.split(/\s+/).filter((w) => w.length > 3);

      // Score pain points by relevance to topic
      const scoredPainPoints = allPainPoints
        .filter((p) => !input.journeyStage || p.stage === input.journeyStage)
        .map((p) => {
          let score = 0;
          const text = `${p.title} ${p.description} ${p.category} ${p.contentTopics || ""}`.toLowerCase();
          keywords.forEach((kw) => { if (text.includes(kw)) score += 2; });
          if (input.journeyStage && p.stage === input.journeyStage) score += 3;
          return { ...p, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      // Pick persona
      const persona = input.personaName
        ? allPersonas.find((p) => p.name.toLowerCase().includes(input.personaName!.toLowerCase()))
        : allPersonas[0];

      // Pick messaging framework
      const framework = input.frameworkName
        ? allFrameworks.find((f) => f.name.toLowerCase().includes(input.frameworkName!.toLowerCase()))
        : allFrameworks[0];

      // Top 2 objections
      const topObjections = allObjections.slice(0, 2);

      // Build the context block string
      const lines: string[] = [
        "=== AVATAR INTELLIGENCE (from real discovery call transcripts) ===",
        "",
        "TARGET PERSONA:",
        `Name: ${persona?.name || "The Desperate Seeker"}`,
        `Profile: ${(persona?.profile || "").slice(0, 300)}`,
        `Communication Style: ${(persona?.communicationStyle || "").slice(0, 200)}`,
        "",
        "PAIN POINTS TO ADDRESS (ranked by relevance to this topic):",
      ];

      scoredPainPoints.forEach((pp, i) => {
        lines.push(`${i + 1}. [${pp.stage.toUpperCase()}] ${pp.title}`);
        lines.push(`   ${(pp.description || "").slice(0, 200)}`);
        if (pp.emotionalHook) lines.push(`   Emotional Hook: ${pp.emotionalHook}`);
        if (pp.keyQuote) lines.push(`   Real Quote: "${(pp.keyQuote || "").slice(0, 150)}"`);
        lines.push("");
      });

      lines.push("MESSAGING FRAMEWORK TO USE:");
      lines.push(`Framework: ${framework?.name || "The Validation Message"}`);
      lines.push(`Structure: ${framework?.structure || ""}`);
      lines.push(`Emotional Job: ${framework?.emotionalJob || ""}`);
      lines.push("");

      lines.push("HEADLINE FORMULA:");
      const topPainPoint = scoredPainPoints[0];
      if (topPainPoint?.headlineFormula) {
        lines.push(`Formula: ${topPainPoint.headlineFormula}`);
        lines.push(`Example: ${topPainPoint.exampleHeadline || ""}`);
      }
      lines.push("");

      lines.push("COMMON OBJECTIONS TO PREEMPTIVELY ADDRESS:");
      topObjections.forEach((o) => {
        lines.push(`- "${o.objection}"`);
        lines.push(`  Underlying Fear: ${(o.underlyingFear || "").slice(0, 150)}`);
      });

      lines.push("");
      lines.push("CRITICAL TONE NOTES (from sales training):");
      lines.push("- Validate their experience FIRST before offering solutions");
      lines.push("- Don't minimize their symptoms — they've been told 'it's in your head' too many times");
      lines.push("- Create urgency around inaction: 'What happens if this continues for another year?'");
      lines.push("- Use transformation language: 'reclaim,' 'restore,' 'finally,' 'root cause,' not 'manage' or 'cope'");
      lines.push("- Reference real patient journeys — specificity builds credibility");
      lines.push("=== END AVATAR INTELLIGENCE ===");

      return {
        contextBlock: lines.join("\n"),
        persona: persona || null,
        painPoints: scoredPainPoints,
        framework: framework || null,
        objections: topObjections,
      };
    }),
});

/**
 * Server-side helper: get avatar context block for a topic.
 * Used directly in AI generation procedures without going through tRPC.
 */
export async function getAvatarContextBlock(
  topic: string,
  journeyStage?: "surface" | "practitioner_maze" | "deep_pain" | "root_cause"
): Promise<string> {
  try {
    const db = await getDb();
    if (!db) return "";

    const [allPainPoints, allPersonas, allFrameworks, allObjections] = await Promise.all([
      db.select().from(avatarPainPoints) as Promise<AvatarPainPoint[]>,
      db.select().from(avatarPersonas) as Promise<AvatarPersona[]>,
      db.select().from(avatarMessagingFrameworks) as Promise<AvatarMessagingFramework[]>,
      db.select().from(avatarObjections) as Promise<AvatarObjection[]>,
    ]);

    const topicLower = topic.toLowerCase();
    const keywords = topicLower.split(/\s+/).filter((w) => w.length > 3);

    const scoredPainPoints = allPainPoints
      .filter((p) => !journeyStage || p.stage === journeyStage)
      .map((p) => {
        let score = 0;
        const text = `${p.title} ${p.description} ${p.category} ${p.contentTopics || ""}`.toLowerCase();
        keywords.forEach((kw) => { if (text.includes(kw)) score += 2; });
        if (journeyStage && p.stage === journeyStage) score += 3;
        return { ...p, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const persona = allPersonas[0];
    const framework = allFrameworks[0];
    const topObjections = allObjections.slice(0, 2);

    const lines: string[] = [
      "\n=== AVATAR INTELLIGENCE (from real discovery call transcripts) ===",
      `TARGET PERSONA: ${persona?.name || "The Desperate Seeker"}`,
      `Profile: ${(persona?.profile || "").slice(0, 250)}`,
      "",
      "KEY PAIN POINTS TO ADDRESS:",
    ];

    scoredPainPoints.forEach((pp, i) => {
      lines.push(`${i + 1}. [${pp.stage.toUpperCase()}] ${pp.title}`);
      lines.push(`   ${(pp.description || "").slice(0, 180)}`);
      if (pp.emotionalHook) lines.push(`   Hook: ${pp.emotionalHook}`);
      if (pp.keyQuote) lines.push(`   Real Quote: "${(pp.keyQuote || "").slice(0, 120)}"`);
    });

    lines.push("");
    lines.push(`MESSAGING FRAMEWORK: ${framework?.name || "The Validation Message"}`);
    lines.push(`Structure: ${framework?.structure || ""}`);
    lines.push(`Emotional Job: ${framework?.emotionalJob || ""}`);

    if (scoredPainPoints[0]?.headlineFormula) {
      lines.push("");
      lines.push(`HEADLINE FORMULA: ${scoredPainPoints[0].headlineFormula}`);
      lines.push(`Example: ${scoredPainPoints[0].exampleHeadline || ""}`);
    }

    lines.push("");
    lines.push("OBJECTIONS TO PREEMPTIVELY ADDRESS:");
    topObjections.forEach((o) => {
      lines.push(`- "${o.objection}" (Fear: ${(o.underlyingFear || "").slice(0, 120)})`);
    });

    lines.push("");
    lines.push("TONE: Validate first. Use transformation language. Create urgency around inaction.");
    lines.push("=== END AVATAR INTELLIGENCE ===\n");

    return lines.join("\n");
  } catch (err) {
    console.warn("[Avatar] Context block failed:", err);
    return "";
  }
}
