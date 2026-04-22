import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { scripts, Script, contentItems, platformEnum, contentGoalEnum } from "../drizzle/schema";
import { eq, desc, asc } from "drizzle-orm";

// ─── Script Library Router ────────────────────────────────────────────────────

const scriptStatusValues = ["idea", "scripted", "in_production", "in_edit", "ready_to_post", "published"] as const;
const scriptTypeValues = ["video", "carousel", "blog", "email", "reel"] as const;
const platformValues = ["meta", "linkedin", "x", "youtube", "tiktok", "blog", "carousel", "all"] as const;
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
        platform: input.platform ?? "all",
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
          platform: (script.platform ?? "all") as "meta" | "linkedin" | "x" | "youtube" | "tiktok" | "blog" | "all",
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

SLIDE 10 (CTA): "Want the full protocol? The Urban Monk Academy has a complete Gut Health course with Dr. Pedram Shojai, OMD. Link in bio."

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

SLIDE 10 (CTA): "This is what we teach in the Urban Monk Academy. Join 10,000+ members learning to heal from the inside out. Link in bio."

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

SLIDE 10 (CTA): "The Urban Monk Academy has a complete Nervous System Reset program. 30 days. Real results. Link in bio."

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

SLIDE 10 (CTA): "The Urban Monk Academy teaches the complete protocol. Join us. Link in bio."

CAPTION: Stress is not just in your head. It's a physical substance that accumulates in your body until the bucket overflows. Here's the model that changed how I think about stress — and how to actually drain the bucket. 💧

#urbanmonk #cortisol #stressmanagement #burnoutrecovery #adrenalhealth #holistichealth #functionalmedicine #qigong #mindfulness #urbanmonkacademy`,
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

SLIDE 10 (CTA): "This is the kind of diagnostic wisdom we teach in the Urban Monk Academy. Ancient tools + modern testing = real answers. Link in bio."

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
});
