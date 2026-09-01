import { describe, expect, it } from "vitest";
import { MAX_IMPORTED_BLOG_TITLE_LENGTH, toBlogImportSlug, toBlogImportTitle, wordpressStatusForImportedBlog } from "./blogImportRouter";
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
});
