import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { kajabiLiveSessions } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { runUnderlordAgent, getJobStatus } from "./descriptClient";

function parseCarouselSlides(json: string | null): Array<{ heading: string; body: string }> {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

/**
 * The Underlord prompt that tells Descript to identify and cut the 3 best marketing reels.
 * We ask it to create separate named compositions so the VA can review them in the Descript app.
 */
const UNDERLORD_REEL_PROMPT = `You are editing a recording of a weekly live Q&A call for Dr. Pedram Shojai, known as The Urban Monk. Your task:

1. Watch the full recording and identify the 3 most compelling, shareable 60–90 second moments. Look for:
   - A powerful insight or teaching moment
   - A moment of genuine connection or humor
   - A practical tip or exercise the audience can use immediately

2. For each of the 3 moments, create a separate composition named exactly:
   - "Marketing Reel 1"
   - "Marketing Reel 2"  
   - "Marketing Reel 3"

3. For each composition:
   - Trim to the selected 60–90 second clip
   - Remove filler words (um, uh, like, you know)
   - Apply Studio Sound to enhance audio quality
   - Add captions in the default style

Do not modify the original composition. Only create the 3 new Marketing Reel compositions.`;

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
    descriptProjectId: z.string().optional(),
    notes: z.string().optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    const now = Date.now();
    // Build Descript project URL if project ID provided
    const descriptProjectUrl = input.descriptProjectId
      ? `https://web.descript.com/${input.descriptProjectId}`
      : null;
    const [result] = await db.insert(kajabiLiveSessions).values({
      title: input.title,
      sessionDate: input.sessionDate,
      descriptProjectId: input.descriptProjectId ?? null,
      descriptProjectUrl,
      status: input.descriptProjectId ? "descript_linked" : "uploaded",
      notes: input.notes ?? null,
      clipsApproved: false,
      createdAt: now,
      updatedAt: now,
    });
    return { id: (result as any).insertId as number };
  }),

  linkDescriptProject: protectedProcedure.input(z.object({
    id: z.number(),
    descriptProjectId: z.string().min(1),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    const descriptProjectUrl = `https://web.descript.com/${input.descriptProjectId}`;
    await db.update(kajabiLiveSessions).set({
      descriptProjectId: input.descriptProjectId,
      descriptProjectUrl,
      status: "descript_linked",
      updatedAt: Date.now(),
    }).where(eq(kajabiLiveSessions.id, input.id));
    return { success: true, descriptProjectUrl };
  }),

  /**
   * Fire the Underlord agent to identify and cut the 3 best marketing reels.
   * Returns immediately with a job_id — poll checkUnderlordStatus to track progress.
   */
  triggerUnderlord: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    const [session] = await db.select().from(kajabiLiveSessions).where(eq(kajabiLiveSessions.id, input.id));
    if (!session) throw new Error("Session not found");
    if (!session.descriptProjectId) throw new Error("No Descript project linked. Please add the Descript project ID first.");

    const agentResult = await runUnderlordAgent({
      projectId: session.descriptProjectId,
      prompt: UNDERLORD_REEL_PROMPT,
    });

    await db.update(kajabiLiveSessions).set({
      underlordJobId: agentResult.job_id,
      underlordStatus: "running",
      status: "underlord_running",
      updatedAt: Date.now(),
    }).where(eq(kajabiLiveSessions.id, input.id));

    return { jobId: agentResult.job_id, projectUrl: agentResult.project_url };
  }),

  /**
   * Poll the Underlord job status. Call this periodically after triggerUnderlord.
   */
  checkUnderlordStatus: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    const [session] = await db.select().from(kajabiLiveSessions).where(eq(kajabiLiveSessions.id, input.id));
    if (!session) throw new Error("Session not found");
    if (!session.underlordJobId) throw new Error("No Underlord job found for this session.");

    const jobStatus = await getJobStatus(session.underlordJobId);
    const isDone = jobStatus.job_state === "stopped";
    const isSuccess = isDone && jobStatus.result?.status === "success";
    const agentResponse = jobStatus.result?.agent_response ?? null;

    if (isDone) {
      await db.update(kajabiLiveSessions).set({
        underlordStatus: isSuccess ? "success" : "failed",
        underlordAgentResponse: agentResponse,
        status: isSuccess ? "reels_ready" : "underlord_failed",
        updatedAt: Date.now(),
      }).where(eq(kajabiLiveSessions.id, input.id));
    }

    return {
      jobState: jobStatus.job_state,
      status: jobStatus.result?.status ?? null,
      agentResponse,
      isDone,
      isSuccess,
    };
  }),

  /**
   * VA has reviewed the reels in Descript and approves them.
   * This triggers AI generation of all social content.
   */
  approveClips: protectedProcedure.input(z.object({
    id: z.number(),
    sessionSummary: z.string().optional(), // Optional: VA can add notes about what the best reel was about
  })).mutation(async ({ input }) => {
    const db = await getDb();
    const [session] = await db.select().from(kajabiLiveSessions).where(eq(kajabiLiveSessions.id, input.id));
    if (!session) throw new Error("Session not found");

    await db.update(kajabiLiveSessions).set({
      clipsApproved: true,
      status: "generating_content",
      updatedAt: Date.now(),
    }).where(eq(kajabiLiveSessions.id, input.id));

    // Generate social content based on session title + Underlord's agent response + optional summary
    const context = [
      `Session title: "${session.title}"`,
      `Date: ${new Date(session.sessionDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}`,
      session.underlordAgentResponse ? `Underlord summary of clips: ${session.underlordAgentResponse}` : null,
      input.sessionSummary ? `VA notes about the best reel: ${input.sessionSummary}` : null,
    ].filter(Boolean).join("\n");

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are the social media strategist for Dr. Pedram Shojai (The Urban Monk). He runs weekly live Q&A calls on Kajabi for his paid community. You're writing posts to share a clip from this week's call on social media.

Goals:
- Drive curiosity from non-members ("what is this community?")
- Demonstrate the value of being in the community without being salesy
- Feel like a gift — a genuine insight, not an ad
- Match Pedram's voice: warm, wise, direct, grounded in ancient wisdom and modern science

The posts should tease the content of the clip and invite people to join the community to get more.`,
        },
        {
          role: "user",
          content: `${context}\n\nGenerate all social content as JSON.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "kajabi_live_social_content",
          strict: true,
          schema: {
            type: "object",
            properties: {
              sharePostInstagram: {
                type: "string",
                description: "Instagram caption (200-300 chars, 3-5 relevant hashtags at end, casual and punchy)",
              },
              sharePostFacebook: {
                type: "string",
                description: "Facebook post (2-3 short paragraphs, conversational, ends with a question or CTA to join)",
              },
              sharePostLinkedin: {
                type: "string",
                description: "LinkedIn post (professional but personal, 150-250 words, 1-2 line hook at top)",
              },
              memberAskText: {
                type: "string",
                description: "Exact script for Pedram to read at the end of the NEXT live call — asking members to share the clip with one friend who needs it. 2-3 sentences, warm and personal.",
              },
              carouselSlides: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    heading: { type: "string" },
                    body: { type: "string" },
                  },
                  required: ["heading", "body"],
                  additionalProperties: false,
                },
                description: "5 slides for an Instagram/LinkedIn carousel based on the key teaching from this session",
              },
            },
            required: ["sharePostInstagram", "sharePostFacebook", "sharePostLinkedin", "memberAskText", "carouselSlides"],
            additionalProperties: false,
          },
        },
      },
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error("LLM returned no content");
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;

    await db.update(kajabiLiveSessions).set({
      sharePostInstagram: parsed.sharePostInstagram,
      sharePostLinkedin: parsed.sharePostLinkedin,
      sharePostFacebook: parsed.sharePostFacebook,
      memberAskText: parsed.memberAskText,
      carouselSlides: JSON.stringify(parsed.carouselSlides),
      status: "ready_for_review",
      updatedAt: Date.now(),
    }).where(eq(kajabiLiveSessions.id, input.id));

    return { ...parsed, carouselSlides: parsed.carouselSlides as Array<{ heading: string; body: string }> };
  }),

  update: protectedProcedure.input(z.object({
    id: z.number(),
    sharePostInstagram: z.string().optional(),
    sharePostLinkedin: z.string().optional(),
    sharePostFacebook: z.string().optional(),
    memberAskText: z.string().optional(),
    notes: z.string().optional(),
    status: z.enum(["uploaded", "descript_linked", "underlord_running", "underlord_failed", "reels_ready", "generating_content", "ready_for_review", "approved", "posted"]).optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    const { id, ...fields } = input;
    const updateData: Record<string, unknown> = { updatedAt: Date.now() };
    if (fields.sharePostInstagram !== undefined) updateData.sharePostInstagram = fields.sharePostInstagram;
    if (fields.sharePostLinkedin !== undefined) updateData.sharePostLinkedin = fields.sharePostLinkedin;
    if (fields.sharePostFacebook !== undefined) updateData.sharePostFacebook = fields.sharePostFacebook;
    if (fields.memberAskText !== undefined) updateData.memberAskText = fields.memberAskText;
    if (fields.notes !== undefined) updateData.notes = fields.notes;
    if (fields.status !== undefined) updateData.status = fields.status;
    await db.update(kajabiLiveSessions).set(updateData).where(eq(kajabiLiveSessions.id, id));
    return { success: true };
  }),

  approveContent: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
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
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await db.delete(kajabiLiveSessions).where(eq(kajabiLiveSessions.id, input.id));
    return { success: true };
  }),
});
