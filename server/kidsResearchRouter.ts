import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { TRPCError } from "@trpc/server";

// ─── Mission Data ─────────────────────────────────────────────────────────────
// Six missions derived from Pedram's five books.
// Each mission has steps. Each step has a prompt the kid copies into Manus.

export const MISSIONS = [
  {
    id: "energy_tools",
    title: "Mission 1: Energy Tools",
    emoji: "⚡",
    bookSource: "Focus & The Urban Monk",
    description:
      "Find physical products that help people restore their energy — without caffeine, pills, or screens. Think tools that help the body recharge the way Pedram teaches.",
    steps: [
      {
        id: "step1",
        title: "Learn the mission",
        instruction:
          "Read this carefully: In his books, Pedram teaches that energy is like a bank account. Most people are overdrawn — they spend more than they earn. Your job is to find PRODUCTS (not books, not apps) that help people earn energy back. Things like: red light therapy devices, grounding mats, acupressure tools, breath trainers, or anything that helps the body recover naturally.",
        prompt: null,
        inputLabel: null,
      },
      {
        id: "step2",
        title: "Research with Manus",
        instruction:
          "Copy this prompt exactly into your Manus chat and paste what Manus tells you in the box below.",
        prompt:
          "I am researching physical wellness products for The Urban Monk brand. The Urban Monk teaches that energy is a finite resource that must be carefully managed and restored. The ideal customer is a busy professional aged 35-55 who wants to feel more alive, focused, and grounded — without relying on caffeine or medication. Please find 5 real products (with brand names, prices, and websites) that help restore physical energy through natural means — such as red light therapy, grounding/earthing mats, acupressure tools, breath training devices, or similar. For each product, tell me: the brand name, what it does, the price, the website, and why it fits The Urban Monk philosophy of sustainable energy management.",
        inputLabel: "Paste Manus's answer here:",
      },
      {
        id: "step3",
        title: "Check if they have a partnership program",
        instruction:
          "Pick your 2 favorite products from step 2. For each one, copy this prompt into Manus (replace [BRAND NAME] with the actual brand).",
        prompt:
          "Does [BRAND NAME] have an affiliate program, wholesale program, or brand partnership program? If yes, what are the commission rates or wholesale discounts? How do brands apply to partner with them? Please give me the direct URL to their affiliate or partnership page.",
        inputLabel: "Paste Manus's answer for both brands here:",
      },
      {
        id: "step4",
        title: "Write your recommendation",
        instruction:
          "Now write your own recommendation for Dad. Which ONE product do you think is the best fit for The Urban Monk store, and why? Write at least 3 sentences.",
        prompt: null,
        inputLabel: "Write your recommendation here:",
      },
    ],
  },
  {
    id: "time_tools",
    title: "Mission 2: Time & Focus Tools",
    emoji: "⏳",
    bookSource: "The Art of Stopping Time & Focus",
    description:
      "Find products that help people slow down, focus, and be more intentional with their time — the physical tools that support the practices Pedram teaches.",
    steps: [
      {
        id: "step1",
        title: "Learn the mission",
        instruction:
          "In 'The Art of Stopping Time,' Pedram teaches a 100-day practice called the Gong — a daily ritual that helps people reclaim their time and attention. In 'Focus,' he talks about how our attention is constantly stolen. Your job is to find PHYSICAL TOOLS that help people focus and be more intentional — like analog timers, journals, sand timers, focus lamps, or anything that helps someone do a daily practice without distraction.",
        prompt: null,
        inputLabel: null,
      },
      {
        id: "step2",
        title: "Research with Manus",
        instruction: "Copy this prompt into Manus and paste the answer below.",
        prompt:
          "I am researching physical focus and time-management tools for The Urban Monk brand. The Urban Monk teaches a daily practice called 'the Gong' — a 100-day commitment to a morning ritual. The ideal customer wants to slow down, be more intentional, and reduce digital distraction. Please find 5 real physical products (not apps or software) that help people focus and be more present — such as analog timers, sand hourglasses, focus candles, ritual journals, or meditation cushions. For each product, tell me: the brand name, what it does, the price, the website, and why it supports a daily mindfulness practice.",
        inputLabel: "Paste Manus's answer here:",
      },
      {
        id: "step3",
        title: "Check for partnership programs",
        instruction:
          "Pick your 2 favorites. For each one, ask Manus (replace [BRAND NAME]):",
        prompt:
          "Does [BRAND NAME] have an affiliate program, wholesale program, or brand ambassador program? What are the details and how would a wellness brand apply to partner with them?",
        inputLabel: "Paste Manus's answer for both brands here:",
      },
      {
        id: "step4",
        title: "Write your recommendation",
        instruction:
          "Which ONE product is the best fit for The Urban Monk store? Write at least 3 sentences explaining why.",
        prompt: null,
        inputLabel: "Write your recommendation here:",
      },
    ],
  },
  {
    id: "nontoxic_home",
    title: "Mission 3: Clean Home & Body",
    emoji: "🌿",
    bookSource: "Rise and Shine & The Urban Monk",
    description:
      "Find non-toxic, clean products for the home and body — things that align with Pedram's teaching that your environment is either healing you or harming you.",
    steps: [
      {
        id: "step1",
        title: "Learn the mission",
        instruction:
          "In 'Rise and Shine,' Pedram teaches that most homes are full of hidden toxins — in cleaning products, personal care, candles, and cookware. He teaches that healing starts with cleaning up your environment. Your job is to find CLEAN, NON-TOXIC products for the home or body — like non-toxic candles, clean skincare, ceramic cookware, natural cleaning sprays, or organic cotton products. No synthetic fragrances, no parabens, no PFAS.",
        prompt: null,
        inputLabel: null,
      },
      {
        id: "step2",
        title: "Research with Manus",
        instruction: "Copy this prompt into Manus and paste the answer below.",
        prompt:
          "I am researching non-toxic home and personal care products for The Urban Monk brand. The Urban Monk teaches that a clean, toxin-free environment is essential for health and healing. The ideal customer is health-conscious, reads ingredient labels, and avoids synthetic fragrances, parabens, PFAS, and other common toxins. Please find 5 real non-toxic products (with brand names, prices, and websites) across these categories: candles, skincare, cookware, cleaning products, or home textiles. For each product, tell me: the brand name, the product, the price, the website, what certifications it has (e.g., EWG Verified, USDA Organic, B Corp), and why it fits a non-toxic lifestyle.",
        inputLabel: "Paste Manus's answer here:",
      },
      {
        id: "step3",
        title: "Check for partnership programs",
        instruction: "Pick your 2 favorites and ask Manus for each one:",
        prompt:
          "Does [BRAND NAME] have an affiliate program, wholesale program, or retail partnership program? What are the commission rates or wholesale pricing? How would a wellness brand apply to carry or promote their products?",
        inputLabel: "Paste Manus's answer for both brands here:",
      },
      {
        id: "step4",
        title: "Write your recommendation",
        instruction:
          "Which ONE product is the best fit for The Urban Monk store? Write at least 3 sentences.",
        prompt: null,
        inputLabel: "Write your recommendation here:",
      },
    ],
  },
  {
    id: "ancient_practices",
    title: "Mission 4: Ancient Practice Tools",
    emoji: "🧘",
    bookSource: "The Urban Monk & Inner Alchemy",
    description:
      "Find tools for Qigong, Tai Chi, meditation, and breathwork — the physical equipment that supports the ancient practices Pedram teaches.",
    steps: [
      {
        id: "step1",
        title: "Learn the mission",
        instruction:
          "Pedram is a doctor of Oriental Medicine and has practiced Qigong and Tai Chi for decades. He teaches these practices as the foundation of health. Your job is to find PHYSICAL TOOLS that support these practices — like Qigong balls, Tai Chi swords (for advanced students), meditation cushions (zafus), singing bowls, incense, or practice clothing. These should be high quality, authentic, and appropriate for serious practitioners.",
        prompt: null,
        inputLabel: null,
      },
      {
        id: "step2",
        title: "Research with Manus",
        instruction: "Copy this prompt into Manus and paste the answer below.",
        prompt:
          "I am researching physical tools and equipment for Qigong, Tai Chi, and meditation practice for The Urban Monk brand. The Urban Monk is a doctor of Oriental Medicine who teaches these ancient practices. The ideal customer is a serious wellness practitioner who wants authentic, high-quality tools — not cheap novelty items. Please find 5 real products (with brand names, prices, and websites) across these categories: Qigong balls or baoding balls, meditation cushions (zafus or zabutons), Tibetan singing bowls, incense or sage bundles, or Tai Chi practice clothing. For each product, tell me: the brand name, the product, the price, the website, and why it is considered high quality and authentic.",
        inputLabel: "Paste Manus's answer here:",
      },
      {
        id: "step3",
        title: "Check for partnership programs",
        instruction: "Pick your 2 favorites and ask Manus for each one:",
        prompt:
          "Does [BRAND NAME] have an affiliate program, wholesale program, or brand partnership program? What are the details and how would a wellness educator apply to partner with them?",
        inputLabel: "Paste Manus's answer for both brands here:",
      },
      {
        id: "step4",
        title: "Write your recommendation",
        instruction:
          "Which ONE product is the best fit for The Urban Monk store? Write at least 3 sentences.",
        prompt: null,
        inputLabel: "Write your recommendation here:",
      },
    ],
  },
  {
    id: "nervous_system",
    title: "Mission 5: Nervous System & Body",
    emoji: "🧠",
    bookSource: "Lights On",
    description:
      "Find tools that help people get back into their body and calm their nervous system — the physical practices from 'Lights On' about the nine senses and embodiment.",
    steps: [
      {
        id: "step1",
        title: "Learn the mission",
        instruction:
          "In 'Lights On,' Pedram teaches that most people are disconnected from their bodies — living in their heads, stressed, and overstimulated. He talks about the nine senses (including proprioception, interoception, and vestibular sense) and how grounding practices help the nervous system reset. Your job is to find PHYSICAL TOOLS that help people reconnect with their body and calm their nervous system — like grounding/earthing products, weighted blankets, vibration plates, cold plunge tools, or vagus nerve stimulators.",
        prompt: null,
        inputLabel: null,
      },
      {
        id: "step2",
        title: "Research with Manus",
        instruction: "Copy this prompt into Manus and paste the answer below.",
        prompt:
          "I am researching physical tools for nervous system regulation and body awareness for The Urban Monk brand. The book 'Lights On' by Dr. Pedram Shojai teaches that modern people are disconnected from their bodies and need tools to ground and regulate their nervous system. The ideal customer is someone dealing with stress, anxiety, or burnout who wants natural, non-pharmaceutical solutions. Please find 5 real products (with brand names, prices, and websites) across these categories: earthing/grounding mats or sheets, weighted blankets, cold therapy tools (ice bath tubs or cold packs), vagus nerve stimulation devices, or vibration plates. For each product, tell me: the brand name, the product, the price, the website, and how it helps regulate the nervous system.",
        inputLabel: "Paste Manus's answer here:",
      },
      {
        id: "step3",
        title: "Check for partnership programs",
        instruction: "Pick your 2 favorites and ask Manus for each one:",
        prompt:
          "Does [BRAND NAME] have an affiliate program, wholesale program, or brand partnership program? What are the commission rates or wholesale pricing? How would a wellness brand apply to partner with them?",
        inputLabel: "Paste Manus's answer for both brands here:",
      },
      {
        id: "step4",
        title: "Write your recommendation",
        instruction:
          "Which ONE product is the best fit for The Urban Monk store? Write at least 3 sentences.",
        prompt: null,
        inputLabel: "Write your recommendation here:",
      },
    ],
  },
  {
    id: "clean_food",
    title: "Mission 6: Clean Food & Kitchen",
    emoji: "🥗",
    bookSource: "Rise and Shine & The Urban Monk",
    description:
      "Find clean food products and kitchen tools that align with Pedram's teaching about eating as medicine — organic, non-toxic, and nourishing.",
    steps: [
      {
        id: "step1",
        title: "Learn the mission",
        instruction:
          "Pedram teaches that food is medicine — but only if it is clean, organic, and prepared properly. He talks about the importance of clean water, non-toxic cookware, and foods that nourish rather than inflame. Your job is to find CLEAN FOOD PRODUCTS or KITCHEN TOOLS — like high-quality olive oil, organic adaptogenic teas, water filters, ceramic or cast iron cookware, or fermented foods. No artificial ingredients, no seed oils, no plastic-leaching containers.",
        prompt: null,
        inputLabel: null,
      },
      {
        id: "step2",
        title: "Research with Manus",
        instruction: "Copy this prompt into Manus and paste the answer below.",
        prompt:
          "I am researching clean food products and kitchen tools for The Urban Monk brand. The Urban Monk teaches that food is medicine and that the modern food supply is full of hidden toxins, seed oils, and inflammatory ingredients. The ideal customer is health-conscious, buys organic, and wants to upgrade their kitchen to support healing. Please find 5 real products (with brand names, prices, and websites) across these categories: high-quality extra virgin olive oil, adaptogenic or medicinal teas, water filtration systems, ceramic or cast iron cookware, or organic fermented foods (like kimchi or kefir). For each product, tell me: the brand name, the product, the price, the website, and why it fits a clean, anti-inflammatory lifestyle.",
        inputLabel: "Paste Manus's answer here:",
      },
      {
        id: "step3",
        title: "Check for partnership programs",
        instruction: "Pick your 2 favorites and ask Manus for each one:",
        prompt:
          "Does [BRAND NAME] have an affiliate program, wholesale program, or retail partnership program? What are the details and how would a wellness brand apply to carry or promote their products?",
        inputLabel: "Paste Manus's answer for both brands here:",
      },
      {
        id: "step4",
        title: "Write your recommendation",
        instruction:
          "Which ONE product is the best fit for The Urban Monk store? Write at least 3 sentences.",
        prompt: null,
        inputLabel: "Write your recommendation here:",
      },
    ],
  },
];

// ─── Router ───────────────────────────────────────────────────────────────────

export const kidsResearchRouter = router({
  // Register a new researcher (no login required — just name + access code)
  register: publicProcedure
    .input(z.object({ name: z.string().min(1).max(64), accessCode: z.string().min(4).max(16) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { name, accessCode } = input;
      const [existingRows] = await db.execute(
        "SELECT id FROM kids_researchers WHERE kr_access_code = " + JSON.stringify(accessCode) + " LIMIT 1"
      ) as any[];
      if (Array.isArray(existingRows) && existingRows.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "That access code is already taken. Try a different one." });
      }
      const [result] = await db.execute(
        "INSERT INTO kids_researchers (kr_name, kr_access_code) VALUES (" +
        JSON.stringify(name) + ", " + JSON.stringify(accessCode) + ")"
      ) as any[];
      return { id: (result as any).insertId, name, accessCode };
    }),

  // Login with access code — returns researcher info
  login: publicProcedure
    .input(z.object({ accessCode: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [rows] = await db.execute(
        "SELECT id, kr_name as name, kr_access_code as accessCode FROM kids_researchers WHERE kr_access_code = " +
        JSON.stringify(input.accessCode) + " LIMIT 1"
      ) as any[];
      const researcher = Array.isArray(rows) ? rows[0] : null;
      if (!researcher) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Access code not found. Check your code and try again." });
      }
      return researcher as { id: number; name: string; accessCode: string };
    }),

  // Get all missions (static data — no DB needed)
  getMissions: publicProcedure.query(() => {
    return MISSIONS.map(({ id, title, emoji, bookSource, description, steps }) => ({
      id, title, emoji, bookSource, description,
      stepCount: steps.length,
    }));
  }),

  // Get a single mission with full step data
  getMission: publicProcedure
    .input(z.object({ missionId: z.string() }))
    .query(({ input }) => {
      const mission = MISSIONS.find((m) => m.id === input.missionId);
      if (!mission) throw new TRPCError({ code: "NOT_FOUND", message: "Mission not found" });
      return mission;
    }),

  // Save progress (draft) for a mission
  saveProgress: publicProcedure
    .input(z.object({
      researcherId: z.number(),
      missionId: z.string(),
      findings: z.record(z.string()),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { researcherId, missionId, findings } = input;
      const mission = MISSIONS.find((m) => m.id === missionId);
      if (!mission) throw new TRPCError({ code: "NOT_FOUND", message: "Mission not found" });

      const findingsJson = JSON.stringify(findings);
      const [existingRows] = await db.execute(
        "SELECT id FROM kids_mission_submissions WHERE kms_researcher_id = " +
        researcherId + " AND kms_mission_id = " + JSON.stringify(missionId) + " LIMIT 1"
      ) as any[];
      const existing = Array.isArray(existingRows) ? existingRows[0] : null;

      if (existing) {
        await db.execute(
          "UPDATE kids_mission_submissions SET kms_findings = " +
          JSON.stringify(findingsJson) + ", kms_status = 'draft' WHERE id = " + existing.id
        );
        return { id: existing.id, saved: true };
      } else {
        const [result] = await db.execute(
          "INSERT INTO kids_mission_submissions (kms_researcher_id, kms_mission_id, kms_mission_title, kms_findings, kms_status) VALUES (" +
          researcherId + ", " + JSON.stringify(missionId) + ", " +
          JSON.stringify(mission.title) + ", " + JSON.stringify(findingsJson) + ", 'draft')"
        ) as any[];
        return { id: (result as any).insertId, saved: true };
      }
    }),

  // Submit a completed mission
  submitMission: publicProcedure
    .input(z.object({
      researcherId: z.number(),
      missionId: z.string(),
      findings: z.record(z.string()),
      recommendation: z.string().min(10),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { researcherId, missionId, findings, recommendation } = input;
      const mission = MISSIONS.find((m) => m.id === missionId);
      if (!mission) throw new TRPCError({ code: "NOT_FOUND", message: "Mission not found" });

      const findingsJson = JSON.stringify(findings);
      const [existingRows] = await db.execute(
        "SELECT id FROM kids_mission_submissions WHERE kms_researcher_id = " +
        researcherId + " AND kms_mission_id = " + JSON.stringify(missionId) + " LIMIT 1"
      ) as any[];
      const existing = Array.isArray(existingRows) ? existingRows[0] : null;

      if (existing) {
        await db.execute(
          "UPDATE kids_mission_submissions SET kms_findings = " +
          JSON.stringify(findingsJson) + ", kms_recommendation = " +
          JSON.stringify(recommendation) + ", kms_status = 'submitted', kms_submittedAt = NOW() WHERE id = " + existing.id
        );
        return { id: existing.id, submitted: true };
      } else {
        const [result] = await db.execute(
          "INSERT INTO kids_mission_submissions (kms_researcher_id, kms_mission_id, kms_mission_title, kms_findings, kms_recommendation, kms_status, kms_submittedAt) VALUES (" +
          researcherId + ", " + JSON.stringify(missionId) + ", " +
          JSON.stringify(mission.title) + ", " + JSON.stringify(findingsJson) + ", " +
          JSON.stringify(recommendation) + ", 'submitted', NOW())"
        ) as any[];
        return { id: (result as any).insertId, submitted: true };
      }
    }),

  // Get all submissions for a researcher
  getMySubmissions: publicProcedure
    .input(z.object({ researcherId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const [rows] = await db.execute(
        "SELECT id, kms_mission_id as missionId, kms_mission_title as missionTitle, " +
        "kms_status as status, kms_findings as findings, kms_recommendation as recommendation, " +
        "kms_submittedAt as submittedAt, kms_updatedAt as updatedAt " +
        "FROM kids_mission_submissions WHERE kms_researcher_id = " + input.researcherId +
        " ORDER BY kms_updatedAt DESC"
      ) as any[];
      return (Array.isArray(rows) ? rows : []).map((r: any) => ({
        ...r,
        findings: r.findings ? JSON.parse(r.findings) : {},
      }));
    }),

  // Admin: get all submissions from all researchers (for Pedram's review)
  getAllSubmissions: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
    }
    const db = await getDb();
    if (!db) return [];
    const [rows] = await db.execute(
      "SELECT s.id, s.kms_mission_id as missionId, s.kms_mission_title as missionTitle, " +
      "s.kms_status as status, s.kms_findings as findings, s.kms_recommendation as recommendation, " +
      "s.kms_submittedAt as submittedAt, s.kms_updatedAt as updatedAt, " +
      "r.id as researcherId, r.kr_name as researcherName " +
      "FROM kids_mission_submissions s " +
      "JOIN kids_researchers r ON r.id = s.kms_researcher_id " +
      "ORDER BY s.kms_submittedAt DESC, s.kms_updatedAt DESC"
    ) as any[];
    return (Array.isArray(rows) ? rows : []).map((r: any) => ({
      ...r,
      findings: r.findings ? JSON.parse(r.findings) : {},
    }));
  }),
});
