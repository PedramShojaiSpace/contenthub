/**
 * internalLinkOptimizer.test.ts
 *
 * Unit tests for the pure helper functions in internalLinkOptimizer.ts.
 * The DB-dependent runInternalLinkOptimizer() function is tested via integration
 * (manual publish flow), but the HTML manipulation helpers are fully unit-testable.
 *
 * Note: injectLink and addRelatedReadingEntry are now exported from the module
 * so they can be tested directly without duplication.
 */

import { describe, it, expect } from "vitest";
import { injectLink, addRelatedReadingEntry } from "./internalLinkOptimizer";

// ---------------------------------------------------------------------------
// Tests: injectLink
// ---------------------------------------------------------------------------

describe("injectLink", () => {
  it("wraps the first occurrence of anchor text with an <a> tag", () => {
    const html = "<p>Learn about sleep optimization and how it affects your health.</p>";
    const result = injectLink(html, "sleep optimization", "https://theurbanmonk.com/sleep");
    expect(result.success).toBe(true);
    expect(result.html).toContain('<a href="https://theurbanmonk.com/sleep" title="sleep optimization">sleep optimization</a>');
  });

  it("returns success=false when the target URL is already present", () => {
    const html = '<p>See <a href="https://theurbanmonk.com/sleep">sleep optimization</a> guide.</p>';
    const result = injectLink(html, "sleep optimization", "https://theurbanmonk.com/sleep");
    expect(result.success).toBe(false);
    expect(result.html).toBe(html);
  });

  it("returns success=false when anchor text is not found in the HTML", () => {
    const html = "<p>This article is about gut health and microbiome.</p>";
    const result = injectLink(html, "sleep optimization", "https://theurbanmonk.com/sleep");
    expect(result.success).toBe(false);
  });

  it("is case-insensitive when matching anchor text", () => {
    const html = "<p>Sleep Optimization is the key to recovery.</p>";
    const result = injectLink(html, "sleep optimization", "https://theurbanmonk.com/sleep");
    expect(result.success).toBe(true);
    expect(result.html).toContain('<a href="https://theurbanmonk.com/sleep"');
  });

  it("only replaces the FIRST occurrence of the anchor text", () => {
    const html = "<p>sleep optimization helps. More sleep optimization tips here.</p>";
    const result = injectLink(html, "sleep optimization", "https://theurbanmonk.com/sleep");
    expect(result.success).toBe(true);
    const linkCount = (result.html.match(/<a href=/g) ?? []).length;
    expect(linkCount).toBe(1);
  });

  it("does not inject a link inside an existing HTML tag attribute", () => {
    const html = '<img alt="sleep optimization tips" src="image.jpg">';
    const result = injectLink(html, "sleep optimization", "https://theurbanmonk.com/sleep");
    expect(result.success).toBe(false);
  });

  it("handles anchor text with special regex characters", () => {
    const html = "<p>The gut-brain axis is fascinating.</p>";
    const result = injectLink(html, "gut-brain axis", "https://theurbanmonk.com/gut-brain");
    expect(result.success).toBe(true);
    expect(result.html).toContain('<a href="https://theurbanmonk.com/gut-brain"');
  });
});

// ---------------------------------------------------------------------------
// Tests: addRelatedReadingEntry
// ---------------------------------------------------------------------------

describe("addRelatedReadingEntry", () => {
  it("creates a new Related Reading section when none exists", () => {
    const html = "<p>This is the pillar post about sleep.</p>";
    const result = addRelatedReadingEntry(html, "Sleep Optimization Guide", "https://theurbanmonk.com/sleep-guide");
    expect(result).toContain("<!-- related-reading -->");
    expect(result).toContain('<a href="https://theurbanmonk.com/sleep-guide">Sleep Optimization Guide</a>');
    expect(result).toContain("Related Reading");
  });

  it("inserts Related Reading before </article> when present", () => {
    const html = "<article><p>Pillar content.</p></article>";
    const result = addRelatedReadingEntry(html, "New Post", "https://theurbanmonk.com/new-post");
    expect(result).toContain("<!-- related-reading -->");
    expect(result.indexOf("<!-- related-reading -->")).toBeLessThan(result.indexOf("</article>"));
  });

  it("appends to existing Related Reading section", () => {
    const html = `<p>Pillar content.</p>
<!-- related-reading -->
<div class="related-reading">
  <ul>
    <li><a href="https://theurbanmonk.com/post-1">Post One</a></li>
  </ul>
</div>`;
    const result = addRelatedReadingEntry(html, "Post Two", "https://theurbanmonk.com/post-2");
    expect(result).toContain('<a href="https://theurbanmonk.com/post-1">Post One</a>');
    expect(result).toContain('<a href="https://theurbanmonk.com/post-2">Post Two</a>');
  });

  it("does not add duplicate entries to existing Related Reading section", () => {
    const html = `<p>Pillar content.</p>
<!-- related-reading -->
<div class="related-reading">
  <ul>
    <li><a href="https://theurbanmonk.com/post-1">Post One</a></li>
  </ul>
</div>`;
    const result = addRelatedReadingEntry(html, "Post One Again", "https://theurbanmonk.com/post-1");
    const count = (result.match(/theurbanmonk\.com\/post-1/g) ?? []).length;
    expect(count).toBe(1);
  });

  it("appends to end of HTML when no </article> tag and no existing section", () => {
    const html = "<div><p>Simple content without article tag.</p></div>";
    const result = addRelatedReadingEntry(html, "Related Post", "https://theurbanmonk.com/related");
    expect(result).toContain("<!-- related-reading -->");
    expect(result).toContain("Related Post");
    expect(result.indexOf("<!-- related-reading -->")).toBeGreaterThan(result.indexOf("</div>"));
  });
});
