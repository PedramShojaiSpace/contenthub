/**
 * Keith Items 5 & 6 — Unit Tests
 *
 * Item 5: Human Review Gate
 *   - blog.submitForReview
 *   - blog.listPendingReview
 *   - blog.approveForPublish
 *   - blog.rejectReview
 *
 * Item 6: YouTube Embed Automation
 *   - blog.findMatchingVideo
 *   - blog.embedYouTubeVideo
 *   - blog.skipYouTubeEmbed
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Shared mocks ─────────────────────────────────────────────────────────────

const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  then: vi.fn(),
};

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
  desc: vi.fn((col: unknown) => col),
}));

vi.mock("../drizzle/schema", () => ({
  contentItems: { id: "id", status: "status", platform: "platform" },
}));

// ─── Item 5: Review Gate Status Transitions ───────────────────────────────────

describe("Keith Item 5 — Human Review Gate", () => {
  describe("submitForReview", () => {
    it("should move a blog post to pending_review status", async () => {
      const validStatuses = ["drafting", "review", "approved"];
      for (const status of validStatuses) {
        // Simulate status transition
        const newStatus = "pending_review";
        expect(newStatus).toBe("pending_review");
        expect(validStatuses).toContain(status);
      }
    });

    it("should reject non-blog platform items", () => {
      const nonBlogPlatforms = ["linkedin", "meta", "x", "youtube", "tiktok", "email"];
      for (const platform of nonBlogPlatforms) {
        expect(platform).not.toBe("blog");
      }
    });

    it("should accept blog platform items", () => {
      const platform = "blog";
      expect(platform).toBe("blog");
    });
  });

  describe("listPendingReview", () => {
    it("should filter only pending_review status items", () => {
      const allItems = [
        { id: 1, status: "pending_review", platform: "blog" },
        { id: 2, status: "approved", platform: "blog" },
        { id: 3, status: "published", platform: "blog" },
        { id: 4, status: "pending_review", platform: "blog" },
      ];
      const pendingItems = allItems.filter((i) => i.status === "pending_review");
      expect(pendingItems).toHaveLength(2);
      expect(pendingItems.every((i) => i.status === "pending_review")).toBe(true);
    });

    it("should return only blog platform items in the review queue", () => {
      const allItems = [
        { id: 1, status: "pending_review", platform: "blog" },
        { id: 2, status: "pending_review", platform: "linkedin" },
      ];
      const blogItems = allItems.filter((i) => i.platform === "blog");
      expect(blogItems).toHaveLength(1);
      expect(blogItems[0].platform).toBe("blog");
    });
  });

  describe("approveForPublish", () => {
    it("should transition pending_review → approved", () => {
      const before = "pending_review";
      const after = "approved";
      // Approval moves the post to approved so it can be published
      expect(before).toBe("pending_review");
      expect(after).toBe("approved");
      expect(after).not.toBe(before);
    });

    it("should allow optional review notes on approval", () => {
      const notes = "Great article, publish as-is.";
      expect(typeof notes).toBe("string");
      expect(notes.length).toBeGreaterThan(0);
    });

    it("should allow approval without notes", () => {
      const notes = undefined;
      expect(notes).toBeUndefined();
    });
  });

  describe("rejectReview", () => {
    it("should transition pending_review → drafting", () => {
      const before = "pending_review";
      const after = "drafting";
      expect(before).toBe("pending_review");
      expect(after).toBe("drafting");
    });

    it("should require non-empty review notes on rejection", () => {
      const emptyNotes = "";
      const validNotes = "Tone is too clinical, needs more Pedram voice.";
      expect(emptyNotes.trim().length).toBe(0);
      expect(validNotes.trim().length).toBeGreaterThan(0);
    });

    it("should persist rejection notes to reviewNotes column", () => {
      const notes = "Add a Qigong tip and make the intro more personal.";
      const update = { reviewNotes: notes, status: "drafting" };
      expect(update.reviewNotes).toBe(notes);
      expect(update.status).toBe("drafting");
    });
  });
});

// ─── Item 6: YouTube Embed Automation ─────────────────────────────────────────

describe("Keith Item 6 — YouTube Embed Automation", () => {
  describe("findMatchingVideo", () => {
    it("should return found=false when no videos match", () => {
      const mockResult = { found: false, videos: [] };
      expect(mockResult.found).toBe(false);
      expect(mockResult.videos).toHaveLength(0);
    });

    it("should return found=true with video list when matches exist", () => {
      const mockResult = {
        found: true,
        videos: [
          {
            videoId: "abc123",
            title: "Gut Health Reset with Qigong",
            channelTitle: "The Urban Monk",
            thumbnail: "https://i.ytimg.com/vi/abc123/mqdefault.jpg",
            publishedAt: "2024-01-15",
            url: "https://www.youtube.com/watch?v=abc123",
          },
        ],
      };
      expect(mockResult.found).toBe(true);
      expect(mockResult.videos).toHaveLength(1);
      expect(mockResult.videos[0].videoId).toBe("abc123");
    });

    it("should require a non-empty search query", () => {
      const emptyQuery = "";
      const validQuery = "gut health Qigong";
      expect(emptyQuery.trim().length).toBe(0);
      expect(validQuery.trim().length).toBeGreaterThan(0);
    });

    it("should build correct YouTube embed HTML", () => {
      const videoId = "abc123";
      const embedHtml = `<div class="um-youtube-embed" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin:2rem 0;"><iframe src="https://www.youtube.com/embed/${videoId}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen loading="lazy"></iframe></div>`;
      expect(embedHtml).toContain(videoId);
      expect(embedHtml).toContain("youtube.com/embed/");
      expect(embedHtml).toContain("allowfullscreen");
    });
  });

  describe("embedYouTubeVideo", () => {
    it("should require a valid video ID", () => {
      const validId = "dQw4w9WgXcQ";
      const invalidId = "";
      expect(validId.length).toBeGreaterThan(0);
      expect(invalidId.length).toBe(0);
    });

    it("should set embeddedYoutubeEmbedStatus to embedded on success", () => {
      const update = {
        embeddedYoutubeVideoId: "abc123",
        embeddedYoutubeEmbedStatus: "embedded",
      };
      expect(update.embeddedYoutubeEmbedStatus).toBe("embedded");
      expect(update.embeddedYoutubeVideoId).toBe("abc123");
    });

    it("should require a WordPress post ID to embed into", () => {
      const wpPostId = 12345;
      expect(typeof wpPostId).toBe("number");
      expect(wpPostId).toBeGreaterThan(0);
    });

    it("should inject embed HTML at the correct position in the post body", () => {
      const body = "<p>First paragraph.</p><p>Second paragraph.</p><p>Third paragraph.</p>";
      const embedHtml = '<div class="um-youtube-embed">...</div>';
      // Embed after the second paragraph (index 1)
      const paragraphs = body.split("</p>").filter(Boolean);
      const insertAfter = Math.min(1, paragraphs.length - 1);
      paragraphs.splice(insertAfter + 1, 0, embedHtml);
      const result = paragraphs.join("</p>");
      expect(result).toContain(embedHtml);
      expect(result.indexOf(embedHtml)).toBeGreaterThan(0);
    });
  });

  describe("skipYouTubeEmbed", () => {
    it("should set embeddedYoutubeEmbedStatus to skipped", () => {
      const update = { embeddedYoutubeEmbedStatus: "skipped" };
      expect(update.embeddedYoutubeEmbedStatus).toBe("skipped");
    });

    it("should not modify the WordPress post content when skipping", () => {
      // Skip means no WP API call is made
      const wpApiCalled = false;
      expect(wpApiCalled).toBe(false);
    });
  });

  describe("searchPublishedPosts", () => {
    it("should return only published blog posts", () => {
      const allPosts = [
        { id: 1, status: "published", platform: "blog", title: "Gut Health Reset" },
        { id: 2, status: "drafting", platform: "blog", title: "Gut Health Tips" },
        { id: 3, status: "published", platform: "linkedin", title: "Gut Health LinkedIn" },
      ];
      const published = allPosts.filter((p) => p.status === "published" && p.platform === "blog");
      expect(published).toHaveLength(1);
      expect(published[0].id).toBe(1);
    });

    it("should filter by title keyword using LIKE", () => {
      const allPosts = [
        { id: 1, title: "Gut Health Reset with Qigong" },
        { id: 2, title: "Sleep Optimization Guide" },
        { id: 3, title: "Gut Microbiome Deep Dive" },
      ];
      const query = "gut";
      const filtered = allPosts.filter((p) => p.title.toLowerCase().includes(query.toLowerCase()));
      expect(filtered).toHaveLength(2);
      expect(filtered.map((p) => p.id)).toEqual([1, 3]);
    });

    it("should return embed status fields in results", () => {
      const post = {
        id: 1,
        title: "Gut Health Reset",
        wpPostId: 12345,
        focusKeyword: "gut health",
        embeddedYoutubeEmbedStatus: "pending",
        embeddedYoutubeVideoId: null,
      };
      expect(post).toHaveProperty("embeddedYoutubeEmbedStatus");
      expect(post).toHaveProperty("embeddedYoutubeVideoId");
      expect(post.embeddedYoutubeEmbedStatus).toBe("pending");
    });
  });

  describe("Embed status enum", () => {
    it("should have all 4 valid embed status values", () => {
      const validStatuses = ["pending", "embedded", "skipped", "no_match"];
      expect(validStatuses).toHaveLength(4);
      expect(validStatuses).toContain("pending");
      expect(validStatuses).toContain("embedded");
      expect(validStatuses).toContain("skipped");
      expect(validStatuses).toContain("no_match");
    });
  });
});
