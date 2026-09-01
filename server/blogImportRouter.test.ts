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
    const prompt = buildBlogFeaturedImagePrompt("The Gut-Brain Connection", "gut-brain axis");
    expect(prompt).toContain("cinematic 16:9 horizontal landscape");
    expect(prompt).toContain("no text, no letters, no numbers, no logos, no labels, no watermarks");
    expect(prompt).toContain("Avoid: people presented as patients");
    expect(buildBlogFeaturedImageAltText("The Gut-Brain Connection")).toBe("Editorial illustration for “The Gut-Brain Connection”");
  });

  it("requires an explicit selected CTA in the client refinement flow and keeps the image candidate out of WordPress handoff", async () => {
    const pagePath = path.resolve(process.cwd(), "client/src/pages/BlogImportStudio.tsx");
    const routerPath = path.resolve(process.cwd(), "server/blogImportRouter.ts");
    const [page, router] = await Promise.all([readFile(pagePath, "utf8"), readFile(routerPath, "utf8")]);
    expect(page).toContain("Choose the approved CTA before refining the article.");
    expect(page).toContain("Selected CTA:");
    expect(page).toContain("Review asset only — not uploaded or linked to a WordPress post.");
    const imageProcedure = router.slice(router.indexOf("generateFeaturedImage:"), router.indexOf("createWordPressDraft:"));
    expect(imageProcedure).not.toContain("createWpPost");
    expect(imageProcedure).not.toContain("upload");
  });
});
