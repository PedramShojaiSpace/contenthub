import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { redditPersonas, redditWarmupTasks, redditPostQueue, contentItems } from "../drizzle/schema";
import { eq, and, desc, asc, lte, isNull } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

// ─── Target subreddits for Urban Monk content ────────────────────────────────
const TARGET_SUBREDDITS = [
  "Biohackers",
  "Nootropics",
  "Meditation",
  "longevity",
  "FunctionalMedicine",
  "Microbiome",
  "Ayurveda",
  "HealthyFood",
  "yoga",
  "intermittentfasting",
  "sleep",
  "guthealth",
  "alternativehealth",
  "HolisticHealth",
];

// ─── Warmup task distribution across 30 days ─────────────────────────────────
// Days 1-7: only upvoting + commenting
// Days 8-20: add question posts
// Days 21-30: add non-UM article shares
function getTaskTypeForDay(day: number): "upvote_session" | "comment" | "question_post" | "non_um_share" {
  if (day <= 7) return day % 2 === 0 ? "comment" : "upvote_session";
  if (day <= 20) return day % 3 === 0 ? "question_post" : day % 2 === 0 ? "comment" : "upvote_session";
  return day % 4 === 0 ? "non_um_share" : day % 2 === 0 ? "comment" : "upvote_session";
}

// ─── Generate warmup task content via AI ─────────────────────────────────────
async function generateWarmupContent(
  taskType: string,
  subreddit: string,
  backstory: string
): Promise<{ content: string; instructions: string }> {
  const prompts: Record<string, string> = {
    upvote_session: `You are helping a Reddit persona warm up their account. Write clear instructions for an upvoting session in r/${subreddit}. The persona's backstory: ${backstory}. Output JSON with fields: "content" (empty string) and "instructions" (step-by-step instructions for the VA to spend 5-10 minutes upvoting 20-30 relevant posts in this subreddit, what to look for, what to avoid).`,
    comment: `You are helping a Reddit persona build karma through genuine community participation. Write a helpful, authentic comment that this persona would post in r/${subreddit}. The persona's backstory: ${backstory}. The comment should be 2-4 sentences, genuinely helpful, and NOT mention any brand or product. Output JSON with fields: "content" (the comment text) and "instructions" (brief instructions for the VA: find a recent post asking about [topic], post this comment, do not edit brand names in).`,
    question_post: `You are helping a Reddit persona build karma by asking genuine questions. Write a question post for r/${subreddit} that this persona would genuinely ask. The persona's backstory: ${backstory}. The question should be authentic, curious, and relevant to the subreddit topic. Output JSON with fields: "content" (the full post: first line is the title, then a blank line, then 2-3 sentences of context) and "instructions" (instructions for the VA to post this as a text post, not a link post).`,
    non_um_share: `You are helping a Reddit persona build credibility by sharing useful non-branded content. Suggest a type of article or resource this persona would share in r/${subreddit}. The persona's backstory: ${backstory}. Output JSON with fields: "content" (a suggested post title and 1-2 sentence intro the VA can use when sharing a relevant article they find) and "instructions" (instructions for the VA to find a recent, high-quality article on [topic] from a reputable source like PubMed, Healthline, or a university, and share it with this intro text).`,
  };

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a social media strategy assistant. Always respond with valid JSON only." },
        { role: "user", content: prompts[taskType] || prompts.comment },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "warmup_task",
          strict: true,
          schema: {
            type: "object",
            properties: {
              content: { type: "string" },
              instructions: { type: "string" },
            },
            required: ["content", "instructions"],
            additionalProperties: false,
          },
        },
      },
    });
    const parsed = JSON.parse(response.choices[0].message.content as string);
    return parsed;
  } catch {
    return {
      content: "",
      instructions: `Go to r/${subreddit} and perform a ${taskType} activity for 10 minutes.`,
    };
  }
}

// ─── Generate persona backstory via AI ───────────────────────────────────────
async function generatePersonaBackstory(vaName: string, slot: number): Promise<{ backstory: string; bio: string; username: string }> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "You are creating authentic Reddit persona backstories for health and wellness advocates. Always respond with valid JSON only.",
      },
      {
        role: "user",
        content: `Create a Reddit persona for a VA named ${vaName} (account #${slot}). This persona is a real person who is genuinely interested in health, wellness, longevity, and ancient wisdom. They are NOT a brand account. They will occasionally share Urban Monk content because they genuinely find it valuable, and they will disclose their connection to the brand when doing so.

Generate:
1. A believable first name and last initial for the persona (NOT the VA's real name)
2. A backstory (2-3 sentences about who they are, their health journey, why they care about wellness)
3. A Reddit bio (1-2 sentences, casual, authentic)
4. A suggested Reddit username (wellness-themed, not obviously branded, e.g. "FunctionalMindset_K" or "LongevityJourney_M")

Output JSON with fields: "personaName", "backstory", "bio", "username"`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "persona_backstory",
        strict: true,
        schema: {
          type: "object",
          properties: {
            personaName: { type: "string" },
            backstory: { type: "string" },
            bio: { type: "string" },
            username: { type: "string" },
          },
          required: ["personaName", "backstory", "bio", "username"],
          additionalProperties: false,
        },
      },
    },
  });
  const parsed = JSON.parse(response.choices[0].message.content as string);
  return {
    backstory: `${parsed.personaName}: ${parsed.backstory}`,
    bio: parsed.bio,
    username: parsed.username,
  };
}

// ─── Generate post queue item via AI ─────────────────────────────────────────
async function generatePostQueueItem(
  persona: typeof redditPersonas.$inferSelect,
  contentTitle: string,
  contentUrl: string,
  contentSummary: string,
  subreddit: string
): Promise<{ postTitle: string; postBody: string; personalFraming: string; disclosureText: string }> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "You are a social media strategy assistant helping authentic community members share content they find valuable. Always respond with valid JSON only.",
      },
      {
        role: "user",
        content: `Write a Reddit post for r/${subreddit} sharing this Urban Monk article.

Persona: ${persona.backstory}
Article title: ${contentTitle}
Article URL: ${contentUrl}
Article summary: ${contentSummary}

Requirements:
- The post title should be compelling and community-focused (not "Check out this article")
- The post body should include: a 2-3 sentence personal framing ("I've been following Pedram's work for a while..."), a 2-3 sentence summary of the key insight, and the URL
- MUST include an FTC disclosure: "Disclosure: I work with The Urban Monk team and genuinely find this content valuable."
- Tone: authentic, conversational, not salesy
- Do NOT use marketing language

Output JSON with fields: "postTitle", "personalFraming", "postBody" (full post including personal framing, insight summary, URL, and disclosure), "disclosureText"`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "reddit_post",
        strict: true,
        schema: {
          type: "object",
          properties: {
            postTitle: { type: "string" },
            personalFraming: { type: "string" },
            postBody: { type: "string" },
            disclosureText: { type: "string" },
          },
          required: ["postTitle", "personalFraming", "postBody", "disclosureText"],
          additionalProperties: false,
        },
      },
    },
  });
  return JSON.parse(response.choices[0].message.content as string);
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const redditPersonaRouter = router({

  // List all personas
  listPersonas: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    return db.select().from(redditPersonas).orderBy(asc(redditPersonas.vaName), asc(redditPersonas.accountSlot));
  }),

  // Get a single persona with their warmup tasks and post queue
  getPersona: protectedProcedure
    .input(z.object({ personaId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [persona] = await db.select().from(redditPersonas).where(eq(redditPersonas.id, input.personaId));
      if (!persona) throw new Error("Persona not found");

      const warmupTasks = await db
        .select()
        .from(redditWarmupTasks)
        .where(eq(redditWarmupTasks.personaId, input.personaId))
        .orderBy(asc(redditWarmupTasks.dayNumber));

      const postQueue = await db
        .select()
        .from(redditPostQueue)
        .where(eq(redditPostQueue.personaId, input.personaId))
        .orderBy(desc(redditPostQueue.createdAt));

      return { persona, warmupTasks, postQueue };
    }),

  // Create a new persona with AI-generated backstory
  createPersona: protectedProcedure
    .input(z.object({
      vaName: z.string().min(1),
      accountSlot: z.number().min(1).max(2),
      username: z.string().optional(), // If empty, AI will suggest one
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Generate AI backstory
      const { backstory, bio, username: suggestedUsername } = await generatePersonaBackstory(input.vaName, input.accountSlot);

      const now = Date.now();
      const [result] = await db.insert(redditPersonas).values({
        vaName: input.vaName,
        accountSlot: input.accountSlot,
        username: input.username || suggestedUsername,
        backstory,
        bio,
        phase: "warmup",
        karma: 0,
        postKarma: 0,
        commentKarma: 0,
        subreddits: JSON.stringify(TARGET_SUBREDDITS.slice(0, 8)),
        createdAt: now,
        updatedAt: now,
      });

      const personaId = (result as any).insertId as number;

      // Generate 30-day warmup task schedule
      const tasks: (typeof redditWarmupTasks.$inferInsert)[] = [];
      const startDate = new Date();
      startDate.setHours(9, 0, 0, 0); // 9am local

      for (let day = 1; day <= 30; day++) {
        const taskDate = new Date(startDate);
        taskDate.setDate(startDate.getDate() + day - 1);

        const taskType = getTaskTypeForDay(day);
        const subreddit = TARGET_SUBREDDITS[(day - 1) % TARGET_SUBREDDITS.length];

        // Generate AI content for comment and question tasks (not upvote sessions)
        let content = "";
        let instructions = `Day ${day}: Spend 10-15 minutes in r/${subreddit}. `;

        if (taskType === "upvote_session") {
          instructions += `Upvote 20-30 posts that are genuinely interesting. Do not comment or post yet.`;
        } else if (taskType === "comment") {
          instructions += `Find a recent post where you can add a helpful 2-4 sentence comment. Post the comment below, or write your own if it doesn't fit.`;
          content = `[AI will generate comment content when you click "Generate Content" for this task]`;
        } else if (taskType === "question_post") {
          instructions += `Post the question below as a text post (not a link post). Edit it to feel natural if needed.`;
          content = `[AI will generate question content when you click "Generate Content" for this task]`;
        } else if (taskType === "non_um_share") {
          instructions += `Find a recent high-quality article about ${subreddit.toLowerCase()} from a reputable source (PubMed, university, major health publication). Share it with a brief intro.`;
        }

        tasks.push({
          personaId,
          taskType,
          subreddit,
          content,
          instructions,
          scheduledFor: taskDate.getTime(),
          status: "pending",
          dayNumber: day,
          createdAt: now,
        });
      }

      await db.insert(redditWarmupTasks).values(tasks);

      return { personaId, username: input.username || suggestedUsername, backstory, bio };
    }),

  // Update persona details (karma, phase, notes)
  updatePersona: protectedProcedure
    .input(z.object({
      personaId: z.number(),
      username: z.string().optional(),
      karma: z.number().optional(),
      postKarma: z.number().optional(),
      commentKarma: z.number().optional(),
      phase: z.enum(["warmup", "active", "paused", "retired"]).optional(),
      notes: z.string().optional(),
      accountCreatedAt: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { personaId, ...updates } = input;

      const updateData: Partial<typeof redditPersonas.$inferInsert> = {
        updatedAt: Date.now(),
      };
      if (updates.username !== undefined) updateData.username = updates.username;
      if (updates.karma !== undefined) updateData.karma = updates.karma;
      if (updates.postKarma !== undefined) updateData.postKarma = updates.postKarma;
      if (updates.commentKarma !== undefined) updateData.commentKarma = updates.commentKarma;
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.accountCreatedAt !== undefined) updateData.accountCreatedAt = updates.accountCreatedAt;
      if (updates.phase !== undefined) {
        updateData.phase = updates.phase;
        if (updates.phase === "active") updateData.activatedAt = Date.now();
      }

      await db.update(redditPersonas).set(updateData).where(eq(redditPersonas.id, personaId));
      return { success: true };
    }),

  // Generate AI content for a specific warmup task
  generateWarmupContent: protectedProcedure
    .input(z.object({ taskId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [task] = await db.select().from(redditWarmupTasks).where(eq(redditWarmupTasks.id, input.taskId));
      if (!task) throw new Error("Task not found");

      const [persona] = await db.select().from(redditPersonas).where(eq(redditPersonas.id, task.personaId));
      if (!persona) throw new Error("Persona not found");

      const { content, instructions } = await generateWarmupContent(
        task.taskType,
        task.subreddit,
        persona.backstory || "A health-conscious person interested in wellness and longevity."
      );

      await db.update(redditWarmupTasks)
        .set({ content, instructions })
        .where(eq(redditWarmupTasks.id, input.taskId));

      return { content, instructions };
    }),

  // Mark a warmup task as completed
  completeWarmupTask: protectedProcedure
    .input(z.object({ taskId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db.update(redditWarmupTasks)
        .set({ status: "completed", completedAt: Date.now() })
        .where(eq(redditWarmupTasks.id, input.taskId));

      // Update persona lastActivityAt
      const [task] = await db.select().from(redditWarmupTasks).where(eq(redditWarmupTasks.id, input.taskId));
      if (task) {
        await db.update(redditPersonas)
          .set({ lastActivityAt: Date.now(), updatedAt: Date.now() })
          .where(eq(redditPersonas.id, task.personaId));
      }

      return { success: true };
    }),

  // Add a content item to the post queue
  addToPostQueue: protectedProcedure
    .input(z.object({
      personaId: z.number(),
      contentItemId: z.number().optional(),
      subreddit: z.string(),
      linkUrl: z.string().optional(),
      scheduledFor: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [persona] = await db.select().from(redditPersonas).where(eq(redditPersonas.id, input.personaId));
      if (!persona) throw new Error("Persona not found");

      // Check cadence: no posts to same subreddit within 7 days
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recentPosts = await db
        .select()
        .from(redditPostQueue)
        .where(
          and(
            eq(redditPostQueue.personaId, input.personaId),
            eq(redditPostQueue.subreddit, input.subreddit),
            eq(redditPostQueue.status, "posted")
          )
        );

      const tooRecent = recentPosts.some(p => (p.postedAt || 0) > sevenDaysAgo);
      if (tooRecent) {
        throw new Error(`Cadence violation: ${persona.username} already posted to r/${input.subreddit} within the last 7 days.`);
      }

      // Get content item details if provided
      let contentTitle = "Urban Monk Article";
      let contentSummary = "";
      let contentUrl = input.linkUrl || "https://www.theurbanmonk.com";

      if (input.contentItemId) {
        const [item] = await db.select().from(contentItems).where(eq(contentItems.id, input.contentItemId));
        if (item) {
          contentTitle = item.title;
          contentSummary = (item as any).rawIdea || (item as any).generatedText || "";
          contentUrl = (item as any).publishUrl || contentUrl;
        }
      }

      // Generate AI post content
      const { postTitle, postBody, personalFraming, disclosureText } = await generatePostQueueItem(
        persona,
        contentTitle,
        contentUrl,
        contentSummary,
        input.subreddit
      );

      // Check if persona is cleared to post (active phase + karma >= 50)
      const isReady = persona.phase === "active" && persona.karma >= 50;

      const now = Date.now();
      const [result] = await db.insert(redditPostQueue).values({
        personaId: input.personaId,
        contentItemId: input.contentItemId,
        subreddit: input.subreddit,
        postTitle,
        postBody,
        linkUrl: contentUrl,
        disclosureText,
        personalFraming,
        scheduledFor: input.scheduledFor || now,
        status: isReady ? "ready" : "queued",
        createdAt: now,
        updatedAt: now,
      });

      return {
        queueItemId: (result as any).insertId,
        postTitle,
        postBody,
        isReady,
        reason: isReady ? null : persona.phase === "warmup"
          ? `Account is in warmup phase (Day ${Math.ceil((Date.now() - (persona.createdAt || now)) / 86400000)} of 30). Posts will be cleared after Day 30.`
          : `Karma too low (${persona.karma}/50 required).`,
      };
    }),

  // Mark a post queue item as posted
  markPosted: protectedProcedure
    .input(z.object({
      queueItemId: z.number(),
      redditPostUrl: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db.update(redditPostQueue)
        .set({
          status: "posted",
          postedAt: Date.now(),
          redditPostUrl: input.redditPostUrl,
          updatedAt: Date.now(),
        })
        .where(eq(redditPostQueue.id, input.queueItemId));

      return { success: true };
    }),

  // Get today's warmup tasks across all personas
  getTodaysTasks: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const tasks = await db
      .select({
        task: redditWarmupTasks,
        persona: redditPersonas,
      })
      .from(redditWarmupTasks)
      .innerJoin(redditPersonas, eq(redditWarmupTasks.personaId, redditPersonas.id))
      .where(
        and(
          lte(redditWarmupTasks.scheduledFor, todayEnd.getTime()),
          eq(redditWarmupTasks.status, "pending")
        )
      )
      .orderBy(asc(redditPersonas.vaName), asc(redditWarmupTasks.dayNumber));

    return tasks;
  }),

  // Get ready-to-post queue items
  getReadyPosts: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    return db
      .select({
        queueItem: redditPostQueue,
        persona: redditPersonas,
      })
      .from(redditPostQueue)
      .innerJoin(redditPersonas, eq(redditPostQueue.personaId, redditPersonas.id))
      .where(eq(redditPostQueue.status, "ready"))
      .orderBy(asc(redditPostQueue.scheduledFor));
  }),

  // Get dashboard summary stats
  getDashboardStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    const allPersonas = await db.select().from(redditPersonas);

    const warmupCount = allPersonas.filter(p => p.phase === "warmup").length;
    const activeCount = allPersonas.filter(p => p.phase === "active").length;
    const totalKarma = allPersonas.reduce((sum, p) => sum + (p.karma || 0), 0);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const pendingTasks = await db
      .select()
      .from(redditWarmupTasks)
      .where(
        and(
          lte(redditWarmupTasks.scheduledFor, todayStart.getTime() + 86400000),
          eq(redditWarmupTasks.status, "pending")
        )
      );

    const readyPosts = await db
      .select()
      .from(redditPostQueue)
      .where(eq(redditPostQueue.status, "ready"));

    return {
      totalPersonas: allPersonas.length,
      warmupCount,
      activeCount,
      totalKarma,
      pendingTasksToday: pendingTasks.length,
      readyToPost: readyPosts.length,
    };
  }),

  // Delete a persona
  deletePersona: protectedProcedure
    .input(z.object({ personaId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db.delete(redditWarmupTasks).where(eq(redditWarmupTasks.personaId, input.personaId));
      await db.delete(redditPostQueue).where(eq(redditPostQueue.personaId, input.personaId));
      await db.delete(redditPersonas).where(eq(redditPersonas.id, input.personaId));

      return { success: true };
    }),
});
