import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { kajabiLiveSessions } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

function parseCarouselSlides(json: string | null): Array<{ heading: string; body: string }> {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

export const kajabiLiveRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    const sessions = await db.select().from(kajabiLiveSessions).orderBy(desc(kajabiLiveSessions.sessionDate));
    return sessions.map(s => ({ ...s, carouselSlides: parseCarouselSlides(s.carouselSlides) }));
  }),

  get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    const [session] = await db.select().from(kajabiLiveSessions).where(eq(kajabiLiveSessions.id, input.id));
    if (!session) throw new Error("Session not found");
    return { ...session, carouselSlides: parseCarouselSlides(session.carouselSlides) };
  }),

  create: protectedProcedure.input(z.object({
    title: z.string().min(1),
    sessionDate: z.number(),
    recordingUrl: z.string().url().optional(),
    notes: z.string().optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    const now = Date.now();
    const [result] = await db.insert(kajabiLiveSessions).values({
      title: input.title, sessionDate: input.sessionDate,
      recordingUrl: input.recordingUrl ?? null, status: "uploaded",
      notes: input.notes ?? null, createdAt: now, updatedAt: now,
    });
    return { id: (result as any).insertId as number };
  }),

  saveTranscript: protectedProcedure.input(z.object({
    id: z.number(), transcript: z.string().min(50),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    await db.update(kajabiLiveSessions).set({ transcript: input.transcript, status: "clips_ready", updatedAt: Date.now() }).where(eq(kajabiLiveSessions.id, input.id));
    return { success: true };
  }),

  generateContent: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    const [session] = await db.select().from(kajabiLiveSessions).where(eq(kajabiLiveSessions.id, input.id));
    if (!session) throw new Error("Session not found");
    if (!session.transcript) throw new Error("No transcript available. Please paste the transcript first.");
    await db.update(kajabiLiveSessions).set({ status: "drafting", updatedAt: Date.now() }).where(eq(kajabiLiveSessions.id, input.id));

    const response = await invokeLLM({
      messages: [
        { role: "system", content: `You are the content strategist for Dr. Pedram Shojai (The Urban Monk). He runs weekly live calls on Kajabi. Extract the most shareable moment and generate social content that drives curiosity from non-members, demonstrates community value, and fits Pedram's voice: warm, wise, direct, grounded in ancient wisdom and modern science. Never salesy — feel like a gift.` },
        { role: "user", content: `Session: "${session.title}" on ${new Date(session.sessionDate).toLocaleDateString()}\n\nTRANSCRIPT:\n${session.transcript.slice(0, 8000)}\n\nGenerate all social content as JSON.` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "kajabi_live_content", strict: true,
          schema: {
            type: "object",
            properties: {
              bestClipStart: { type: "integer" }, bestClipEnd: { type: "integer" },
              bestClipReason: { type: "string" }, sharePostDraft: { type: "string" },
              sharePostInstagram: { type: "string" }, sharePostLinkedin: { type: "string" },
              sharePostFacebook: { type: "string" }, memberAskText: { type: "string" },
              carouselSlides: { type: "array", items: { type: "object", properties: { heading: { type: "string" }, body: { type: "string" } }, required: ["heading", "body"], additionalProperties: false } },
            },
            required: ["bestClipStart","bestClipEnd","bestClipReason","sharePostDraft","sharePostInstagram","sharePostLinkedin","sharePostFacebook","memberAskText","carouselSlides"],
            additionalProperties: false,
          },
        },
      },
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error("LLM returned no content");
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;

    await db.update(kajabiLiveSessions).set({
      bestClipStart: parsed.bestClipStart, bestClipEnd: parsed.bestClipEnd,
      bestClipReason: parsed.bestClipReason, sharePostDraft: parsed.sharePostDraft,
      sharePostInstagram: parsed.sharePostInstagram, sharePostLinkedin: parsed.sharePostLinkedin,
      sharePostFacebook: parsed.sharePostFacebook, memberAskText: parsed.memberAskText,
      carouselSlides: JSON.stringify(parsed.carouselSlides),
      status: "ready_for_review", updatedAt: Date.now(),
    }).where(eq(kajabiLiveSessions.id, input.id));

    return { ...parsed, carouselSlides: parsed.carouselSlides as Array<{ heading: string; body: string }> };
  }),

  update: protectedProcedure.input(z.object({
    id: z.number(),
    sharePostInstagram: z.string().optional(), sharePostLinkedin: z.string().optional(),
    sharePostFacebook: z.string().optional(), sharePostDraft: z.string().optional(),
    memberAskText: z.string().optional(), notes: z.string().optional(),
    status: z.enum(["uploaded","transcribing","clips_ready","drafting","ready_for_review","approved","posted"]).optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    const { id, ...fields } = input;
    const updateData: Record<string, unknown> = { updatedAt: Date.now() };
    if (fields.sharePostInstagram !== undefined) updateData.sharePostInstagram = fields.sharePostInstagram;
    if (fields.sharePostLinkedin !== undefined) updateData.sharePostLinkedin = fields.sharePostLinkedin;
    if (fields.sharePostFacebook !== undefined) updateData.sharePostFacebook = fields.sharePostFacebook;
    if (fields.sharePostDraft !== undefined) updateData.sharePostDraft = fields.sharePostDraft;
    if (fields.memberAskText !== undefined) updateData.memberAskText = fields.memberAskText;
    if (fields.notes !== undefined) updateData.notes = fields.notes;
    if (fields.status !== undefined) updateData.status = fields.status;
    await db.update(kajabiLiveSessions).set(updateData).where(eq(kajabiLiveSessions.id, id));
    return { success: true };
  }),

  approve: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    await db.update(kajabiLiveSessions).set({ status: "approved", updatedAt: Date.now() }).where(eq(kajabiLiveSessions.id, input.id));
    return { success: true };
  }),

  markPosted: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    await db.update(kajabiLiveSessions).set({ status: "posted", updatedAt: Date.now() }).where(eq(kajabiLiveSessions.id, input.id));
    return { success: true };
  }),

  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    await db.delete(kajabiLiveSessions).where(eq(kajabiLiveSessions.id, input.id));
    return { success: true };
  }),
});
