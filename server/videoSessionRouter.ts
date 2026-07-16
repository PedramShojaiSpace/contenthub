/**
 * videoSessionRouter.ts
 *
 * Handles the full Video Production Session lifecycle:
 *   1. createSession  — name, idea, platform
 *   2. generateScripts — LLM generates 5 hooks + body + CTA in one call
 *   3. updateScript   — inline edit of any script
 *   4. approveScript  — toggle approved on a single script
 *   5. approveAll     — approve every script in a session
 *   6. exportTeleprompter — returns DOCX file parts (base64 JSON) for client-side assembly
 *   7. attachRecording — link an S3 recording URL to a script
 *   8. getSession     — full session with scripts
 *   9. listSessions   — history
 *  10. deleteSession  — hard delete
 *  11. updateStatus   — manual status override
 */

import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { getDb } from "./db";
import {
  videoProductionSessions,
  sessionScripts,
  SessionScript,
} from "../drizzle/schema";
import { protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { wrapLLM, parseLLMJson } from "./llmUtils";

// ─── helpers ─────────────────────────────────────────────────────────────────

async function getSessionOrThrow(sessionId: number, userId: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const rows = await db
    .select()
    .from(videoProductionSessions)
    .where(
      and(
        eq(videoProductionSessions.id, sessionId),
        eq(videoProductionSessions.userId, userId)
      )
    )
    .limit(1);
  if (!rows[0]) throw new Error("Session not found");
  return rows[0];
}

// ─── LLM script generation ────────────────────────────────────────────────────

interface GeneratedScripts {
  hooks: string[];
  body: string;
  cta: string;
}

const CTA_KEYWORD_MAP: Record<string, { keyword: string; programName: string; funnelDest: string }> = {
  UPSTREAM:    { keyword: "UPSTREAM",    programName: "Upstream",                          funnelDest: "upstream" },
  LIGHTSON:    { keyword: "LIGHTSON",    programName: "Lights On",                         funnelDest: "lights_on" },
  TEST:        { keyword: "TEST",        programName: "the Gateway to Health Test",        funnelDest: "gateway_test" },
  SLEEP:       { keyword: "SLEEP",       programName: "the Restorative Sleep Masterclass", funnelDest: "lights_on" },
  WEBOFLIFE:   { keyword: "WEBOFLIFE",   programName: "The Web of Life",                   funnelDest: "web_of_life_lander" },
  ELEPHANT:    { keyword: "ELEPHANT",    programName: "the Elephant in the Room",          funnelDest: "elephant_lander" },
};

async function generateScriptsFromIdea(
  idea: string,
  platform: string,
  ctaKeyword?: string | null
): Promise<GeneratedScripts> {
  const platformGuide: Record<string, string> = {
    tiktok:    "TikTok (15-60 sec, fast-paced, Gen-Z energy, trending audio hooks)",
    instagram: "Instagram Reels (15-90 sec, aspirational, lifestyle-forward)",
    youtube:   "YouTube Shorts (up to 60 sec) or long-form (5-20 min)",
    linkedin:  "LinkedIn video (professional, thought-leadership, 1-3 min)",
    x:         "X/Twitter video (up to 2:20, punchy, opinion-driven)",
    meta:      "Meta/Facebook (1-3 min, community-focused, story arc)",
  };
  const guide = platformGuide[platform] ?? "social media video";

  const systemPrompt = `You are Dr. Pedram Shojai's video script writer.
Dr. Shojai is a Doctor of Oriental Medicine, Qigong master, NY Times bestselling author, and the founder of The Urban Monk.
His voice is: warm, authoritative, science-meets-ancient-wisdom, conversational, never preachy, always actionable.
Platform context: ${guide}.

Generate a complete video script package for split-testing hooks:
- 5 distinct HOOKS (each 1-3 sentences, ~10-20 seconds when spoken). Each hook uses a DIFFERENT psychological trigger:
  Hook 1: Contradiction (challenge a common belief)
  Hook 2: Specificity (a precise surprising stat or fact)
  Hook 3: Curiosity Gap (tease a revelation without giving it away)
  Hook 4: Pain Point (name the exact frustration the viewer feels right now)
  Hook 5: Bold Promise (a direct, credible outcome statement)
- 1 BODY (main content, 60-180 seconds when spoken, delivers on the hook's promise, teaches one clear insight)
- 1 CTA (15-30 seconds spoken word — CRITICAL RULE: NEVER mention a URL or website address. NEVER invent your own keyword. This is a ManyChat keyword-reply flow. The viewer comments the keyword and receives the link via DM automatically. ${(() => { const kw = (ctaKeyword && CTA_KEYWORD_MAP[ctaKeyword]) ? CTA_KEYWORD_MAP[ctaKeyword] : CTA_KEYWORD_MAP["UPSTREAM"]; return `The keyword is "${kw.keyword}" and the program is ${kw.programName}. The CTA MUST tell the viewer to comment exactly "${kw.keyword}" below. Example: "If you want to learn more about ${kw.programName}, just comment ${kw.keyword} below and I'll send you the link directly." Use only this exact keyword — do not substitute, modify, or invent a different word.`; })()} Keep it warm, conversational, and non-pushy.)

All scripts must be written as SPOKEN WORD — no stage directions, no labels, no markdown.
Write exactly as Dr. Shojai would say it into a camera.`;

  const userPrompt = `Video idea: "${idea}"

Return a JSON object:
{
  "hooks": ["hook1 text", "hook2 text", "hook3 text", "hook4 text", "hook5 text"],
  "body": "full body script text",
  "cta": "cta script text"
}`;

  const response = await wrapLLM(() => invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "video_scripts",
        strict: true,
        schema: {
          type: "object",
          properties: {
            hooks: { type: "array", items: { type: "string" } },
            body: { type: "string" },
            cta: { type: "string" },
          },
          required: ["hooks", "body", "cta"],
          additionalProperties: false,
        },
      },
    },
  }));

  const raw = response?.choices?.[0]?.message?.content ?? "{}";
  const parsed: GeneratedScripts = parseLLMJson<GeneratedScripts>(typeof raw === "string" ? raw : JSON.stringify(raw), "video scripts");
  while (parsed.hooks.length < 5) parsed.hooks.push("");
  parsed.hooks = parsed.hooks.slice(0, 5);
  return parsed;
}

// ─── DOCX export ─────────────────────────────────────────────────────────────

function buildDocxPayload(scripts: SessionScript[]): string {
  const escapeXml = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const makeParagraph = (text: string, fontSize = 24) => {
    const lines = text.split("\n").filter(Boolean);
    return lines
      .map(
        (line) => `<w:p>
  <w:pPr><w:spacing w:after="200"/></w:pPr>
  <w:r>
    <w:rPr><w:sz w:val="${fontSize * 2}"/><w:szCs w:val="${fontSize * 2}"/></w:rPr>
    <w:t xml:space="preserve">${escapeXml(line)}</w:t>
  </w:r>
</w:p>`
      )
      .join("\n");
  };

  const makeHeading = (text: string) => `<w:p>
  <w:pPr><w:spacing w:before="400" w:after="120"/><w:jc w:val="center"/></w:pPr>
  <w:r>
    <w:rPr><w:b/><w:color w:val="1a1a2e"/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr>
    <w:t>${escapeXml(text)}</w:t>
  </w:r>
</w:p>`;

  const makeDivider = () => `<w:p>
  <w:pPr><w:spacing w:before="200" w:after="200"/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="cccccc"/></w:pBdr></w:pPr>
</w:p>`;

  const hooks = scripts.filter((s) => s.scriptType === "hook").sort((a, b) => a.scriptOrder - b.scriptOrder);
  const body = scripts.find((s) => s.scriptType === "body");
  const cta = scripts.find((s) => s.scriptType === "cta");

  const hookLabels = ["CONTRADICTION", "SPECIFICITY", "CURIOSITY GAP", "PAIN POINT", "BOLD PROMISE"];

  let bodyXml = makeHeading("URBAN MONK — VIDEO PRODUCTION SCRIPTS");
  bodyXml += makeDivider();
  hooks.forEach((h, i) => {
    bodyXml += makeHeading(`HOOK ${i + 1} — ${hookLabels[i] ?? `HOOK ${i + 1}`}`);
    bodyXml += makeParagraph(h.scriptText, 18);
    bodyXml += makeDivider();
  });
  if (body) {
    bodyXml += makeHeading("MAIN BODY");
    bodyXml += makeParagraph(body.scriptText, 18);
    bodyXml += makeDivider();
  }
  if (cta) {
    bodyXml += makeHeading("CALL TO ACTION");
    bodyXml += makeParagraph(cta.scriptText, 18);
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${bodyXml}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const files: Record<string, string> = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    "word/document.xml": documentXml,
  };

  const filesBase64: Record<string, string> = {};
  for (const [name, content] of Object.entries(files)) {
    filesBase64[name] = Buffer.from(content, "utf-8").toString("base64");
  }
  return JSON.stringify(filesBase64);
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const videoSessionRouter = router({
  createSession: protectedProcedure
    .input(
      z.object({
        sessionName: z.string().min(1).max(255),
        idea: z.string().min(1),
        platform: z.enum(["tiktok", "instagram", "youtube", "linkedin", "x", "meta"]).default("instagram"),
        ctaKeyword: z.enum(["UPSTREAM", "LIGHTSON", "TEST", "SLEEP", "WEBOFLIFE", "ELEPHANT"]).optional(),
        // Content Brief fields
        contentPillar: z.enum(["gut_health_metabolism", "nervous_system_stress", "consciousness_longevity", "web_of_life", "the_practice"]).optional(),
        funnelDestination: z.enum(["lights_on", "upstream", "web_of_life_lander", "elephant_lander", "gateway_test"]).optional(),
        painCluster: z.string().max(128).optional(),
        villain: z.string().max(255).optional(),
        briefHookPhrase: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      // Auto-derive funnelDestination from ctaKeyword if not explicitly set
      const derivedFunnelDest = input.funnelDestination ??
        (input.ctaKeyword && CTA_KEYWORD_MAP[input.ctaKeyword]
          ? CTA_KEYWORD_MAP[input.ctaKeyword].funnelDest as "lights_on" | "upstream" | "web_of_life_lander" | "elephant_lander" | "gateway_test"
          : undefined);
      const [result] = await db.insert(videoProductionSessions).values({
        userId: ctx.user.openId,
        sessionName: input.sessionName,
        idea: input.idea,
        platform: input.platform,
        ctaKeyword: input.ctaKeyword ?? null,
        contentPillar: input.contentPillar ?? null,
        funnelDestination: derivedFunnelDest ?? null,
        painCluster: input.painCluster ?? null,
        villain: input.villain ?? null,
        briefHookPhrase: input.briefHookPhrase ?? null,
        status: "scripting",
      });
      return { sessionId: (result as { insertId: number }).insertId };
    }),

  generateScripts: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const session = await getSessionOrThrow(input.sessionId, ctx.user.openId);
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(sessionScripts).where(eq(sessionScripts.sessionId, input.sessionId));

      const generated = await generateScriptsFromIdea(session.idea, session.platform, session.ctaKeyword);

      const toInsert = [
        ...generated.hooks.map((text, i) => ({
          sessionId: input.sessionId,
          scriptType: "hook" as const,
          scriptOrder: i + 1,
          scriptText: text,
          approved: false,
        })),
        { sessionId: input.sessionId, scriptType: "body" as const, scriptOrder: 0, scriptText: generated.body, approved: false },
        { sessionId: input.sessionId, scriptType: "cta" as const, scriptOrder: 0, scriptText: generated.cta, approved: false },
      ];

      await db.insert(sessionScripts).values(toInsert);
      await db.update(videoProductionSessions).set({ status: "scripting" }).where(eq(videoProductionSessions.id, input.sessionId));
      return { count: toInsert.length };
    }),

  updateScript: protectedProcedure
    .input(z.object({ scriptId: z.number(), scriptText: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [script] = await db.select().from(sessionScripts).where(eq(sessionScripts.id, input.scriptId)).limit(1);
      if (!script) throw new Error("Script not found");
      await getSessionOrThrow(script.sessionId, ctx.user.openId);
      await db.update(sessionScripts).set({ scriptText: input.scriptText, updatedAt: new Date() }).where(eq(sessionScripts.id, input.scriptId));
      return { ok: true };
    }),

  approveScript: protectedProcedure
    .input(z.object({ scriptId: z.number(), approved: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [script] = await db.select().from(sessionScripts).where(eq(sessionScripts.id, input.scriptId)).limit(1);
      if (!script) throw new Error("Script not found");
      await getSessionOrThrow(script.sessionId, ctx.user.openId);
      await db.update(sessionScripts).set({
        approved: input.approved,
        approvedAt: input.approved ? new Date() : null,
        updatedAt: new Date(),
      }).where(eq(sessionScripts.id, input.scriptId));
      return { ok: true };
    }),

  approveAll: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await getSessionOrThrow(input.sessionId, ctx.user.openId);
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.update(sessionScripts).set({ approved: true, approvedAt: new Date(), updatedAt: new Date() }).where(eq(sessionScripts.sessionId, input.sessionId));
      await db.update(videoProductionSessions).set({ status: "ready_to_record", updatedAt: new Date() }).where(eq(videoProductionSessions.id, input.sessionId));
      return { ok: true };
    }),

  exportTeleprompter: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ ctx, input }) => {
      await getSessionOrThrow(input.sessionId, ctx.user.openId);
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const scripts = await db.select().from(sessionScripts).where(
        and(eq(sessionScripts.sessionId, input.sessionId), eq(sessionScripts.approved, true))
      );
      if (scripts.length === 0) throw new Error("No approved scripts to export");
      const docxPayload = buildDocxPayload(scripts);
      return { docxPayload };
    }),

  attachRecording: protectedProcedure
    .input(z.object({ scriptId: z.number(), recordingUrl: z.string().url(), recordingKey: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [script] = await db.select().from(sessionScripts).where(eq(sessionScripts.id, input.scriptId)).limit(1);
      if (!script) throw new Error("Script not found");
      await getSessionOrThrow(script.sessionId, ctx.user.openId);
      await db.update(sessionScripts).set({ recordingUrl: input.recordingUrl, recordingKey: input.recordingKey, updatedAt: new Date() }).where(eq(sessionScripts.id, input.scriptId));

      const allApproved = await db.select().from(sessionScripts).where(
        and(eq(sessionScripts.sessionId, script.sessionId), eq(sessionScripts.approved, true))
      );
      const allHaveRecordings = allApproved.every((s: SessionScript) => !!s.recordingUrl);
      if (allHaveRecordings && allApproved.length > 0) {
        await db.update(videoProductionSessions).set({ status: "uploading", updatedAt: new Date() }).where(eq(videoProductionSessions.id, script.sessionId));
      }
      return { ok: true };
    }),

  getSession: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ ctx, input }) => {
      const session = await getSessionOrThrow(input.sessionId, ctx.user.openId);
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const scripts = await db.select().from(sessionScripts)
        .where(eq(sessionScripts.sessionId, input.sessionId))
        .orderBy(sessionScripts.scriptType, sessionScripts.scriptOrder);
      return { session, scripts };
    }),

  listSessions: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      return db.select().from(videoProductionSessions)
        .where(eq(videoProductionSessions.userId, ctx.user.openId))
        .orderBy(desc(videoProductionSessions.createdAt))
        .limit(input.limit);
    }),

  deleteSession: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await getSessionOrThrow(input.sessionId, ctx.user.openId);
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(sessionScripts).where(eq(sessionScripts.sessionId, input.sessionId));
      await db.delete(videoProductionSessions).where(eq(videoProductionSessions.id, input.sessionId));
      return { ok: true };
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      sessionId: z.number(),
      status: z.enum(["scripting", "ready_to_record", "uploading", "stitching", "done"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await getSessionOrThrow(input.sessionId, ctx.user.openId);
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.update(videoProductionSessions).set({ status: input.status, updatedAt: new Date() }).where(eq(videoProductionSessions.id, input.sessionId));
      return { ok: true };
    }),

    regenerateCta: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const session = await getSessionOrThrow(input.sessionId, ctx.user.openId);
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      // Generate a fresh CTA using the session's keyword and idea
      const generated = await generateScriptsFromIdea(session.idea, session.platform, session.ctaKeyword);
      // Delete only the existing CTA script(s) for this session
      await db.delete(sessionScripts)
        .where(and(
          eq(sessionScripts.sessionId, input.sessionId),
          eq(sessionScripts.scriptType, "cta")
        ));
      // Insert the fresh CTA — auto-approved since the user explicitly requested regeneration
      await db.insert(sessionScripts).values({
        sessionId: input.sessionId,
        scriptType: "cta",
        scriptOrder: 0,
        scriptText: generated.cta,
        approved: true,
        approvedAt: new Date(),
      });
      return { ok: true };
    }),

  // ─── Publish Package: YouTube Metadata ──────────────────────────────────────
  generateYouTubeMetadata: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const session = await getSessionOrThrow(input.sessionId, ctx.user.openId);
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Gather all approved scripts
      const scripts = await db
        .select()
        .from(sessionScripts)
        .where(eq(sessionScripts.sessionId, input.sessionId));
      const approvedHooks = scripts.filter(s => s.scriptType === "hook" && s.approved).map(s => s.scriptText);
      const body = scripts.find(s => s.scriptType === "body")?.scriptText ?? "";
      const cta = scripts.find(s => s.scriptType === "cta")?.scriptText ?? "";
      const fullScript = [...approvedHooks, body, cta].join("\n\n");

      // Avatar context
      const { getAvatarContextBlock } = await import("./avatarRouter");
      const avatarContext = await getAvatarContextBlock(session.idea).catch(() => "");

      const channelFooter = `---
Welcome to The Urban Monk channel! If you enjoyed this video, make sure to Like, Subscribe, and hit the Notification Bell so you never miss an update.
🚀 Free Upstream Masterclass: https://upstream.theurbanmonk.com?utm_source=youtube&utm_medium=video&utm_campaign=upstream-bundle
💡 Lights On Course: https://lightson.theurbanmonk.com?utm_source=youtube&utm_medium=video&utm_campaign=lights-on
🌿 InterConnected Free Screening: https://theacademy.theurbanmonk.com/ic-interconnected-free-screening-Meta?utm_source=youtube&utm_medium=video&utm_campaign=ic-free-screening
📚 The Urban Monk: https://www.theurbanmonk.com?utm_source=youtube&utm_medium=video&utm_campaign=brand-awareness`;

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an expert YouTube SEO strategist for The Urban Monk channel (Dr. Pedram Shojai). Your job is to generate a complete YouTube publish package.

ALWAYS output valid JSON matching this exact schema:
{
  "titleOptions": ["Title 1", "Title 2", "Title 3", "Title 4", "Title 5"],
  "description": "Full YouTube description (plain text, no markdown, 300-500 words before footer)",
  "tags": ["tag1", "tag2", ...],
  "primaryKeyword": "main SEO keyword"
}

Title rules: 5 options, 50-60 chars each, include primary keyword, no clickbait, no "In this video", no quotes.
Description rules: Hook (2-3 sentences with primary keyword) + Body (150-200 words, second person, mention Dr. Pedram Shojai) + Timestamps (4-6 if identifiable) + Channel footer EXACTLY as provided.
Tags rules: 25-30 tags, mix of broad (gut health) + specific (leaky gut symptoms) + branded (urban monk, pedram shojai) + long-tail (how to fix gut health naturally). No hashtags in tags.

${avatarContext ? `AUDIENCE INTELLIGENCE (use to inform keyword choices and title angles):
${avatarContext}` : ""}`,
          },
          {
            role: "user",
            content: `VIDEO IDEA: ${session.idea}\nPLATFORM: ${session.platform}\n\nAPPROVED SCRIPT:\n${fullScript.slice(0, 4000)}\n\nCHANNEL FOOTER (paste EXACTLY at end of description):\n${channelFooter}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "youtube_metadata",
            strict: true,
            schema: {
              type: "object",
              properties: {
                titleOptions: { type: "array", items: { type: "string" } },
                description: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
                primaryKeyword: { type: "string" },
              },
              required: ["titleOptions", "description", "tags", "primaryKeyword"],
              additionalProperties: false,
            },
          },
        } as any,
      });

      const raw = String(response.choices?.[0]?.message?.content ?? "{}");
      const meta = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim());
      return {
        titleOptions: (meta.titleOptions ?? []) as string[],
        description: (meta.description ?? "") as string,
        tags: (meta.tags ?? []) as string[],
        primaryKeyword: (meta.primaryKeyword ?? session.idea) as string,
      };
    }),

  // ─── Publish Package: Social Captions ───────────────────────────────────────
  generateSocialCaptions: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const session = await getSessionOrThrow(input.sessionId, ctx.user.openId);
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const scripts = await db
        .select()
        .from(sessionScripts)
        .where(eq(sessionScripts.sessionId, input.sessionId));
      const approvedHooks = scripts.filter(s => s.scriptType === "hook" && s.approved).map(s => s.scriptText);
      const body = scripts.find(s => s.scriptType === "body")?.scriptText ?? "";
      const cta = scripts.find(s => s.scriptType === "cta")?.scriptText ?? "";
      const fullScript = [...approvedHooks, body, cta].join("\n\n");

      const { getAvatarContextBlock } = await import("./avatarRouter");
      const avatarContext = await getAvatarContextBlock(session.idea).catch(() => "");

      const ctaInfo = session.ctaKeyword && CTA_KEYWORD_MAP[session.ctaKeyword]
        ? CTA_KEYWORD_MAP[session.ctaKeyword]
        : CTA_KEYWORD_MAP["UPSTREAM"];

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a social media ghostwriter for Dr. Pedram Shojai (The Urban Monk). Generate platform-specific social media captions for a new video.

CTA rule: Every caption must end with a ManyChat keyword CTA. The viewer comments the keyword "${ctaInfo.keyword}" to receive the link via DM. Example: "Comment ${ctaInfo.keyword} below and I'll send you the link directly."

Platform rules:
- Instagram: 150-200 words, conversational, 3-5 line breaks, 15-20 hashtags at end, warm and personal tone
- TikTok: 80-120 words, punchy, one idea per line, 5-8 hashtags, hook in first line, Gen Z-friendly but not cringe
- LinkedIn: 200-250 words, professional, thought-leadership angle, 3-5 hashtags, no emojis except sparingly, cite the science
- X (Twitter): 240 chars max, punchy hook + CTA, 2-3 hashtags max, no filler words

Output valid JSON:
{
  "instagram": { "caption": "...", "hashtags": ["#tag1", ...] },
  "tiktok": { "caption": "...", "hashtags": ["#tag1", ...] },
  "linkedin": { "caption": "...", "hashtags": ["#tag1", ...] },
  "x": { "caption": "...", "hashtags": ["#tag1", ...] }
}

${avatarContext ? `AUDIENCE INTELLIGENCE:\n${avatarContext}` : ""}`,
          },
          {
            role: "user",
            content: `VIDEO IDEA: ${session.idea}\nPLATFORM: ${session.platform}\n\nSCRIPT SUMMARY:\n${fullScript.slice(0, 3000)}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "social_captions",
            strict: true,
            schema: {
              type: "object",
              properties: {
                instagram: { type: "object", properties: { caption: { type: "string" }, hashtags: { type: "array", items: { type: "string" } } }, required: ["caption", "hashtags"], additionalProperties: false },
                tiktok: { type: "object", properties: { caption: { type: "string" }, hashtags: { type: "array", items: { type: "string" } } }, required: ["caption", "hashtags"], additionalProperties: false },
                linkedin: { type: "object", properties: { caption: { type: "string" }, hashtags: { type: "array", items: { type: "string" } } }, required: ["caption", "hashtags"], additionalProperties: false },
                x: { type: "object", properties: { caption: { type: "string" }, hashtags: { type: "array", items: { type: "string" } } }, required: ["caption", "hashtags"], additionalProperties: false },
              },
              required: ["instagram", "tiktok", "linkedin", "x"],
              additionalProperties: false,
            },
          },
        } as any,
      });

      const raw = String(response.choices?.[0]?.message?.content ?? "{}");
      const captions = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim());
      return captions as {
        instagram: { caption: string; hashtags: string[] };
        tiktok: { caption: string; hashtags: string[] };
        linkedin: { caption: string; hashtags: string[] };
        x: { caption: string; hashtags: string[] };
      };
    }),

  // ─── Publish Package: Generate Blog from Script ──────────────────────────────
  generateBlogFromScript: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const session = await getSessionOrThrow(input.sessionId, ctx.user.openId);
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const scripts = await db
        .select()
        .from(sessionScripts)
        .where(eq(sessionScripts.sessionId, input.sessionId));
      const approvedHooks = scripts.filter(s => s.scriptType === "hook" && s.approved).map(s => s.scriptText);
      const body = scripts.find(s => s.scriptType === "body")?.scriptText ?? "";
      const cta = scripts.find(s => s.scriptType === "cta")?.scriptText ?? "";
      const fullScript = [...approvedHooks, body, cta].join("\n\n");

      if (!fullScript.trim()) throw new Error("No approved scripts found in this session");

      // Delegate to the existing blog generation procedure via direct LLM call
      const { getAvatarContextBlock } = await import("./avatarRouter");
      const avatarContext = await getAvatarContextBlock(session.idea).catch(() => "");

      const { contentItems } = await import("../drizzle/schema");

      // Generate blog post from the script
      const blogResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a content writer for The Urban Monk (Dr. Pedram Shojai). Convert a video script into a full SEO-optimized blog post.

Rules:
- 800-1200 words
- Use H2 and H3 subheadings (markdown format)
- Write in second person (you/your)
- Expand on the script — add context, research references, and practical steps not in the script
- Do NOT include hashtags
- End with a soft CTA to the Urban Monk Academy or Upstream program
- Include a meta description (155 chars max) at the very top in format: META: [description]

${avatarContext ? `AUDIENCE INTELLIGENCE:\n${avatarContext}` : ""}`,
          },
          {
            role: "user",
            content: `VIDEO IDEA: ${session.idea}\n\nVIDEO SCRIPT:\n${fullScript.slice(0, 5000)}`,
          },
        ],
      });

      const blogContent = String(blogResponse.choices?.[0]?.message?.content ?? "").trim();
      const metaMatch = blogContent.match(/^META:\s*(.+)/m);
      const metaDescription = metaMatch ? metaMatch[1].trim() : "";
      const cleanContent = blogContent.replace(/^META:\s*.+\n?/m, "").trim();

      // Extract a title from the first H1 or H2 line
      const titleMatch = cleanContent.match(/^#{1,2}\s+(.+)/m);
      const blogTitle = titleMatch ? titleMatch[1].trim() : session.idea;

      // Save to content_items as a draft blog post
      const [inserted] = await db.insert(contentItems).values({
        userId: ctx.user.id,
        platform: "blog",
        title: blogTitle,
        content: cleanContent,
        metaDescription,
        focusKeyword: session.idea,
        status: "drafting",
        sourceType: "video_script",
      } as any);

      return {
        contentItemId: (inserted as any)?.insertId ?? null,
        title: blogTitle,
        preview: cleanContent.slice(0, 300),
      };
    }),
});

