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
import { wrapLLM } from "./llmUtils";
import { safeParseJson } from "./fetchUtils";
import { TRPCError } from "@trpc/server";
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
    cta: "Reserve Your Free Seat — It's Free",
    description:
      "A free live webinar with Dr. Pedram Shojai — 'Actual Intelligence: How to Reclaim the One Thing AI Can't Replace' — discover how the attention economy has hijacked your 9 perceptual channels and what to do about it. Includes the Perceptual Baseline Quiz.",
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

SOCRATIC PULL ARCHITECTURE (REQUIRED for Lights On and webinar offers; optional but preferred for all others):
This landing page uses the Socratic Pull Method. The visitor is not sold to — they are invited to recognize their own question in Pedram's journey. The structure is: Question → Recognition → Discovery → Invitation.
- The headline is a QUESTION the visitor is already half-asking themselves, not a statement about the product.
- The opening story begins with Pedram's own question, not with credentials or a problem statement.
- The bridge introduces Pedram as the sailing teacher: "I teach sailing. I'm not your boat captain. I expect you to leave here and go sail on your own."
- The close is an invitation framed as a decision point, not a sales pitch: "If this resonated — if you recognized yourself in that question — then you already know whether this is for you."

LANDING PAGE STRUCTURE (write in this exact order, using Markdown):
1. **Headline** — A question the visitor is already half-asking themselves. Max 12 words. Use the Socratic Pull format: "What if [the thing they've been told is wrong]?" or "Have you ever [the experience that reveals the problem]?" or "[The thing they want] — what if you already have it?" Use the Headline Formula from Avatar Intelligence if provided, but reframe it as a question.
2. **Subheadline** — One sentence that names what Pedram found when he went looking. Max 25 words. Frame as discovery, not promise.
3. **Opening Story** (2-3 short paragraphs) — Pedram begins with HIS question, not the avatar's pain. "I had a question I couldn't stop asking. I went looking. Here is what I found." Then bridge to the avatar's experience using real customer quotes and emotional hooks from Avatar Intelligence.
4. **The Recognition** (2-3 bullet points) — Name the root causes as things the avatar will RECOGNIZE in themselves, not problems being diagnosed. "You've probably noticed that..." / "If you've ever felt..." Draw from Avatar Intelligence pain points.
5. **The Bridge — The Sailing Teacher** (1-2 paragraphs) — Introduce Pedram's credentials through the sailing teacher frame: "I teach sailing. I'm not your boat captain. I expect you to leave here and go sail on your own." Explain what makes this different by explaining what Pedram is NOT (a guru, a dependency, a quick fix) and what he IS (a map-giver, a fellow traveler who found something).
6. **What You Will Discover** (3-5 bullet points) — Frame as questions the avatar will be able to answer after the offer. "Why your [symptom] isn't what you think it is." Outcomes as discoveries, not features.
7. **Who This Is For** (3-4 bullet points) — Describe the ideal buyer as someone who is already asking the right questions. "This is for you if you've ever wondered..." Make them feel recognized, not targeted.
8. **Social Proof Placeholder** — Write 2 sample testimonial quotes in the voice of the avatar (clearly marked as examples for real testimonials to replace). Frame as discovery narratives: "I came in with a question. I left with a map."
9. **Offer Summary** — Restate the offer name, price, and what's included in 2-3 sentences. Frame as "what you get access to," not "what you buy."
10. **The Invitation** (replaces CTA Block) — A decision-point paragraph (2-3 sentences) that ends with a QUESTION, not a command: "If what I've shared resonated — if you recognized yourself in that question — then you already know whether this is for you. The question is: do you want to find out what's on the other side?" Then the CTA button text in bold.
11. **Closing Reassurance** — 1-2 sentences. Frame as confidence, not fear: "30-day guarantee — not because I'm worried you won't love it, but because I'm confident enough in this work to make that promise."

VOICE RULES:
- Write as Pedram speaking directly to the reader ("you", "your")
- Warm but direct — no corporate fluff, no hype
- Bridge science and ancient wisdom naturally
- Specific and credible — reference real concepts (Taoist medicine, gut-brain axis, cortisol, qi, etc.)
- No bullet points in the opening story or bridge sections — use flowing prose
- The copy must feel personal, not like a sales page template
- Use transformation language: "reclaim," "restore," "finally," "root cause" — never "manage" or "cope"
- NEVER use guru language: "I will show you," "I will teach you," "follow me" — use sailing teacher language instead: "I went looking," "here is what I found," "here is the map"

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
  // Cross-module connection tracking
  sourceWebinarId?: number | null;
  sourceEbookId?: number | null;
  sourceLandingPageId?: number | null;
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
    // Connection tracking FKs
    ...(data.sourceWebinarId ? { sourceWebinarId: data.sourceWebinarId } : {}),
    ...(data.sourceEbookId ? { sourceEbookId: data.sourceEbookId } : {}),
    ...(data.sourceLandingPageId ? { sourceLandingPageId: data.sourceLandingPageId } : {}),
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

  const data = await safeParseJson<{ generationId: string }>(response, "Gamma API create generation");
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

  const data = await safeParseJson<{
    status: string;
    gammaUrl?: string;
    error?: string;
  }>(response, "Gamma API poll generation");

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
        // Cross-module connection tracking
        sourceWebinarId: z.number().optional(),
        sourceEbookId: z.number().optional(),
        sourceLandingPageId: z.number().optional(),
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
      const response = await wrapLLM(() => invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Write the landing page copy for ${input.personaName} targeting the ${offerLabel} offer. Content angle: ${input.contentAngle}`,
          },
        ],
      }));

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
        // Connection tracking FKs from cross-module feed
        sourceWebinarId: input.sourceWebinarId,
        sourceEbookId: input.sourceEbookId,
        sourceLandingPageId: input.sourceLandingPageId,
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

      const response = await wrapLLM(() => invokeLLM({
        messages: [
          { role: "system", content: variantPrompt },
          { role: "user", content: `Rewrite with the ${input.variantAngle} angle.` },
        ],
      }));

      const rawContent = response.choices?.[0]?.message?.content;
      const variantCopy = typeof rawContent === "string" ? rawContent : "";

      if (!variantCopy) throw new Error("Variant generation failed — no content returned.");

      // Extract title from variant
      const titleLine = variantCopy.split("\n").find((l) => l.startsWith("#"));
      const variantTitle = titleLine
        ? titleLine.replace(/^#+\s*/, "").trim().slice(0, 200)
        : `${page.title} (${input.variantAngle} variant)`;

      // Save as a new draft page (track source page for pipeline)
      const result = await createLandingPage({
        title: variantTitle,
        personaId: page.personaId,
        personaName: page.personaName,
        offer: page.offer as "upstream_bundle" | "upstream_course" | "explorer_tier" | "lights_on_webinar" | "deep_sleep_webinar" | "homesick_screening" | "interconnected_screening" | "kbmo_testing" | "gateway_health" | "custom",
        offerCustomLabel: page.offerCustomLabel,
        contentAngle: `${page.contentAngle} [${input.variantAngle} variant]`,
        copyBody: variantCopy,
        sourceLandingPageId: input.id,
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

  // Parse a Gamma landing page's copyBody Markdown into structured fields for the CH builder
  getForCHBuilder: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const page = await getLandingPage(input.id);
      if (!page) throw new TRPCError({ code: "NOT_FOUND" });

      const copy = page.copyBody ?? "";
      const lines = copy.split("\n").map(l => l.trim()).filter(Boolean);

      // Extract headline — first # heading, strip leading #
      const headlineLine = lines.find(l => l.startsWith("# "));
      const headline = headlineLine ? headlineLine.replace(/^#+\s*/, "") : "";

      // Extract subheadline — first ## heading or first bold sentence
      const subheadlineLine = lines.find(l => l.startsWith("## "));
      const boldLine = lines.find(l => /^\*\*[^*]+\*\*/.test(l));
      const subheadline = subheadlineLine
        ? subheadlineLine.replace(/^#+\s*/, "")
        : boldLine
          ? boldLine.replace(/\*\*/g, "")
          : "";

      // Body copy — everything after the first ## heading, joined
      const firstH2Idx = lines.findIndex(l => l.startsWith("## "));
      const bodyCopy = firstH2Idx >= 0
        ? lines.slice(firstH2Idx).join("\n")
        : copy;

      // Infer campaign from offer
      const offerToCampaign: Record<string, string> = {
        lights_on_webinar: "lo",
        upstream_bundle: "lo",
        upstream_course: "lo",
        explorer_tier: "lo",
        deep_sleep_webinar: "sleep",
        kbmo_testing: "gut",
        gateway_health: "gut",
        homesick_screening: "webinar",
        interconnected_screening: "webinar",
      };
      const campaign = offerToCampaign[page.offer] ?? "lo";

      // Infer template from offer type
      const offerToTemplate: Record<string, string> = {
        lights_on_webinar: "sales",
        upstream_bundle: "sales",
        upstream_course: "sales",
        explorer_tier: "sales",
        deep_sleep_webinar: "sales",
        kbmo_testing: "sales",
        gateway_health: "sales",
        homesick_screening: "sales",
        interconnected_screening: "sales",
      };
      const template = offerToTemplate[page.offer] ?? "optin";

      // Extract CTA text and URL from copy if present
      const ctaLine = lines.find(l => /\[.*?\]\(https?:\/\//.test(l));
      const ctaMatch = ctaLine?.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
      const ctaText = ctaMatch?.[1] ?? "";
      const ctaUrl = ctaMatch?.[2] ?? "";

      return {
        id: page.id,
        title: page.title ?? "",
        headline,
        subheadline,
        bodyCopy,
        campaign,
        template,
        ctaText,
        ctaUrl,
        offer: page.offer,
        personaName: page.personaName ?? "",
      };
    }),
});
