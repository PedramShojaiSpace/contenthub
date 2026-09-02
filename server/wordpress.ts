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
  if (!baseUrl) {
    throw new Error(
      "WordPress URL is not configured. Set WORDPRESS_URL to the full HTTPS site URL before publishing."
    );
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    throw new Error(
      "WordPress URL is invalid. Set WORDPRESS_URL to a full HTTPS site URL before publishing."
    );
  }
  if (parsedUrl.protocol !== "https:") {
    throw new Error("WordPress URL must use HTTPS before publishing.");
  }
  if (!username || !appPassword) {
    throw new Error(
      "WordPress credentials are not configured. Set WORDPRESS_USERNAME and WORDPRESS_APP_PASSWORD before publishing."
    );
  }
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

export interface WpCategory {
  id: number;
  name: string;
  slug: string;
}

/** Fetch existing WordPress categories for explicit author selection; never creates or edits taxonomy. */
export async function fetchWpCategories(): Promise<WpCategory[]> {
  const { baseUrl, authHeader } = getWpAuth();
  const categories: WpCategory[] = [];
  let page = 1;

  while (true) {
    const res = await wpFetch(
      `${baseUrl}/wp-json/wp/v2/categories?per_page=100&hide_empty=false&orderby=name&order=asc&page=${page}`,
      { headers: { Authorization: authHeader } },
      15_000,
    );
    if (!res.ok) {
      if (res.status === 400) break;
      throw new Error(`WordPress category lookup failed: ${res.statusText}`);
    }

    const rows = await safeParseJson<Array<{ id: number; name: string; slug: string }>>(res, "WordPress category lookup");
    categories.push(...rows.map(row => ({ id: row.id, name: row.name, slug: row.slug })));
    const totalPages = Number(res.headers.get("X-WP-TotalPages") ?? "1");
    if (page >= totalPages) break;
    page += 1;
  }

  return categories;
}

export type WpHandoffCheckState = "passed" | "failed" | "unverified";

export interface WpHandoffCheck {
  key: "status" | "title" | "slug" | "featuredMedia" | "category" | "seoTitle" | "metaDescription" | "focusKeyword" | "canonical";
  label: string;
  expected: string;
  actual: string | null;
  state: WpHandoffCheckState;
}

export interface WpHandoffExpectation {
  postId: number;
  status: "draft" | "publish";
  title: string;
  slug: string;
  featuredMediaId: number;
  categoryId: number;
  seoTitle: string;
  metaDescription: string;
  focusKeyword: string;
  canonicalUrl: string;
}

export interface WpHandoffVerification {
  postId: number;
  verified: boolean;
  checks: WpHandoffCheck[];
}

type WpHandoffReadRecord = {
  status?: string;
  slug?: string;
  title?: { raw?: string; rendered?: string };
  featured_media?: number;
  categories?: number[];
  meta?: Record<string, unknown>;
  yoast_meta?: Record<string, unknown>;
  yoast_head_json?: { title?: string; description?: string; canonical?: string };
};

function normaliseWpText(value: string | null | undefined) {
  return (value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function checkWpHandoffField(params: {
  key: WpHandoffCheck["key"];
  label: string;
  expected: string;
  actual?: string | null;
  matches?: (actual: string, expected: string) => boolean;
}): WpHandoffCheck {
  const actual = normaliseWpText(params.actual);
  if (!actual) return { key: params.key, label: params.label, expected: params.expected, actual: null, state: "unverified" };
  const matches = params.matches ?? ((candidate, expected) => candidate === expected);
  return { key: params.key, label: params.label, expected: params.expected, actual, state: matches(actual, params.expected) ? "passed" : "failed" };
}

/** Evaluate a post-write record against the exact handoff request without performing a write. */
export function evaluateWpHandoffVerification(
  expected: WpHandoffExpectation,
  record: WpHandoffReadRecord,
): WpHandoffVerification {
  const meta = record.meta ?? {};
  const yoastMeta = record.yoast_meta ?? {};
  const head = record.yoast_head_json ?? {};
  const getMeta = (key: string) => {
    const value = meta[`_${key}`] ?? meta[key] ?? yoastMeta[key];
    return typeof value === "string" ? value : null;
  };
  const featuredMedia = String(record.featured_media ?? "");
  const categoryAssigned = Boolean(record.categories?.includes(expected.categoryId));
  const checks: WpHandoffCheck[] = [
    checkWpHandoffField({ key: "status", label: "WordPress status", expected: expected.status, actual: record.status ?? null }),
    checkWpHandoffField({ key: "title", label: "Post title", expected: expected.title, actual: record.title?.raw ?? record.title?.rendered ?? null }),
    checkWpHandoffField({ key: "slug", label: "Post slug", expected: expected.slug, actual: record.slug ?? null }),
    checkWpHandoffField({ key: "featuredMedia", label: "Featured image", expected: String(expected.featuredMediaId), actual: featuredMedia }),
    { key: "category", label: "Selected category", expected: String(expected.categoryId), actual: record.categories?.join(", ") ?? null, state: categoryAssigned ? "passed" : "failed" },
    checkWpHandoffField({ key: "seoTitle", label: "Yoast SEO title", expected: expected.seoTitle, actual: getMeta("yoast_wpseo_title") ?? head.title ?? null, matches: (actual, value) => actual === value || actual.startsWith(`${value} `) }),
    checkWpHandoffField({ key: "metaDescription", label: "Yoast meta description", expected: expected.metaDescription, actual: getMeta("yoast_wpseo_metadesc") ?? head.description ?? null }),
    checkWpHandoffField({ key: "focusKeyword", label: "Yoast focus keyphrase", expected: expected.focusKeyword, actual: getMeta("yoast_wpseo_focuskw") ?? null }),
    checkWpHandoffField({ key: "canonical", label: "Canonical URL", expected: expected.canonicalUrl, actual: getMeta("yoast_wpseo_canonical") ?? head.canonical ?? null, matches: (actual, value) => actual.replace(/\/$/, "") === value.replace(/\/$/, "") }),
  ];
  return { postId: expected.postId, verified: checks.every(check => check.state === "passed"), checks };
}

/** Read back a WordPress post after a Blog Import handoff and verify all required fields. */
export async function verifyWpPostHandoff(expected: WpHandoffExpectation): Promise<WpHandoffVerification> {
  const { baseUrl, authHeader } = getWpAuth();
  const res = await wpFetch(`${baseUrl}/wp-json/wp/v2/posts/${expected.postId}?context=edit`, {
    headers: { Authorization: authHeader },
  }, 20_000);
  if (!res.ok) throw new Error(`WordPress post-write verification failed: ${res.statusText}`);
  const record = await safeParseJson<WpHandoffReadRecord>(res, "WordPress post-write verification");
  return evaluateWpHandoffVerification(expected, record);
}

/** Publish a previously verified WordPress draft without altering any other post field. */
export async function publishVerifiedWpDraft(wpPostId: number): Promise<{ status: string }> {
  const { baseUrl, authHeader } = getWpAuth();
  const res = await wpFetch(`${baseUrl}/wp-json/wp/v2/posts/${wpPostId}`, {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "publish" }),
  }, 20_000);
  if (!res.ok) throw new Error(`WordPress draft publication failed: ${res.statusText}`);
  const post = await safeParseJson<{ status: string }>(res, "WordPress draft publication");
  return { status: post.status };
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
    // BlogPosting is a subtype of Article — it explicitly signals to Google that
    // this is a blog post, which is the correct type for theurbanmonk.com content.
    // This replaces the need for a /blog/ URL prefix in the path structure.
    "@type": "BlogPosting",
    headline: params.title,
    description: params.metaDescription,
    url,
    datePublished: now,
    dateModified: now,
    // isPartOf signals this post belongs to the Urban Monk blog
    isPartOf: {
      "@type": "Blog",
      "@id": "https://theurbanmonk.com/#blog",
      name: "The Urban Monk Blog",
      url: "https://theurbanmonk.com",
    },
    author: {
      "@type": "Person",
      name: "Dr. Pedram Shojai",
      url: "https://theurbanmonk.com/about",
      sameAs: [
        "https://www.instagram.com/urbanmonkofficial",
        "https://www.youtube.com/@theurbanmonk",
        "https://www.linkedin.com/in/pedramshojai",
      ],
      jobTitle: "Doctor of Oriental Medicine, Daoist Monk, Author",
      description:
        "Dr. Pedram Shojai (OMD) is a New York Times bestselling author, Doctor of Oriental Medicine, Daoist monk, and filmmaker. Founder of The Urban Monk wellness education platform.",
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
  // WordPress Classic Editor (wp_kses_post) strips bare <script> tags from post content.
  // The correct approach is to NOT inject schema into post content at all — instead,
  // Yoast SEO generates its own Article schema automatically from the focus keyword,
  // SEO title, and meta description fields we set via the Yoast REST meta fields.
  //
  // For FAQ schema (which Yoast Free does not generate), we use a hidden div wrapper
  // with a data attribute so the raw JSON is preserved in the DB but not rendered
  // visibly. A small functions.php snippet can extract and output it in wp_head.
  // If no snippet is installed, the FAQ schema is simply omitted — it's non-critical.
  let enrichedContent = input.content;
  // Only inject FAQ schema (Article schema is handled by Yoast automatically)
  if (input.faqSchema) {
    // Wrap in a hidden div so Classic Editor preserves the content without rendering it
    // A functions.php snippet can extract this and output it in wp_head if desired.
    // The div is aria-hidden and display:none so it never appears to readers.
    enrichedContent = enrichedContent + `\n\n<div class="schema-faq-data" aria-hidden="true" style="display:none;">${input.faqSchema}</div>`;
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
  // Yoast SEO Free does NOT expose _yoast_wpseo_* keys via the REST API by default.
  // We use a two-pronged approach:
  //
  // 1. `yoast_meta` top-level field (works if Yoast registers it — varies by version)
  //    Sub-keys WITHOUT the leading underscore: yoast_wpseo_focuskw, yoast_wpseo_title, etc.
  //
  // 2. Standard `meta` field with underscore-prefixed keys (works if the site has the
  //    wp-yoast-rest-meta.php snippet installed in functions.php or mu-plugins/).
  //    This is the RECOMMENDED approach — see /home/ubuntu/wp-yoast-rest-meta.php
  //
  // Both are sent simultaneously so whichever mechanism is available on the target site
  // will succeed. The second-pass update below also retries both approaches.
  const yoastMeta: Record<string, string> = {};
  const yoastMetaUnderscore: Record<string, string> = {};
  if (input.seoTitle) {
    yoastMeta["yoast_wpseo_title"] = input.seoTitle;
    yoastMetaUnderscore["_yoast_wpseo_title"] = input.seoTitle;
  }
  if (input.metaDescription) {
    yoastMeta["yoast_wpseo_metadesc"] = input.metaDescription;
    yoastMetaUnderscore["_yoast_wpseo_metadesc"] = input.metaDescription;
  }
  if (input.focusKeyword) {
    yoastMeta["yoast_wpseo_focuskw"] = input.focusKeyword;
    yoastMetaUnderscore["_yoast_wpseo_focuskw"] = input.focusKeyword;
  }
  if (input.canonicalUrl) {
    yoastMeta["yoast_wpseo_canonical"] = input.canonicalUrl;
    yoastMetaUnderscore["_yoast_wpseo_canonical"] = input.canonicalUrl;
  }

  if (Object.keys(yoastMeta).length > 0) {
    body.yoast_meta = yoastMeta;
    // Also try the standard meta field with underscore-prefixed keys
    // (requires wp-yoast-rest-meta.php snippet in functions.php or mu-plugins)
    body.meta = { ...(body.meta as Record<string, string> ?? {}), ...yoastMetaUnderscore };
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
        body: JSON.stringify({ yoast_meta: yoastMeta, meta: yoastMetaUnderscore }),
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
 *
 * Two-pronged approach (same as createWpPost):
 * 1. `yoast_meta` top-level field — works if Yoast registers it (varies by version)
 * 2. `meta` field with underscore-prefixed keys — works if the wp-yoast-rest-meta.php
 *    snippet is installed in functions.php or mu-plugins/.
 *    See: /home/ubuntu/lights-on-optin/docs/wordpress-yoast-rest-api-snippet.php
 */
export async function updateWpPostYoast(params: {
  wpPostId: number;
  seoTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
  canonicalUrl?: string;
}): Promise<{ success: boolean; postId: number; snippetInstalled?: boolean }> {
  const { baseUrl, authHeader } = getWpAuth();

  // Build both field name formats simultaneously
  const yoastMeta: Record<string, string> = {};
  const yoastMetaUnderscore: Record<string, string> = {};

  if (params.seoTitle) {
    yoastMeta["yoast_wpseo_title"] = params.seoTitle;
    yoastMetaUnderscore["_yoast_wpseo_title"] = params.seoTitle;
  }
  if (params.metaDescription) {
    yoastMeta["yoast_wpseo_metadesc"] = params.metaDescription;
    yoastMetaUnderscore["_yoast_wpseo_metadesc"] = params.metaDescription;
  }
  if (params.focusKeyword) {
    yoastMeta["yoast_wpseo_focuskw"] = params.focusKeyword;
    yoastMetaUnderscore["_yoast_wpseo_focuskw"] = params.focusKeyword;
  }
  if (params.canonicalUrl) {
    yoastMeta["yoast_wpseo_canonical"] = params.canonicalUrl;
    yoastMetaUnderscore["_yoast_wpseo_canonical"] = params.canonicalUrl;
  }

  if (Object.keys(yoastMeta).length === 0) {
    return { success: true, postId: params.wpPostId };
  }

  const body: Record<string, unknown> = {
    yoast_meta: yoastMeta,
    // meta field with underscore keys — only works after snippet is installed
    meta: yoastMetaUnderscore,
  };

  const res = await wpFetch(`${baseUrl}/wp-json/wp/v2/posts/${params.wpPostId}`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }, 20_000);

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WordPress Yoast update failed: ${errText.substring(0, 300)}`);
  }

  // Verify whether the snippet is installed by checking if the focus keyword
  // was actually written to the meta field
  let snippetInstalled = false;
  try {
    const verifyRes = await wpFetch(
      `${baseUrl}/wp-json/wp/v2/posts/${params.wpPostId}?context=edit`,
      { headers: { Authorization: authHeader } },
      10_000
    );
    if (verifyRes.ok) {
      const verifyData = await verifyRes.json() as { meta?: Record<string, unknown> };
      const writtenFocuskw = verifyData.meta?.["_yoast_wpseo_focuskw"];
      snippetInstalled = !!(writtenFocuskw && writtenFocuskw === params.focusKeyword);
      if (!snippetInstalled) {
        console.warn(
          `[WP] Yoast focus keyphrase NOT written to meta. ` +
          `The wp-yoast-rest-meta.php snippet must be installed in functions.php. ` +
          `See: /home/ubuntu/lights-on-optin/docs/wordpress-yoast-rest-api-snippet.php`
        );
      } else {
        console.log(`[WP] Yoast SEO fields confirmed written for post ${params.wpPostId}`);
      }
    }
  } catch {
    // Non-fatal — verification failure doesn't block the update
  }

  return { success: true, postId: params.wpPostId, snippetInstalled };
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

/**
 * Fetch the Yoast SEO score for a published WordPress post.
 * Reads the `_yoast_wpseo_linkdex` meta field (SEO score) via the WP REST API.
 *
 * Yoast stores the score as a letter grade:
 *   "good"  → green  (score ≥ 71)
 *   "ok"    → orange (score 41-70)
 *   "bad"   → red    (score ≤ 40)
 *   ""      → not yet calculated (post was never opened in the editor)
 *
 * Requires the wp-yoast-rest-meta.php snippet to be installed in functions.php.
 * Returns null if the snippet is not installed or the post is not found.
 */
export async function getWpYoastScore(
  wpPostId: number
): Promise<{ seoScore: string | null; readabilityScore: string | null }> {
  const { baseUrl, authHeader } = getWpAuth();
  if (!baseUrl) return { seoScore: null, readabilityScore: null };

  try {
    const res = await wpFetch(
      `${baseUrl}/wp-json/wp/v2/posts/${wpPostId}?context=edit`,
      { headers: { Authorization: authHeader } },
      10_000
    );
    if (!res.ok) return { seoScore: null, readabilityScore: null };

    const data = await res.json() as { meta?: Record<string, unknown> };
    const meta = data.meta ?? {};

    // _yoast_wpseo_linkdex: SEO score ("good" | "ok" | "bad" | "")
    const rawSeo = meta["_yoast_wpseo_linkdex"];
    // _yoast_wpseo_content_score: Readability score ("good" | "ok" | "bad" | "")
    const rawReadability = meta["_yoast_wpseo_content_score"];

    const normalise = (v: unknown): string | null => {
      if (typeof v !== "string" || v === "") return null;
      const lower = v.toLowerCase();
      if (["good", "ok", "bad"].includes(lower)) return lower;
      return null;
    };

    return {
      seoScore: normalise(rawSeo),
      readabilityScore: normalise(rawReadability),
    };
  } catch {
    return { seoScore: null, readabilityScore: null };
  }
}

/**
 * Fetch a single WordPress post by ID and return its rendered HTML body
 * plus the current Yoast meta fields (focus keyword, meta description).
 * Used by the fixYoastIssues procedure to get the live post state.
 */
export async function fetchSingleWpPost(wpPostId: number): Promise<{
  content: string;
  focusKeyword: string | null;
  metaDescription: string | null;
  seoTitle: string | null;
}> {
  const { baseUrl, authHeader } = getWpAuth();
  if (!baseUrl) throw new Error("WordPress URL not configured");

  const res = await wpFetch(
    `${baseUrl}/wp-json/wp/v2/posts/${wpPostId}?context=edit`,
    { headers: { Authorization: authHeader } },
    20_000
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WordPress fetch failed: ${errText.substring(0, 300)}`);
  }

  const data = await res.json() as {
    content?: { rendered?: string; raw?: string };
    meta?: Record<string, unknown>;
    yoast_meta?: Record<string, unknown>;
  };

  // Prefer raw (edit context) over rendered so we get the actual stored HTML
  const content = (data.content?.raw ?? data.content?.rendered ?? "") as string;
  const meta = data.meta ?? {};

  const focusKeyword = (meta["_yoast_wpseo_focuskw"] as string | undefined) ?? null;
  const metaDescription = (meta["_yoast_wpseo_metadesc"] as string | undefined) ?? null;
  const seoTitle = (meta["_yoast_wpseo_title"] as string | undefined) ?? null;

  return { content, focusKeyword, metaDescription, seoTitle };
}

/**
 * Update the body content (HTML) of an existing WordPress post.
 * Used by the H2 keyphrase backfill to patch the rendered HTML without
 * republishing the entire post or changing its status/slug.
 */
export async function updateWpPostContent(
  wpPostId: number,
  htmlContent: string
): Promise<{ success: boolean }> {
  const { baseUrl, authHeader } = getWpAuth();
  if (!baseUrl) throw new Error("WordPress URL not configured");

  const res = await wpFetch(`${baseUrl}/wp-json/wp/v2/posts/${wpPostId}`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content: htmlContent }),
  }, 20_000);

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WordPress content update failed: ${errText.substring(0, 300)}`);
  }

  return { success: true };
}

/**
 * Apply a deliberately limited taxonomy/media repair to an existing WordPress post.
 * This never changes title, slug, body, excerpt, status, CTA, or SEO metadata.
 */
export async function updateWpPostFeaturedMediaAndCategories(params: {
  wpPostId: number;
  featuredMediaId: number;
  categories: number[];
}): Promise<{ success: boolean; postId: number }> {
  const { baseUrl, authHeader } = getWpAuth();
  const res = await wpFetch(`${baseUrl}/wp-json/wp/v2/posts/${params.wpPostId}`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      featured_media: params.featuredMediaId,
      categories: params.categories,
    }),
  }, 20_000);

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WordPress featured media/category update failed: ${errText.substring(0, 300)}`);
  }

  return { success: true, postId: params.wpPostId };
}
