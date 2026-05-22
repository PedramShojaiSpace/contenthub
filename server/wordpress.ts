/**
 * WordPress REST API integration for The Urban Monk (theurbanmonk.com)
 * Uses Application Password authentication (Basic Auth over HTTPS)
 *
 * SEO Implementation: GhostLink OS B1/B15 Pillar Standards
 * - Full Yoast SEO meta fields (focus keyword, SEO title, meta description, canonical)
 * - Article schema (JSON-LD) for E-E-A-T and Google rich results
 * - FAQ schema (JSON-LD) for featured snippets and AI engine citation
 * - Image alt text for accessibility and image SEO
 * - Open Graph and Twitter Card meta via Yoast
 */

import { safeParseJson } from "./fetchUtils";

function getWpAuth(): { baseUrl: string; authHeader: string } {
  const baseUrl = (process.env.WORDPRESS_URL ?? "").replace(/\/$/, "");
  const username = process.env.WORDPRESS_USERNAME ?? "";
  const appPassword = process.env.WORDPRESS_APP_PASSWORD ?? "";
  const authHeader =
    "Basic " + Buffer.from(`${username}:${appPassword}`).toString("base64");
  return { baseUrl, authHeader };
}

/**
 * Fetch wrapper with a hard timeout and maintenance-mode detection.
 * Throws a descriptive error instead of hanging indefinitely.
 */
async function wpFetch(
  url: string,
  options: RequestInit = {},
  timeoutMs = 20_000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    // Detect WordPress maintenance mode (503 with autoupdater meta tag)
    if (res.status === 503) {
      const body = await res.text();
      if (body.includes("autoupdater") || body.includes("maintenance") || body.includes("Site is offline")) {
        throw new Error(
          "WordPress is currently in maintenance mode. Please wait a few minutes and try publishing again."
        );
      }
      throw new Error(`WordPress returned 503: ${body.substring(0, 200)}`);
    }
    return res;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        "WordPress did not respond within 20 seconds. The site may be in maintenance mode or experiencing high load. Please try again."
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Upload an image from a URL to the WordPress media library.
 * Returns the WordPress media attachment ID and the hosted URL.
 */
export async function uploadMediaFromUrl(
  imageUrl: string,
  filename: string,
  altText?: string
): Promise<{ id: number; url: string }> {
  const { baseUrl, authHeader } = getWpAuth();

  // Fetch the image bytes (30s timeout for large images)
  const imgRes = await wpFetch(imageUrl, {}, 30_000);
  if (!imgRes.ok) {
    throw new Error(`Failed to fetch image from URL: ${imgRes.statusText}`);
  }
  const imgBuffer = await imgRes.arrayBuffer();
  const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";

  // Upload to WordPress media endpoint (30s timeout for large uploads)
  const uploadRes = await wpFetch(`${baseUrl}/wp-json/wp/v2/media`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": contentType,
    },
    body: imgBuffer,
  }, 30_000);

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`WordPress media upload failed: ${errText}`);
  }

  const media = await safeParseJson<{
    id: number;
    source_url: string;
  }>(uploadRes, "WordPress media upload");

  // Set alt text for image SEO
  if (altText && media.id) {
    await wpFetch(`${baseUrl}/wp-json/wp/v2/media/${media.id}`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        alt_text: altText,
        caption: altText,
        description: altText,
      }),
    }, 10_000).catch(() => {
      // Non-fatal — alt text update failure doesn't block publish
    });
  }

  return { id: media.id, url: media.source_url };
}

export interface WpPostInput {
  title: string;
  slug: string;
  content: string; // HTML — WP stores as-is
  excerpt?: string;
  status?: "draft" | "publish" | "pending" | "future";
  featuredMediaId?: number;
  categories?: number[];
  tags?: number[];
  date?: string; // ISO 8601 UTC date string for scheduled posts (status: "future")

  // ─── Yoast SEO fields ────────────────────────────────────────────────────────
  metaDescription?: string;      // _yoast_wpseo_metadesc (150-160 chars)
  focusKeyword?: string;          // _yoast_wpseo_focuskw
  seoTitle?: string;              // _yoast_wpseo_title (if different from post title)
  canonicalUrl?: string;          // _yoast_wpseo_canonical

  // ─── Schema markup (injected as JSON-LD in post content) ────────────────────────────────────
  articleSchema?: string;         // JSON-LD Article schema block (pre-built)
  faqSchema?: string;             // JSON-LD FAQPage schema block (pre-built)

  // ─── CTA Banner ──────────────────────────────────────────────────────────────────────────────
  ctaBannerUrl?: string;          // URL of the AI-generated CTA banner image
}

export interface WpPostResult {
  id: number;
  link: string;
  status: string;
  editLink: string;
}

/**
 * Build Article JSON-LD schema for E-E-A-T and Google rich results.
 * Follows GhostLink OS B15 AEO requirements.
 */
function buildArticleSchema(params: {
  title: string;
  slug: string;
  metaDescription: string;
  heroImageUrl?: string;
  baseUrl: string;
  datePublished?: string;
}): string {
  const url = `${params.baseUrl}/${params.slug}/`;
  const now = params.datePublished ?? new Date().toISOString();
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: params.title,
    description: params.metaDescription,
    url,
    datePublished: now,
    dateModified: now,
    author: {
      "@type": "Person",
      name: "Dr. Pedram Shojai",
      url: "https://theurbanmonk.com/about",
      sameAs: [
        "https://www.instagram.com/urbanmonkofficial",
        "https://www.youtube.com/@theurbanmonk",
        "https://www.linkedin.com/in/pedramshojai",
      ],
      jobTitle: "Doctor of Oriental Medicine, Taoist Monk, Author",
      description:
        "Dr. Pedram Shojai (OMD) is a New York Times bestselling author, Doctor of Oriental Medicine, Taoist monk, and filmmaker. Founder of The Urban Monk wellness education platform.",
    },
    publisher: {
      "@type": "Organization",
      name: "The Urban Monk",
      url: "https://theurbanmonk.com",
      logo: {
        "@type": "ImageObject",
        url: "https://theurbanmonk.com/wp-content/uploads/urban-monk-logo.png",
      },
    },
    ...(params.heroImageUrl
      ? {
          image: {
            "@type": "ImageObject",
            url: params.heroImageUrl,
            width: 1200,
            height: 675,
          },
        }
      : {}),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
  };
  return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
}

/**
 * Build FAQPage JSON-LD schema from a Markdown FAQ section.
 * Parses ### Question / Answer pairs from the GhostLink OS FAQ format.
 * Critical for Google featured snippets and AI engine (ChatGPT, Perplexity) citation.
 */
function buildFaqSchema(faqMarkdown: string): string | null {
  if (!faqMarkdown) return null;

  const entries: Array<{ question: string; answer: string }> = [];
  // Match ### Question\nAnswer blocks
  const blocks = faqMarkdown.split(/\n(?=###\s)/);
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (!lines[0]) continue;
    const question = lines[0].replace(/^###\s*/, "").trim();
    const answer = lines
      .slice(1)
      .join(" ")
      .replace(/\*\*/g, "")
      .replace(/\[.*?\]\(.*?\)/g, "")
      .trim();
    if (question && answer) {
      entries.push({ question, answer });
    }
  }

  if (entries.length === 0) return null;

  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((e) => ({
      "@type": "Question",
      name: e.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: e.answer,
      },
    })),
  };
  return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
}

/**
 * Create a new WordPress post with full SEO optimization.
 * Injects Yoast SEO meta fields, Article schema, and FAQ schema.
 * Returns the post ID, public link, and admin edit link.
 */
export async function createWpPost(input: WpPostInput): Promise<WpPostResult> {
  const { baseUrl, authHeader } = getWpAuth();

  // JSON-LD schema injection strategy:
  // WordPress strips <script> tags from Classic Editor post content, but it PRESERVES them
  // inside Gutenberg <!-- wp:html --> raw HTML blocks. We append the schema blocks as
  // raw HTML blocks at the very end of the post content so they survive sanitization.
  // This is the standard approach used by Rank Math, SEOPress, and custom schema plugins.
  let enrichedContent = input.content;
  const schemaBlocks: string[] = [];
  if (input.articleSchema) {
    schemaBlocks.push(`<!-- wp:html -->\n${input.articleSchema}\n<!-- /wp:html -->`);
  }
  if (input.faqSchema) {
    schemaBlocks.push(`<!-- wp:html -->\n${input.faqSchema}\n<!-- /wp:html -->`);
  }
  if (schemaBlocks.length > 0) {
    enrichedContent = enrichedContent + "\n\n" + schemaBlocks.join("\n\n");
  }

  const body: Record<string, unknown> = {
    title: input.title,
    slug: input.slug,
    content: enrichedContent,
    status: input.status ?? "draft",
  };

  if (input.excerpt) body.excerpt = input.excerpt;
  if (input.featuredMediaId) body.featured_media = input.featuredMediaId;
  if (input.categories?.length) body.categories = input.categories;
  if (input.tags?.length) body.tags = input.tags;
  if (input.date) body.date_gmt = input.date;

  // ─── Yoast SEO meta fields ───────────────────────────────────────────────────
  // Yoast SEO (free) does NOT expose its protected meta keys (_yoast_wpseo_*) via the
  // standard WP REST API 'meta' field. The only working approach is the 'yoast_meta'
  // top-level field that Yoast registers on the post endpoint.
  // Sub-keys use the format WITHOUT the leading underscore: yoast_wpseo_*
  //
  // Confirmed working via live API testing:
  //   yoast_wpseo_title      → sets the Yoast SEO title
  //   yoast_wpseo_metadesc   → sets the Yoast meta description
  //   yoast_wpseo_focuskw    → sets the Yoast focus keyphrase
  //   yoast_wpseo_canonical  → sets the canonical URL
  const yoastMeta: Record<string, string> = {};
  if (input.seoTitle) yoastMeta["yoast_wpseo_title"] = input.seoTitle;
  if (input.metaDescription) yoastMeta["yoast_wpseo_metadesc"] = input.metaDescription;
  if (input.focusKeyword) yoastMeta["yoast_wpseo_focuskw"] = input.focusKeyword;
  if (input.canonicalUrl) yoastMeta["yoast_wpseo_canonical"] = input.canonicalUrl;

  if (Object.keys(yoastMeta).length > 0) {
    body.yoast_meta = yoastMeta;
  }

  const res = await wpFetch(`${baseUrl}/wp-json/wp/v2/posts`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WordPress post creation failed: ${errText}`);
  }

  const post = await safeParseJson<{
    id: number;
    link: string;
    status: string;
  }>(res, "WordPress post creation");

  // ─── Second-pass Yoast update ────────────────────────────────────────────────
  // Some Yoast fields (metadesc, focuskw) may not be written on the initial POST
  // if the Yoast plugin hasn't fully registered its REST fields yet for a new post.
  // A follow-up PATCH on the created post ID ensures all fields are persisted.
  if (Object.keys(yoastMeta).length > 0) {
    try {
      const updateRes = await wpFetch(`${baseUrl}/wp-json/wp/v2/posts/${post.id}`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ yoast_meta: yoastMeta }),
      }, 15_000);
      if (!updateRes.ok) {
        const errText = await updateRes.text();
        console.warn(`[WP] Yoast second-pass update failed (non-fatal): ${errText.substring(0, 200)}`);
      } else {
        console.log(`[WP] Yoast SEO fields updated for post ${post.id}`);
      }
    } catch (err) {
      console.warn("[WP] Yoast second-pass update failed (non-fatal):", err);
    }
  }

  // ─── CTA Banner: upload to WP media library + set custom field ──────────────────────────────
  // If a ctaBannerUrl is provided, upload the image to WP media and store the
  // resulting WP media URL in the post's _cta_banner_url custom meta field.
  // This lets the theme render the banner natively without relying on an external CDN URL.
  if (input.ctaBannerUrl) {
    try {
      const bannerExt = input.ctaBannerUrl.toLowerCase().endsWith(".png") ? "png" : "jpg";
      const bannerFilename = `${input.slug}-cta-banner.${bannerExt}`;
      const bannerMedia = await uploadMediaFromUrl(
        input.ctaBannerUrl,
        bannerFilename,
        `${input.title} — CTA Banner`
      );
      // Set _cta_banner_url custom field via WP REST API meta
      try {
        const metaRes = await wpFetch(`${baseUrl}/wp-json/wp/v2/posts/${post.id}`, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            meta: { _cta_banner_url: bannerMedia.url },
          }),
        }, 15_000);
        if (metaRes.ok) {
          console.log(`[WP] CTA banner uploaded and meta set for post ${post.id}: ${bannerMedia.url}`);
        } else {
          const errText = await metaRes.text();
          console.warn(`[WP] CTA banner meta update failed (non-fatal): ${errText.substring(0, 200)}`);
        }
      } catch (metaErr) {
        console.warn("[WP] CTA banner meta update failed (non-fatal):", metaErr);
      }
    } catch (bannerErr) {
      console.warn("[WP] CTA banner upload failed (non-fatal):", bannerErr);
    }
  }

  return {
    id: post.id,
    link: post.link,
    status: post.status,
    editLink: `${baseUrl}/wp-admin/post.php?post=${post.id}&action=edit`,
  };
}

/**
 * Convenience export: build all schema blocks for a blog post.
 * Called from the publish procedure before createWpPost.
 */
export function buildBlogSchemas(params: {
  title: string;
  slug: string;
  metaDescription: string;
  heroImageUrl?: string;
  faqSection?: string;
  baseUrl: string;
  datePublished?: string;
}): { articleSchema: string; faqSchema: string | null } {
  return {
    articleSchema: buildArticleSchema(params),
    faqSchema: params.faqSection ? buildFaqSchema(params.faqSection) : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// WordPress Post Index — Sync published posts for internal link injection
// ─────────────────────────────────────────────────────────────────────────────

export interface WpPostSummary {
  wpPostId: number;
  title: string;
  slug: string;
  url: string;
  excerpt: string;
  categories: string[];
  tags: string[];
  publishedAt: string;
}

/**
 * Fetch all published posts from the WordPress REST API.
 * Paginates through all pages to return the complete list.
 * Returns an array of WpPostSummary objects ready for DB upsert.
 */
export async function fetchAllWpPosts(): Promise<WpPostSummary[]> {
  const { baseUrl, authHeader } = getWpAuth();
  const posts: WpPostSummary[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const url = `${baseUrl}/wp-json/wp/v2/posts?status=publish&per_page=${perPage}&page=${page}&_fields=id,title,slug,link,excerpt,categories,tags,date_gmt&_embed=false`;
    const res = await wpFetch(url, {
      headers: { Authorization: authHeader },
    });

    if (!res.ok) {
      if (res.status === 400) break; // WP returns 400 when page exceeds total
      throw new Error(`WP posts fetch failed (page ${page}): ${res.statusText}`);
    }

    const data = await safeParseJson<Array<{
      id: number;
      title: { rendered: string };
      slug: string;
      link: string;
      excerpt: { rendered: string };
      categories: number[];
      tags: number[];
      date_gmt: string;
    }>>(res, "WordPress posts fetch");

    if (!data || data.length === 0) break;

    for (const p of data) {
      // Strip HTML from excerpt
      const rawExcerpt = p.excerpt?.rendered ?? "";
      const cleanExcerpt = rawExcerpt.replace(/<[^>]+>/g, "").trim().slice(0, 500);
      posts.push({
        wpPostId: p.id,
        title: p.title?.rendered ?? "",
        slug: p.slug,
        url: p.link,
        excerpt: cleanExcerpt,
        categories: (p.categories ?? []).map(String),
        tags: (p.tags ?? []).map(String),
        publishedAt: p.date_gmt,
      });
    }

    // Check if there are more pages
    const totalPages = parseInt(res.headers.get("X-WP-TotalPages") ?? "1", 10);
    if (page >= totalPages) break;
    page++;
  }

  return posts;
}

/**
 * Update Yoast SEO fields on an existing WordPress post without changing its content.
 * Used to backfill SEO metadata on already-published posts.
 */
export async function updateWpPostYoast(params: {
  wpPostId: number;
  seoTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
  canonicalUrl?: string;
}): Promise<{ success: boolean; postId: number }> {
  const { baseUrl, authHeader } = getWpAuth();

  const yoastMeta: Record<string, string> = {};
  if (params.seoTitle) yoastMeta["yoast_wpseo_title"] = params.seoTitle;
  if (params.metaDescription) yoastMeta["yoast_wpseo_metadesc"] = params.metaDescription;
  if (params.focusKeyword) yoastMeta["yoast_wpseo_focuskw"] = params.focusKeyword;
  if (params.canonicalUrl) yoastMeta["yoast_wpseo_canonical"] = params.canonicalUrl;

  if (Object.keys(yoastMeta).length === 0) {
    return { success: true, postId: params.wpPostId };
  }

  const res = await wpFetch(`${baseUrl}/wp-json/wp/v2/posts/${params.wpPostId}`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ yoast_meta: yoastMeta }),
  }, 20_000);

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WordPress Yoast update failed: ${errText.substring(0, 300)}`);
  }

  return { success: true, postId: params.wpPostId };
}

/**
 * Find the most relevant published posts for a given topic/keyword.
 * Used to inject real internal link candidates into the blog generation prompt.
 * Returns up to `limit` posts whose title or excerpt contains any of the keywords.
 */
export function findRelevantPosts(
  posts: WpPostSummary[],
  topic: string,
  limit = 8
): WpPostSummary[] {
  const keywords = topic
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);

  const scored = posts.map((p) => {
    const text = `${p.title} ${p.excerpt}`.toLowerCase();
    const score = keywords.reduce(
      (acc, kw) => acc + (text.includes(kw) ? 1 : 0),
      0
    );
    return { post: p, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.post);
}
