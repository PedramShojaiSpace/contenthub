/**
 * Pillar Post Generator — Gut Health & Sleep Optimization
 *
 * Generates and publishes the two remaining pillar pages:
 *  1. "gut health" (keyword_targets id: 1)
 *  2. "sleep optimization" (keyword_targets id: 20)
 *
 * Uses the same LLM pipeline as the tRPC generateBlog procedure.
 * Run with: cd /home/ubuntu/lights-on-optin && npx tsx scripts/generate-pillar-posts.ts
 */

import "dotenv/config";
import { invokeLLM } from "../server/_core/llm";
import { generateImage } from "../server/_core/imageGeneration";
import { createWpPost, buildBlogSchemas, fetchAllWpPosts, findRelevantPosts, type WpPostSummary } from "../server/wordpress";
import { markdownToWpHtml, DEFAULT_WP_CATEGORIES, resolveOrCreateWpTags } from "../server/wpContentUtils";
import { scrubHallucinatedUrls } from "../server/urlScrubber";
import { resolvePlaceholderLinks } from "../server/urlScrubber";
import { getDb } from "../server/db";

// ─── BLOG PROMPT (same as routers.ts) ─────────────────────────────────────────
const BLOG_PROMPT = `You are a ghostwriter for Dr. Pedram Shojai (The Urban Monk) writing a publication-ready long-form blog article for theurbanmonk.com. This article must pass BOTH traditional Google SEO and AI Engine Optimization (AEO) — meaning it will be cited by ChatGPT, Perplexity, Claude, and Google AI Overviews.

AUDIENCE: Educated, health-conscious adults aged 30-55. Ambitious professionals, parents, and seekers who are serious about optimizing their biology, reducing chronic stress, and integrating ancient wisdom with modern science. They are skeptical of hype but hungry for evidence-based alternatives. They have tried conventional medicine and found it lacking. They want depth, not listicles.

VOICE (GhostLink OS B6 Voice Rules — non-negotiable):
- Sentences ≤18 words average. Break anything longer.
- No adverbs modifying verbs. Pick a stronger verb.
- BANNED WORDS: leverage, strategic, solutions, stakeholder, ecosystem, robust, synergy, paradigm, best-in-class, world-class, empowering, transforming, revolutionizing, unlocking, perhaps, maybe, kind of, sort of, in today's world, at the end of the day
- Concrete nouns over abstract nouns. Every bold claim has a receipt within 2 sentences.
- Direct address: "you" and "we" — never "one" or "users"
- Opinions land hard. No "I think maybe."
- Pedram writes as a doctor (OMD), a Taoist monk, a filmmaker, and a father. Warm but direct. He cites mechanisms (not just studies). He tells short stories. Never condescending. No fluff.

CRITICAL OUTPUT RULES:
- Output ONLY the full article body in clean Markdown. Do NOT wrap in JSON. Do NOT include a title H1 at the top. Start directly with the opening hook paragraph. Write the complete article — all sections fully developed — ending with the FAQ section. Do not stop early.

ARTICLE STRUCTURE (follow exactly — this is the GhostLink OS Written Pillar Architecture):

1. OPENING HOOK (2-3 paragraphs, 200-250 words):
   Select hook from the 12 families based on emotional driver. Start with the painful truth — a provocative statement, a surprising statistic, or a brief patient story. Establish the problem viscerally. Make the reader feel seen. End with a bridge sentence that promises real answers. The first sentence must pass the 3-second scroll test: specific, tensioned, relevant.

2. KEY TAKEAWAYS (immediately after the opening hook, before the first H2):
   Output a Markdown block that begins with the exact heading: ## Key Takeaways
   Then write 4-6 concise bullet points (using - ) that summarise the most actionable insights the reader will gain from this article. Each bullet must be a complete sentence, 15-25 words, written in Pedram's warm-but-direct voice.

3. THE HIDDEN PROBLEM — WHY THIS IS HAPPENING (1 H2, 2-3 paragraphs, 200-250 words):
   H2 must contain a semantic keyword and answer a PAA-style question. Diagnose the root cause — the biology, physiology, Taoist or functional medicine lens.

4. WHAT MOST PEOPLE GET WRONG (1 H2, 2-3 paragraphs, 200-250 words):
   H2 must contain a semantic keyword. Use the 3-Mistake Pattern: (1) Tactic mistake, (2) Mindset mistake, (3) System mistake.

5. THE FRAMEWORK — [GIVE IT A MEMORABLE NAME] (1-2 H2 sections, 3-4 paragraphs each, 300-400 words):
   H2 must contain the focus keyword or a semantic variant. Name the framework. For each step: give it a memorable name, teach the core concept, name the common mistake, give a mini-example.

6. PRACTICAL PROTOCOL (1 H2, 2-3 paragraphs, 150-200 words):
   H2 must be a question. Give 3-5 numbered concrete steps.

7. TRANSFORMATION VISION (1-2 paragraphs, 100-150 words):
   Paint the future state using Identity and Inspiration driver language.

8. CLOSING + CTA (2 paragraphs, 150-200 words):
   Bring the article full circle. Close with an empowering statement. Then write a natural CTA paragraph inviting the reader to explore more at https://theurbanmonk.com.

9. FAQ SECTION (place at the END of the article):
   Format: ## Frequently Asked Questions\\n[4-6 PAA questions as ### Question\\nAnswer]

SEO + AEO INTEGRATION RULES:
- H1 (title) must contain the primary focus keyword
- Each H2 must either contain a semantic keyword variant OR be phrased as a question
- Include a clear, direct answer to the core question within the first 300 words
- Use sequential H2/H3 heading structure
- Weave 3-5 semantic keyword variants naturally into headings and body
- Include at least 2 internal links from the VERIFIED INTERNAL LINK LIST
- Include at least 2 outbound links to high-authority sources (PubMed, Harvard Health, Mayo Clinic, NIH)
- The FAQ section targets featured snippets and AI engine citation
- E-E-A-T signals: weave Pedram's credentials naturally into the body

ABSOLUTE RULES:
- NEVER use the URL urbanmonk.com — the ONLY correct domain is theurbanmonk.com
- NEVER invent, guess, or construct a theurbanmonk.com URL not in the VERIFIED INTERNAL LINK LIST
- NEVER fabricate media citations
- NEVER add hashtags
- NEVER include a TL;DR block

TOTAL ARTICLE LENGTH: 2,500-3,000 words (pillar page — longer than standard posts). Every section must be fully developed.

FORMATTING RULES (YOAST READABILITY):
- Use ## for H2 section headings
- Use ### for H3 sub-headings within framework steps
- Every block of text MUST have an H2 or H3 heading within every 300 words
- Every paragraph must be 150 words or fewer
- At least 30% of sentences must begin with or contain a transition word
- Use **bold** for key terms (2-4 per section maximum)
- Use > blockquote for ONE powerful pull-quote per article only
- No bullet lists in the main body — write in flowing prose

CONTENT PILLARS: Gut-brain axis and LPS endotoxemia, sleep architecture and liver detox, cortisol and HPA axis dysregulation, energy economics and time compression syndrome, Taoist philosophy applied to modern life, functional medicine and upstream health, oral microbiome and systemic inflammation, ancient practices with scientific backing (Qigong, meditation, fasting, breathwork), mitochondrial health, circadian biology, neuroplasticity and stress resilience.`;

const BLOG_IMAGE_STYLE = `Wide-format editorial hero image (16:9). Warm, authoritative, and contemplative. Soft golden morning light with warm cream and sage tones. A single light source illuminating a symbolic object or anonymous human figure from the side. Think a high-end wellness magazine or an uplifting documentary thumbnail. No text overlay. Evokes wisdom, transformation, hope, and scientific depth. Timeless, warm quality.`;

// ─── Pillar post definitions ───────────────────────────────────────────────────
const PILLARS = [
  {
    id: 1,
    focusKeyword: "gut health",
    idea: "The Complete Gut Health Guide: Heal Your Microbiome, End Bloating, and Reclaim Your Energy",
    customInstructions: `This is the PILLAR PAGE for the entire Gut Health keyword cluster on theurbanmonk.com. It must be the most comprehensive, authoritative gut health resource on the site. 

Key topics to cover:
- The gut-brain axis and how gut health affects mood, focus, and energy
- LPS endotoxemia and leaky gut — the hidden driver of systemic inflammation
- The microbiome: what it is, why it matters, how modern life destroys it
- The 3 biggest gut health mistakes (antibiotics overuse, processed food, chronic stress)
- Pedram's clinical framework for gut restoration (diet, probiotics, stress, sleep, movement)
- Specific foods that heal vs. harm the gut lining
- The connection between gut health and cortisol/HPA axis
- Practical 30-day gut reset protocol
- Internal links to related cluster posts (cortisol, sleep, detox)

This post anchors the entire Gut Health Authority campaign. It must rank for "gut health" (high-volume pillar keyword) and serve as the hub that all cluster posts link back to.`,
    ctaUrl: "https://theurbanmonk.com/",
  },
  {
    id: 20,
    focusKeyword: "sleep optimization",
    idea: "Sleep Optimization: The Science-Backed Protocol to Fix Your Sleep Architecture and Wake Up Restored",
    customInstructions: `This is the PILLAR PAGE for the entire Sleep & Recovery keyword cluster on theurbanmonk.com. It must be the most comprehensive, authoritative sleep optimization resource on the site.

Key topics to cover:
- Sleep architecture: the 4 stages (N1, N2, N3/deep sleep, REM) and why each matters
- Circadian biology: how light, cortisol, and melatonin govern your sleep-wake cycle
- The liver's detox window (1-3 AM) and why poor sleep = toxic buildup
- The 3 biggest sleep mistakes (blue light, irregular schedule, caffeine timing)
- Pedram's clinical sleep optimization framework (light hygiene, temperature, nervous system regulation)
- The cortisol-sleep connection: how chronic stress destroys sleep architecture
- Ancient practices for sleep: Qigong, meditation, breathwork before bed
- Practical sleep optimization protocol: what to do in the 2 hours before bed
- Internal links to related cluster posts (cortisol, gut health, detox)

This post anchors the entire Sleep & Recovery Authority campaign. It must rank for "sleep optimization" (high-volume pillar keyword) and serve as the hub that all cluster posts link back to.`,
    ctaUrl: "https://theurbanmonk.com/",
  },
];

// ─── Metadata extraction ───────────────────────────────────────────────────────
async function extractMetadata(idea: string, articleBody: string, focusKeyword: string) {
  const metaResponse = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are an SEO metadata extractor. Given a completed blog article, extract the required SEO fields. Return ONLY a valid JSON object with no preamble.`,
      },
      {
        role: "user",
        content: `Extract SEO metadata from this pillar article about: ${idea}\nFocus keyword: ${focusKeyword}\n\nARTICLE:\n${articleBody.slice(0, 3000)}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "blog_metadata",
        strict: true,
        schema: {
          type: "object",
          properties: {
            title: { type: "string", description: "H1 headline, 50-65 chars, contains primary keyword" },
            slug: { type: "string", description: "URL-friendly slug, max 60 chars" },
            metaDescription: { type: "string", description: "150-160 char meta description" },
            focusKeyword: { type: "string", description: "Primary SEO keyword phrase, 2-4 words" },
            semanticKeywords: { type: "array", items: { type: "string" }, description: "3-5 semantic keyword variants" },
            faqSection: { type: "string", description: "Markdown FAQ section with 4-6 PAA questions" },
          },
          required: ["title", "slug", "metaDescription", "focusKeyword", "semanticKeywords", "faqSection"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawMeta = String(metaResponse.choices?.[0]?.message?.content ?? "{}");
  try {
    let cleaned = rawMeta.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    if (jsonStart >= 0 && jsonEnd > jsonStart) cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
    return JSON.parse(cleaned);
  } catch {
    console.warn("[Meta] Metadata extraction failed — using fallback");
    return {
      title: idea.slice(0, 80),
      slug: focusKeyword.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60),
      metaDescription: "",
      focusKeyword,
      semanticKeywords: [],
      faqSection: "",
    };
  }
}

// ─── Main generation loop ──────────────────────────────────────────────────────
async function generatePillarPost(pillar: typeof PILLARS[0]) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`[Pillar] Generating: ${pillar.focusKeyword}`);
  console.log(`${"=".repeat(60)}\n`);

  // 1. Load WordPress post index for internal links
  let internalLinkBlock = "";
  let postIndex: WpPostSummary[] = [];
  try {
    postIndex = await fetchAllWpPosts();
    const relevant = findRelevantPosts(postIndex, pillar.idea, 8);
    const linkLines = relevant.map((p) => `- [${p.title}](${p.url}) — ${p.excerpt.slice(0, 100)}`);
    if (linkLines.length > 0) {
      internalLinkBlock = `\n\nVERIFIED INTERNAL LINK LIST — CRITICAL: You may ONLY use URLs from this list as internal links. Do NOT invent, guess, or construct any theurbanmonk.com URL not shown here. For any topic not covered by a URL in this list, use the placeholder format: [INTERNAL LINK: topic].\n${linkLines.join("\n")}`;
    } else {
      internalLinkBlock = `\n\nVERIFIED INTERNAL LINK LIST — CRITICAL: No pre-verified internal links are available for this topic. Do NOT invent any theurbanmonk.com URLs. Use ONLY the placeholder format for all internal links: [INTERNAL LINK: topic of related article].`;
    }
    console.log(`[Pillar] Loaded ${postIndex.length} WP posts, ${relevant.length} relevant for internal links`);
  } catch (err) {
    console.warn("[Pillar] Could not load WP post index:", err);
    internalLinkBlock = `\n\nVERIFIED INTERNAL LINK LIST — CRITICAL: No pre-verified internal links are available. Use ONLY the placeholder format: [INTERNAL LINK: topic].`;
  }

  const ctaInjection = `\n\n[CTA BLOCK — The Urban Monk]\nIf you want to go deeper on this topic, Dr. Pedram Shojai has created a comprehensive library of resources at The Urban Monk. From ancient practices to cutting-edge functional medicine protocols, you'll find everything you need to reclaim your health.\n[END CTA BLOCK]\nIMPORTANT: Include this CTA naturally in the Conclusion section. Use EXACTLY this URL: ${pillar.ctaUrl}`;

  const userMessage = [
    `Raw idea: ${pillar.idea}`,
    `\nSEO NOTE: The target focus keyword for this article is "${pillar.focusKeyword}". Use it naturally in the opening paragraph, at least one H2 heading, and 5-7 times throughout the body. This is a PILLAR PAGE — it must be the most comprehensive resource on this topic on theurbanmonk.com.`,
    `\nAdditional instructions: ${pillar.customInstructions}`,
    internalLinkBlock,
    ctaInjection,
  ].filter(Boolean).join("");

  // 2. Generate article body
  console.log("[Pillar] Generating article body via LLM...");
  const articleResponse = await invokeLLM({
    messages: [
      { role: "system", content: BLOG_PROMPT },
      { role: "user", content: userMessage },
    ],
    max_tokens: 8192,
  });

  let articleBody = String(articleResponse.choices?.[0]?.message?.content ?? "").trim();
  if (!articleBody || articleBody.length < 1000) {
    throw new Error(`Article generation failed — body too short (${articleBody.length} chars)`);
  }
  console.log(`[Pillar] Article generated: ${articleBody.length} chars`);

  // 3. Scrub hallucinated URLs
  const verifiedUrls = postIndex.map((p) => p.url);
  const { body: scrubbedBody, removed } = scrubHallucinatedUrls(articleBody, verifiedUrls);
  if (removed.length > 0) console.log(`[Pillar] Scrubbed ${removed.length} hallucinated URLs`);

  // 4. Resolve placeholder links
  const postSummaries = postIndex.map((p) => ({ title: p.title, url: p.url, excerpt: p.excerpt }));
  const { body: resolvedBody, resolved, stripped } = resolvePlaceholderLinks(scrubbedBody, postSummaries);
  console.log(`[Pillar] Link resolution: ${resolved.length} resolved, ${stripped.length} stripped`);

  // 5. Extract metadata
  console.log("[Pillar] Extracting SEO metadata...");
  const meta = await extractMetadata(pillar.idea, resolvedBody, pillar.focusKeyword);
  console.log(`[Pillar] Title: ${meta.title}`);
  console.log(`[Pillar] Slug: ${meta.slug}`);
  console.log(`[Pillar] Focus keyword: ${meta.focusKeyword}`);

  // 6. Generate hero image
  console.log("[Pillar] Generating hero image...");
  let heroImageUrl: string | undefined;
  try {
    const promptResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert visual director for The Urban Monk brand. Write a concise, evocative image generation prompt (max 80 words) for a blog hero image. Style: ${BLOG_IMAGE_STYLE}. Return ONLY the prompt, no explanation. IMPORTANT: Avoid the cliché warm-sunrise-yoga-pose aesthetic. Choose a unique, unexpected visual metaphor that is specific to the article topic.`,
        },
        {
          role: "user",
          content: `Blog title: ${meta.title}\nFocus keyword: ${pillar.focusKeyword}\nArticle intro: ${resolvedBody.slice(0, 400)}`,
        },
      ],
    });
    const rawPrompt = promptResponse.choices?.[0]?.message?.content;
    const imagePrompt = typeof rawPrompt === "string" ? rawPrompt : pillar.idea;
    const { url } = await generateImage({ prompt: `${imagePrompt}. Visual style: ${BLOG_IMAGE_STYLE}` });
    heroImageUrl = url;
    console.log(`[Pillar] Hero image generated: ${heroImageUrl?.slice(0, 60)}...`);
  } catch (err) {
    console.warn("[Pillar] Hero image generation failed (non-fatal):", err);
  }

  // 7. Build WordPress content
  const wpHtmlBody = markdownToWpHtml(resolvedBody);
  const wpBaseUrl = (process.env.WORDPRESS_URL ?? "").replace(/\/$/, "");
  const seoTitle = `${meta.title} | The Urban Monk`;
  const metaDesc = meta.metaDescription;

  // 8. Build schemas
  const { articleSchema, faqSchema } = buildBlogSchemas({
    title: meta.title,
    slug: meta.slug,
    metaDescription: metaDesc,
    heroImageUrl,
    faqSection: meta.faqSection,
    baseUrl: wpBaseUrl,
    datePublished: new Date().toISOString(),
  });

  // 9. Sanitize slug and add uniqueness suffix
  const sanitizeSlug = (raw: string): string =>
    raw.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "").slice(0, 55);
  const baseSlug = sanitizeSlug(meta.slug || pillar.focusKeyword);
  const slugSuffix = Date.now().toString(36).slice(-4);
  const safeSlug = `${baseSlug}-${slugSuffix}`;

  // 10. Resolve tags
  const authHeader = "Basic " + Buffer.from(`${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`).toString("base64");
  const allKeywords = [meta.focusKeyword, ...(meta.semanticKeywords ?? [])].filter(Boolean);
  let wpTagIds: number[] = [];
  try {
    wpTagIds = await resolveOrCreateWpTags(allKeywords, authHeader, wpBaseUrl);
    console.log(`[Pillar] Resolved ${wpTagIds.length} WP tags`);
  } catch (err) {
    console.warn("[Pillar] Tag resolution failed (non-fatal):", err);
  }

  // 11. Upload hero image to WP media library
  let featuredMediaId: number | undefined;
  let wpImageUrl: string | undefined;
  if (heroImageUrl) {
    try {
      const { uploadMediaFromUrl } = await import("../server/wordpress");
      const ext = heroImageUrl.toLowerCase().endsWith(".png") ? "png" : "jpg";
      const media = await uploadMediaFromUrl(
        heroImageUrl,
        `${safeSlug}-hero.${ext}`,
        `${meta.title} — The Urban Monk`
      );
      featuredMediaId = media.id;
      wpImageUrl = media.url;
      console.log(`[Pillar] Hero image uploaded to WP: media ID ${featuredMediaId}`);
    } catch (err) {
      console.warn("[Pillar] Hero image WP upload failed (non-fatal):", err);
    }
  }

  // 12. Publish to WordPress
  console.log("[Pillar] Publishing to WordPress...");
  const post = await createWpPost({
    title: meta.title,
    slug: safeSlug,
    content: wpHtmlBody,
    excerpt: metaDesc,
    status: "publish",
    featuredMediaId,
    categories: DEFAULT_WP_CATEGORIES,
    tags: wpTagIds.length > 0 ? wpTagIds : undefined,
    metaDescription: metaDesc,
    focusKeyword: meta.focusKeyword,
    seoTitle,
    canonicalUrl: `${wpBaseUrl}/${safeSlug}/`,
    articleSchema,
    faqSchema: faqSchema ?? undefined,
  });

  console.log(`\n✅ PUBLISHED: ${meta.title}`);
  console.log(`   URL: ${post.link}`);
  console.log(`   WP Post ID: ${post.id}`);
  console.log(`   Edit: ${post.editLink}`);

  // 13. Save to content_items DB
  try {
    const db = await getDb();
    if (db) {
      const { contentItems } = await import("../drizzle/schema");
      await db.insert(contentItems).values({
        title: meta.title,
        rawIdea: pillar.idea,
        platform: "blog",
        status: "published",
        textContent: resolvedBody,
        imageUrl: wpImageUrl ?? heroImageUrl,
        publishUrl: post.link,
        wpPostId: post.id,
        focusKeyword: meta.focusKeyword,
        seoKeywords: JSON.stringify(meta.semanticKeywords ?? []),
        yoastSeoTitle: seoTitle,
        yoastMetaDescription: metaDesc,
      });
      console.log(`[Pillar] Saved to content_items DB`);
    }
  } catch (err) {
    console.warn("[Pillar] DB save failed (non-fatal):", err);
  }

  // 14. Update keyword_targets with published URL
  try {
    const db = await getDb();
    if (db) {
      const { keywordTargets } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(keywordTargets).set({
        contentStatus: "published",
        publishedUrl: post.link,
      }).where(eq(keywordTargets.id, pillar.id));
      console.log(`[Pillar] Updated keyword_targets id=${pillar.id} with URL: ${post.link}`);
    }
  } catch (err) {
    console.warn("[Pillar] keyword_targets update failed (non-fatal):", err);
  }

  return {
    id: pillar.id,
    focusKeyword: pillar.focusKeyword,
    title: meta.title,
    postId: post.id,
    postUrl: post.link,
    editUrl: post.editLink,
  };
}

async function main() {
  console.log("🚀 Urban Monk Pillar Post Generator");
  console.log(`   Generating ${PILLARS.length} pillar posts...\n`);

  const results = [];
  for (const pillar of PILLARS) {
    try {
      const result = await generatePillarPost(pillar);
      results.push({ ...result, success: true });
    } catch (err) {
      console.error(`\n❌ FAILED: ${pillar.focusKeyword}`, err);
      results.push({ focusKeyword: pillar.focusKeyword, success: false, error: String(err) });
    }
    // Brief pause between posts to avoid rate limits
    if (PILLARS.indexOf(pillar) < PILLARS.length - 1) {
      console.log("\n[Pillar] Pausing 10s before next post...");
      await new Promise((r) => setTimeout(r, 10000));
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("GENERATION COMPLETE");
  console.log("=".repeat(60));
  for (const r of results) {
    if (r.success) {
      console.log(`✅ ${r.focusKeyword}: ${r.postUrl}`);
    } else {
      console.log(`❌ ${r.focusKeyword}: FAILED — ${(r as any).error}`);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
