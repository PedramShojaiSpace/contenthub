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

const OFFER_DETAILS: Record<string, { label: string; price: string; cta: string; description: string }> = {
  academy: {
    label: "Urban Monk Academy",
    price: "$297/year",
    cta: "Join the Urban Monk Academy",
    description:
      "A year-long membership with Dr. Pedram Shojai — weekly practices, masterclasses, guided meditations, and a community of high-performers reclaiming their health.",
  },
  retreat: {
    label: "Urban Monk Retreat",
    price: "$1,200",
    cta: "Reserve Your Retreat Spot",
    description:
      "An immersive 3-day retreat with Dr. Pedram Shojai — deep dives into Taoist medicine, energy cultivation, breathwork, and peak performance practices.",
  },
  supplements: {
    label: "Urban Monk Supplements",
    price: "Starting at $49",
    cta: "Shop the Urban Monk Collection",
    description:
      "Clinically-informed supplements formulated by Dr. Pedram Shojai — adaptogens, gut health support, and performance blends rooted in East-West medicine.",
  },
  free_guide: {
    label: "Free Wellness Guide",
    price: "Free",
    cta: "Download Your Free Guide",
    description:
      "A free guide from Dr. Pedram Shojai — practical tools to reclaim your energy, focus, and vitality starting today.",
  },
  custom: {
    label: "Custom Offer",
    price: "",
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
  contentAngle: string
): string {
  const offerInfo = OFFER_DETAILS[offer] ?? OFFER_DETAILS.academy;
  const offerLabel = offer === "custom" && offerCustomLabel ? offerCustomLabel : offerInfo.label;

  return `You are Dr. Pedram Shojai (The Urban Monk) — a Doctor of Oriental Medicine, Taoist monk, filmmaker, and New York Times bestselling author. You bridge ancient Eastern wisdom with modern Western science. Your voice is warm, authoritative, direct, and deeply personal. You speak as a trusted guide who has walked this path himself.

You are writing a high-converting landing page for the following:

AVATAR (Target Persona): ${personaName}
AVATAR PAIN POINTS: ${personaPainPoints}
AVATAR ASPIRATIONS: ${personaAspirations}

OFFER: ${offerLabel}
OFFER PRICE: ${offerInfo.price}
PRIMARY CTA: ${offerInfo.cta}
OFFER DESCRIPTION: ${offerInfo.description}

CONTENT ANGLE / KEY MESSAGE: ${contentAngle}

LANDING PAGE STRUCTURE (write in this exact order, using Markdown):
1. **Headline** — A bold, pattern-interrupting headline that speaks directly to the avatar's deepest pain or desire. Max 12 words.
2. **Subheadline** — One sentence that expands the headline and introduces the solution. Max 25 words.
3. **Opening Story** (2-3 short paragraphs) — Pedram speaks directly to the avatar. Acknowledge their pain. Show you understand their world. Build empathy and credibility.
4. **The Problem** (2-3 bullet points) — Name the root causes of their struggle. Use clinical insight + ancient wisdom framing.
5. **The Bridge** (1-2 paragraphs) — Introduce the offer as the solution. Explain WHY this works when everything else has failed. Reference Pedram's credentials naturally.
6. **What You Get** (3-5 bullet points) — Specific, tangible benefits of the offer. Outcomes, not features.
7. **Who This Is For** (3-4 bullet points) — Describe the ideal buyer. Make them feel seen and called.
8. **Social Proof Placeholder** — Write 2 sample testimonial quotes in the voice of the avatar (clearly marked as examples for real testimonials to replace).
9. **Offer Summary** — Restate the offer name, price, and what's included in 2-3 sentences.
10. **CTA Block** — A compelling call to action paragraph (2-3 sentences) followed by the CTA button text in bold.
11. **Closing Reassurance** — 1-2 sentences addressing the main objection or hesitation. Build trust.

VOICE RULES:
- Write as Pedram speaking directly to the reader ("you", "your")
- Warm but direct — no corporate fluff, no hype
- Bridge science and ancient wisdom naturally
- Specific and credible — reference real concepts (Taoist medicine, gut-brain axis, cortisol, qi, etc.)
- No bullet points in the opening story or bridge sections — use flowing prose
- The copy must feel personal, not like a sales page template

OUTPUT: Return ONLY the landing page copy in clean Markdown. No meta-commentary, no labels outside the structure above, no "Here is your landing page:" preamble.`;
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function createLandingPage(data: {
  title: string;
  personaId?: number | null;
  personaName?: string | null;
  offer: "academy" | "retreat" | "supplements" | "free_guide" | "custom";
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

async function startGammaGeneration(
  copyBody: string,
  title: string,
  personaName: string,
  offer: string
): Promise<string> {
  const apiKey = process.env.GAMMA_API_KEY;
  if (!apiKey) throw new Error("GAMMA_API_KEY is not configured");

  const offerInfo = OFFER_DETAILS[offer] ?? OFFER_DETAILS.academy;

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
        offer: z.enum(["academy", "retreat", "supplements", "free_guide", "custom"]),
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

      // Build the system prompt
      const systemPrompt = buildCopyPrompt(
        input.personaName,
        input.personaPainPoints,
        input.personaAspirations,
        input.offer,
        input.offerCustomLabel,
        input.contentAngle
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
