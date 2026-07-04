/**
 * Advertorial Bridge Page Router
 * Generates and manages native advertorial pages for cold traffic Meta ads.
 * Pages are served at ch.theurbanmonk.com/bridge/{slug}
 */
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { advertorialPages, AdvertorialPage } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { TRPCError } from "@trpc/server";

// ─── Topic configs ─────────────────────────────────────────────────────────────
const TOPIC_CONFIGS: Record<string, {
  label: string;
  defaultCampaign: string;
  defaultCtaUrl: string;
  defaultCtaText: string;
  defaultCtaSubtext: string;
  painPoints: string[];
  mechanism: string;
  offer: string;
}> = {
  gut_health: {
    label: "Gut Health",
    defaultCampaign: "upstream",
    defaultCtaUrl: "https://theacademy.theurbanmonk.com/offers/Dbu2EDpX",
    defaultCtaText: "Check Your Eligibility →",
    defaultCtaSubtext: "Free assessment · Takes 60 seconds · No credit card required",
    painPoints: [
      "chronic bloating and digestive discomfort",
      "brain fog and inability to concentrate",
      "unexplained fatigue that sleep doesn't fix",
      "food sensitivities that keep expanding",
      "inflammation that doctors can't explain",
    ],
    mechanism: "gut-brain axis inflammation cascade",
    offer: "Urban Monk Academy — Upstream Health Program ($297/year)",
  },
  sleep: {
    label: "Sleep & Fatigue",
    defaultCampaign: "lo",
    defaultCtaUrl: "https://lightson.theurbanmonk.com",
    defaultCtaText: "Discover Your Sleep Type →",
    defaultCtaSubtext: "Free assessment · 2 minutes · Personalized results",
    painPoints: [
      "waking up exhausted no matter how much sleep you get",
      "racing mind that won't shut off at night",
      "afternoon energy crashes that derail your day",
      "relying on caffeine just to function",
      "feeling disconnected and foggy all day",
    ],
    mechanism: "Five Element organ body clock imbalance",
    offer: "Lights On Program — Wake Up & Live With Purpose ($297/year)",
  },
  energy: {
    label: "Energy & Vitality",
    defaultCampaign: "upstream",
    defaultCtaUrl: "https://theacademy.theurbanmonk.com/offers/Dbu2EDpX",
    defaultCtaText: "Start Your Energy Reset →",
    defaultCtaSubtext: "Free assessment · Personalized protocol",
    painPoints: [
      "chronic fatigue that no amount of rest fixes",
      "immune system that keeps getting triggered",
      "inflammation sapping your vitality",
      "feeling old before your time",
      "low motivation and drive",
    ],
    mechanism: "mitochondrial dysfunction from chronic immune activation",
    offer: "Urban Monk Academy — Upstream Health Program ($297/year)",
  },
  inflammation: {
    label: "Inflammation",
    defaultCampaign: "upstream",
    defaultCtaUrl: "https://theacademy.theurbanmonk.com/offers/Dbu2EDpX",
    defaultCtaText: "Check Your Inflammation Score →",
    defaultCtaSubtext: "Free 60-second assessment · No obligation",
    painPoints: [
      "joint pain and stiffness that limits your life",
      "skin issues that flare without warning",
      "autoimmune symptoms doctors dismiss",
      "weight gain that won't budge despite clean eating",
      "mood swings and anxiety tied to physical symptoms",
    ],
    mechanism: "leaky gut triggering systemic inflammatory cascade",
    offer: "Urban Monk Academy — Upstream Health Program ($297/year)",
  },
  stress: {
    label: "Stress & Cortisol",
    defaultCampaign: "lo",
    defaultCtaUrl: "https://lightson.theurbanmonk.com",
    defaultCtaText: "Take the Stress Assessment →",
    defaultCtaSubtext: "Free · 2 minutes · Personalized insights",
    painPoints: [
      "constant low-grade anxiety that never fully goes away",
      "cortisol dysregulation destroying your sleep",
      "stress eating and weight gain around the midsection",
      "feeling overwhelmed by things that used to be easy",
      "burnout that a vacation can't fix",
    ],
    mechanism: "HPA axis dysregulation from modern lifestyle overload",
    offer: "Lights On Program — Systematic Stress Mastery ($297/year)",
  },
  longevity: {
    label: "Longevity & Anti-Aging",
    defaultCampaign: "upstream",
    defaultCtaUrl: "https://theacademy.theurbanmonk.com/offers/Dbu2EDpX",
    defaultCtaText: "Get Your Longevity Protocol →",
    defaultCtaSubtext: "Free assessment · Evidence-based results",
    painPoints: [
      "aging faster than your peers",
      "declining cognitive function and memory",
      "loss of muscle mass and strength",
      "chronic disease risk that keeps climbing",
      "feeling like your best years are behind you",
    ],
    mechanism: "accelerated cellular aging from gut-driven inflammation",
    offer: "Urban Monk Academy — Longevity Framework ($297/year)",
  },
};

// ─── Generate advertorial copy via LLM ────────────────────────────────────────
async function generateAdvertorialCopy(params: {
  topic: string;
  customAngle?: string;
  targetAudience?: string;
}): Promise<{
  headline: string;
  subheadline: string;
  mechanismAngle: string;
  bodyHtml: string;
  metaTitle: string;
  metaDescription: string;
}> {
  const config = TOPIC_CONFIGS[params.topic];
  if (!config) throw new TRPCError({ code: "BAD_REQUEST", message: `Unknown topic: ${params.topic}` });

  const audience = params.targetAudience || "health-conscious adults 35-65 who are frustrated with conventional medicine";
  const angle = params.customAngle || config.mechanism;

  const systemPrompt = `You are a world-class direct response copywriter specializing in native advertorials for health and wellness brands.
You write editorial-style content that reads like journalism, not advertising.
Your advertorials follow the proven anatomy:
1. Skeptic-destroying headline — specific, benefit-driven, speaks to the reader's biggest pain
2. Invisible mechanism angle — a metaphor or concept that explains the hidden root cause
3. 3-minute deep engagement — reads like a news article, builds credibility, maximizes completion
4. Seamless bridge CTA — natural next step that pre-qualifies the reader

The brand is Dr. Pedram Shojai, OMD — Doctor of Oriental Medicine, Daoist monk, NYT bestselling author, PBS filmmaker.
He bridges ancient Eastern wisdom with modern functional medicine.
His authority: 30 years of practice, 8 books, The Urban Monk Academy.

CRITICAL RULES:
- Write in editorial/journalistic voice — NEVER sound like an ad
- Use "researchers have found" / "a growing body of evidence" / "practitioners are seeing" framing
- Include Dr. Shojai's credentials naturally in the narrative
- The mechanism angle must be specific and counterintuitive (not generic "inflammation is bad")
- Body copy should be 600-900 words of genuine educational value
- End with a soft, curiosity-driven CTA that feels like a logical next step
- No exclamation marks in headlines. No "revolutionary" or "breakthrough" language.
- Output ONLY valid JSON, no markdown code blocks`;

  const userPrompt = `Generate a complete advertorial bridge page for the following:

TOPIC: ${config.label}
MECHANISM ANGLE: ${angle}
TARGET AUDIENCE: ${audience}
PAIN POINTS TO ADDRESS: ${config.painPoints.join(", ")}
OFFER: ${config.offer}

Return a JSON object with these exact fields:
{
  "headline": "The main headline (skeptic-destroying, specific, 10-15 words max)",
  "subheadline": "Supporting subheadline that deepens curiosity (15-25 words)",
  "mechanismAngle": "1-2 sentence explanation of the invisible mechanism concept used in this advertorial",
  "bodyHtml": "Full article body as HTML (use <p>, <h2>, <h3>, <ul>, <li>, <strong>, <em> tags only). 600-900 words. Structure: hook paragraph → mechanism explanation → social proof reference → Dr. Shojai's approach → what most people get wrong → the solution framework → bridge to CTA",
  "metaTitle": "SEO title (55-60 chars)",
  "metaDescription": "Meta description (140-155 chars)"
}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "advertorial_copy",
        strict: true,
        schema: {
          type: "object",
          properties: {
            headline: { type: "string" },
            subheadline: { type: "string" },
            mechanismAngle: { type: "string" },
            bodyHtml: { type: "string" },
            metaTitle: { type: "string" },
            metaDescription: { type: "string" },
          },
          required: ["headline", "subheadline", "mechanismAngle", "bodyHtml", "metaTitle", "metaDescription"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content;
  const parsed = typeof content === "string" ? JSON.parse(content) : content;
  return parsed;
}

// ─── Router ────────────────────────────────────────────────────────────────────
export const advertorialRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    return await db
      .select({
        id: advertorialPages.id,
        slug: advertorialPages.slug,
        topic: advertorialPages.topic,
        campaign: advertorialPages.campaign,
        status: advertorialPages.status,
        headline: advertorialPages.headline,
        ctaUrl: advertorialPages.ctaUrl,
        createdAt: advertorialPages.createdAt,
        publishedAt: advertorialPages.publishedAt,
      })
      .from(advertorialPages)
      .orderBy(advertorialPages.createdAt);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [page] = await db.select().from(advertorialPages).where(eq(advertorialPages.id, input.id));
      if (!page) throw new TRPCError({ code: "NOT_FOUND" });
      return page;
    }),

  getTopics: protectedProcedure.query(async () => {
    return Object.entries(TOPIC_CONFIGS).map(([key, config]) => ({
      key,
      label: config.label,
      defaultCampaign: config.defaultCampaign,
      defaultCtaUrl: config.defaultCtaUrl,
      defaultCtaText: config.defaultCtaText,
      defaultCtaSubtext: config.defaultCtaSubtext,
    }));
  }),

  generate: protectedProcedure
    .input(z.object({
      topic: z.string(),
      customAngle: z.string().optional(),
      targetAudience: z.string().optional(),
      slug: z.string().min(3).max(128).regex(/^[a-z0-9-]+$/),
      campaign: z.string().optional(),
      ctaUrl: z.string().optional(),
      ctaText: z.string().optional(),
      ctaSubtext: z.string().optional(),
      publicationName: z.string().optional(),
      authorName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const config = TOPIC_CONFIGS[input.topic];
      if (!config) throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown topic" });

      const copy = await generateAdvertorialCopy({
        topic: input.topic,
        customAngle: input.customAngle,
        targetAudience: input.targetAudience,
      });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const now = Date.now();
      const [result] = await db.insert(advertorialPages).values({
        slug: input.slug,
        topic: input.topic,
        campaign: input.campaign || config.defaultCampaign,
        status: "draft",
        publicationName: input.publicationName || "The Urban Monk Insider",
        authorName: input.authorName || "Dr. Pedram Shojai, OMD",
        readTime: "3 min read",
        headline: copy.headline,
        subheadline: copy.subheadline,
        mechanismAngle: copy.mechanismAngle,
        bodyHtml: copy.bodyHtml,
        ctaText: input.ctaText || config.defaultCtaText,
        ctaSubtext: input.ctaSubtext || config.defaultCtaSubtext,
        ctaUrl: input.ctaUrl || config.defaultCtaUrl,
        metaTitle: copy.metaTitle,
        metaDescription: copy.metaDescription,
        generationPrompt: `topic:${input.topic} angle:${input.customAngle || config.mechanism}`,
        generationModel: "default",
        createdAt: now,
        updatedAt: now,
      });

      const insertId = (result as any).insertId;
      const [page] = await db.select().from(advertorialPages).where(eq(advertorialPages.id, insertId));
      return page;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      headline: z.string().optional(),
      subheadline: z.string().optional(),
      bodyHtml: z.string().optional(),
      ctaText: z.string().optional(),
      ctaSubtext: z.string().optional(),
      ctaUrl: z.string().optional(),
      heroImageUrl: z.string().optional(),
      publicationName: z.string().optional(),
      authorName: z.string().optional(),
      readTime: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { id, ...fields } = input;
      const updates: Record<string, unknown> = { updatedAt: Date.now() };
      for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined) updates[k] = v;
      }
      await db.update(advertorialPages).set(updates).where(eq(advertorialPages.id, id));
      const [page] = await db.select().from(advertorialPages).where(eq(advertorialPages.id, id));
      return page;
    }),

  setStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["draft", "published", "archived"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const now = Date.now();
      await db.update(advertorialPages).set({
        status: input.status,
        publishedAt: input.status === "published" ? now : undefined,
        updatedAt: now,
      }).where(eq(advertorialPages.id, input.id));
      const [page] = await db.select().from(advertorialPages).where(eq(advertorialPages.id, input.id));
      return page;
    }),

  regenerate: protectedProcedure
    .input(z.object({
      id: z.number(),
      customAngle: z.string().optional(),
      targetAudience: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [page] = await db.select().from(advertorialPages).where(eq(advertorialPages.id, input.id));
      if (!page) throw new TRPCError({ code: "NOT_FOUND" });

      const copy = await generateAdvertorialCopy({
        topic: page.topic,
        customAngle: input.customAngle,
        targetAudience: input.targetAudience,
      });

      const now = Date.now();
      await db.update(advertorialPages).set({
        headline: copy.headline,
        subheadline: copy.subheadline,
        mechanismAngle: copy.mechanismAngle,
        bodyHtml: copy.bodyHtml,
        metaTitle: copy.metaTitle,
        metaDescription: copy.metaDescription,
        updatedAt: now,
      }).where(eq(advertorialPages.id, input.id));

      const [updated] = await db.select().from(advertorialPages).where(eq(advertorialPages.id, input.id));
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.delete(advertorialPages).where(eq(advertorialPages.id, input.id));
      return { success: true };
    }),
});

// ─── HTML Renderer ─────────────────────────────────────────────────────────────
export function renderAdvertorialHtml(page: AdvertorialPage): string {
  const pixelId = page.metaPixelId || "1498608757116877";
  const ga4Id = page.ga4Id || "G-CXZK2Q275S";
  const pubDate = new Date(page.createdAt).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${page.metaTitle || page.headline || "The Urban Monk Insider"}</title>
  <meta name="description" content="${page.metaDescription || ""}" />
  <meta property="og:title" content="${page.headline || ""}" />
  <meta property="og:description" content="${page.subheadline || ""}" />
  <meta property="og:type" content="article" />

  <!-- Meta Pixel -->
  <script>
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${pixelId}');
    fbq('track', 'PageView');
    fbq('track', 'ViewContent', { content_name: '${(page.slug || "").replace(/'/g, "\\'")}', content_category: '${(page.topic || "").replace(/'/g, "\\'")}' });
  </script>
  <noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"/></noscript>

  <!-- Google Analytics -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=${ga4Id}"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4Id}');</script>

  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, 'Times New Roman', serif; background: #fafaf8; color: #1a1a1a; line-height: 1.7; }
    .pub-header { background: #1a1a1a; color: #fff; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; font-family: 'Helvetica Neue', Arial, sans-serif; }
    .pub-name { font-size: 15px; font-weight: 700; letter-spacing: 0.05em; }
    .pub-tagline { font-size: 11px; color: #999; letter-spacing: 0.08em; text-transform: uppercase; }
    .sponsored-label { font-size: 10px; color: #aaa; text-transform: uppercase; letter-spacing: 0.1em; border: 1px solid #444; padding: 2px 8px; border-radius: 2px; }
    .article-wrap { max-width: 680px; margin: 0 auto; padding: 40px 24px 80px; }
    .article-category { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #c0392b; margin-bottom: 16px; }
    h1.headline { font-size: clamp(26px, 5vw, 38px); font-weight: 700; line-height: 1.25; color: #111; margin-bottom: 16px; }
    .subheadline { font-size: 18px; color: #444; line-height: 1.5; margin-bottom: 24px; font-style: italic; }
    .byline { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #666; padding-bottom: 20px; border-bottom: 1px solid #e0e0e0; margin-bottom: 28px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    .byline .author { font-weight: 600; color: #333; }
    .byline .read-time { background: #f0f0f0; padding: 2px 8px; border-radius: 12px; font-size: 11px; }
    .hero-placeholder { width: 100%; height: 280px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); border-radius: 4px; margin-bottom: 28px; }
    .body-copy p { margin-bottom: 20px; font-size: 17px; }
    .body-copy h2 { font-size: 22px; font-weight: 700; margin: 32px 0 12px; color: #111; }
    .body-copy h3 { font-size: 18px; font-weight: 700; margin: 24px 0 10px; color: #222; }
    .body-copy ul, .body-copy ol { margin: 16px 0 20px 24px; }
    .body-copy li { margin-bottom: 8px; font-size: 17px; }
    .body-copy strong { color: #111; }
    .cta-section { margin-top: 40px; padding: 32px; background: #1a1a1a; border-radius: 8px; text-align: center; color: #fff; }
    .cta-section h2 { font-size: 22px; font-weight: 700; margin-bottom: 12px; color: #fff; }
    .cta-section p { font-size: 15px; color: #ccc; margin-bottom: 24px; font-family: 'Helvetica Neue', Arial, sans-serif; }
    .cta-btn { display: inline-block; background: #00d4ff; color: #000; font-family: 'Helvetica Neue', Arial, sans-serif; font-weight: 700; font-size: 16px; padding: 14px 32px; border-radius: 4px; text-decoration: none; letter-spacing: 0.02em; }
    .cta-subtext { font-size: 12px; color: #888; margin-top: 12px; font-family: 'Helvetica Neue', Arial, sans-serif; }
    .disclaimer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #999; line-height: 1.6; }
    @media (max-width: 600px) { .article-wrap { padding: 24px 16px 60px; } h1.headline { font-size: 24px; } .cta-section { padding: 24px 16px; } }
  </style>
</head>
<body>
  <div class="pub-header">
    <div>
      <div class="pub-name">${page.publicationName || "The Urban Monk Insider"}</div>
      <div class="pub-tagline">Health · Longevity · Ancient Wisdom</div>
    </div>
    <div class="sponsored-label">Sponsored</div>
  </div>

  <div class="article-wrap">
    <div class="article-category">Health &amp; Longevity</div>
    <h1 class="headline">${page.headline || ""}</h1>
    ${page.subheadline ? `<div class="subheadline">${page.subheadline}</div>` : ""}
    <div class="byline">
      <span>By <span class="author">${page.authorName || "Dr. Pedram Shojai, OMD"}</span></span>
      <span>${pubDate}</span>
      <span class="read-time">${page.readTime || "3 min read"}</span>
    </div>
    ${page.heroImageUrl
      ? `<img src="${page.heroImageUrl}" alt="Article header" style="width:100%;height:280px;object-fit:cover;border-radius:4px;margin-bottom:28px;" />`
      : `<div class="hero-placeholder"></div>`
    }
    <div class="body-copy">${page.bodyHtml || ""}</div>

    <div class="cta-section">
      <h2>Ready to Find Out What's Really Going On?</h2>
      <p>${page.ctaSubtext || "Take the free 60-second assessment and get your personalized protocol."}</p>
      <a href="${page.ctaUrl || "https://theacademy.theurbanmonk.com"}" class="cta-btn" onclick="typeof fbq !== 'undefined' && fbq('track', 'Lead')">
        ${page.ctaText || "Check Your Eligibility →"}
      </a>
    </div>

    <div class="disclaimer">
      <strong>Disclosure:</strong> This is a sponsored editorial. The information provided is for educational purposes only and is not intended as medical advice. Individual results may vary. Consult your healthcare provider before making any changes to your health regimen. Dr. Pedram Shojai, OMD is a licensed Doctor of Oriental Medicine.
    </div>
  </div>
</body>
</html>`;
}
