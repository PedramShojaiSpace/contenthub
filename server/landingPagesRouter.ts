/**
 * Landing Page Generator — tRPC Router
 *
 * Flow:
 *   1. User picks avatar (persona), offer, content angle
 *   2. generateCopy  → LLM writes full landing page copy in Pedram's voice
 *   3. publishToGamma → POST to Gamma API, poll for completion, return gammaUrl
 *
 * The Gamma publish step is NEVER triggered automatically — only on explicit
 * "Publish to Gamma" button press, to avoid burning API credits.
 */

import { eq } from "drizzle-orm";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { landingPages } from "../drizzle/schema";

// ─── Offer metadata ───────────────────────────────────────────────────────────

const OFFER_DETAILS: Record<string, { label: string; price: string; cta: string; url: string; description: string }> = {
  upstream_bundle: {
    label: "The Upstream Course + KBMO FIT22",
    price: "$399",
    url: "https://upstream.theurbanmonk.com/",
    cta: "Get the Upstream Course + KBMO FIT22 Bundle",
    description:
      "The Upstream Course + KBMO FIT22 food sensitivity test from Dr. Pedram Shojai — the complete diagnostic path to find and fix your upstream root cause, with all bonuses included. $399.",
  },
  upstream_course: {
    label: "The Upstream Course",
    price: "$299",
    url: "https://upstream.theurbanmonk.com/",
    cta: "Start the Upstream Course — $299",
    description:
      "A 10-part docu-series with Dr. Pedram Shojai — the DIY path to finding and fixing your upstream health root cause, with all bonuses included. $299.",
  },
  explorer_tier: {
    label: "The Explorer Tier",
    price: "Testing Tier",
    url: "https://go.theurbanmonk.com/explore-tier",
    cta: "Join the Explorer Tier",
    description:
      "The Explorer Tier from Dr. Pedram Shojai — KBMO FIT 176 food sensitivity testing, GI Map, and oral biome analysis for a complete diagnostic picture.",
  },
  lights_on_webinar: {
    label: "Lights On Webinar",
    price: "Free",
    url: "https://lightson.theurbanmonk.com/",
    cta: "Reserve Your Free Seat",
    description:
      "A free live webinar with Dr. Pedram Shojai — 'Something Has Been Stolen From You' — discover what's draining your energy and vitality and how to get it back.",
  },
  deep_sleep_webinar: {
    label: "Deep Sleep Solution Webinar",
    price: "Free",
    url: "https://theacademy.theurbanmonk.com/dss-webinar-kajabi",
    cta: "Join the Free Sleep Webinar",
    description:
      "A free webinar with Dr. Pedram Shojai — the science-backed protocol to restore deep, restorative sleep without drugs or supplements.",
  },
  homesick_screening: {
    label: "Homesick Home Free Screening",
    price: "Free",
    url: "https://theacademy.theurbanmonk.com/SqueezePage",
    cta: "Watch the Free Screening",
    description:
      "A free documentary screening from Dr. Pedram Shojai — the environmental toxin conversation your doctor isn't having with you.",
  },
  interconnected_screening: {
    label: "Interconnected Series Re-Screening",
    price: "Free",
    url: "https://theacademy.theurbanmonk.com/ic-interconnected-free-screening-Meta",
    cta: "Watch the Interconnected Series Free",
    description:
      "A free docu-series from Dr. Pedram Shojai — the gut-brain-immune connection story that changes how you understand chronic illness.",
  },
  kbmo_testing: {
    label: "KBMO Testing — $299",
    price: "$299",
    url: "https://theacademy.theurbanmonk.com/interconnected-kbmo-webinar-299",
    cta: "Get Your KBMO Test for $299",
    description:
      "The KBMO FIT22 food sensitivity and gut permeability test — identifies the foods and gut barrier issues driving your symptoms, with a health coach consultation.",
  },
  gateway_to_health: {
    label: "Gateway to Health — Free Screening",
    price: "Free",
    url: "https://www.gatewaytohealth.com/gatewaytohealth",
    cta: "Watch the Gateway to Health Series Free",
    description:
      "A free screening series from Dr. Pedram Shojai — the entry point for anyone ready to understand the real root causes of modern chronic health challenges.",
  },
  custom: {
    label: "Custom Offer",
    price: "",
    url: "",
    cta: "Learn More",
    description: "",
  },
};

// ─── Landing page copy system prompt ─────────────────────────────────────────

function buildCopyPrompt(
  personaName: string,
  personaPainPoints: string,
  personaAspirations: string,
  offer: string,
  offerCustomLabel: string | null | undefined,
  contentAngle: string,
  avatarContextBlock: string = ""
): string {
  const offerInfo = OFFER_DETAILS[offer] ?? OFFER_DETAILS.upstream_bundle;
  const offerLabel = offer === "custom" && offerCustomLabel ? offerCustomLabel : offerInfo.label;

  const avatarSection = avatarContextBlock
    ? `\n${avatarContextBlock}\n`
    : "";

  return `You are Dr. Pedram Shojai (The Urban Monk) — a Doctor of Oriental Medicine, Taoist monk, filmmaker, and New York Times bestselling author. You bridge ancient Eastern wisdom with modern Western science. Your voice is warm, authoritative, direct, and deeply personal. You speak as a trusted guide who has walked this path himself.

You are writing a high-converting landing page for the following:

AVATAR (Target Persona): ${personaName}
AVATAR PAIN POINTS: ${personaPainPoints}
AVATAR ASPIRATIONS: ${personaAspirations}
${avatarSection}
OFFER: ${offerLabel}
OFFER PRICE: ${offerInfo.price}
PRIMARY CTA: ${offerInfo.cta}
OFFER DESCRIPTION: ${offerInfo.description}
OFFER URL: ${offerInfo.url || 'See website'}

CONTENT ANGLE / KEY MESSAGE: ${contentAngle}

CRITICAL INSTRUCTIONS FOR OBJECTION HANDLING:
- The Avatar Intelligence block above contains real buyer objections from discovery call transcripts.
- You MUST weave responses to these objections naturally into the copy — especially in sections 5 (The Bridge), 10 (CTA Block), and 11 (Closing Reassurance).
- Do NOT list objections explicitly — handle them implicitly through the copy's framing, language, and reassurances.
- Use the "Response Framework" and "Key Insight" from each objection to craft language that preempts hesitation before it arises.
- Use the "Emotional Hook" and real customer quotes from pain points as hooks in the Opening Story and The Problem sections.

LANDING PAGE STRUCTURE (write in this exact order, using Markdown):
1. **Headline** — A bold, pattern-interrupting headline that speaks directly to the avatar's deepest pain or desire. Max 12 words. Use the Headline Formula from Avatar Intelligence if provided.
2. **Subheadline** — One sentence that expands the headline and introduces the solution. Max 25 words.
3. **Opening Story** (2-3 short paragraphs) — Pedram speaks directly to the avatar. Acknowledge their pain using the real customer quotes and emotional hooks from Avatar Intelligence. Show you understand their world. Build empathy and credibility.
4. **The Problem** (2-3 bullet points) — Name the root causes of their struggle. Use clinical insight + ancient wisdom framing. Draw from the pain point descriptions in Avatar Intelligence.
5. **The Bridge** (1-2 paragraphs) — Introduce the offer as the solution. Explain WHY this works when everything else has failed. Implicitly address the top objection (e.g., "I've tried everything") by explaining what makes this different. Reference Pedram's credentials naturally.
6. **What You Get** (3-5 bullet points) — Specific, tangible benefits of the offer. Outcomes, not features.
7. **Who This Is For** (3-4 bullet points) — Describe the ideal buyer using the persona profile from Avatar Intelligence. Make them feel seen and called.
8. **Social Proof Placeholder** — Write 2 sample testimonial quotes in the voice of the avatar (clearly marked as examples for real testimonials to replace). Use the messaging framework's emotional job to guide the transformation arc in each quote.
9. **Offer Summary** — Restate the offer name, price, and what's included in 2-3 sentences.
10. **CTA Block** — A compelling call to action paragraph (2-3 sentences) followed by the CTA button text in bold. Address the affordability/time objection implicitly (e.g., frame the cost against the cost of inaction).
11. **Closing Reassurance** — 1-2 sentences addressing the main objection or hesitation. Use the response framework from Avatar Intelligence to build final trust.

VOICE RULES:
- Write as Pedram speaking directly to the reader ("you", "your")
- Warm but direct — no corporate fluff, no hype
- Bridge science and ancient wisdom naturally
- Specific and credible — reference real concepts (Taoist medicine, gut-brain axis, cortisol, qi, etc.)
- No bullet points in the opening story or bridge sections — use flowing prose
- The copy must feel personal, not like a sales page template
- Use transformation language: "reclaim," "restore," "finally," "root cause" — never "manage" or "cope"

OUTPUT: Return ONLY the landing page copy in clean Markdown. No meta-commentary, no labels outside the structure above, no "Here is your landing page:" preamble.`;
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function createLandingPage(data: {
  title: string;
  personaId?: number | null;
  personaName?: string | null;
  offer: "upstream_bundle" | "upstream_course" | "explorer_tier" | "lights_on_webinar" | "deep_sleep_webinar" | "homesick_screening" | "interconnected_screening" | "kbmo_testing" | "gateway_health" | "custom";
  offerCustomLabel?: string | null;
  contentAngle?: string | null;
  copyBody?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(landingPages).values({
    title: data.title,
    personaId: data.personaId ?? null,
    personaName: data.personaName ?? null,
    offer: data.offer,
    offerCustomLabel: data.offerCustomLabel ?? null,
    contentAngle: data.contentAngle ?? null,
    copyBody: data.copyBody ?? null,
    status: "draft",
  });
  return result;
}

async function getLandingPage(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(landingPages).where(eq(landingPages.id, id));
  return rows[0] ?? null;
}

async function updateLandingPage(id: number, data: Partial<typeof landingPages.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(landingPages).set(data).where(eq(landingPages.id, id));
}

async function listLandingPagesFromDb() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(landingPages).orderBy(landingPages.createdAt);
}

async function deleteLandingPageFromDb(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(landingPages).where(eq(landingPages.id, id));
}

// ─── Gamma API helpers ────────────────────────────────────────────────────────

const GAMMA_API_BASE = "https://public-api.gamma.app/v1.0";

// 'creme' is a valid Gamma standard theme — warm cream/beige/sand tones that match Urban Monk's earthy aesthetic
const URBAN_MONK_THEME_ID = "creme";

async function startGammaGeneration(
  copyBody: string,
  title: string,
  personaName: string,
  offer: string
): Promise<string> {
  const apiKey = process.env.GAMMA_API_KEY;
  if (!apiKey) throw new Error("GAMMA_API_KEY is not configured");

  const offerInfo = OFFER_DETAILS[offer] ?? OFFER_DETAILS.upstream_bundle;

  const additionalInstructions = `
This is a landing page for The Urban Monk (Dr. Pedram Shojai).
Target audience: ${personaName}.
Offer: ${offerInfo.label} — ${offerInfo.price}.
Design guidelines:
- Warm, earthy, wellness aesthetic — cream/parchment backgrounds, terracotta and sage green accents
- Clean, modern layout with generous white space
- Hero section with large headline and subheadline
- Use warm golden tones and natural imagery style
- Professional but approachable — not corporate, not new-age
- CTA buttons in warm terracotta/amber
- The Urban Monk brand voice: ancient wisdom meets modern science
`.trim();

  const response = await fetch(`${GAMMA_API_BASE}/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({
      inputText: `# ${title}\n\n${copyBody}`,
      textMode: "preserve",
      format: "webpage",
      numCards: 8,
      additionalInstructions,
      textOptions: {
        amount: "detailed",
        tone: "warm, authoritative, inspiring, direct",
        audience: personaName,
      },
      imageOptions: {
        source: "aiGenerated",
        style: "warm, earthy, wellness photography, golden light, sage greens, parchment tones, editorial",
      },
      sharingOptions: {
        externalAccess: "view",
      },
      // Urban Monk brand theme — ensures every generated page uses the correct design template
      themeId: URBAN_MONK_THEME_ID,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gamma API error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as { generationId: string };
  return data.generationId;
}

async function pollGammaGeneration(generationId: string): Promise<{
  status: "pending" | "completed" | "failed";
  gammaUrl?: string;
  error?: string;
}> {
  const apiKey = process.env.GAMMA_API_KEY;
  if (!apiKey) throw new Error("GAMMA_API_KEY is not configured");

  const response = await fetch(`${GAMMA_API_BASE}/generations/${generationId}`, {
    headers: { "X-API-KEY": apiKey },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gamma poll error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as {
    status: string;
    gammaUrl?: string;
    error?: string;
  };

  if (data.status === "completed") {
    return { status: "completed", gammaUrl: data.gammaUrl };
  } else if (data.status === "failed") {
    return { status: "failed", error: data.error ?? "Generation failed" };
  }
  return { status: "pending" };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const landingPagesRouter = router({
  // List all landing pages
  list: protectedProcedure.query(async () => {
    return listLandingPagesFromDb();
  }),

  // Get a single landing page
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return getLandingPage(input.id);
    }),

  // Delete a landing page
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteLandingPageFromDb(input.id);
      return { success: true };
    }),

  // Step 1: Generate AI copy — saves to DB as draft, returns the copy for preview
  generateCopy: protectedProcedure
    .input(
      z.object({
        personaId: z.number().optional(),
        personaName: z.string().min(1),
        personaPainPoints: z.string().default(""),
        personaAspirations: z.string().default(""),
        offer: z.enum(["upstream_bundle", "upstream_course", "explorer_tier", "lights_on_webinar", "deep_sleep_webinar", "homesick_screening", "interconnected_screening", "kbmo_testing", "gateway_health", "custom"]),
        offerCustomLabel: z.string().optional(),
        contentAngle: z.string().min(1, "Please describe the key message or angle for this page"),
      })
    )
    .mutation(async ({ input }) => {
      const offerInfo = OFFER_DETAILS[input.offer] ?? OFFER_DETAILS.academy;
      const offerLabel =
        input.offer === "custom" && input.offerCustomLabel
          ? input.offerCustomLabel
          : offerInfo.label;

      // Enrich pain points / aspirations from DB persona if personaId is provided
      let enrichedPainPoints = input.personaPainPoints;
      let enrichedAspirations = input.personaAspirations;
      if (input.personaId) {
        try {
          const db = await getDb();
          if (db) {
            const { personas } = await import("../drizzle/schema");
            const { eq: eqOp } = await import("drizzle-orm");
            const found = await db.select().from(personas).where(eqOp(personas.id, input.personaId));
            if (found.length > 0) {
              const p = found[0] as any;
              const dbPains: string[] = JSON.parse(p.painPoints ?? "[]");
              const dbAspirations: string[] = JSON.parse(p.aspirations ?? "[]");
              if (dbPains.length > 0) {
                enrichedPainPoints = dbPains.join("; ");
              }
              if (dbAspirations.length > 0) {
                enrichedAspirations = dbAspirations.join("; ");
              }
            }
          }
        } catch (err) {
          console.warn("[LandingPages] Could not load persona pain points:", err);
        }
      }

      // Load Avatar Intelligence context block (objections, pain points, messaging framework, persona)
      // This is the same context injected into Creation Studio, Blog, and Script generation.
      let avatarContextBlock = "";
      try {
        const { getAvatarContextBlockForPersona } = await import("./avatarRouter");
        avatarContextBlock = await getAvatarContextBlockForPersona(
          input.contentAngle,
          input.personaName
        );
        if (avatarContextBlock) {
          console.log(`[LandingPages] Avatar context loaded for persona: ${input.personaName}`);
        }
      } catch (err) {
        console.warn("[LandingPages] Could not load avatar context block:", err);
      }

      // Build the system prompt with enriched (real survey) data + avatar intelligence
      const systemPrompt = buildCopyPrompt(
        input.personaName,
        enrichedPainPoints,
        enrichedAspirations,
        input.offer,
        input.offerCustomLabel,
        input.contentAngle,
        avatarContextBlock
      );

      // Call LLM
      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Write the landing page copy for ${input.personaName} targeting the ${offerLabel} offer. Content angle: ${input.contentAngle}`,
          },
        ],
      });

      const rawContent = response.choices?.[0]?.message?.content;
      const copyBody = typeof rawContent === "string" ? rawContent : "";

      if (!copyBody) {
        throw new Error("Copy generation failed — no content returned.");
      }

      // Generate a title
      const titleLine = copyBody.split("\n").find((l) => l.startsWith("#"));
      const title = titleLine
        ? titleLine.replace(/^#+\s*/, "").trim().slice(0, 200)
        : `${input.personaName} — ${offerLabel}`;

      // Save to DB as draft
      const result = await createLandingPage({
        title,
        personaId: input.personaId,
        personaName: input.personaName,
        offer: input.offer,
        offerCustomLabel: input.offerCustomLabel,
        contentAngle: input.contentAngle,
        copyBody,
      });

      return {
        id: (result as { insertId?: number })?.insertId ?? 0,
        title,
        copyBody,
        offer: input.offer,
        offerLabel,
      };
    }),

  // Update copy (user edits the copy before publishing)
  updateCopy: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        copyBody: z.string().min(1),
        title: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await updateLandingPage(input.id, {
        copyBody: input.copyBody,
        ...(input.title ? { title: input.title } : {}),
      });
      return { success: true };
    }),

  // Step 2: Publish to Gamma — MANUAL TRIGGER ONLY
  // Starts the Gamma generation job and returns the generationId for polling
  publishToGamma: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const page = await getLandingPage(input.id);
      if (!page) throw new Error("Landing page not found");
      if (!page.copyBody) throw new Error("No copy to publish — generate copy first");

      // Mark as generating
      await updateLandingPage(input.id, { status: "generating", errorMessage: null });

      try {
        const generationId = await startGammaGeneration(
          page.copyBody,
          page.title,
          page.personaName ?? "Health-Conscious Professional",
          page.offer
        );

        await updateLandingPage(input.id, { gammaGenerationId: generationId });

        return { success: true, generationId };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await updateLandingPage(input.id, { status: "failed", errorMessage: msg });
        throw err;
      }
    }),

  // Poll Gamma for generation status
  pollGamma: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const page = await getLandingPage(input.id);
      if (!page) throw new Error("Landing page not found");
      if (!page.gammaGenerationId) {
        return { status: "pending" as const, gammaUrl: null };
      }

      const result = await pollGammaGeneration(page.gammaGenerationId);

      if (result.status === "completed" && result.gammaUrl) {
        await updateLandingPage(input.id, {
          status: "published",
          gammaUrl: result.gammaUrl,
        });
        return { status: "completed" as const, gammaUrl: result.gammaUrl };
      } else if (result.status === "failed") {
        await updateLandingPage(input.id, {
          status: "failed",
          errorMessage: result.error ?? "Generation failed",
        });
        return { status: "failed" as const, gammaUrl: null, error: result.error };
      }

      return { status: "pending" as const, gammaUrl: null };
    }),

  // Generate an A/B variant — rewrites the copy with a different hook angle
  generateVariant: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        variantAngle: z.enum(["fear", "aspiration", "authority", "curiosity"]),
      })
    )
    .mutation(async ({ input }) => {
      const page = await getLandingPage(input.id);
      if (!page) throw new Error("Landing page not found");
      if (!page.copyBody) throw new Error("No copy to create a variant from");

      const ANGLE_INSTRUCTIONS: Record<string, string> = {
        fear: "Lead with the COST OF INACTION. Open with what the reader stands to lose if they don't act — their health, their relationships, their vitality. Make the pain of staying the same feel more real than the discomfort of change. Every section should subtly remind them of what's at stake.",
        aspiration: "Lead with the BEST POSSIBLE FUTURE. Paint a vivid picture of who they become after taking action — energized, clear-headed, purposeful, free. Every section should pull them toward the vision, not push them away from pain.",
        authority: "Lead with PEDRAM'S CREDENTIALS AND TRACK RECORD. Open with his OMD degree, his 20+ years of clinical practice, his NYT bestselling books, his films. Let the reader feel the weight of expertise behind every recommendation. Social proof and clinical evidence should anchor every section.",
        curiosity: "Lead with A SURPRISING INSIGHT or COUNTERINTUITIVE TRUTH that challenges what the reader thinks they know. Open with a provocative question or a fact that makes them lean in. Every section should feel like peeling back a layer to reveal something they've never heard before.",
      };

      const angleInstruction = ANGLE_INSTRUCTIONS[input.variantAngle];

      const variantPrompt = `You are Dr. Pedram Shojai (The Urban Monk). You have an existing landing page and you need to rewrite it with a different persuasion angle.

ORIGINAL COPY:
${page.copyBody}

NEW ANGLE INSTRUCTION:
${angleInstruction}

Rewrite the entire landing page using this new angle. Keep the same offer, the same structure (headline → story → problem → bridge → benefits → CTA → reassurance), and the same persona targeting. But shift the emotional register and opening hook to match the new angle.

Rules:
- Keep Pedram's warm, direct, credible voice
- Do NOT change the offer, price, or CTA button text
- Do NOT add any meta-commentary or labels
- Return ONLY the rewritten landing page copy in clean Markdown`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: variantPrompt },
          { role: "user", content: `Rewrite with the ${input.variantAngle} angle.` },
        ],
      });

      const rawContent = response.choices?.[0]?.message?.content;
      const variantCopy = typeof rawContent === "string" ? rawContent : "";

      if (!variantCopy) throw new Error("Variant generation failed — no content returned.");

      // Extract title from variant
      const titleLine = variantCopy.split("\n").find((l) => l.startsWith("#"));
      const variantTitle = titleLine
        ? titleLine.replace(/^#+\s*/, "").trim().slice(0, 200)
        : `${page.title} (${input.variantAngle} variant)`;

      // Save as a new draft page
      const result = await createLandingPage({
        title: variantTitle,
        personaId: page.personaId,
        personaName: page.personaName,
        offer: page.offer as "upstream_bundle" | "upstream_course" | "explorer_tier" | "lights_on_webinar" | "deep_sleep_webinar" | "homesick_screening" | "interconnected_screening" | "kbmo_testing" | "gateway_health" | "custom",
        offerCustomLabel: page.offerCustomLabel,
        contentAngle: `${page.contentAngle} [${input.variantAngle} variant]`,
        copyBody: variantCopy,
      });

      return {
        id: (result as { insertId?: number })?.insertId ?? 0,
        title: variantTitle,
        copyBody: variantCopy,
        variantAngle: input.variantAngle,
      };
    }),

  // Validate Gamma API key (used in tests)
  validateApiKey: protectedProcedure.query(async () => {
    const apiKey = process.env.GAMMA_API_KEY;
    if (!apiKey) return { valid: false, reason: "GAMMA_API_KEY not set" };

    try {
      const response = await fetch(`${GAMMA_API_BASE}/themes`, {
        headers: { "X-API-KEY": apiKey },
      });
      if (response.ok) {
        return { valid: true };
      }
      return { valid: false, reason: `HTTP ${response.status}` };
    } catch (err) {
      return { valid: false, reason: err instanceof Error ? err.message : String(err) };
    }
  }),
});
