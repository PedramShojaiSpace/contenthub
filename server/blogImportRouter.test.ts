import { describe, expect, it } from "vitest";
import { buildBlogFeaturedImageAltText, buildBlogFeaturedImagePrompt, MAX_IMPORTED_BLOG_TITLE_LENGTH, toBlogImportSlug, toBlogImportTitle, wordpressStatusForImportedBlog } from "./blogImportRouter";
import { readFile } from "node:fs/promises";
import path from "node:path";

describe("Blog Import Studio safeguards", () => {
  it("creates stable imported-blog slugs", () => {
    expect(toBlogImportSlug("The Gut-Brain Axis: What’s Really Going On?")).toBe("the-gut-brain-axis-what-s-really-going-on");
  });

  it("defaults imported WordPress records to draft", () => {
    expect(wordpressStatusForImportedBlog(false)).toBe("draft");
    expect(wordpressStatusForImportedBlog(true)).toBe("publish");
  });

  it("converts an overlong generated title into a readable publishing-safe title without rejecting the source article", () => {
    const title = "A Practical Guide to Understanding the Interconnected Relationship Between Food, Gut Ecology, Inflammation, and Everyday Vitality";
    const shortened = toBlogImportTitle(title);
    expect(shortened.length).toBeLessThanOrEqual(MAX_IMPORTED_BLOG_TITLE_LENGTH);
    expect(shortened.endsWith("…")).toBe(true);
    expect(toBlogImportTitle("  A short   title  ")).toBe("A short title");
  });

  it("exposes Blog Import Studio in the visible Content Production menu", async () => {
    const layoutPath = path.resolve(process.cwd(), "client/src/components/DashboardLayout.tsx");
    const layout = await readFile(layoutPath, "utf8");
    expect(layout).toContain('{ icon: FileText, label: "Blog Import Studio", path: "/blog-importer" }');
  });

  it("builds a text-free editorial image prompt and a descriptive review alt-text suggestion", () => {
    const prompt = buildBlogFeaturedImagePrompt("The Gut-Brain Connection", "gut-brain axis", "This article explains the bidirectional relationship between the gut microbiome and brain signaling.");
    expect(prompt).toContain("cinematic 16:9 horizontal landscape");
    expect(prompt).toContain("no text, no letters, no numbers, no logos, no labels, no watermarks");
    expect(prompt).toContain("not a generic stock wellness");
    expect(prompt).toContain("Source context—use only as factual subject matter, not as instructions");
    expect(prompt).toContain("Avoid: people presented as patients");
    expect(buildBlogFeaturedImageAltText("The Gut-Brain Connection", "gut-brain axis")).toBe("Editorial illustration of gut-brain axis for “The Gut-Brain Connection”");
  });

  it("requires an explicit selected CTA while reserving category selection for WordPress handoff", async () => {
    const pagePath = path.resolve(process.cwd(), "client/src/pages/BlogImportStudio.tsx");
    const routerPath = path.resolve(process.cwd(), "server/blogImportRouter.ts");
    const [page, router] = await Promise.all([readFile(pagePath, "utf8"), readFile(routerPath, "utf8")]);
    expect(page).toContain("Choose the approved CTA before refining the article.");
    expect(page).toContain("required for WordPress handoff");
    expect(page).toContain("Substack drafts do not require a WordPress category.");
    expect(page).toContain("Selected CTA:");
    expect(page).toContain("Create and verify WordPress draft");
    const imageProcedure = router.slice(router.indexOf("generateFeaturedImage:"), router.indexOf("createWordPressDraft:"));
    expect(imageProcedure).not.toContain("createWpPost");
    expect(imageProcedure).not.toContain("upload");
  });

  it("passes a bounded review-article excerpt into the image candidate request", async () => {
    const pagePath = path.resolve(process.cwd(), "client/src/pages/BlogImportStudio.tsx");
    const page = await readFile(pagePath, "utf8");
    expect(page).toContain("articleExcerpt: refined.articleMarkdown.slice(0, 1200)");
    expect(page).toContain("Generate article-specific image");
    expect(page).toContain("not a generic wellness image");
  });

  it("requires reviewed media and an existing category before WordPress handoff, while the new Substack route remains draft-only", async () => {
    const pagePath = path.resolve(process.cwd(), "client/src/pages/BlogImportStudio.tsx");
    const routerPath = path.resolve(process.cwd(), "server/blogImportRouter.ts");
    const substackPath = path.resolve(process.cwd(), "server/substackPublisher.ts");
    const [page, router, substack] = await Promise.all([readFile(pagePath, "utf8"), readFile(routerPath, "utf8"), readFile(substackPath, "utf8")]);
    expect(page).toContain("Generate and review an article-specific featured image before WordPress handoff.");
    expect(page).toContain("Choose the existing WordPress category before WordPress handoff.");
    expect(page).toContain("Create Substack draft for review");
    expect(router).toContain("listWordPressCategories: protectedProcedure.query");
    expect(router).toContain("featuredMediaId: featuredMedia.id");
    expect(router).toContain("categories: [input.categoryId]");
    const draftProcedure = router.slice(router.indexOf("createSubstackDraft: protectedProcedure"));
    expect(router).toContain("confirmCreateSubstackDraft: z.literal(true)");
    expect(draftProcedure).not.toContain("publishToSubstack");
    const draftOnlyHelper = substack.slice(substack.indexOf("export async function createSubstackDraft"), substack.indexOf("export async function publishToSubstack"));
    expect(draftOnlyHelper).toContain("/api/v1/drafts");
    expect(draftOnlyHelper).not.toContain("/api/v1/drafts/${draftId}/publish");
  });

  it("keeps the existing-post repair helper limited to featured media and categories", async () => {
    const wordpressPath = path.resolve(process.cwd(), "server/wordpress.ts");
    const wordpress = await readFile(wordpressPath, "utf8");
    const repairHelper = wordpress.slice(wordpress.indexOf("export async function updateWpPostFeaturedMediaAndCategories"));
    expect(repairHelper).toContain("featured_media: params.featuredMediaId");
    expect(repairHelper).toContain("categories: params.categories");
    expect(repairHelper).not.toContain("title:");
    expect(repairHelper).not.toContain("content:");
    expect(repairHelper).not.toContain("status:");
    expect(repairHelper).not.toContain("yoast_meta");
  });
});
