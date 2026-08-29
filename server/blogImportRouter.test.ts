import { describe, expect, it } from "vitest";
import { toBlogImportSlug, wordpressStatusForImportedBlog } from "./blogImportRouter";

describe("Blog Import Studio safeguards", () => {
  it("creates stable imported-blog slugs", () => {
    expect(toBlogImportSlug("The Gut-Brain Axis: What’s Really Going On?")).toBe("the-gut-brain-axis-what-s-really-going-on");
  });

  it("defaults imported WordPress records to draft", () => {
    expect(wordpressStatusForImportedBlog(false)).toBe("draft");
    expect(wordpressStatusForImportedBlog(true)).toBe("publish");
  });
});
