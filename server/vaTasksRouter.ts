/**
 * vaTasksRouter.ts — VA Task Hub tRPC router
 * Comprehensive outreach and traffic-building task management for Jim and VAs.
 */

import { z } from "zod";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { vaTasks } from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";

const categoryEnum = z.enum([
  "content_distribution", "seo_authority", "community_engagement",
  "influencer_outreach", "professional_outreach", "podcast_outreach",
  "reputation", "video_strategy",
]);

const channelEnum = z.enum([
  "medium", "quora", "youtube_comments", "youtube_channel",
  "seo_blog", "ai_video", "backlink", "reddit",
  "google_reviews", "amazon_reviews", "video_testimonial", "google_business",
  "substack", "title_card", "influencer_shopify", "influencer_youtube",
  "influencer_meta", "linkedin", "podcast_guest", "podcast_host",
  "doctor_burnout", "dentist", "executive", "other",
]);

const statusEnum = z.enum(["todo", "in_progress", "needs_review", "done", "blocked"]);
const priorityEnum = z.enum(["high", "medium", "low"]);

// ─── AI draft prompts per channel ────────────────────────────────────────────
const CHANNEL_PROMPTS: Record<string, (ctx: string) => string> = {
  quora: (ctx) => `You are Dr. Pedram Shojai, OMD — author, filmmaker, founder of The Urban Monk Academy.
Write a detailed expert Quora answer for: "${ctx}"
- Open with a compelling hook establishing authority
- Share a specific insight from your experience as a doctor and monk
- Provide 3-4 actionable takeaways
- End with a soft CTA to The Urban Monk Academy (no hard sell)
- Tone: warm, wise, direct — like a knowledgeable friend
- Length: 300-500 words in flowing paragraphs (no markdown headers)`,

  medium: (ctx) => `You are Dr. Pedram Shojai, OMD. Write a Medium article on: "${ctx}"
- Compelling title + subtitle
- Hook intro with personal story or surprising fact
- 3-4 sections with conversational subheadings
- Practical takeaways in each section
- Conclusion with soft CTA to The Urban Monk Academy
- Tone: thoughtful, accessible, bridges ancient wisdom with modern science
- Length: 800-1200 words`,

  reddit: (ctx) => `You are a knowledgeable community member (not a marketer) posting about: "${ctx}"
- Sound like a genuine Reddit user, NOT a marketer
- Lead with value — share a specific insight or experience
- If mentioning Pedram Shojai, do so naturally ("I came across this in Pedram Shojai's work...")
- No promotional language, no CTAs, no links unless genuinely helpful
- Length: 150-300 words for a comment; 300-500 for a post`,

  substack: (ctx) => `You are Dr. Pedram Shojai. Write a Substack newsletter issue on: "${ctx}"
- Subject line + preview text
- Personal story opening
- 2-3 key insights with depth
- "This Week's Practice": one concrete exercise readers can do today
- Warm personal sign-off + CTA to The Urban Monk Academy
- Length: 600-900 words`,

  linkedin: (ctx) => `You are Dr. Pedram Shojai, OMD. Write a LinkedIn outreach message for: "${ctx}"
- Personalized opening referencing their specific work or title
- Brief credible intro (2 sentences max)
- Clear value proposition for them
- Specific ask (30-min call, resource share, or partnership)
- Warm professional close
- Length: 150-250 words. NO generic openers.`,

  podcast_guest: (ctx) => `Write a podcast guest pitch email from Dr. Pedram Shojai to: "${ctx}"
- Subject line that gets opened
- Reference a specific episode from their show
- Brief bio: physician, filmmaker, author of 8 books including The Urban Monk and Exhausted
- 3 specific episode topic ideas with 1-sentence descriptions
- Social proof: Academy, documentary films, book sales
- Clear ask: propose a recording date range
- Length: 250-350 words`,

  doctor_burnout: (ctx) => `Write an outreach email from Dr. Pedram Shojai to a burned-out physician about: "${ctx}"
- Subject line: empathetic, resonates with physician burnout
- Opening: acknowledge the reality of physician burnout
- Intro: Dr. Pedram Shojai, OMD — former ER physician who found a different path
- Core: The Urban Monk Academy offers tools for energy management and stress resilience
- Specific offer: free module access or discovery call
- Tone: physician-to-physician, peer-level
- Length: 200-300 words`,

  dentist: (ctx) => `Write an outreach email from Dr. Pedram Shojai to a dental professional about: "${ctx}"
- Subject line relevant to dental professional wellness or oral-gut health
- Acknowledge unique stressors of dental practice
- Intro: physician and author who has studied the oral-gut-brain axis
- Connect oral health to systemic health, stress, and longevity
- Specific offer: collaboration, content partnership, or Academy access
- Tone: collegial, science-forward
- Length: 200-300 words`,

  executive: (ctx) => `Write an outreach email from Dr. Pedram Shojai to a corporate executive about: "${ctx}"
- Subject line focused on executive performance, longevity, or resilience
- Acknowledge demands of executive leadership
- Intro: physician and author who has worked with high-performers
- Core: evidence-based protocols for energy, focus, and longevity
- Specific offer: corporate wellness program, keynote, or executive retreat
- ROI framing: healthier leaders = better decisions, lower burnout
- Length: 200-300 words`,

  title_card: (ctx) => `You are a YouTube thumbnail strategist. Create 5 A/B test variations for: "${ctx}"
For each variation:
1. Title (60 chars max, front-load the hook)
2. Thumbnail concept (text overlay, image, color scheme, emotion)
3. Why it works (1 sentence — psychological trigger)
Focus on curiosity gaps, specific numbers, and emotional resonance. No clickbait.`,

  google_business: (ctx) => `Write a Google Business Profile post for The Urban Monk Academy about: "${ctx}"
- 150-300 characters
- Lead with a benefit or insight
- Clear CTA (Learn More, Book Now, or Sign Up)
- Warm approachable tone
- 1-2 relevant emoji
- 2-3 relevant hashtags`,

  video_testimonial: (ctx) => `Write a video testimonial request email for The Urban Monk Academy about: "${ctx}"
- Subject line: warm and personal, not transactional
- Thank them for being part of the community
- Ask: 60-90 second video with 3 specific guiding prompts
- Make it easy: Loom, phone, or Zoom
- Incentive: complimentary month or exclusive content
- Length: 150-250 words`,
};

const defaultPrompt = (channel: string, ctx: string) =>
  `Create a detailed VA task brief for the following ${channel} task: "${ctx}"
Provide:
1. Step-by-step instructions (numbered)
2. Key talking points and content angles
3. Tone guidelines for Dr. Pedram Shojai's brand
4. Success criteria (what does "done" look like)
5. Estimated time to complete
Be specific and actionable.`;

export const vaTasksRouter = router({
  list: protectedProcedure
    .input(z.object({
      category: categoryEnum.optional(),
      channel: channelEnum.optional(),
      status: statusEnum.optional(),
      priority: priorityEnum.optional(),
      assignee: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const conditions = [];
      if (input?.category) conditions.push(eq(vaTasks.category, input.category));
      if (input?.channel) conditions.push(eq(vaTasks.channel, input.channel));
      if (input?.status) conditions.push(eq(vaTasks.status, input.status));
      if (input?.priority) conditions.push(eq(vaTasks.priority, input.priority));
      if (input?.assignee) conditions.push(eq(vaTasks.assignee, input.assignee));
      return conditions.length > 0
        ? await db.select().from(vaTasks).where(and(...conditions)).orderBy(
            asc(sql`FIELD(${vaTasks.priority}, 'high', 'medium', 'low')`), desc(vaTasks.createdAt))
        : await db.select().from(vaTasks).orderBy(
            asc(sql`FIELD(${vaTasks.priority}, 'high', 'medium', 'low')`), desc(vaTasks.createdAt));
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const rows = await db.select().from(vaTasks).where(eq(vaTasks.id, input.id)).limit(1);
      if (!rows.length) throw new Error(`Task ${input.id} not found`);
      return rows[0];
    }),

  create: protectedProcedure
    .input(z.object({
      category: categoryEnum,
      channel: channelEnum,
      title: z.string().min(1).max(255),
      description: z.string().optional(),
      priority: priorityEnum.default("medium"),
      assignee: z.string().default("Jim"),
      dueDate: z.number().optional(),
      isRecurring: z.boolean().default(false),
      recurrenceInterval: z.string().optional(),
      sourceContentId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const now = Date.now();
      const [result] = await db.insert(vaTasks).values({
        category: input.category,
        channel: input.channel,
        title: input.title,
        description: input.description ?? null,
        priority: input.priority,
        status: "todo",
        assignee: input.assignee,
        dueDate: input.dueDate ?? null,
        isRecurring: input.isRecurring,
        recurrenceInterval: input.recurrenceInterval ?? null,
        sourceContentId: input.sourceContentId ?? null,
        createdAt: now,
        updatedAt: now,
      });
      return { id: (result as any).insertId as number, success: true };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: statusEnum.optional(),
      priority: priorityEnum.optional(),
      assignee: z.string().optional(),
      notes: z.string().optional(),
      publishedUrl: z.string().optional(),
      aiDraft: z.string().optional(),
      dueDate: z.number().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...fields } = input;
      const now = Date.now();
      const updateData: Record<string, unknown> = { updatedAt: now };
      if (fields.status !== undefined) {
        updateData.status = fields.status;
        if (fields.status === "done") updateData.completedAt = now;
      }
      if (fields.priority !== undefined) updateData.priority = fields.priority;
      if (fields.assignee !== undefined) updateData.assignee = fields.assignee;
      if (fields.notes !== undefined) updateData.notes = fields.notes;
      if (fields.publishedUrl !== undefined) updateData.publishedUrl = fields.publishedUrl;
      if (fields.aiDraft !== undefined) updateData.aiDraft = fields.aiDraft;
      if (fields.dueDate !== undefined) updateData.dueDate = fields.dueDate;
      if (fields.title !== undefined) updateData.title = fields.title;
      if (fields.description !== undefined) updateData.description = fields.description;
      await db.update(vaTasks).set(updateData).where(eq(vaTasks.id, id));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(vaTasks).where(eq(vaTasks.id, input.id));
      return { success: true };
    }),

  generateDraft: protectedProcedure
    .input(z.object({ taskId: z.number(), context: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const rows = await db.select().from(vaTasks).where(eq(vaTasks.id, input.taskId)).limit(1);
      if (!rows.length) throw new Error(`Task ${input.taskId} not found`);
      const task = rows[0];
      const promptFn = CHANNEL_PROMPTS[task.channel];
      const prompt = promptFn ? promptFn(input.context) : defaultPrompt(task.channel, input.context);
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are an expert content strategist for Dr. Pedram Shojai and The Urban Monk Academy. Produce high-quality, on-brand content that drives traffic, builds authority, and converts readers into Academy members." },
          { role: "user", content: prompt },
        ],
      });
      const rawContent = response.choices?.[0]?.message?.content;
      const draft = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent ?? "");
      await db.update(vaTasks).set({ aiDraft: draft, updatedAt: Date.now() }).where(eq(vaTasks.id, input.taskId));
      return { draft };
    }),

  seedTemplates: protectedProcedure
    .mutation(async () => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const existing = await db.select({ id: vaTasks.id }).from(vaTasks).limit(1);
      if (existing.length > 0) return { seeded: false, message: "Tasks already exist — skipping seed." };
      const now = Date.now();
      const week = now + 7 * 24 * 60 * 60 * 1000;
      const month = now + 30 * 24 * 60 * 60 * 1000;
      const templates: Array<typeof vaTasks.$inferInsert> = [
        // Content Distribution
        { category: "content_distribution", channel: "medium", priority: "high", title: "Repurpose top blog post to Medium article", description: "Take the highest-traffic blog post from theurbanmonk.com this week and adapt it for Medium. Use the AI draft tool to generate the Medium version, then publish under Dr. Pedram Shojai's Medium account. Include a canonical link back to the original post.", assignee: "Jim", isRecurring: true, recurrenceInterval: "weekly", dueDate: week, createdAt: now, updatedAt: now },
        { category: "content_distribution", channel: "quora", priority: "high", title: "Answer 3 Quora questions in health/wellness niche", description: "Search Quora for questions related to gut health, brain fog, stress, sleep, longevity, or functional medicine. Select 3 questions with 1,000+ followers. Use the AI draft tool to generate expert answers in Pedram's voice. Post answers and track URLs.", assignee: "Jim", isRecurring: true, recurrenceInterval: "weekly", dueDate: week, createdAt: now, updatedAt: now },
        { category: "content_distribution", channel: "substack", priority: "medium", title: "Cross-post newsletter to Substack", description: "After the weekly email goes out, adapt it for Substack format. Add a Substack-specific intro paragraph and publish. Tag with relevant topics. Share the Substack link in the Slack channel.", assignee: "Jim", isRecurring: true, recurrenceInterval: "weekly", dueDate: week, createdAt: now, updatedAt: now },
        { category: "content_distribution", channel: "reddit", priority: "medium", title: "Post value-add content in 2 health subreddits", description: "Target subreddits: r/longevity, r/Biohackers, r/Meditation, r/functionalmedicine, r/holistic. Find trending threads or post original content. Use the AI draft tool. Never post promotional content — lead with genuine value. Track post URLs.", assignee: "Jim", isRecurring: true, recurrenceInterval: "weekly", dueDate: week, createdAt: now, updatedAt: now },
        // SEO Authority
        { category: "seo_authority", channel: "seo_blog", priority: "high", title: "Publish 1 SEO-optimized blog post with embedded AI video", description: "Use the Blog → YouTube pipeline to create a new SEO blog post targeting a keyword from the Keyword Strategy dashboard. Embed the corresponding AI avatar video. Publish to WordPress and submit URL to Google Search Console for indexing.", assignee: "Jim", isRecurring: true, recurrenceInterval: "weekly", dueDate: week, createdAt: now, updatedAt: now },
        { category: "seo_authority", channel: "title_card", priority: "high", title: "A/B test 5 title card variations for latest YouTube video", description: "Use the AI draft tool to generate 5 title + thumbnail concept variations for the most recent YouTube upload. Present options to Pedram for selection. Upload the chosen thumbnail via YouTube Studio. Track CTR after 48 hours.", assignee: "Jim", isRecurring: true, recurrenceInterval: "weekly", dueDate: week, createdAt: now, updatedAt: now },
        { category: "seo_authority", channel: "backlink", priority: "medium", title: "Identify and outreach to 5 backlink prospects", description: "Use the Backlink Outreach tool to find 5 new high-DA prospects in the health/wellness/mindfulness space. Generate personalized outreach emails. Send and log in the Backlink Outreach tracker.", assignee: "Jim", isRecurring: true, recurrenceInterval: "weekly", dueDate: week, createdAt: now, updatedAt: now },
        // Community Engagement
        { category: "community_engagement", channel: "youtube_comments", priority: "high", title: "Respond to YouTube comments across all channels", description: "Check all Urban Monk YouTube channels for new comments. Respond to questions with substantive answers (2-3 sentences minimum). Heart and pin the best comments. Flag any negative or spam comments for review. Aim for 100% response rate on questions.", assignee: "Jim", isRecurring: true, recurrenceInterval: "weekly", dueDate: week, createdAt: now, updatedAt: now },
        { category: "community_engagement", channel: "youtube_channel", priority: "medium", title: "Organize YouTube channel playlists and descriptions", description: "Audit all YouTube channels: update channel descriptions, organize videos into themed playlists (Gut Health, Brain Health, Meditation, Longevity, etc.), ensure all videos have end screens and cards pointing to Academy. Update channel art if needed.", assignee: "Jim", isRecurring: false, dueDate: week, createdAt: now, updatedAt: now },
        { category: "community_engagement", channel: "google_business", priority: "medium", title: "Post weekly update to Google Business Profile", description: "Create a Google Business post for The Urban Monk Academy. Use the AI draft tool to generate a 150-300 character post with a CTA. Include a relevant image from the Asset Library. Post and track engagement.", assignee: "Jim", isRecurring: true, recurrenceInterval: "weekly", dueDate: week, createdAt: now, updatedAt: now },
        // Reputation
        { category: "reputation", channel: "google_reviews", priority: "high", title: "Request Google/Amazon reviews from recent customers", description: "Identify customers who completed their first 30 days in the Academy this week. Send personalized review request emails using the AI draft tool. Target: Google Business, Amazon (for books), and Trustpilot. Track responses.", assignee: "Jim", isRecurring: true, recurrenceInterval: "weekly", dueDate: week, createdAt: now, updatedAt: now },
        { category: "reputation", channel: "video_testimonial", priority: "medium", title: "Reach out to 3 long-term members for video testimonials", description: "Identify 3 Academy members who have been active for 6+ months and have shared positive feedback. Use the AI draft tool to generate personalized video testimonial request emails. Offer a complimentary month in exchange. Track responses.", assignee: "Jim", isRecurring: true, recurrenceInterval: "monthly", dueDate: month, createdAt: now, updatedAt: now },
        // Influencer Outreach
        { category: "influencer_outreach", channel: "influencer_youtube", priority: "high", title: "Identify and pitch 3 YouTube influencers for collaboration", description: "Find YouTube channels in health/wellness/mindfulness with 50K-500K subscribers. Look for alignment with Urban Monk values. Use the AI draft tool to generate personalized collaboration pitches. Track outreach in the Influencer CRM.", assignee: "Jim", isRecurring: true, recurrenceInterval: "monthly", dueDate: month, createdAt: now, updatedAt: now },
        { category: "influencer_outreach", channel: "influencer_meta", priority: "medium", title: "Identify Meta/Instagram influencers for partnership", description: "Search Instagram for health/wellness micro-influencers (10K-100K followers) with high engagement rates. Prioritize accounts focused on: functional medicine, meditation, longevity, gut health. Draft DM outreach using AI draft tool.", assignee: "Jim", isRecurring: true, recurrenceInterval: "monthly", dueDate: month, createdAt: now, updatedAt: now },
        { category: "influencer_outreach", channel: "influencer_shopify", priority: "medium", title: "Outreach to Shopify supplement/wellness store owners", description: "Find Shopify store owners in the supplement/wellness space who could cross-promote or affiliate with Urban Monk Academy. Use LinkedIn or email outreach. Propose affiliate partnership or co-marketing.", assignee: "Jim", isRecurring: true, recurrenceInterval: "monthly", dueDate: month, createdAt: now, updatedAt: now },
        // Professional Outreach
        { category: "professional_outreach", channel: "linkedin", priority: "high", title: "LinkedIn outreach to 10 executives, doctors, or dentists", description: "Use the Lead Scrubber to identify LinkedIn prospects. Target: burned-out physicians, dental professionals, and corporate executives. Use the AI draft tool to generate personalized connection requests and follow-up messages. Track in Lead Scrubber.", assignee: "Jim", isRecurring: true, recurrenceInterval: "weekly", dueDate: week, createdAt: now, updatedAt: now },
        { category: "professional_outreach", channel: "doctor_burnout", priority: "high", title: "Email campaign to physician burnout communities", description: "Identify physician burnout Facebook groups, LinkedIn groups, and forums. Research the most active members. Use the AI draft tool to create personalized outreach emails positioning The Urban Monk Academy as a resource for physician wellness.", assignee: "Jim", isRecurring: true, recurrenceInterval: "monthly", dueDate: month, createdAt: now, updatedAt: now },
        { category: "professional_outreach", channel: "dentist", priority: "medium", title: "Outreach to dental associations and dental professionals", description: "Research dental associations (ADA, state dental societies) and find contact info for wellness committee chairs. Use the AI draft tool to pitch Pedram as a speaker on oral-gut-brain health. Also target individual dentists via LinkedIn.", assignee: "Jim", isRecurring: true, recurrenceInterval: "monthly", dueDate: month, createdAt: now, updatedAt: now },
        { category: "professional_outreach", channel: "executive", priority: "medium", title: "Corporate wellness outreach to HR directors and C-suite", description: "Use Apollo or LinkedIn to find HR Directors, Chief People Officers, and C-suite executives at companies with 500+ employees. Use the AI draft tool to pitch The Urban Monk Academy corporate wellness program. Track in Lead Scrubber.", assignee: "Jim", isRecurring: true, recurrenceInterval: "monthly", dueDate: month, createdAt: now, updatedAt: now },
        // Podcast Outreach
        { category: "podcast_outreach", channel: "podcast_guest", priority: "high", title: "Pitch Pedram as guest to 5 health/wellness podcasts", description: "Research top health, longevity, and mindfulness podcasts with 10K+ listeners per episode. Use the AI draft tool to generate personalized pitch emails. Include 3 episode topic ideas per pitch. Track responses and follow up after 7 days.", assignee: "Jim", isRecurring: true, recurrenceInterval: "weekly", dueDate: week, createdAt: now, updatedAt: now },
        { category: "podcast_outreach", channel: "podcast_host", priority: "medium", title: "Book 2 guests for The Urban Monk podcast", description: "Identify potential guests for The Urban Monk podcast: doctors, researchers, authors, or practitioners in functional medicine, longevity, or mindfulness. Use the AI draft tool to generate booking outreach emails. Coordinate scheduling.", assignee: "Jim", isRecurring: true, recurrenceInterval: "monthly", dueDate: month, createdAt: now, updatedAt: now },
      ];
      await db.insert(vaTasks).values(templates);
      return { seeded: true, count: templates.length };
    }),

  stats: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      return await db.select({ status: vaTasks.status, count: sql<number>`count(*)` })
        .from(vaTasks).groupBy(vaTasks.status);
    }),
});
