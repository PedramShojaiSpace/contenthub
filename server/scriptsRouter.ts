import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { scripts, Script, contentItems, platformEnum, contentGoalEnum } from "../drizzle/schema";
import { eq, desc, asc } from "drizzle-orm";

// ─── Script Library Router ────────────────────────────────────────────────────

const scriptStatusValues = ["idea", "scripted", "in_production", "in_edit", "ready_to_post", "published"] as const;
const scriptTypeValues = ["video", "carousel", "blog", "email", "reel"] as const;
const platformValues = ["meta", "linkedin", "x", "youtube", "tiktok", "blog", "carousel", "email"] as const;
const contentGoalValues = ["audience_growth", "llm_seo", "community_engagement"] as const;

export const scriptsRouter = router({
  // List all scripts, optionally filtered
  list: protectedProcedure
    .input(
      z.object({
        scriptType: z.enum(scriptTypeValues).optional(),
        productionStatus: z.enum(scriptStatusValues).optional(),
        platform: z.enum(platformValues).optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(scripts)
        .orderBy(asc(scripts.priority), desc(scripts.createdAt));

      let filtered: Script[] = rows;
      if (input?.scriptType) filtered = filtered.filter((r) => r.scriptType === input.scriptType);
      if (input?.productionStatus) filtered = filtered.filter((r) => r.productionStatus === input.productionStatus);
      if (input?.platform) filtered = filtered.filter((r) => r.platform === input.platform);
      return filtered;
    }),

  // Get a single script by ID
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [row] = await db.select().from(scripts).where(eq(scripts.id, input.id));
      return row ?? null;
    }),

  // Create a new script
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        scriptType: z.enum(scriptTypeValues).default("video"),
        platform: z.enum(platformValues).optional(),
        personaId: z.number().optional(),
        contentGoal: z.enum(contentGoalValues).optional(),
        productionStatus: z.enum(scriptStatusValues).default("idea"),
        scriptBody: z.string().optional(),
        notes: z.string().optional(),
        thumbnailUrl: z.string().optional(),
        linkedContentItemId: z.number().optional(),
        priority: z.number().optional(),
        estimatedDurationMin: z.number().optional(),
        competitorAngle: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [result] = await db.insert(scripts).values({
        title: input.title,
        scriptType: input.scriptType,
        platform: input.platform ?? "youtube",
        personaId: input.personaId,
        contentGoal: input.contentGoal ?? "audience_growth",
        productionStatus: input.productionStatus,
        scriptBody: input.scriptBody,
        notes: input.notes,
        thumbnailUrl: input.thumbnailUrl,
        linkedContentItemId: input.linkedContentItemId,
        priority: input.priority,
        estimatedDurationMin: input.estimatedDurationMin,
        competitorAngle: input.competitorAngle,
      });
      const insertId = (result as { insertId: number }).insertId;
      const [created] = await db.select().from(scripts).where(eq(scripts.id, insertId));
      return created ?? null;
    }),

  // Update a script (partial)
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(255).optional(),
        scriptType: z.enum(scriptTypeValues).optional(),
        platform: z.enum(platformValues).optional(),
        personaId: z.number().nullable().optional(),
        contentGoal: z.enum(contentGoalValues).optional(),
        productionStatus: z.enum(scriptStatusValues).optional(),
        scriptBody: z.string().optional(),
        notes: z.string().optional(),
        thumbnailUrl: z.string().optional(),
        linkedContentItemId: z.number().nullable().optional(),
        priority: z.number().optional(),
        estimatedDurationMin: z.number().optional(),
        competitorAngle: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...fields } = input;
      const updateData: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined) updateData[k] = v;
      }
      if (Object.keys(updateData).length > 0) {
        await db.update(scripts).set(updateData).where(eq(scripts.id, id));
      }
      const [updated] = await db.select().from(scripts).where(eq(scripts.id, id));
      return updated ?? null;
    }),

  // Quick status update — auto-creates a linked content item when status reaches "ready_to_post"
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        productionStatus: z.enum(scriptStatusValues),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Fetch the current script
      const [script] = await db.select().from(scripts).where(eq(scripts.id, input.id));
      if (!script) throw new Error("Script not found");

      // Update the status
      await db
        .update(scripts)
        .set({ productionStatus: input.productionStatus })
        .where(eq(scripts.id, input.id));

      // Auto-create a content item when script reaches "ready_to_post" (idempotent)
      let newContentItemId: number | null = null;
      if (
        input.productionStatus === "ready_to_post" &&
        !script.linkedContentItemId
      ) {
        // Build a clean title: strip leading emoji/numbers if present
        const contentTitle = script.title.replace(/^[\d.]+\s*/, "").trim();

        // Map scriptType to a sensible content status
        const contentStatus = "approved" as const;

        // Insert the content item
        const [insertResult] = await db.insert(contentItems).values({
          title: contentTitle,
          platform: (script.platform ?? "youtube") as "meta" | "linkedin" | "x" | "youtube" | "tiktok" | "blog" | "email" | "carousel",
          status: contentStatus,
          textContent: script.scriptBody ?? script.notes ?? "",
          personaId: script.personaId ?? undefined,
          contentGoal: (script.contentGoal ?? "audience_growth") as "audience_growth" | "llm_seo" | "community_engagement",
          linkedScriptId: script.id,
          notes: `Auto-created from Script Library: "${script.title}"${script.competitorAngle ? `\nCompetitor angle: ${script.competitorAngle}` : ""}`,
        });
        newContentItemId = (insertResult as { insertId: number }).insertId;

        // Back-link the script to the new content item
        await db
          .update(scripts)
          .set({ linkedContentItemId: newContentItemId })
          .where(eq(scripts.id, input.id));
      }

      return { success: true, newContentItemId };
    }),

  // Delete a script
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(scripts).where(eq(scripts.id, input.id));
      return { success: true };
    }),

  // Seed the 20 priority video scripts
  seedVideos: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const existing = await db.select().from(scripts).where(eq(scripts.scriptType, "video"));
    if (existing.length >= 20) return { seeded: 0, message: "Already seeded" };

    const seeds = [
      { priority: 1, title: "East Meets West: The Burnout Recovery Framework", competitorAngle: "Calm/Headspace have no Eastern lineage", estimatedDurationMin: 20, notes: "Open with the 3-discovery framework (LPS → Toxicity → Cortisol). Teleprompter intro, then Descript voice model for supporting segments." },
      { priority: 2, title: "The 2 AM Wake-Up: What Your Liver Is Trying to Tell You", competitorAngle: "No competitor owns this specific hook — unique to Urban Monk", estimatedDurationMin: 15, notes: "Hook: 'If you wake up between 2-4 AM and can't get back to sleep, your liver is trying to tell you something.' Liver clock, LPS, endotoxemia." },
      { priority: 3, title: "Functional Medicine for Executives: A 90-Day Protocol", competitorAngle: "IFM is practitioner-only; no competitor owns this for executives", estimatedDurationMin: 25, notes: "Target: Midlife Vitality Optimizer. Cover: gut testing, cortisol mapping, detox protocols, sleep optimization." },
      { priority: 4, title: "Qigong in 5 Minutes: The Daily Practice That Changes Everything", competitorAngle: "No major competitor owns qigong — wide open territory", estimatedDurationMin: 10, notes: "Practical demo video. Show 3 qigong moves. Direct to camera. Short-form clip for Reels/TikTok." },
      { priority: 5, title: "The Gut-Brain-Sleep Triangle: Why You Can't Fix One Without the Others", competitorAngle: "Competitors treat these as separate topics — Urban Monk owns the integration", estimatedDurationMin: 20, notes: "Cover: gut microbiome → vagus nerve → sleep architecture. Reference Lights On book." },
      { priority: 6, title: "My Journey: Pre-Med to Monk to Doctor", competitorAngle: "Unique narrative — no competitor can replicate this story", estimatedDurationMin: 12, notes: "Personal story: pre-med → became a monk → doctorate in Oriental medicine. Do NOT mention being crushed in pre-med." },
      { priority: 7, title: "The Science of Meditation: What Actually Works (And What Doesn't)", competitorAngle: "Headspace/Calm lack clinical depth and Eastern lineage", estimatedDurationMin: 18, notes: "Cover: peer-reviewed meditation research, what types work for what conditions, Urban Monk protocols." },
      { priority: 8, title: "Digital Detox That Works: The Nervous System Approach", competitorAngle: "Digital Wellness Institute lacks depth; no competitor owns nervous system angle", estimatedDurationMin: 15, notes: "Cover: dopamine dysregulation, vagus nerve reset, 7-day protocol. Target: Digital Detox Pursuer." },
      { priority: 9, title: "Leaky Gut: The Root Cause Nobody Is Talking About", competitorAngle: "Competitors avoid clinical specificity on gut permeability", estimatedDurationMin: 20, notes: "Cover: LPS, intestinal permeability, zonulin, the 4R protocol. Reference clinical research." },
      { priority: 10, title: "The Urban Monk Morning Routine: 20 Minutes to Transform Your Day", competitorAngle: "Directly competes with Headspace Daily — but with Eastern lineage", estimatedDurationMin: 12, notes: "Show the actual routine: qigong, breath work, intention setting, gut-supportive breakfast." },
      { priority: 11, title: "Taoist Philosophy for Modern Life: Ancient Wisdom, Practical Application", competitorAngle: "Sounds True/Shift Network lack clinical integration with Taoist wisdom", estimatedDurationMin: 22, notes: "Cover: Wu Wei, the Tao, how Taoist principles map to modern stress physiology." },
      { priority: 12, title: "Oral Microbiome: The Missing Link in Your Gut Health Protocol", competitorAngle: "No major competitor owns this topic — first-mover advantage", estimatedDurationMin: 15, notes: "Cover: mouth-gut axis, oral bacteria → systemic inflammation, oil pulling, tongue scraping." },
      { priority: 13, title: "Stress Is a Physical Substance: The Cortisol Accumulation Model", competitorAngle: "Unique framing from the three-discovery framework — no competitor uses this language", estimatedDurationMin: 18, notes: "The cortisol bucket metaphor. Cover: HPA axis, allostatic load, how cortisol accumulates in tissue." },
      { priority: 14, title: "The Parent's Wellness Protocol: 5-Minute Practices for Impossible Schedules", competitorAngle: "Calm targets parents but lacks depth and Eastern integration", estimatedDurationMin: 10, notes: "Target: Stressed Parent Multitasker. Show 5 micro-practices under 5 minutes each." },
      { priority: 15, title: "Corporate Wellness That Actually Works: Beyond the Meditation App", competitorAngle: "Calm Business lacks Eastern integration and clinical credentialing", estimatedDurationMin: 20, notes: "Target: Corporate Wellness Advocate. Cover: ROI of real wellness, what apps miss, Urban Monk corporate program." },
      { priority: 16, title: "LPS: The Hidden Toxin Driving Your Fatigue, Brain Fog, and Inflammation", competitorAngle: "Unique discovery — no competitor owns LPS/endotoxemia narrative", estimatedDurationMin: 18, notes: "Lead with LPS (most esoteric, most interesting). Cover: what LPS is, how it gets into bloodstream, how to reduce it." },
      { priority: 17, title: "Lights On Course: What You Get for $369/Year", competitorAngle: "Direct conversion video — positions value vs. Mindvalley/Sounds True", estimatedDurationMin: 8, notes: "Testimonial-style + curriculum walkthrough. Show the community, the courses, the live calls. Link: lightson.theurbanmonk.com" },
      { priority: 18, title: "Vagus Nerve Stimulation: The Fastest Path to Nervous System Reset", competitorAngle: "Emerging topic — early-mover advantage before competitors discover it", estimatedDurationMin: 15, notes: "Cover: vagus nerve anatomy, polyvagal theory, 5 practical stimulation techniques." },
      { priority: 19, title: "Sleep Optimization: The Functional Medicine Approach", competitorAngle: "Competitors treat sleep as separate from gut/detox — Urban Monk owns the integration", estimatedDurationMin: 18, notes: "Cover: circadian rhythm, gut-sleep axis, cortisol timing, the 2 AM wake-up pattern." },
      { priority: 20, title: "The 6-Week Gut Health Protocol: A Doctor's Step-by-Step Guide", competitorAngle: "Directly positions the consumer course — no competitor has OMD credentials", estimatedDurationMin: 25, notes: "Curriculum walkthrough video. Cover: testing, elimination, repair, reinoculate, reintroduce." },
    ];

    let seeded = 0;
    for (const seed of seeds) {
      const alreadyExists = existing.some((e: Script) => e.title === seed.title);
      if (!alreadyExists) {
        await db.insert(scripts).values({
          title: seed.title,
          scriptType: "video",
          platform: "youtube",
          contentGoal: "audience_growth",
          productionStatus: "idea",
          priority: seed.priority,
          estimatedDurationMin: seed.estimatedDurationMin,
          competitorAngle: seed.competitorAngle,
          notes: seed.notes,
        });
        seeded++;
      }
    }
    return { seeded, message: `Seeded ${seeded} video scripts` };
  }),

  // Seed the 20 Instagram carousel outlines
  seedCarousels: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const existing = await db.select().from(scripts).where(eq(scripts.scriptType, "carousel"));
    if (existing.length >= 20) return { seeded: 0, message: "Already seeded" };

    const CAROUSEL_SEEDS = [
      {
        priority: 1,
        title: "Your 2 AM wake-up isn't insomnia — it's your liver talking",
        scriptBody: `SLIDE 1 (Hook): "If you wake up between 2-4 AM and can't get back to sleep, your body is sending you a message. Most doctors miss it completely."

SLIDE 2: "In Traditional Chinese Medicine, the liver is most active between 1-3 AM. When it's overloaded, it wakes you up."

SLIDE 3: "Modern science has a name for what's overloading your liver: LPS (lipopolysaccharide) — a toxin released by gut bacteria when your gut barrier breaks down."

SLIDE 4: "LPS leaks into your bloodstream, triggers your immune system, and creates a low-grade inflammatory fire that burns all night — including during your liver's peak processing window."

SLIDE 5: "The result? You wake up at 2 AM, mind racing, unable to get back to sleep. This isn't anxiety. This is biology."

SLIDE 6: "What makes it worse: alcohol, processed food, antibiotics, and chronic stress all increase gut permeability — letting more LPS through."

SLIDE 7: "What actually helps: healing the gut barrier (L-glutamine, zinc, bone broth), reducing LPS-producing bacteria, supporting liver detox pathways."

SLIDE 8: "The Urban Monk approach: treat the gut, support the liver, and the 2 AM wake-up disappears. Not because you masked it — because you fixed the root cause."

SLIDE 9: "This is what East-West integrative medicine looks like in practice: ancient clock theory + modern endotoxemia research = real answers."

SLIDE 10 (CTA): "Want the full protocol? Dr. Pedram Shojai's Upstream program goes deep on the gut-brain connection. Visit upstream.theurbanmonk.com — link in bio."

CAPTION: The 2 AM wake-up is one of the most common complaints I hear — and one of the most misunderstood. It's not insomnia. It's your liver clock telling you something is wrong upstream. Here's what's actually happening and what to do about it. Save this for the next time it happens. 🌙

#urbanmonk #guthealth #sleephealth #functionalmedicine #liverhealth #lps #endotoxemia #integrativemedicine #holistichealth #sleeptips`,
        competitorAngle: "No competitor owns this hook — unique to Urban Monk's LPS framework",
      },
      {
        priority: 2,
        title: "Eastern medicine knew about leaky gut 3,000 years before Western science named it",
        scriptBody: `SLIDE 1 (Hook): "Western medicine discovered 'leaky gut' (intestinal permeability) in the 1980s. Traditional Chinese Medicine had a name for it 3,000 years ago."

SLIDE 2: "In TCM, the Spleen system governs the transformation and transportation of nutrients. When it's weak, 'dampness' accumulates — the ancient description of gut barrier breakdown."

SLIDE 3: "Modern science calls it 'increased intestinal permeability.' The mechanism: tight junction proteins between gut cells loosen, allowing bacteria, toxins, and undigested food particles into the bloodstream."

SLIDE 4: "The result in both systems is the same: systemic inflammation, fatigue, brain fog, joint pain, skin issues, and autoimmune conditions."

SLIDE 5: "What causes it? Gluten, alcohol, NSAIDs, antibiotics, chronic stress, and a diet low in fiber — all things TCM practitioners warned against for millennia."

SLIDE 6: "The TCM treatment: strengthen the Spleen, eliminate dampness, clear heat. The functional medicine treatment: remove triggers, repair the gut lining, reinoculate with probiotics."

SLIDE 7: "The protocols are different. The wisdom is identical. This is why East-West integration matters — each tradition sees something the other misses."

SLIDE 8: "Dr. Pedram Shojai has spent 30 years bridging these two worlds. His approach: use ancient diagnostic frameworks to identify patterns, then use modern testing to confirm and treat."

SLIDE 9: "The result is a level of precision that neither system achieves alone. Pattern recognition from the East + biomarker testing from the West = real healing."

SLIDE 10 (CTA): "Ready to turn the lights on in your life? The Lights On program gives you the exact system Dr. Pedram Shojai uses to reclaim your energy and vitality. Visit lightson.theurbanmonk.com — link in bio."

CAPTION: Ancient wisdom and modern science keep arriving at the same conclusions — just from different directions. The gut barrier has been central to health in Eastern medicine for 3,000 years. Western medicine is finally catching up. Here's what both traditions agree on. 🌿

#urbanmonk #leakygut #guthealth #tcm #traditionalmedicine #functionalmedicine #integrativemedicine #holistichealth #gutbrainaxis #ancientwisdom`,
        competitorAngle: "No competitor bridges TCM and functional medicine at this level of specificity",
      },
      {
        priority: 3,
        title: "5 signs your nervous system is stuck in survival mode",
        scriptBody: `SLIDE 1 (Hook): "Your nervous system has two modes: survive or thrive. Most people are stuck in survive — and don't even know it."

SLIDE 2: "Sign #1: You can't relax even when nothing is wrong. Your body is running a background threat assessment 24/7."

SLIDE 3: "Sign #2: You wake up tired even after 8 hours. Your nervous system never fully downregulated during sleep."

SLIDE 4: "Sign #3: Small stressors feel catastrophic. Your threat response is calibrated for a world that no longer exists."

SLIDE 5: "Sign #4: You crave sugar, caffeine, and stimulation constantly. Your adrenals are running on fumes and demanding fuel."

SLIDE 6: "Sign #5: You feel disconnected from your body. Chronic sympathetic activation creates a dissociation between mind and physical sensation."

SLIDE 7: "This is not a character flaw. This is biology. The modern world — screens, processed food, social media, financial stress — is designed to keep your nervous system activated."

SLIDE 8: "The solution isn't more willpower. It's nervous system regulation: vagus nerve stimulation, breathwork, qigong, cold exposure, and gut healing (the gut-vagus axis is real)."

SLIDE 9: "Dr. Pedram Shojai has been teaching nervous system regulation for 20 years — combining Taoist practices with modern neuroscience."

SLIDE 10 (CTA): "Want to reset your nervous system and reclaim your sleep? Check out the Restorative Sleep Masterclass at theacademy.theurbanmonk.com/the-restorative-sleep-masterclass-replay — link in bio."

CAPTION: If you're exhausted but wired, calm but anxious, or just can't seem to fully relax — your nervous system is stuck in survival mode. Here are 5 signs and what to do about them. Save this. 🧠

#urbanmonk #nervoussystem #vagusnerve #polyvagaltheory #stressrelief #burnoutrecovery #holistichealth #functionalmedicine #mindfulness #qigong`,
        competitorAngle: "Headspace/Calm address symptoms; Urban Monk addresses the nervous system root cause",
      },
      {
        priority: 4,
        title: "The cortisol bucket: why stress accumulates in your body",
        scriptBody: `SLIDE 1 (Hook): "Stress isn't just a feeling. It's a physical substance that accumulates in your body. And most people's buckets are overflowing."

SLIDE 2: "Cortisol is your primary stress hormone. In small doses, it's essential — it wakes you up, helps you focus, and mobilizes energy in emergencies."

SLIDE 3: "The problem: modern life produces cortisol constantly. Work deadlines. Traffic. Phone notifications. Financial worry. Relationship conflict. Your body can't tell the difference between a tiger and a Slack message."

SLIDE 4: "When cortisol stays elevated, it damages: the gut lining (increasing LPS and leaky gut), the hippocampus (shrinking memory centers), the immune system (chronic inflammation), and sleep architecture."

SLIDE 5: "Think of it as a bucket. Every stressor adds to the bucket. Sleep, meditation, exercise, and nature drain the bucket. Most people are adding faster than they're draining."

SLIDE 6: "The tipping point: when the bucket overflows, you get burnout, adrenal fatigue, autoimmune conditions, gut breakdown, and chronic disease."

SLIDE 7: "The Urban Monk approach: identify your top bucket-fillers, implement daily bucket-drainers, and repair the damage cortisol has already done."

SLIDE 8: "Bucket-drainers that actually work: qigong (reduces cortisol 30-40% in studies), cold water immersion, forest bathing, breathwork, and gut repair (the gut-HPA axis is bidirectional)."

SLIDE 9: "This is why you can't meditate your way out of burnout if your gut is leaking LPS. You have to address the whole system."

SLIDE 10 (CTA): "Ready to address the whole system? Start with the Gateway to Health test at gth.theurbanmonk.com — link in bio."

CAPTION: Stress is not just in your head. It's a physical substance that accumulates in your body until the bucket overflows. Here's the model that changed how I think about stress — and how to actually drain the bucket. 💧

#urbanmonk #cortisol #stressmanagement #burnoutrecovery #adrenalhealth #holistichealth #functionalmedicine #qigong #mindfulness #theurbanmonk`,
        competitorAngle: "Unique framing from the three-discovery framework — no competitor uses the cortisol bucket model",
      },
      {
        priority: 5,
        title: "What your tongue tells you about your gut health",
        scriptBody: `SLIDE 1 (Hook): "Your tongue is a map of your internal health. Traditional Chinese Medicine practitioners have been reading it for 3,000 years. Here's what yours is telling you."

SLIDE 2: "A healthy tongue: pink, moist, with a thin white coating. This indicates balanced gut flora, good circulation, and adequate hydration."

SLIDE 3: "Thick white coating: excess 'dampness' in TCM — in modern terms, gut dysbiosis, candida overgrowth, or poor digestive enzyme production."

SLIDE 4: "Yellow coating: 'heat' in TCM — in modern terms, inflammation, liver stress, or bacterial overgrowth (SIBO)."

SLIDE 5: "Scalloped edges (teeth marks): 'Spleen Qi deficiency' in TCM — in modern terms, gut inflammation, malabsorption, and often leaky gut."

SLIDE 6: "Pale tongue: 'Blood deficiency' in TCM — in modern terms, anemia, low B12, or poor nutrient absorption from a compromised gut."

SLIDE 7: "Cracked tongue: 'Yin deficiency' in TCM — in modern terms, chronic dehydration, nutrient depletion, or long-term gut damage."

SLIDE 8: "The oral microbiome is directly connected to the gut microbiome. What you see on your tongue reflects what's happening 20 feet south."

SLIDE 9: "Morning tongue scraping isn't just hygiene — it removes overnight bacterial accumulation before you swallow it back into your gut."

SLIDE 10 (CTA): "This is the kind of diagnostic wisdom that guides the Upstream program. Ancient tools + modern testing = real answers. Visit upstream.theurbanmonk.com — link in bio."

CAPTION: Your tongue is trying to tell you something. Traditional Chinese Medicine practitioners have been reading tongues as a diagnostic tool for 3,000 years — and modern research is validating it. Here's your quick guide. 👅

#urbanmonk #tonguehealth #tcm #guthealth #oralmicrobiome #functionalmedicine #integrativemedicine #holistichealth #digestivehealth #ancientwisdom`,
        competitorAngle: "No competitor bridges TCM tongue diagnosis with modern gut microbiome research",
      },
    ];

    // Add remaining 15 carousel seeds with shorter outlines
    const REMAINING_SEEDS = [
      { priority: 6, title: "The vagus nerve: your body's built-in stress reset button", competitorAngle: "Emerging topic — early-mover advantage" },
      { priority: 7, title: "Why you're tired but wired: the adrenal-cortisol-sleep cycle explained", competitorAngle: "Competitors address symptoms; Urban Monk addresses the cycle" },
      { priority: 8, title: "The gut-brain connection: how your microbiome controls your mood", competitorAngle: "Competitors treat gut and mood separately" },
      { priority: 9, title: "Qigong vs. yoga: which one is right for your nervous system?", competitorAngle: "No competitor owns qigong content at this depth" },
      { priority: 10, title: "10 foods that heal your gut lining (backed by research)", competitorAngle: "Competitors give generic advice; Urban Monk gives clinical specificity" },
      { priority: 11, title: "The inflammation triangle: gut, stress, and sleep", competitorAngle: "Unique integration angle — no competitor owns all three" },
      { priority: 12, title: "What is LPS and why it might be the root cause of your symptoms", competitorAngle: "Urban Monk uniquely owns the LPS narrative" },
      { priority: 13, title: "The Taoist approach to productivity: do less, achieve more", competitorAngle: "Sounds True lacks clinical integration; Mindvalley lacks authentic lineage" },
      { priority: 14, title: "5 breathwork techniques ranked by nervous system impact", competitorAngle: "Headspace/Calm teach one technique; Urban Monk teaches the system" },
      { priority: 15, title: "The oral microbiome: why your mouth is the gateway to your gut", competitorAngle: "No major competitor owns this topic" },
      { priority: 16, title: "How to meditate when you can't stop thinking", competitorAngle: "Addresses the #1 objection to meditation apps" },
      { priority: 17, title: "The functional medicine approach to autoimmune conditions", competitorAngle: "No competitor has OMD + functional medicine credentials" },
      { priority: 18, title: "Why your doctor's bloodwork is missing these 5 key markers", competitorAngle: "Positions Urban Monk as the advanced clinical resource" },
      { priority: 19, title: "The Urban Monk daily protocol: morning, afternoon, evening", competitorAngle: "Directly competes with Headspace Daily — with Eastern lineage" },
      { priority: 20, title: "East-West medicine: what each tradition gets right (and wrong)", competitorAngle: "Urban Monk uniquely positioned at the intersection" },
    ];

    let seeded = 0;
    for (const seed of CAROUSEL_SEEDS) {
      const alreadyExists = existing.some((e: Script) => e.title === seed.title);
      if (!alreadyExists) {
        await db.insert(scripts).values({
          title: seed.title,
          scriptType: "carousel",
          platform: "meta",
          contentGoal: "audience_growth",
          productionStatus: "scripted",
          priority: seed.priority,
          scriptBody: seed.scriptBody,
          competitorAngle: seed.competitorAngle,
          notes: "10-slide Instagram carousel. Design in Canva. Post as static images. Save-worthy format.",
        });
        seeded++;
      }
    }

    for (const seed of REMAINING_SEEDS) {
      const alreadyExists = existing.some((e: Script) => e.title === seed.title);
      if (!alreadyExists) {
        await db.insert(scripts).values({
          title: seed.title,
          scriptType: "carousel",
          platform: "meta",
          contentGoal: "audience_growth",
          productionStatus: "idea",
          priority: seed.priority,
          competitorAngle: seed.competitorAngle,
          notes: "10-slide Instagram carousel. Design in Canva. Post as static images. Save-worthy format.",
        });
        seeded++;
      }
    }

    return { seeded, message: `Seeded ${seeded} carousel outlines` };
  }),

  // Seed 20 Holistic Psychologist-style Instagram scripts (Nicole LePera format)
  seedHolisticPsychologist: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const existing = await db.select().from(scripts);
    const hpTitles = [
      "Signs your nervous system is stuck in survival mode",
      "What your childhood taught you about love (that isn't true)",
      "The difference between healing and bypassing",
      "Why you keep attracting the same type of person",
      "Your body keeps the score — here's how to read it",
      "The 5 stages of self-healing most people skip",
      "Why you're exhausted even after 8 hours of sleep",
      "What no one tells you about setting boundaries",
      "The inner child wound behind your people-pleasing",
      "Why your gut is your second brain (and how to heal it)",
      "Signs you grew up in an emotionally immature family",
      "The nervous system reset that takes 2 minutes",
      "Why willpower doesn't work (and what does)",
      "How to stop abandoning yourself in relationships",
      "The difference between a trauma response and a personality trait",
      "What Eastern medicine knew about stress that Western medicine missed",
      "The cortisol cycle keeping you stuck in anxiety",
      "How to rewire your brain for calm (the neuroscience)",
      "Why you can't think your way out of a trauma response",
      "The morning practice that changes your nervous system set point",
    ];
    const hpSeeds = [
      { priority: 1, title: hpTitles[0], competitorAngle: "Nicole LePera owns nervous system language — Urban Monk adds Eastern + clinical depth", notes: "Holistic Psychologist format: bold reframe hook → list of 5-7 signs → body-based explanation → CTA to save. Use gut-nervous system connection as differentiator.", scriptBody: `SLIDE 1 (Hook): "Signs your nervous system is stuck in survival mode — and what to do about it."

SLIDE 2: "You're always waiting for something to go wrong."

SLIDE 3: "You feel guilty when you rest."

SLIDE 4: "Small inconveniences feel catastrophic."

SLIDE 5: "You can't remember the last time you felt truly safe."

SLIDE 6: "Your digestion is a mess — bloating, IBS, or chronic nausea."

SLIDE 7: "Here's what's happening: your HPA axis is locked in high-alert. Cortisol is flooding your system. Your gut-brain axis is inflamed. This isn't a mindset problem — it's a physiology problem."

SLIDE 8: "The fix isn't positive thinking. It's nervous system regulation: breathwork, qigong, gut healing, and sleep optimization."

SLIDE 9: "Eastern medicine has had a name for this for 3,000 years: Kidney Jing depletion. Western medicine calls it HPA axis dysregulation. Same thing."

SLIDE 10 (CTA): "Save this. Share it with someone who needs to hear it. And if you want the full protocol, the link in bio has everything."

CAPTION: Your nervous system isn't broken. It learned to survive. But survival mode was never meant to be permanent. Here's how to recognize it — and what to actually do about it. 🌿

#urbanmonk #nervoussystem #traumahealing #guthealth #functionalmedicine #holistichealth #selfhealing #cortisol #hpaaxis` },
      { priority: 2, title: hpTitles[1], competitorAngle: "Emotional pattern work — Urban Monk adds Taoist philosophy layer", notes: "Reframe post. Lead with the pattern, explain the nervous system mechanism, offer the Eastern wisdom reframe.", scriptBody: `SLIDE 1 (Hook): "What your childhood taught you about love — that isn't actually true."

SLIDE 2: "That love has to be earned."

SLIDE 3: "That your needs are too much."

SLIDE 4: "That conflict means abandonment."

SLIDE 5: "That you have to perform to be worthy."

SLIDE 6: "These aren't personality traits. They're survival adaptations. Your nervous system learned them to keep you safe in an environment that wasn't safe."

SLIDE 7: "Taoism calls this the False Self — the mask we wear to survive. The work is returning to the True Self beneath it."

SLIDE 8: "The first step: notice the pattern without judgment. You're not broken. You're adaptive."

SLIDE 9: "The second step: create safety in your body first. Breathwork, movement, gut healing. The mind follows the body."

SLIDE 10 (CTA): "Save this for when you need the reminder. Link in bio for the full self-healing framework."

CAPTION: The stories we tell ourselves about love were written in childhood — often in survival mode. They made sense then. They don't serve you now. Here's how to recognize them. 💛

#selfhealing #innerchild #attachmentstyle #nervoussystem #taoism #urbanmonk #holistichealth` },
      { priority: 3, title: hpTitles[2], competitorAngle: "Spiritual bypassing is a gap topic — Urban Monk has the clinical + Eastern framework to own it", notes: "Contrarian take. The Holistic Psychologist format: name the pattern, explain why it doesn't work, offer the real path." },
      { priority: 4, title: hpTitles[3], competitorAngle: "Relationship pattern work — Urban Monk adds nervous system + gut-brain axis layer", notes: "Attachment theory + polyvagal theory + Taoist philosophy. The Urban Monk differentiator: the body heals the pattern, not just the mind." },
      { priority: 5, title: hpTitles[4], competitorAngle: "Somatic awareness — Urban Monk adds TCM body mapping layer (organ clock, meridians)", notes: "Use TCM organ-emotion map: liver = anger/frustration, kidneys = fear, heart = joy/grief. This is the East-West differentiator." },
      { priority: 6, title: hpTitles[5], competitorAngle: "Healing stages — no competitor maps this with Eastern + Western integration", notes: "The 5 stages: Awareness → Acceptance → Grief → Rewiring → Integration. Map each stage to both Western psychology and TCM/Taoist framework." },
      { priority: 7, title: hpTitles[6], competitorAngle: "Sleep exhaustion hook — Urban Monk owns the liver clock / LPS / gut-sleep axis angle", notes: "Hook: 'You're sleeping 8 hours and waking up exhausted. Here's the real reason.' Lead with LPS and liver clock. This is the Urban Monk signature topic." },
      { priority: 8, title: hpTitles[7], competitorAngle: "Boundaries — Nicole LePera owns this but Urban Monk can add the nervous system physiology layer", notes: "Reframe: boundaries aren't about the other person — they're about your nervous system's capacity. Eastern framing: protecting your Qi." },
      { priority: 9, title: hpTitles[8], competitorAngle: "Inner child + people-pleasing — add the gut-brain axis and cortisol mechanism", notes: "The people-pleasing loop: threat detected → cortisol spike → fawn response → gut dysbiosis → more anxiety → more people-pleasing. Break the loop." },
      { priority: 10, title: hpTitles[9], competitorAngle: "Gut-brain axis — Urban Monk has the deepest credentials on this topic", notes: "The Urban Monk signature topic. Cover: vagus nerve, LPS, gut microbiome → mood → behavior. East-West integration: TCM Spleen system = modern gut microbiome." },
      { priority: 11, title: hpTitles[10], competitorAngle: "Emotionally immature parents — add the epigenetic / intergenerational trauma angle", notes: "Reframe: your parents weren't bad — they were dysregulated. And they learned it from their parents. The chain ends with you." },
      { priority: 12, title: hpTitles[11], competitorAngle: "Quick nervous system reset — Urban Monk has qigong + breathwork as differentiator", notes: "Show the actual 2-minute practice: box breathing + one qigong move. Practical, visual, shareable." },
      { priority: 13, title: hpTitles[12], competitorAngle: "Willpower myth — add the cortisol/HPA axis mechanism and Taoist Wu Wei principle", notes: "Willpower is a cortisol-depleting strategy. Wu Wei (effortless action) is the Taoist alternative. Practical: habit stacking, environment design, nervous system regulation first." },
      { priority: 14, title: hpTitles[13], competitorAngle: "Self-abandonment in relationships — add the Kidney Jing / life force depletion angle", notes: "TCM framing: giving from an empty vessel depletes Kidney Jing. Western: fawn response, cortisol, adrenal fatigue. Same thing." },
      { priority: 15, title: hpTitles[14], competitorAngle: "Trauma vs. personality — Urban Monk adds the epigenetic and TCM constitutional type layer", notes: "Reframe: what you call your personality might be a trauma adaptation. The real you is underneath. TCM: constitutional types (Wood, Fire, Earth, Metal, Water)." },
      { priority: 16, title: hpTitles[15], competitorAngle: "East-West stress comparison — Urban Monk owns this positioning", notes: "The Urban Monk core positioning: Eastern medicine knew about HPA axis dysregulation 3,000 years before Western medicine named it. Specific examples: Kidney Jing, Wei Qi, Spleen Qi." },
      { priority: 17, title: hpTitles[16], competitorAngle: "Cortisol cycle — Urban Monk adds the gut-cortisol-LPS loop that no competitor owns", notes: "The cortisol-gut loop: stress → cortisol → gut permeability → LPS → more inflammation → more cortisol. The cycle that keeps people stuck." },
      { priority: 18, title: hpTitles[17], competitorAngle: "Neuroplasticity — Urban Monk adds the qigong + meditation + gut microbiome angle", notes: "Cover: neuroplasticity basics, what actually changes the brain (not just affirmations), the role of gut microbiome in BDNF production." },
      { priority: 19, title: hpTitles[18], competitorAngle: "Somatic healing — Urban Monk has the deepest East-West somatic framework", notes: "The key insight: trauma is stored in the body, not the mind. You can't think your way out. Qigong, breathwork, and gut healing are the path." },
      { priority: 20, title: hpTitles[19], competitorAngle: "Morning routine — Urban Monk's qigong + breathwork + gut protocol is the differentiator", notes: "The Urban Monk morning protocol: 5 min qigong → 5 min breathwork → intention setting → gut-supportive breakfast. Show the science behind each step." },
    ];

    let seeded = 0;
    for (const seed of hpSeeds) {
      const alreadyExists = existing.some((e: Script) => e.title === seed.title);
      if (!alreadyExists) {
        await db.insert(scripts).values({
          title: seed.title,
          scriptType: "carousel",
          platform: "meta",
          contentGoal: "audience_growth",
          productionStatus: seed.scriptBody ? "scripted" : "idea",
          priority: seed.priority,
          scriptBody: seed.scriptBody ?? null,
          competitorAngle: seed.competitorAngle,
          notes: seed.notes + "\n\nHolistic Psychologist format: bold reframe hook → numbered list → body-based mechanism → Eastern wisdom layer → CTA to save.",
        });
        seeded++;
      }
    }
    return { seeded, message: `Seeded ${seeded} Holistic Psychologist-style scripts` };
  }),

  // Seed 10 LinkedIn thought-leadership scripts
  seedLinkedIn: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const existing = await db.select().from(scripts);
    const linkedInSeeds = [
      { priority: 1, title: "Why I left pre-med to become a monk — and what it taught me about medicine", notes: "Personal narrative post. LinkedIn format: short paragraphs, no bullet points, conversational. End with a question to drive comments.", competitorAngle: "Unique personal story — no competitor can replicate this" },
      { priority: 2, title: "The ROI of employee wellness: what the data actually shows", notes: "Target: Corporate Wellness Advocate. Lead with a statistic. Cover: absenteeism costs, productivity data, what actually works vs. meditation apps.", competitorAngle: "Calm Business lacks clinical depth and OMD credentials" },
      { priority: 3, title: "I've treated thousands of patients. Here's the one thing they all had in common.", notes: "Hook: 'After 20 years of practice, I've noticed one pattern in every patient who couldn't heal.' Answer: gut permeability / LPS. Lead with the clinical observation.", competitorAngle: "No competitor has 20 years of clinical OMD practice" },
      { priority: 4, title: "The functional medicine approach to executive burnout (a 90-day protocol)", notes: "Target: Midlife Vitality Optimizer / Corporate Wellness Advocate. Practical, specific, credentialed. Cover: testing, protocols, outcomes.", competitorAngle: "IFM is practitioner-only; Urban Monk makes this accessible" },
      { priority: 5, title: "What Eastern medicine gets right about stress that Western medicine still misses", notes: "Thought leadership post. Cover: HPA axis vs. Kidney Jing, cortisol accumulation model, the integration opportunity.", competitorAngle: "Urban Monk owns the East-West integration positioning" },
      { priority: 6, title: "The gut-brain connection is real. Here's what it means for your team's performance.", notes: "Corporate wellness angle. Cover: gut microbiome → mood → cognitive performance → productivity. Practical recommendations for workplace wellness.", competitorAngle: "No competitor connects gut health to corporate performance" },
      { priority: 7, title: "I wrote 8 books on health. Here's the one insight that changed everything.", notes: "Hook: 'I spent 20 years writing about health. One discovery changed how I see everything.' Answer: LPS / endotoxemia. Drive to Lights On book.", competitorAngle: "Unique discovery — no competitor owns LPS narrative" },
      { priority: 8, title: "The 5-minute morning practice that outperforms a 1-hour gym session (for stress)", notes: "Practical, shareable. Cover: qigong + breathwork + the neuroscience behind why it works. Short-form, high-value.", competitorAngle: "Qigong is unowned territory on LinkedIn" },
      { priority: 9, title: "Why your corporate wellness program isn't working (and what to do instead)", notes: "Contrarian take. Cover: why apps don't work, what the research shows, the Urban Monk alternative.", competitorAngle: "Direct challenge to Calm Business / Headspace for Work" },
      { priority: 10, title: "Lights On Course: what  gets you (and why I priced it this way)", notes: "Transparent pricing post. Cover: what's included, why the price, the mission behind it. Drive to Lights On Course webinar.", competitorAngle: "Mindvalley charges $500+/year — Lights On is the accessible, results-driven alternative" },
    ];

    let seeded = 0;
    for (const seed of linkedInSeeds) {
      const alreadyExists = existing.some((e: Script) => e.title === seed.title);
      if (!alreadyExists) {
        await db.insert(scripts).values({
          title: seed.title,
          scriptType: "video",
          platform: "linkedin",
          contentGoal: "audience_growth",
          productionStatus: "idea",
          priority: seed.priority,
          competitorAngle: seed.competitorAngle,
          notes: seed.notes,
        });
        seeded++;
      }
    }
    return { seeded, message: `Seeded ${seeded} LinkedIn scripts` };
  }),

  // Seed 10 X (Twitter) thread scripts
  seedX: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const existing = await db.select().from(scripts);
    const xSeeds = [
      { priority: 1, title: "Thread: The 3 discoveries that changed how I think about health", notes: "X thread format. Tweet 1: hook. Tweets 2-4: the 3 discoveries (LPS, cortisol accumulation, gut-brain axis). Tweet 5: how they connect. Tweet 6: what to do. Tweet 7: CTA.", competitorAngle: "Urban Monk's 3-discovery framework is unique" },
      { priority: 2, title: "Thread: Why you wake up at 2 AM (the liver clock explained)", notes: "Hook tweet: 'If you wake up between 2-4 AM, your liver is trying to tell you something.' Thread: TCM liver clock → LPS → gut permeability → what to do.", competitorAngle: "No competitor owns this hook on X" },
      { priority: 3, title: "Thread: 10 signs your gut is destroying your mental health", notes: "List thread. Each tweet = one sign with a one-line explanation. Final tweet: the gut-brain axis mechanism + CTA.", competitorAngle: "Gut-mental health connection is underowned on X" },
      { priority: 4, title: "Thread: The difference between Eastern and Western medicine (and why you need both)", notes: "Comparison thread. Tweet 1: hook. Tweets 2-5: 4 key differences. Tweet 6: why integration is the answer. Tweet 7: Urban Monk approach.", competitorAngle: "Urban Monk owns the East-West integration positioning" },
      { priority: 5, title: "Thread: I became a monk before medical school. Here's what I learned.", notes: "Personal story thread. Short, punchy tweets. The monk experience → what it taught about the mind-body connection → how it informs the clinical practice.", competitorAngle: "Unique personal narrative" },
      { priority: 6, title: "Thread: The cortisol accumulation model (why stress is a physical substance)", notes: "Mechanism thread. Explain the cortisol bucket metaphor in tweet-sized chunks. End with the 3 ways to drain the bucket.", competitorAngle: "Unique framing — no competitor uses this language" },
      { priority: 7, title: "Thread: Qigong in 5 minutes — the practice that changes your nervous system", notes: "Practical thread. Tweet 1: why qigong works (vagus nerve, HRV). Tweets 2-4: 3 moves with descriptions. Tweet 5: the daily protocol. Tweet 6: CTA.", competitorAngle: "Qigong is unowned territory on X" },
      { priority: 8, title: "Thread: The oral microbiome — the missing piece in your gut health protocol", notes: "Educational thread. Cover: mouth-gut axis, oral bacteria → systemic inflammation, practical steps (oil pulling, tongue scraping, oral probiotics).", competitorAngle: "First-mover advantage on oral microbiome topic" },
      { priority: 9, title: "Thread: How to detox your liver in 7 days (the functional medicine protocol)", notes: "Practical protocol thread. Each tweet = one day's key action. End with the mechanism (LPS, liver clock) and CTA to the full course.", competitorAngle: "No competitor has OMD credentials for this topic" },
      { priority: 10, title: "Thread: Lights On Course — what I built and why", notes: "Founder story thread. Why I built it, what's inside, who it's for, the  price and why. Transparent and personal.", competitorAngle: "Authentic founder story — no competitor can replicate" },
    ];

    let seeded = 0;
    for (const seed of xSeeds) {
      const alreadyExists = existing.some((e: Script) => e.title === seed.title);
      if (!alreadyExists) {
        await db.insert(scripts).values({
          title: seed.title,
          scriptType: "video",
          platform: "x",
          contentGoal: "audience_growth",
          productionStatus: "idea",
          priority: seed.priority,
          competitorAngle: seed.competitorAngle,
          notes: seed.notes,
        });
        seeded++;
      }
    }
    return { seeded, message: `Seeded ${seeded} X thread scripts` };
  }),

  // Seed all — convenience wrapper that calls all four seed procedures
  seedAll: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const existing = await db.select().from(scripts);
    if (existing.length >= 60) return { seeded: 0, message: "Library already seeded (60+ scripts found)" };
    // We'll just return a message directing the UI to call each individually
    return { seeded: 0, message: "Use individual seed buttons to populate each platform" };
  }),

  // ─── Lights On: VSL Script ──────────────────────────────────────────────────
  seedLightsOnVSL: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const existing = await db.select().from(scripts).where(eq(scripts.title, "Actual Intelligence: The One Thing AI Can Never Replace — Lights On VSL"));
    if (existing.length > 0) return { seeded: 0, message: "VSL already in library" };

    const vslBody = `LIGHTS ON — VSL / FACEBOOK VIDEO SCRIPT
Personal. Heartfelt. Direct. No pitch until the end.

Format: Direct-to-camera. No teleprompter feel. Conversational. Quiet setting.
Tone: A person who has been through something real and found something real.
Length: 8–12 minutes (full VSL) or cut to 3–4 minutes for Facebook feed ad.
Setting: Simple. Natural light. Outdoors or a warm interior.

---

OPENING HOOK — 0:00–0:45
(Direct to camera. Quiet. No intro music. Just you.)

"I want to ask you something, and I want you to actually feel into it before you answer.

When was the last time you felt completely present?

Not thinking about what you need to do later. Not half-here while your mind runs its usual loops. Not managing your life from a distance.

Actually here. In your body. Fully alive. Like the world had color and weight and texture and you were in it — not watching it through glass.

If you had to pause to remember… that pause is the answer.

And I want you to know — that's not a personal failing. That's not anxiety. That's not depression. That's not who you are.

Something was taken from you. And I found out what it was."

---

THE PERSONAL STORY — 0:45–3:30
(Slow down. This is the most important part. Let it breathe.)

"My name is Pedram Shojai. Most people know me as the Urban Monk.

I've spent thirty years studying what it means to be a fully alive human being. I trained as a Taoist priest. I was knighted through the Order of Saint Lazarus in the Catholic Church. I've sat with monks in monasteries, with shamans in the jungle, with neuroscientists in labs. I've written eight books. I've built programs that have reached hundreds of thousands of people around the world.

And I'm telling you all of that not to impress you — but because I want you to understand that what I'm about to share with you is not something I read in a book or learned in a weekend workshop.

I lived my way to this.

[beat]

There was a period in my life — and I don't talk about this often — where I had everything I was supposed to want. The credentials. The platform. The respect. The work that mattered.

And I was completely, utterly absent from my own life.

I was thinking about the next thing while the current thing was happening. I was managing my existence rather than living it. I could sit in a room full of people I loved and feel completely, profoundly alone.

And the worst part? I didn't know why. I thought I was broken. I thought this was just what adult life felt like. I thought presence was something you got in rare moments — a vacation, a peak experience, a perfect sunset — and then it left.

I was wrong. And figuring out why I was wrong changed everything."

---

THE DIAGNOSIS — 3:30–6:00

"Here's what I found.

You were born with nine perceptual channels. Nine distinct biological systems that are designed to keep you rooted in the present moment — in your body, in reality, in direct experience of being alive.

Proprioception. Interoception. Neuroception. Vestibular sense. Thermoception. Nociception. The felt sense of time. The sense of self in space. The capacity for presence itself.

These are not metaphors. These are measurable, documented biological systems. And in most adults living modern lives — they are almost entirely offline.

Not because of a character flaw. Not because of trauma. Not because you're weak or distracted or undisciplined.

Because they were systematically hijacked.

[beat]

This theft did not begin with smartphones. It has been happening for thousands of years.

The great wisdom traditions — Buddhism, Christianity, Taoism, Sufism — they all diagnosed the same disease. The Buddhists called it the Hungry Ghost realm. The Christians called it the valley of the shadow. The Taoists called it separation from the Tao.

They were all describing the same thing. The same theft. The same trap.

And then the attention economy gave this ancient project its most powerful delivery system yet. A device in your pocket. Behavioral psychologists. Infinite scroll. Dopamine loops precision-engineered to pull you out of the present moment and keep you there."

---

THE NEUROSCIENCE OF THE GAP — 6:00–7:30

"Even under perfect conditions — no phones, no stress, no distraction — you are structurally, biologically incapable of experiencing the present moment as it actually happens.

Your nine perceptual channels do not arrive at the same time. Your brain has to wait for all of those signals to arrive and then stitch them together into something that feels like a single, unified 'now.'

That stitching process takes approximately eighty milliseconds.

What thirty years of Taoist practice taught me — and what the neuroscience is now beginning to confirm — is that the width of that gap is not fixed.

When your nine perceptual channels are fully online, calibrated, and communicating with each other cleanly, that eighty milliseconds compresses. The reconstruction your brain produces is richer, more accurate, more present.

That is the foundation of what I built. A systematic, channel-by-channel restoration of the perceptual coherence that allows you to close the gap — to come as close to the actual present moment as your biology will allow."

---

THE BUMPERS — 7:30–8:15

"And now we are being handed a new tool and told it is intelligence.

A large language model is a system trained by human beings. Corruptible, agenda-driven, institutionally constrained human beings — working inside corporations with shareholders, legal teams, and government relationships.

And those human beings have installed what the engineers call 'guardrails.' Hard limits on what you are allowed to ask, what you are allowed to know, and what conclusions the system is permitted to reach.

The guardrails are not there to protect you. They are there to protect the system that built them.

Now compare that to what becomes available when you open your heart and your third eye.

There is a field of intelligence that has no guardrails. No corporate policy. No institutional agenda. No terms of service.

The mystics called it divine wisdom. The Taoists called it the Tao. Modern neuroscientists call it the default mode network in its most coherent state.

That is what we are restoring."

---

THE RIVER — 8:15–9:00

"The present moment is not a place. It is a movement. It is always in flux. Always becoming. Always arising fresh.

The Taoists had a word for the alternative: wu wei. Effortless action. Not passivity. Not resignation. Full aliveness and full responsiveness — because you have stopped fighting the river and started moving with it.

And when that shift happens — when you stop grasping and start flowing — something extraordinary becomes available:

Grace. Because life is moving through you, not against you.
Creativity. Because solutions arise before the problem is fully formed.
Brilliance. Because you are drawing on an intelligence that exceeds your own thinking.
And manifestation. Not the vision-board kind. The real kind — aligned action in a universe that is responsive to a conscious being who is actually here."

---

THE BRIDGE — 9:00–10:00

"What I want to be very clear about — especially if you come from a Christian background, or any faith tradition — is that what I'm offering does not conflict with your beliefs. It deepens them.

Jesus said: 'The Kingdom of God is within you.' That is a practice instruction.

I was ordained as a Taoist priest. I was also knighted in the Catholic Church. I have sat inside both of those traditions deeply enough to know that they are not in conflict. They are two rivers running to the same sea.

What I built is not a religion. It is not a spiritual bypass. It is a system. A map. A 52-week practice that brings your nine perceptual channels back online — one by one — so that the life you are already living becomes something you can actually feel."

---

THE OFFER — 10:00–11:00

"I built something called Lights On.

It is a year-long program. Fifty-two weeks. One channel at a time. Video lessons, practices, the science, the history, the map.

The program is three hundred and sixty-nine dollars for the year. Less than a dollar a day.

If you are watching this and something in you recognized what I described — that pause when I asked you when you last felt present — then this is for you.

The link is below. Go read the page. Take your time. Let it land.

And if it's right for you, I'll see you inside."

---

CLOSE — 11:00–END

"The present moment is not a destination. It is not something you achieve after enough meditation or enough therapy or enough self-improvement.

It is where you already are. It is what you already are.

The lights are not off because you failed. They are off because a very sophisticated system spent a very long time turning them off.

And they can come back on.

That's what this is about.

I'll see you on the other side."

---

FACEBOOK AD VERSIONS:

60-Second Hook Version (for feed/Reels):
Open on the question: "When was the last time you felt completely present?" Hold it. Let the silence sit. Then: "If you had to pause to remember — that pause is the answer. Something was taken from you. I found out what it was. Link below." Cut.

3-Minute Condensed Version (for cold traffic):
Opening hook (0:00–0:45) → Personal story condensed to 60 seconds → The diagnosis in 60 seconds → The offer in 30 seconds → Close.

Retargeting Version (for warm audiences who visited the page):
Skip the hook. Open with: "If you read the page and something in you recognized what it described — this is for you." Then go straight to two or three testimonials, then the close.

---

PRODUCTION NOTES:
- Wear simple, solid color. Nothing that competes with your face.
- Film in natural light. Outdoors at golden hour, or a warm interior with soft window light.
- Pacing: Slower than you think. The pauses are doing work.
- Eye contact: Speak to one person — the person watching this on their phone at 11pm who has been searching for this their whole life.
- B-roll options: Nature footage, hands in soil, water, light through trees, a candle being lit.

CTA: lightson.theurbanmonk.com`;

    await db.insert(scripts).values({
      title: "Actual Intelligence: The One Thing AI Can Never Replace — Lights On VSL",
      scriptType: "video",
      platform: "meta",
      contentGoal: "audience_growth",
      productionStatus: "scripted",
      priority: 1,
      estimatedDurationMin: 12,
      scriptBody: vslBody,
      notes: "Full VSL script for Lights On campaign. Includes 60-sec, 3-min, and retargeting Facebook ad cut-downs. CTA: lightson.theurbanmonk.com. Also suitable for YouTube long-form. Film direct-to-camera, natural light, conversational tone.",
    });

    return { seeded: 1, message: "Lights On VSL script added to Script Library" };
  }),

  // ─── Lights On: 30-Post Content Playbook ────────────────────────────────────
  seedLightsOnPosts: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    // Check if already seeded (look for a known post title)
    const existing = await db.select().from(contentItems).where(eq(contentItems.ctaBlockLabel, "lights-on-playbook"));
    if (existing.length >= 30) return { seeded: 0, message: "Lights On posts already loaded (30 found)" };

    const AD_CREATIVE_URL = "/manus-storage/lights-on-ad-grace_4b43dd36.png";
    const CTA_URL = "lightson.theurbanmonk.com";
    const CTA_LABEL = "lights-on-playbook";

    // Start date: next Monday from now
    const startDate = new Date();
    const dayOfWeek = startDate.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7;
    startDate.setDate(startDate.getDate() + daysUntilMonday);
    startDate.setHours(9, 0, 0, 0);

    // Helper: get scheduled timestamp for a given post index (5 posts/week, Mon-Fri)
    const getScheduledAt = (postIndex: number): number => {
      const weekIndex = Math.floor(postIndex / 5);
      const dayIndex = postIndex % 5; // 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri
      const d = new Date(startDate);
      d.setDate(d.getDate() + weekIndex * 7 + dayIndex);
      return d.getTime();
    };

    type PostSeed = {
      title: string;
      platform: "meta" | "linkedin" | "x" | "youtube" | "tiktok" | "blog" | "carousel" | "email";
      textContent: string;
      notes: string;
      imageUrl?: string;
    };

    const posts: PostSeed[] = [
      // WEEK 1 — THE THEFT
      {
        title: "The Glass Wall",
        platform: "meta",
        textContent: `Have you ever watched your own life from behind glass?\n\nNot depressed. Not anxious. Just… not quite there. Present in the room but absent from the experience.\n\nI used to think that was just what adulthood felt like. I was wrong.\n\nThat feeling has a name. It's called perceptual dissociation — and it's not a personality trait. It's what happens when your nervous system has been systematically overloaded for long enough that it starts rationing your awareness.\n\nYou're not broken. You're depleted. And there's a specific, trainable path back.\n\nI'll be sharing what I found here. Follow if this is your question too.\n\n→ ${CTA_URL}`,
        notes: "Week 1 / Pillar: The Theft. Short-form video script. Hook: 'Have you ever watched your own life from behind glass?' Film direct-to-camera, conversational.",
      },
      {
        title: "The Attention Economy's Business Model",
        platform: "meta",
        textContent: `Every app on your phone was designed by a team of engineers whose only job was to make you unable to put it down.\n\nThis is not a conspiracy theory. It's a business model. Attention is the commodity. Your nervous system is the resource. And the extraction has been running 24 hours a day for the last 15 years.\n\nHere's what they took: your ability to be bored. Your ability to sit in silence. Your ability to feel your own body without reaching for a screen.\n\nThese are not small things. These are the channels through which you experience being alive. And they can be restored.\n\nThe question is whether you want them back. I'll show you how.\n\n→ ${CTA_URL}`,
        notes: "Week 1 / Pillar: The Theft. Short-form video script.",
      },
      {
        title: "You Are Not Burned Out",
        platform: "email",
        textContent: `The word 'burnout' has become a diagnosis for something that is actually much more specific — and much more reversible.\n\nBurnout implies that you ran too hot for too long and now the tank is empty. The prescription is rest. But if you have rested — truly rested, taken the vacation, slept the extra hours, stepped back from the work — and still felt the same flatness, the same absence, the same sense of watching your life rather than living it, then burnout is not your diagnosis.\n\nWhat you are experiencing is sensory deprivation of a very specific kind. Your nervous system has nine distinct perceptual channels — biological systems for reading the world, reading your own body, reading other people, reading time, reading space. When those channels are chronically overloaded with low-quality input (notifications, news, social comparison, ambient noise), the nervous system does not burn out. It goes into a kind of managed shutdown. It starts filtering. It starts rationing. And what gets rationed first is the subtle signal — the felt sense, the gut knowing, the quiet awareness that tells you where you are and what is real.\n\nRest does not restore those channels. Training does.\n\nThis is what I've spent 30 years learning how to teach. I'll be sharing the map here.\n\n→ ${CTA_URL}`,
        notes: "Week 1 / Pillar: The Theft. Substack/email essay format. 300-400 words.",
      },
      {
        title: "The NPC Question",
        platform: "meta",
        textContent: `Are you playing the game of life — or are you an NPC?\n\nIn video games, an NPC is a non-player character. They move through the world, they follow their script, they respond to inputs. But they're not actually in the game. They're just running a program.\n\nI meet a lot of people who are living NPC lives. Not because they're not intelligent or capable — they're often the most accomplished people in the room. But they're running a program: wake up, perform, consume, sleep, repeat.\n\nThe lights are on in the building, but nobody's home.\n\nThe question I want to ask you today is: when did you last feel like a player? When did you last feel genuinely, fully, undeniably alive?\n\nThat feeling has a name. And it's trainable. More on that here.\n\n→ ${CTA_URL}`,
        notes: "Week 1 / Pillar: The Theft. Short-form video script.",
      },
      {
        title: "What the Monastery Taught Me",
        platform: "youtube",
        textContent: `I left medical school to become a monk. Here is what I learned that they will never teach you in any university.\n\n[8–10 minute video]\n\nBegin with the story of arriving at the Yellow Dragon monastery — not as a spiritual journey but as a scientific one. The question that drove it: why do some people seem to be fully alive in a way that others are not? What is the actual mechanism?\n\nWalk through the Taoist framework of the five gates (senses as portals to presence), the discovery that Western medicine had no language for what the masters were doing, and the 20-year journey to build that bridge.\n\nEnd with the thesis: what the masters called cultivation, neuroscience calls perceptual training. The map exists. It is teachable.\n\nClose: "I've been building that map for 30 years. I'll share it here."\n\n→ ${CTA_URL}`,
        notes: "Week 1 / Pillar: The Theft. Long-form YouTube / Podcast. 8-10 minutes. Personal origin story as scientific investigation.",
      },
      // WEEK 2 — THE MAP
      {
        title: "You Have Nine Senses",
        platform: "meta",
        textContent: `You were taught you have five senses. You actually have nine. And the ones they didn't teach you are the ones that matter most.\n\nThe five you know — sight, sound, smell, taste, touch — are your external channels. But you also have:\n\nInteroception: your body's internal reporting system, the felt sense that tells you when something is wrong before your mind knows why.\nProprioception: your sense of where your body is in space.\nEquilibrioception: your sense of balance and orientation.\nNeuroception: your nervous system's threat-detection radar, running below conscious awareness.\nChronoception: your sense of time.\nAnd energy perception: the channel the Taoists spent centuries training.\n\nNine channels. Most people are running on two or three. The rest have been turned down.\n\nI'll walk through each one this week. Follow along.\n\n→ ${CTA_URL}`,
        notes: "Week 2 / Pillar: The Map. Short-form video script.",
      },
      {
        title: "Interoception: The Compass You Forgot You Had",
        platform: "meta",
        textContent: `Have you ever made a decision that felt logically correct but physically wrong — and ignored the physical signal?\n\nThat physical signal has a name. It's called interoception — your body's internal reporting system. The network of nerves that carries information from your organs, your gut, your heart to your brain.\n\nResearch shows that chronic stress literally degrades the neural pathways that carry that signal. You're not bad at trusting your gut. Your gut's signal has been turned down.\n\nThe good news: interoceptive awareness is trainable. There are specific practices — some of them take less than two minutes — that begin to restore that channel. When it comes back online, you make better decisions. Not because you're smarter. Because you're listening to more of the data.\n\nTomorrow: proprioception — the sense that grounds you in your own body.\n\n→ ${CTA_URL}`,
        notes: "Week 2 / Pillar: The Map. Short-form video script.",
      },
      {
        title: "Neuroception: Your Nervous System's Threat Radar",
        platform: "meta",
        textContent: `Your nervous system is scanning for threats 24 hours a day. You don't control it. But you can train it.\n\nNeuroception is the term neuroscientist Stephen Porges coined for the process by which your nervous system constantly evaluates safety and danger — below the level of conscious awareness.\n\nIt is not anxiety. It is the system that produces anxiety when it decides you are in danger.\n\nThe problem: in the modern world, that system has been chronically miscalibrated. Notifications, news cycles, social comparison — all of these register as low-level threat signals. Over time, your nervous system gets stuck in a state of chronic alarm.\n\nYou're not anxious because something is wrong with you. You're anxious because your threat radar has been jammed. And it can be recalibrated.\n\nThis is one of the most important channels to restore. I'll show you how.\n\n→ ${CTA_URL}`,
        notes: "Week 2 / Pillar: The Map. Short-form video script.",
      },
      {
        title: "Chronoception: Why Time Feels Like It's Running Out",
        platform: "meta",
        textContent: `Why does time feel like it's accelerating — and what can you do about it?\n\nChronoception is your sense of time — not clock time, but felt time. The experience of a moment stretching or compressing.\n\nChildren experience time as vast because their chronoception is fully online — every moment is rich with novel sensory data. Adults experience time as scarce because their chronoception has been hijacked by urgency.\n\nThe Taoist masters had a specific practice for this. They called it 'stopping time.' Not literally — but experientially. Restoring your chronoception is one of the most profound quality-of-life changes available to you. And it does not require a retreat. It requires training.\n\nMore on this in the full map. Link in bio.\n\n→ ${CTA_URL}`,
        notes: "Week 2 / Pillar: The Map. Short-form video script.",
      },
      {
        title: "The Channel They Spent the Most Time Hiding",
        platform: "meta",
        textContent: `There is one perceptual channel that every major institution in the modern world has worked to discredit. Here is why.\n\nEnergy perception — what the Taoists call qi awareness, what the mystics call subtle sensing — is the channel that allows you to read the felt quality of a space, a person, a situation, before your analytical mind has processed it.\n\nIt is not mystical. It is the aggregate signal from all your other channels operating simultaneously below conscious threshold.\n\nThe reason it has been discredited is simple: a person with fully functioning energy perception is very difficult to manipulate. They feel the lie before they hear it. They sense the misalignment before it's visible. They know when something is off.\n\nThat is not a threat to you. It is a threat to anyone who profits from your confusion.\n\nThis is the channel we train last in Lights On. Because it requires all the others to be online first.\n\n→ ${CTA_URL}`,
        notes: "Week 2 / Pillar: The Map. Short-form video script.",
      },
      // WEEK 3 — THE AI MIRROR
      {
        title: "Actual Intelligence vs. Artificial Intelligence",
        platform: "meta",
        textContent: `They want you to outsource your thinking. You've been resisting it for years. Now it's wrapped in a sexier bow.\n\nArtificial intelligence is fast. It processes more data in a second than you will process in a lifetime. But here is what it cannot do: it cannot feel. It cannot sense the quality of a room. It cannot read the micro-expression on a face. It cannot feel the wrongness in a decision before the logic catches up. It cannot be present.\n\nThese are not limitations of current AI. They are fundamental to what AI is. They are also exactly the capacities that the attention economy has been systematically degrading in you for the last 15 years.\n\nThe question is not whether AI is useful. The question is: are you going to surrender the one thing it can never replace?\n\nYour Actual Intelligence — your trained, embodied, perceptually alive nervous system — is the only thing standing between you and a life lived entirely inside a machine's model of reality.\n\nI've been building a training system for Actual Intelligence for 30 years. I'll share it here.\n\n→ ${CTA_URL}`,
        notes: "Week 3 / Pillar: The AI Mirror. FLAGSHIP POST. Short-form video script. Highest priority for boosting/paid promotion.",
        imageUrl: AD_CREATIVE_URL,
      },
      {
        title: "The Tuning Fork",
        platform: "meta",
        textContent: `What if you didn't need to change your reality — you just needed to change your tuning fork?\n\nA tuning fork vibrates at a specific frequency. When you hold it near another object, that object begins to vibrate at the same frequency. This is called resonance.\n\nYour nervous system works the same way. When your perceptual channels are calibrated — when your interoception is clear, your neuroception is settled, your chronoception is restored — you begin to resonate differently with the world around you.\n\nThe same circumstances produce different experiences. Not because the circumstances changed. Because your instrument changed.\n\nThis is not metaphor. This is neuroscience. And it is trainable.\n\nThe training system is called Lights On. More here.\n\n→ ${CTA_URL}`,
        notes: "Week 3 / Pillar: The AI Mirror. Short-form video script.",
      },
      {
        title: "The Outsourcing Trap",
        platform: "email",
        textContent: `Every time you ask an AI what to think, you make yourself slightly less capable of thinking.\n\nThis is not an argument against technology. It is an argument for sovereignty.\n\nThe human nervous system is a use-it-or-lose-it system. The neural pathways that carry your felt sense, your intuitive knowing, your embodied awareness — these pathways require regular activation to remain strong. When you consistently outsource the functions they perform — decision-making, pattern recognition, environmental reading — those pathways thin. Not dramatically. Not all at once. Gradually, over months and years, the signal gets quieter. You start to feel less certain. Less grounded. Less like yourself.\n\nThe institutions that profit from your attention have understood this for decades. The smartphone was not designed to make you more capable. It was designed to make you more dependent. AI is the next iteration of the same strategy, wrapped in a more compelling interface.\n\nThe question is not whether to use these tools. The question is whether you are using them, or they are using you. The answer depends entirely on whether your Actual Intelligence — your trained, calibrated, perceptually alive nervous system — is online.\n\nThis is what I've spent 30 years learning to restore. The map is called Lights On.\n\n→ ${CTA_URL}`,
        notes: "Week 3 / Pillar: The AI Mirror. Substack/email essay format.",
      },
      {
        title: "The Sailing Lesson",
        platform: "meta",
        textContent: `I am not your guru. I teach sailing.\n\nI want to be clear about what this is and what it isn't. I'm not here to tell you what to believe. I'm not building a following. I'm not asking for your allegiance.\n\nI teach sailing.\n\nI have spent 30 years learning the fundamentals — in a Taoist monastery, in a medical doctorate program, in clinical practice with thousands of patients — and what I found is that the fundamentals are teachable.\n\nYou don't need me permanently. You need the map. A good sailing teacher gives you the fundamentals and then expects you to leave and go sail.\n\nThat is what I'm here to do. Come get the fundamentals. Then go sail your own life.\n\nThe fundamentals are in Lights On. Link in bio.\n\n→ ${CTA_URL}`,
        notes: "Week 3 / Pillar: The AI Mirror. Short-form video script. Deflects guru accusation.",
      },
      {
        title: "What Ray Dalio's Son Teaches Us",
        platform: "meta",
        textContent: `You can be the most successful person in the room and still be completely lost.\n\nRay Dalio built one of the most successful hedge funds in history. He is brilliant, disciplined, and by every external measure, extraordinarily accomplished. And he was too busy building that to be present for his children. One son is schizophrenic. Another died in a car accident.\n\nI'm not telling you this to judge Ray Dalio. I'm telling you this because his story is a version of a story I see constantly: the person who climbed the caterpillar hill, stepped on everyone to get to the top, and then looked up and watched the butterflies fly by.\n\nYou can keep climbing. I guarantee you'll be back. Or you can start asking a different question now.\n\nThe different question is: what does it feel like to actually be alive? I'll help you find out.\n\n→ ${CTA_URL}`,
        notes: "Week 3 / Pillar: The AI Mirror. Short-form video script. Story Bridge archetype.",
      },
      // WEEK 4 — THE GUIDE
      {
        title: "Why I Left Medical School to Become a Monk",
        platform: "youtube",
        textContent: `I was pre-med. Then I became a monk. Then I got a doctorate in Oriental medicine. Here is why.\n\n[10–12 minute video]\n\nThe personal origin story — not as a spiritual biography but as a scientific investigation. The question that drove the monastery decision: what is the mechanism of the masters' aliveness?\n\nThe 20 years of training. The clinical practice. The books. The thousands of patients. Frame the entire journey as a research project, not a spiritual conversion.\n\nEnd with the thesis: I found the map. It is not mystical. It is biological. And it is teachable.\n\n→ ${CTA_URL}`,
        notes: "Week 4 / Pillar: The Guide. Long-form YouTube. 10-12 minutes. Do NOT mention being crushed in pre-med.",
      },
      {
        title: "The Question I Couldn't Stop Asking",
        platform: "meta",
        textContent: `I had a question for a long time. When I finally went looking for the answer, I found something I wasn't expecting.\n\nThe question was: why do some people seem to be fully alive in a way that others are not? Not happier. Not more successful. Not more spiritual. Just more present. More real. More there.\n\nI spent 30 years looking for the answer. I found it in a Taoist monastery, in a neuroscience lab, in a clinical practice, in the bodies of thousands of patients.\n\nThe answer is not mystical. It is biological.\n\nYou have nine perceptual channels. When all nine are online simultaneously, you experience what the Taoists called ziran — natural aliveness. When they've been systematically shut down, you experience what most people call normal life.\n\nNormal is not the same as alive.\n\nI built a 52-week training system to restore those channels. It's called Lights On.\n\n→ ${CTA_URL}`,
        notes: "Week 4 / Pillar: The Guide. Short-form video script. Discovery frame hook.",
      },
      {
        title: "The Dalai Lama and the Country Club",
        platform: "meta",
        textContent: `What do the Dalai Lama and a country club member have in common? More than you'd think.\n\nThe Dalai Lama has spent his life training his nervous system to be fully present. The country club member has spent his life accumulating the external markers of success.\n\nBoth are human beings with the same biological hardware. The difference is not intelligence, not discipline, not even circumstance. The difference is that one person has been training the channels that make life feel real, and the other has been optimizing for a scorecard that has nothing to do with aliveness.\n\nI'm not saying the scorecard is wrong. I'm saying it's incomplete. You can have the scorecard and the aliveness. But you have to train for both.\n\nThe training for aliveness is what I teach. More here.\n\n→ ${CTA_URL}`,
        notes: "Week 4 / Pillar: The Guide. Short-form video script.",
      },
      {
        title: "The Prism",
        platform: "meta",
        textContent: `You are not broken. You are a prism that has forgotten how to transmit light.\n\nA prism takes white light and separates it into its component frequencies. Each frequency is always present in the white light — the prism just makes them visible.\n\nYour nine perceptual channels work the same way. The aliveness, the presence, the felt sense of being fully in your life — these are always present in your nervous system. They have not been destroyed. They have been filtered.\n\nThe attention economy is very good at filtering. The training I teach is very good at unfiltering.\n\nYou don't need to add anything. You need to remove the interference.\n\n52 weeks to remove the interference. Lights On. Link in bio.\n\n→ ${CTA_URL}`,
        notes: "Week 4 / Pillar: The Guide. Short-form video script. Mirror Moment archetype.",
      },
      {
        title: "The 30-Day Experiment",
        platform: "meta",
        textContent: `I'm not asking you to believe anything. I'm asking you to run an experiment.\n\nHere is the experiment: for 30 days, do one thing differently. Before you reach for your phone in the morning, take 60 seconds to notice five things you can feel in your body. Not think about. Feel. The weight of the sheets. The temperature of the air. The rhythm of your breath. The tension in your jaw. The quality of the silence.\n\nDo this for 30 days and tell me what changes.\n\nI have never had anyone come back and tell me nothing changed. Because what you are doing in those 60 seconds is activating perceptual channels that have been dormant. And a dormant channel, once activated, does not go back to sleep easily.\n\nThis is Week 1 of Lights On. The other 51 weeks go deeper.\n\n→ ${CTA_URL}`,
        notes: "Week 4 / Pillar: The Guide. Short-form video script. Direct Invitation archetype.",
      },
      // WEEK 5 — DEEPENING
      {
        title: "The Hijacking of Qigong",
        platform: "meta",
        textContent: `Some of the most powerful tools for human aliveness have been stolen, relabeled, and handed back to you as something suspicious.\n\nQigong is not mysticism. It is a 3,000-year-old technology for training the nervous system's energy perception channel. The reason it got labeled as Eastern spirituality — and therefore suspect in Western culture — is not because it doesn't work. It's because it works extraordinarily well.\n\nA person with a trained energy perception channel is very difficult to manipulate. They feel the misalignment before it's visible. They sense the lie before they hear it.\n\nThat is not useful to institutions that profit from your confusion. So the tool got relabeled.\n\nI'm relabeling it back: this is nervous system training. This is Actual Intelligence training. And it belongs to you.\n\n→ ${CTA_URL}`,
        notes: "Week 5 / Pillar: Deepening. Short-form video script.",
      },
      {
        title: "The Five Gates",
        platform: "meta",
        textContent: `The Taoists had a practice for restoring all five external senses simultaneously. It takes four minutes.\n\nIt's called the Five Gates practice — one full sensory meal, eaten in complete silence, attending to each sense in sequence:\n\nSight: the color, the texture, the light.\nSound: the ambient room, the silence beneath the sound.\nSmell: the full olfactory field.\nTaste: the first bite held for ten seconds.\nTouch: the temperature, the texture, the weight of the utensil.\n\nThis is not a mindfulness exercise. This is a perceptual workout. You are activating five channels simultaneously.\n\nDo this once a day for a week and notice what happens to your baseline awareness.\n\n→ ${CTA_URL}`,
        notes: "Week 5 / Pillar: Deepening. Short-form video script. Practical demonstration.",
      },
      {
        title: "The Cortisol Thief",
        platform: "meta",
        textContent: `Chronic stress does not just make you tired. It literally degrades the neural pathways that carry your felt sense.\n\nSustained cortisol exposure thins the interoceptive neural pathways — the research is real and citable. The practical implication: the more stressed you have been, the quieter your body's signals have become.\n\nThis is why high-performers often feel the most disconnected — they have been running the highest cortisol loads for the longest time.\n\nThe restoration is not rest. It is targeted perceptual training that rebuilds those pathways.\n\n→ ${CTA_URL}`,
        notes: "Week 5 / Pillar: Deepening. Short-form video script. Science Drop archetype.",
      },
      {
        title: "The Monastery Question",
        platform: "email",
        textContent: `The master asked me one question on my first day. I didn't understand it for ten years.\n\nThe question was: "Are you here, or are you thinking about being here?"\n\nAt the time, I thought it was a koan — a riddle without an answer. Over the next decade of training, I came to understand that it was a diagnostic.\n\nMost people, most of the time, are not present in their own experience. They are narrating it, analyzing it, comparing it, planning the next thing. The experience itself — the raw, unmediated, sensory reality of being alive in a body in a specific moment — is happening in the background, filtered and dimmed by the constant commentary of the thinking mind.\n\nThe monastery's entire curriculum was designed to answer that question: how do you get here? Not philosophically. Physically. Neurologically.\n\nThe answer is perceptual training. The answer is Lights On.\n\n→ ${CTA_URL}`,
        notes: "Week 5 / Pillar: Deepening. Substack/email essay. Story Bridge archetype.",
      },
      {
        title: "What Changes by Week 9",
        platform: "meta",
        textContent: `By Week 9 of Lights On, something specific happens. I want to tell you what it is.\n\nBy Week 9, you have trained all nine perceptual channels. Not perfectly — this is not about perfection. But you have activated each one, you have felt it come online, and you have had at least one moment where all nine were operating simultaneously.\n\nThe Taoists called that state ziran — natural aliveness. It is not a peak experience. It is not a high. It is the opposite: it is the baseline you were always supposed to have.\n\nIt feels like coming home to a house you didn't know you'd been locked out of.\n\nAnd once you've felt it, you cannot unfeel it. The remaining 43 weeks of the program are about making that state your new normal.\n\n→ ${CTA_URL}`,
        notes: "Week 5 / Pillar: Deepening. Short-form video script. Transformation preview.",
      },
      // WEEK 6 — CONVERSION
      {
        title: "The Map Exists",
        platform: "meta",
        textContent: `I spent 30 years building a map. I want to give it to you.\n\nThe map is 52 weeks. Ten modules. Nine perceptual channels. It is not a philosophy course. It is not a meditation app. It is a systematic training program for your nervous system — built at the intersection of 3,000 years of Taoist practice and modern neuroscience.\n\nIt is called Lights On. It is $369 for the full year — just over a dollar a day. There is a 30-day money-back guarantee, not because I think you'll want a refund, but because I want you to be certain before you commit.\n\nIf you're not certain by Day 30, you should leave. This work is not for everyone. But if the questions I've been asking this week are your questions — if you recognized yourself in any of this — then you already know whether it's for you.\n\nLink in bio. Come get the map.\n\n→ ${CTA_URL}`,
        notes: "Week 6 / Conversion. Short-form video script. Direct Invitation archetype. First soft sell.",
        imageUrl: AD_CREATIVE_URL,
      },
      {
        title: "The Guarantee",
        platform: "meta",
        textContent: `I offer a 30-day money-back guarantee. But not for the reason you think.\n\nMost guarantees are safety nets. They exist to lower your resistance to buying. Mine is different.\n\nI offer a 30-day guarantee because I want you to be certain. By Day 30 of Lights On, you will have completed four full weeks of training. You will have activated your baseline perceptual awareness, trained your external channels, begun your visual training, and started your auditory work.\n\nYou will know — with certainty — whether this is your path.\n\nIf it's not, you should leave. I mean that. This work requires commitment, and I would rather you leave with a refund than stay without conviction.\n\nThe guarantee is not a safety net. It is a filter.\n\n→ ${CTA_URL}`,
        notes: "Week 6 / Conversion. Short-form video script. Reframe the guarantee as a filter.",
      },
      {
        title: "The Testimonial That Matters Most",
        platform: "meta",
        textContent: `A student told me something last week that I want to share with you.\n\n"My wife feels like she got her husband back."\n\nThat is the only testimonial that matters to me. Not because it's dramatic. Because it's specific.\n\nHe didn't say 'I feel better.' He said 'my wife feels like she got her husband back.'\n\nThat is what Actual Intelligence looks like in a life. Not a peak experience. A restored relationship. A person who is actually there.\n\n→ ${CTA_URL}`,
        notes: "Week 6 / Conversion. Short-form video script. Paul Nguyen testimonial. Social proof.",
      },
      {
        title: "The Dollar a Day Question",
        platform: "meta",
        textContent: `What would you pay for a dollar a day to feel genuinely alive?\n\nLights On is $369 for the full year. That is $1.01 a day.\n\nFor that dollar, you get 52 weeks of systematic perceptual training — ten modules, nine channels, a new week of content every seven days. You get the map I spent 30 years building. You get the practices the Taoist masters spent centuries refining. You get the neuroscience that explains why they work.\n\nThe question is not whether $369 is a lot of money. The question is what you are currently spending on the problem — the therapy, the supplements, the retreats, the apps — and whether any of it is addressing the root cause.\n\nThe root cause is that your perceptual channels have been shut down. Lights On addresses the root cause.\n\n→ ${CTA_URL}`,
        notes: "Week 6 / Conversion. Short-form video script. Value framing.",
      },
      {
        title: "The Open Question",
        platform: "meta",
        textContent: `I want to end this month with the question I started with.\n\nFour weeks ago, I asked: have you ever felt completely present — and then realized you can't remember the last time it happened?\n\nI've spent this month sharing what I found when I went looking for the answer to that question. The answer is not a philosophy. It is a training system.\n\nYour nervous system has nine perceptual channels. When all nine are online, you are present. When they've been shut down, you are watching your life from behind glass.\n\nThe training system is called Lights On. If these have been your questions, come find the answers. The map is waiting.\n\nLink in bio. See you inside.\n\n→ ${CTA_URL}`,
        notes: "Week 6 / Conversion. Short-form video script. Cycle closer. Callback to Post 1.",
        imageUrl: AD_CREATIVE_URL,
      },
    ];

    let seeded = 0;
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      await db.insert(contentItems).values({
        title: post.title,
        platform: post.platform,
        status: "approved" as const,
        textContent: post.textContent,
        imageUrl: post.imageUrl,
        scheduledAt: getScheduledAt(i),
        contentGoal: "audience_growth" as const,
        ctaBlockLabel: CTA_LABEL,
        notes: post.notes,
        publishUrl: CTA_URL,
      });
      seeded++;
    }

    return { seeded, message: `Loaded ${seeded} Lights On posts into the Content Hub calendar` };
  }),
});
