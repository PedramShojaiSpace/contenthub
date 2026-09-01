import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { protectedProcedure, router } from "./_core/trpc";
import { appendUtmToCtaUrl, getActiveCtaById, getCtaForTopic } from "./ctaRouter";
import { updateContentItem } from "./db";
import { createWpPost } from "./wordpress";
import { markdownToWpHtml } from "./wpContentUtils";
import { generateImage } from "./_core/imageGeneration";

const MAX_ARTICLE_LENGTH = 80_000;
export const MAX_IMPORTED_BLOG_TITLE_LENGTH = 96;

const refinementSchema = z.object({
  title: z.string().min(1).max(300),
  slug: z.string().min(1).max(120),
  focusKeyword: z.string().min(1).max(120),
  metaDescription: z.string().min(1).max(180),
  semanticKeywords: z.array(z.string()).min(3).max(12),
  articleMarkdown: z.string().min(300),
  reviewNotes: z.array(z.string()).max(10),
});

const refineInput = z.object({
  sourceTitle: z.string().max(500).optional(),
  sourceLabel: z.string().max(180).optional(),
  focusKeyword: z.string().max(120).optional(),
  selectedCtaId: z.number().int().positive().optional(),
  article: z.string().min(300).max(MAX_ARTICLE_LENGTH),
});

const imageInput = z.object({
  title: z.string().min(1).max(MAX_IMPORTED_BLOG_TITLE_LENGTH),
  focusKeyword: z.string().max(120).optional(),
});

const wordpressInput = z.object({
  contentItemId: z.number().int().positive(),
  title: z.string().min(1).max(96),
  slug: z.string().min(1).max(120),
  focusKeyword: z.string().min(1).max(120),
  metaDescription: z.string().min(1).max(180),
  articleMarkdown: z.string().min(300).max(MAX_ARTICLE_LENGTH),
});

export function toBlogImportSlug(value: string) {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96) || "urban-monk-import";
}

export function toBlogImportTitle(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "Urban Monk Article";
  if (normalized.length <= MAX_IMPORTED_BLOG_TITLE_LENGTH) return normalized;

  const candidate = normalized.slice(0, MAX_IMPORTED_BLOG_TITLE_LENGTH - 1).trimEnd();
  const finalWordBoundary = candidate.lastIndexOf(" ");
  const readable = finalWordBoundary >= 48 ? candidate.slice(0, finalWordBoundary).trimEnd() : candidate;
  return `${readable}…`;
}

export function buildBlogFeaturedImagePrompt(title: string, focusKeyword?: string) {
  const subject = focusKeyword?.trim() || title;
  return [
    "Create a premium editorial blog cover image for The Urban Monk, designed for a health-education article.",
    `Subject: ${subject}.`,
    "Composition: cinematic 16:9 horizontal landscape, one clear conceptual focal point, balanced negative space for a future title overlay, elegant depth and natural texture.",
    "Style: refined contemporary editorial photography with subtle science-and-nature cues, calm intelligent mood, warm natural light, deep forest and stone palette with restrained gold accents.",
    "Text/content to render: no text, no letters, no numbers, no logos, no labels, no watermarks.",
    "Avoid: people presented as patients, medical diagnoses, anatomy diagrams, supplement bottles, before-and-after imagery, gore, exaggerated clinical imagery, testimonials, or claims of treatment outcomes.",
  ].join(" ");
}

export function buildBlogFeaturedImageAltText(title: string) {
  return `Editorial illustration for “${title}”`;
}

export function wordpressStatusForImportedBlog(confirmLivePublish: boolean): "draft" | "publish" {
  return confirmLivePublish ? "publish" : "draft";
}

async function createWordPressPost(input: z.infer<typeof wordpressInput>, confirmLivePublish: boolean) {
  const status = wordpressStatusForImportedBlog(confirmLivePublish);
  const slug = toBlogImportSlug(input.slug);
  const post = await createWpPost({
    title: input.title,
    slug,
    content: markdownToWpHtml(input.articleMarkdown),
    excerpt: input.metaDescription,
    status,
    metaDescription: input.metaDescription,
    focusKeyword: input.focusKeyword,
    seoTitle: input.title,
    canonicalUrl: `https://theurbanmonk.com/${slug}/`,
  });
  await updateContentItem(input.contentItemId, {
    status: status === "publish" ? "published" : "review",
    publishUrl: post.link,
    wpPostId: post.id,
    yoastSeoTitle: input.title,
    yoastMetaDescription: input.metaDescription,
  });
  return post;
}

export const blogImportRouter = router({
  refine: protectedProcedure.input(refineInput).mutation(async ({ input }) => {
    const topic = input.focusKeyword?.trim() || input.sourceTitle?.trim() || "wellness education";
    const cta = input.selectedCtaId ? await getActiveCtaById(input.selectedCtaId) : await getCtaForTopic(topic);
    const response = await invokeLLM({
      model: "gpt-5-mini",
      maxTokens: 12_000,
      messages: [
        {
          role: "system",
          content: "You are The Urban Monk editorial desk. Refine a full imported article for clear, science-informed health education, readability, SEO, and AEO. Preserve the author’s core argument, quotes, citations, reference list, and uncertainty. Never invent studies, citations, testimonials, patient stories, results, product claims, or medical guarantees. Do not diagnose, prescribe, or promise treatment outcomes. Soften unsupported health claims and list them in reviewNotes. Use H2 headings and concise paragraphs. Do not include an H1 title, any CTA, sales copy, or external links. Return only the required JSON. The SEO title must be 96 characters or fewer.",
        },
        {
          role: "user",
          content: `Source: ${input.sourceLabel || "Imported external draft"}\nWorking title: ${input.sourceTitle || "Not supplied"}\nFocus keyword: ${input.focusKeyword || "Derive a specific non-medical keyword"}\n\nArticle:\n${input.article}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "urban_monk_blog_import",
          strict: true,
          schema: {
            type: "object",
            properties: {
              title: { type: "string" }, slug: { type: "string" }, focusKeyword: { type: "string" }, metaDescription: { type: "string" },
              semanticKeywords: { type: "array", items: { type: "string" } }, articleMarkdown: { type: "string" }, reviewNotes: { type: "array", items: { type: "string" } },
            },
            required: ["title", "slug", "focusKeyword", "metaDescription", "semanticKeywords", "articleMarkdown", "reviewNotes"],
            additionalProperties: false,
          },
        },
      },
    });
    const raw = response.choices[0]?.message?.content;
    if (typeof raw !== "string") throw new Error("The article editor returned no usable response. Please try again.");
    let result: unknown;
    try { result = JSON.parse(raw); } catch { throw new Error("The article editor returned an invalid review package. Please try again."); }
    const refined = refinementSchema.parse(result);
    const generatedTitle = refined.title;
    const title = toBlogImportTitle(generatedTitle);
    const slug = toBlogImportSlug(refined.slug || title);
    const ctaUrl = appendUtmToCtaUrl(cta.url, "blog", slug, "imported-article");
    const articleMarkdown = `${refined.articleMarkdown.trim()}\n\n## Continue the Conversation\n\n${cta.ctaText}\n\n[Explore ${cta.label}](${ctaUrl})`;
    return {
      ...refined,
      title,
      titleWasShortened: title !== generatedTitle.trim(),
      slug,
      metaDescription: refined.metaDescription.slice(0, 160),
      articleMarkdown,
      ctaLabel: cta.label,
      ctaUrl,
      ctaWasSelected: Boolean(input.selectedCtaId),
    };
  }),

  generateFeaturedImage: protectedProcedure.input(imageInput).mutation(async ({ input }) => {
    const title = toBlogImportTitle(input.title);
    const result = await generateImage({ prompt: buildBlogFeaturedImagePrompt(title, input.focusKeyword) });
    if (!result.url) throw new Error("The image generator returned no review image. Please try again.");
    return {
      imageUrl: result.url,
      altText: buildBlogFeaturedImageAltText(title),
      title,
      reviewOnly: true,
    };
  }),

  createWordPressDraft: protectedProcedure.input(wordpressInput).mutation(async ({ input }) => createWordPressPost(input, false)),

  publishWordPressLive: protectedProcedure
    .input(wordpressInput.extend({ confirmLivePublish: z.literal(true) }))
    .mutation(async ({ input }) => createWordPressPost(input, input.confirmLivePublish)),
});
