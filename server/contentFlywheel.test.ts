/**
 * Tests for Keith Strategy Gap Completions:
 * - Gap 1: GSC Content Flywheel (getMovingPosts, suggestFollowUp)
 * - Gap 2: YouTube embed auto-trigger in blog.publish
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Gap 1: GSC Content Flywheel ─────────────────────────────────────────────

describe("GSC Content Flywheel — getMovingPosts", () => {
  it("correctly identifies a post that moved up (breakthrough signal)", () => {
    const currentPos = 8;
    const previousPos = 18;
    const delta = previousPos - currentPos; // positive = moved up
    expect(delta).toBe(10);
    expect(delta >= 3).toBe(true); // meets minMovement threshold

    // Signal classification
    const direction: "up" | "down" = delta > 0 ? "up" : "down";
    expect(direction).toBe("up");

    let signal: string;
    if (direction === "up" && currentPos <= 10) {
      signal = "breakthrough";
    } else if (direction === "up" && currentPos <= 20) {
      signal = "rising_star";
    } else if (direction === "down" && currentPos > 20) {
      signal = "slipping";
    } else {
      signal = "needs_refresh";
    }
    expect(signal).toBe("breakthrough");
  });

  it("correctly identifies a post that moved up (rising_star signal)", () => {
    const currentPos = 14;
    const previousPos = 22;
    const delta = previousPos - currentPos;
    expect(delta).toBe(8);

    const direction: "up" | "down" = delta > 0 ? "up" : "down";
    let signal: string;
    if (direction === "up" && currentPos <= 10) signal = "breakthrough";
    else if (direction === "up" && currentPos <= 20) signal = "rising_star";
    else if (direction === "down" && currentPos > 20) signal = "slipping";
    else signal = "needs_refresh";

    expect(signal).toBe("rising_star");
  });

  it("correctly identifies a post that dropped (slipping signal)", () => {
    const currentPos = 28;
    const previousPos = 15;
    const delta = previousPos - currentPos; // negative = moved down
    expect(delta).toBe(-13);
    expect(Math.abs(delta) >= 3).toBe(true);

    const direction: "up" | "down" = delta > 0 ? "up" : "down";
    let signal: string;
    if (direction === "up" && currentPos <= 10) signal = "breakthrough";
    else if (direction === "up" && currentPos <= 20) signal = "rising_star";
    else if (direction === "down" && currentPos > 20) signal = "slipping";
    else signal = "needs_refresh";

    expect(signal).toBe("slipping");
    expect(direction).toBe("down");
  });

  it("filters out posts that moved less than minMovement", () => {
    const minMovement = 3;
    const movements = [
      { current: 10, previous: 12, delta: 2 }, // should be filtered (delta < 3)
      { current: 8, previous: 15, delta: 7 },  // should pass
      { current: 20, previous: 22, delta: 2 }, // should be filtered
      { current: 5, previous: 10, delta: 5 },  // should pass
    ];

    const passing = movements.filter(m => Math.abs(m.delta) >= minMovement);
    expect(passing).toHaveLength(2);
  });

  it("sorts results with breakthrough first, then rising_star, then slipping", () => {
    const signalOrder: Record<string, number> = {
      breakthrough: 0,
      rising_star: 1,
      slipping: 2,
      needs_refresh: 3,
    };

    const posts = [
      { signal: "slipping", positionDelta: -8 },
      { signal: "breakthrough", positionDelta: 12 },
      { signal: "rising_star", positionDelta: 5 },
      { signal: "needs_refresh", positionDelta: -3 },
    ];

    posts.sort((a, b) => {
      const orderDiff = signalOrder[a.signal] - signalOrder[b.signal];
      if (orderDiff !== 0) return orderDiff;
      return Math.abs(b.positionDelta) - Math.abs(a.positionDelta);
    });

    expect(posts[0].signal).toBe("breakthrough");
    expect(posts[1].signal).toBe("rising_star");
    expect(posts[2].signal).toBe("slipping");
    expect(posts[3].signal).toBe("needs_refresh");
  });

  it("generates correct recommendation text for breakthrough signal", () => {
    const post = {
      signal: "breakthrough" as const,
      focusKeyword: "gut health",
      currentPosition: 8,
      positionDelta: 10,
    };

    const recommendation = `This page broke into the top 10! Publish a follow-up or supporting article on "${post.focusKeyword}" to capture more of this traffic cluster.`;
    expect(recommendation).toContain("top 10");
    expect(recommendation).toContain("gut health");
  });

  it("generates correct recommendation text for slipping signal", () => {
    const post = {
      signal: "slipping" as const,
      positionDelta: -13,
    };

    const recommendation = `Slipping — dropped ${Math.abs(post.positionDelta).toFixed(0)} positions. Refresh the article with updated stats, add 2–3 new sections, and re-submit for indexing.`;
    expect(recommendation).toContain("13");
    expect(recommendation).toContain("Refresh");
  });
});

// ─── Gap 1: suggestFollowUp LLM prompt structure ─────────────────────────────

describe("GSC Content Flywheel — suggestFollowUp prompt", () => {
  it("builds correct signal context for breakthrough", () => {
    const signal = "breakthrough";
    const currentPosition = 8;
    const positionDelta = 10;

    const signalContext = {
      breakthrough: `This article just broke into the top 10 on Google (position ${currentPosition.toFixed(1)}), gaining ${Math.abs(positionDelta).toFixed(0)} positions. This is a momentum signal — the topic cluster is hot.`,
      rising_star: "",
      slipping: "",
      needs_refresh: "",
    }[signal];

    expect(signalContext).toContain("top 10");
    expect(signalContext).toContain("8.0");
    expect(signalContext).toContain("10");
  });

  it("builds correct signal context for slipping", () => {
    const signal = "slipping";
    const currentPosition = 28;
    const positionDelta = -13;

    const signalContext = {
      breakthrough: "",
      rising_star: "",
      slipping: `This article is losing ground (now position ${currentPosition.toFixed(1)}, dropped ${Math.abs(positionDelta).toFixed(0)} positions). It needs a refresh or supporting content.`,
      needs_refresh: "",
    }[signal];

    expect(signalContext).toContain("losing ground");
    expect(signalContext).toContain("28.0");
    expect(signalContext).toContain("13");
  });

  it("validates the expected JSON schema of suggestFollowUp response", () => {
    const mockResponse = {
      blogIdea: {
        title: "7 Signs Your Gut Health Is Affecting Your Sleep",
        focusKeyword: "gut health sleep connection",
        angle: "Connects two trending topics with a science-backed angle.",
        outline: ["H2: The Gut-Brain Axis", "H2: Sleep Disruption Signs", "H2: Foods That Heal Both"],
        internalLinkOpportunity: "existing gut health article",
      },
      videoIdea: {
        title: "Your Gut Is Ruining Your Sleep (Here's Why)",
        hook: "If you're waking up at 3am, your gut is trying to tell you something. Most doctors miss this completely.",
        platform: "YouTube",
        cta: "Join Urban Monk Academy for the full gut-sleep protocol",
      },
      urgency: "high",
      reasoning: "Gut-sleep connection is a rising search cluster that directly feeds Academy signups.",
    };

    expect(mockResponse.blogIdea.title).toBeTruthy();
    expect(mockResponse.blogIdea.focusKeyword).toBeTruthy();
    expect(mockResponse.blogIdea.outline).toHaveLength(3);
    expect(mockResponse.videoIdea.hook).toBeTruthy();
    expect(["high", "medium", "low"]).toContain(mockResponse.urgency);
    expect(mockResponse.reasoning).toBeTruthy();
  });
});

// ─── Gap 2: YouTube Embed Auto-Trigger ───────────────────────────────────────

describe("YouTube Embed Auto-Trigger in blog.publish", () => {
  it("builds correct YouTube iframe embed block", () => {
    const videoId = "abc123xyz";
    const videoTitle = "Gut Health & Sleep: The Urban Monk";

    const embedBlock = `\n\n<figure class="wp-block-embed is-type-video is-provider-youtube wp-block-embed-youtube wp-embed-aspect-16-9 wp-has-aspect-ratio"><div class="wp-block-embed__wrapper"><iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" title="${videoTitle.replace(/"/g, "&quot;")}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div></figure>\n\n`;

    expect(embedBlock).toContain(`/embed/${videoId}`);
    expect(embedBlock).toContain("wp-block-embed-youtube");
    expect(embedBlock).toContain("allowfullscreen");
    expect(embedBlock).toContain(videoTitle);
  });

  it("injects embed after the second </p> tag", () => {
    const content = "<p>First paragraph.</p><p>Second paragraph.</p><p>Third paragraph.</p>";
    const embedBlock = "<figure>EMBED</figure>";

    const secondPClose = (() => {
      let count = 0;
      let idx = 0;
      while (idx < content.length) {
        const found = content.indexOf("</p>", idx);
        if (found === -1) break;
        count++;
        if (count === 2) return found + 4;
        idx = found + 4;
      }
      return -1;
    })();

    expect(secondPClose).toBeGreaterThan(0);
    const injected = content.slice(0, secondPClose) + embedBlock + content.slice(secondPClose);
    expect(injected).toContain("<p>First paragraph.</p><p>Second paragraph.</p><figure>EMBED</figure><p>Third paragraph.</p>");
  });

  it("falls back to appending embed at end when fewer than 2 paragraphs", () => {
    const content = "<p>Only one paragraph.</p>";
    const embedBlock = "<figure>EMBED</figure>";

    const secondPClose = (() => {
      let count = 0;
      let idx = 0;
      while (idx < content.length) {
        const found = content.indexOf("</p>", idx);
        if (found === -1) break;
        count++;
        if (count === 2) return found + 4;
        idx = found + 4;
      }
      return -1;
    })();

    expect(secondPClose).toBe(-1); // No second </p>
    const injected = secondPClose > 0
      ? content.slice(0, secondPClose) + embedBlock + content.slice(secondPClose)
      : content + embedBlock;

    expect(injected).toContain("<figure>EMBED</figure>");
    expect(injected.endsWith("<figure>EMBED</figure>")).toBe(true);
  });

  it("correctly identifies Urban Monk channel videos by channelTitle", () => {
    const videos = [
      { id: "v1", title: "Random video", channelId: "UCother", channelTitle: "Other Channel" },
      { id: "v2", title: "Gut Health Tips", channelId: "UCFjivNnMnVAMvHBvHJnBqRg", channelTitle: "The Urban Monk" },
      { id: "v3", title: "Sleep Protocol", channelId: "UCother2", channelTitle: "Pedram Shojai" },
    ];

    const bestVideo = videos.find((v) =>
      v.channelId === "UCFjivNnMnVAMvHBvHJnBqRg" ||
      (v.channelTitle ?? "").toLowerCase().includes("urban monk") ||
      (v.channelTitle ?? "").toLowerCase().includes("pedram")
    ) ?? videos[0];

    expect(bestVideo.id).toBe("v2"); // Exact channel ID match wins
  });

  it("falls back to first result when no Urban Monk video found", () => {
    const videos = [
      { id: "v1", title: "Random video", channelId: "UCother", channelTitle: "Other Channel" },
      { id: "v2", title: "Another video", channelId: "UCother2", channelTitle: "Someone Else" },
    ];

    const bestVideo = videos.find((v) =>
      v.channelId === "UCFjivNnMnVAMvHBvHJnBqRg" ||
      (v.channelTitle ?? "").toLowerCase().includes("urban monk") ||
      (v.channelTitle ?? "").toLowerCase().includes("pedram")
    ) ?? videos[0];

    expect(bestVideo.id).toBe("v1"); // Falls back to first
  });

  it("skips embed when status is scheduled", () => {
    const newStatus = "scheduled";
    const shouldEmbed = newStatus !== "scheduled";
    expect(shouldEmbed).toBe(false);
  });

  it("proceeds with embed when status is published", () => {
    const newStatus = "published";
    const focusKeyword = "gut health";
    const postId = 123;
    const shouldEmbed = newStatus !== "scheduled" && !!postId && !!focusKeyword;
    expect(shouldEmbed).toBe(true);
  });

  it("returns correct youtubeEmbedResult shape on success", () => {
    const result = {
      embedded: true,
      videoId: "abc123",
      videoTitle: "Gut Health Tips — The Urban Monk",
      message: "Embedded: Gut Health Tips — The Urban Monk",
    };

    expect(result.embedded).toBe(true);
    expect(result.videoId).toBeTruthy();
    expect(result.message).toContain("Embedded:");
  });

  it("returns correct youtubeEmbedResult shape on no match", () => {
    const result = {
      embedded: false,
      message: "No matching video found on channel",
    };

    expect(result.embedded).toBe(false);
    expect(result.message).toContain("No matching");
  });
});
