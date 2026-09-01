import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { protectedProcedure, router } from "./_core/trpc";
import { appendUtmToCtaUrl, getCtaForTopic } from "./ctaRouter";
import { updateContentItem } from "./db";
import { createWpPost } from "./wordpress";
import { markdownToWpHtml } from "./wpContentUtils";

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
  article: z.string().min(300).max(MAX_ARTICLE_LENGTH),
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
    const cta = await getCtaForTopic(topic);
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
    };
  }),

  createWordPressDraft: protectedProcedure.input(wordpressInput).mutation(async ({ input }) => createWordPressPost(input, false)),

  publishWordPressLive: protectedProcedure
    .input(wordpressInput.extend({ confirmLivePublish: z.literal(true) }))
    .mutation(async ({ input }) => createWordPressPost(input, input.confirmLivePublish)),
});
