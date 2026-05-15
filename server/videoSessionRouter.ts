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
import { wrapLLM } from "./llmUtils";

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

async function generateScriptsFromIdea(
  idea: string,
  platform: string
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
Dr. Shojai is a Doctor of Oriental Medicine, Qigong master, NY Times bestselling author, and the founder of The Urban Monk Academy.
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
- 1 CTA (15-30 seconds, drives viewer to Urban Monk Academy at $297/year, natural and non-pushy)

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
  const parsed: GeneratedScripts = typeof raw === "string" ? JSON.parse(raw) : raw;
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [result] = await db.insert(videoProductionSessions).values({
        userId: ctx.user.openId,
        sessionName: input.sessionName,
        idea: input.idea,
        platform: input.platform,
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

      const generated = await generateScriptsFromIdea(session.idea, session.platform);

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
});
