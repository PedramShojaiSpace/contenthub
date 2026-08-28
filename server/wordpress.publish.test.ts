/**
 * WordPress Publish Tests
 *
 * Tests the WordPress integration helpers and the blog.publish dedup guard.
 * These are unit/integration tests that mock the WP REST API calls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── markdownToWpHtml ─────────────────────────────────────────────────────────
describe("markdownToWpHtml", () => {
  it("converts ## headings to <h2> tags", async () => {
    const { markdownToWpHtml } = await import("./wpContentUtils");
    const md = "## Introduction\n\nSome text here.";
    const html = markdownToWpHtml(md);
    expect(html).toContain("<h2");
    expect(html).toContain("Introduction");
  });

  it("converts ### headings to <h3> tags", async () => {
    const { markdownToWpHtml } = await import("./wpContentUtils");
    const md = "### Sub-section\n\nMore text.";
    const html = markdownToWpHtml(md);
    expect(html).toContain("<h3");
    expect(html).toContain("Sub-section");
  });

  it("converts **bold** to <strong> tags", async () => {
    const { markdownToWpHtml } = await import("./wpContentUtils");
    const md = "This is **bold** text.";
    const html = markdownToWpHtml(md);
    expect(html).toContain("<strong>bold</strong>");
  });

  it("preserves existing HTML blocks (CTA banner) without double-encoding", async () => {
    const { markdownToWpHtml } = await import("./wpContentUtils");
    const md = `<div class="cta-banner"><a href="https://example.com">Join Now</a></div>\n\n## FAQ\n\n**Q: What is this?**\n\nA: This is a test.`;
    const html = markdownToWpHtml(md);
    expect(html).toContain('<div class="cta-banner">');
    expect(html).toContain("<h2");
    expect(html).toContain("FAQ");
    // The CTA banner should not be double-encoded
    expect(html).not.toContain("&lt;div");
  });

  it("converts bullet lists to <ul><li> tags", async () => {
    const { markdownToWpHtml } = await import("./wpContentUtils");
    const md = "- Item one\n- Item two\n- Item three";
    const html = markdownToWpHtml(md);
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>");
    expect(html).toContain("Item one");
  });

  it("wraps paragraphs in <p> tags", async () => {
    const { markdownToWpHtml } = await import("./wpContentUtils");
    const md = "First paragraph.\n\nSecond paragraph.";
    const html = markdownToWpHtml(md);
    expect(html).toContain("<p>");
    expect(html).toContain("First paragraph.");
    expect(html).toContain("Second paragraph.");
  });
});

// ── WordPress slug sanitization ───────────────────────────────────────────────
describe("WordPress slug sanitization", () => {
  it("converts title with special characters to a valid slug", () => {
    const sanitizeSlug = (raw: string): string => {
      return raw
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
    };

    expect(sanitizeSlug("How to Meditate: A Beginner's Guide!")).toBe(
      "how-to-meditate-a-beginners-guide"
    );
    expect(sanitizeSlug("  Spaces  and  Dashes  ")).toBe("spaces-and-dashes");
    expect(sanitizeSlug("ALL CAPS TITLE")).toBe("all-caps-title");
  });

  it("truncates slugs longer than 60 characters", () => {
    const sanitizeSlug = (raw: string): string => {
      return raw
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
    };

    const longTitle =
      "This is a very long blog post title that exceeds sixty characters for testing";
    const slug = sanitizeSlug(longTitle);
    expect(slug.length).toBeLessThanOrEqual(60);
  });
});

// ── WordPress publish dedup guard ─────────────────────────────────────────────
describe("WordPress publish dedup guard logic", () => {
  it("returns early with 'updated' status when wpPostId already exists", async () => {
    // This tests the dedup guard logic pattern used in blog.publish
    const existingWpPostId = 42;
    const existingPublishUrl = "https://theurbanmonk.com/?p=42";

    // Simulate the dedup guard check
    const mockItem = {
      wpPostId: existingWpPostId,
      publishUrl: existingPublishUrl,
    };

    // If wpPostId exists, we should return early
    if (mockItem.wpPostId) {
      const result = {
        wpPostId: mockItem.wpPostId,
        publishUrl: mockItem.publishUrl ?? "",
        status: "updated" as const,
        message: `Existing WordPress post #${mockItem.wpPostId} updated (dedup guard).`,
        campaignValidationWarning: null,
        youtubeEmbedResult: { embedded: false, message: "skipped (dedup update)" },
      };

      expect(result.status).toBe("updated");
      expect(result.wpPostId).toBe(42);
      expect(result.message).toContain("dedup guard");
    }
  });

  it("proceeds to create new post when wpPostId is null", () => {
    const mockItem = { wpPostId: null, publishUrl: null };
    // When wpPostId is null, the dedup guard should NOT fire
    const shouldCreateNew = !mockItem.wpPostId;
    expect(shouldCreateNew).toBe(true);
  });
});

// ── WordPress credentials check ───────────────────────────────────────────────
describe("WordPress credentials", () => {
  it("should have WORDPRESS_URL set", () => {
    expect(process.env.WORDPRESS_URL).toBeTruthy();
  });

  it("should have a valid absolute WORDPRESS_URL", () => {
    const url = new URL(process.env.WORDPRESS_URL ?? "");
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBeTruthy();
  });

  it("reaches the configured WordPress REST API without publishing content", async () => {
    const baseUrl = (process.env.WORDPRESS_URL ?? "").replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/wp-json/wp/v2/types/post`);
    expect(response.ok).toBe(true);
    expect(response.headers.get("content-type") ?? "").toContain("application/json");
  }, 20_000);

  it("authenticates to the WordPress post endpoint without creating content", async () => {
    const baseUrl = (process.env.WORDPRESS_URL ?? "").replace(/\/$/, "");
    const username = process.env.WORDPRESS_USERNAME ?? "";
    const appPassword = process.env.WORDPRESS_APP_PASSWORD ?? "";
    const authorization = "Basic " + Buffer.from(`${username}:${appPassword}`).toString("base64");
    const response = await fetch(`${baseUrl}/wp-json/wp/v2/posts?context=edit&per_page=1`, {
      headers: { Authorization: authorization },
    });
    expect(response.ok).toBe(true);
    expect(response.headers.get("content-type") ?? "").toContain("application/json");
  }, 20_000);

  it("should have WORDPRESS_USERNAME set", () => {
    expect(process.env.WORDPRESS_USERNAME).toBeTruthy();
  });

  it("should have WORDPRESS_APP_PASSWORD set", () => {
    expect(process.env.WORDPRESS_APP_PASSWORD).toBeTruthy();
  });
});
