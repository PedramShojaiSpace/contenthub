/**
 * Tests for urlScrubber — scrubHallucinatedUrls + resolvePlaceholderLinks
 */

import { describe, it, expect } from "vitest";
import { scrubHallucinatedUrls, resolvePlaceholderLinks } from "./urlScrubber";

// ─── scrubHallucinatedUrls ────────────────────────────────────────────────────

describe("scrubHallucinatedUrls", () => {
  it("keeps a verified theurbanmonk.com URL unchanged", () => {
    const body = "Read more at [Gut Health Guide](https://theurbanmonk.com/gut-health-guide/).";
    const { body: out, kept, removed } = scrubHallucinatedUrls(body, [
      "https://theurbanmonk.com/gut-health-guide/",
    ]);
    expect(out).toContain("[Gut Health Guide](https://theurbanmonk.com/gut-health-guide/)");
    expect(kept).toHaveLength(1);
    expect(removed).toHaveLength(0);
  });

  it("replaces a hallucinated theurbanmonk.com URL with a placeholder", () => {
    const body = "See [Sleep Tips](https://theurbanmonk.com/sleep-tips-invented/).";
    const { body: out, removed } = scrubHallucinatedUrls(body, []);
    expect(out).toContain("[INTERNAL LINK: Sleep Tips]");
    expect(out).not.toContain("theurbanmonk.com/sleep-tips-invented");
    expect(removed).toHaveLength(1);
  });

  it("handles trailing slashes in URL comparison", () => {
    const body = "[Article](https://theurbanmonk.com/article)";
    const { kept } = scrubHallucinatedUrls(body, [
      "https://theurbanmonk.com/article/", // trailing slash variant
    ]);
    expect(kept).toHaveLength(1);
  });

  it("does not touch non-theurbanmonk.com links", () => {
    const body = "Source: [PubMed Study](https://pubmed.ncbi.nlm.nih.gov/12345/).";
    const { body: out } = scrubHallucinatedUrls(body, []);
    expect(out).toContain("pubmed.ncbi.nlm.nih.gov");
  });
});

// ─── resolvePlaceholderLinks ──────────────────────────────────────────────────

const SAMPLE_INDEX = [
  {
    title: "The Gut-Brain Axis: Your Second Brain's Influence on Mood and Health",
    url: "https://theurbanmonk.com/gut-brain-axis/",
    excerpt: "The gut-brain connection is a bidirectional communication highway between your digestive system and your brain.",
  },
  {
    title: "Sleep Hygiene Tips for Deep Restorative Rest",
    url: "https://theurbanmonk.com/sleep-hygiene-tips/",
    excerpt: "Improving sleep hygiene can dramatically improve the quality of your rest and your daytime energy.",
  },
  {
    title: "Stress and Cortisol: How Chronic Stress Destroys Your Health",
    url: "https://theurbanmonk.com/stress-cortisol/",
    excerpt: "Chronic stress elevates cortisol levels and creates a cascade of hormonal imbalances.",
  },
];

describe("resolvePlaceholderLinks", () => {
  it("resolves a placeholder to a real URL when a good match exists", () => {
    const body = "Learn more about [INTERNAL LINK: The Gut-Brain Axis: Your Second Brain's Influence on Mood and Health].";
    const { body: out, resolved, stripped } = resolvePlaceholderLinks(body, SAMPLE_INDEX);
    expect(out).toContain("https://theurbanmonk.com/gut-brain-axis/");
    expect(out).not.toContain("[INTERNAL LINK:");
    expect(resolved).toHaveLength(1);
    expect(stripped).toHaveLength(0);
  });

  it("resolves a partial topic match by keyword overlap", () => {
    const body = "For better rest, see [INTERNAL LINK: sleep hygiene and restorative rest].";
    const { body: out, resolved } = resolvePlaceholderLinks(body, SAMPLE_INDEX);
    // "sleep", "hygiene", "restorative", "rest" all appear in the sleep post
    expect(out).toContain("https://theurbanmonk.com/sleep-hygiene-tips/");
    expect(resolved).toHaveLength(1);
  });

  it("strips a placeholder when no post matches the topic", () => {
    const body = "Also consider [INTERNAL LINK: quantum biohacking with infrared saunas].";
    const { body: out, stripped, resolved } = resolvePlaceholderLinks(body, SAMPLE_INDEX);
    // No post matches this topic — placeholder should be stripped to plain text
    expect(out).not.toContain("[INTERNAL LINK:");
    expect(out).not.toContain("[");
    expect(stripped).toHaveLength(1);
    expect(resolved).toHaveLength(0);
  });

  it("handles multiple placeholders in one article", () => {
    const body = [
      "Gut health matters. [INTERNAL LINK: gut brain axis mood health].",
      "Sleep is critical. [INTERNAL LINK: sleep hygiene deep rest].",
      "Unknown topic: [INTERNAL LINK: alien detox protocol].",
    ].join("\n");
    const { resolved, stripped } = resolvePlaceholderLinks(body, SAMPLE_INDEX);
    expect(resolved).toHaveLength(2);
    expect(stripped).toHaveLength(1);
  });

  it("returns the body unchanged when there are no placeholders", () => {
    const body = "This article has no placeholders at all.";
    const { body: out, resolved, stripped } = resolvePlaceholderLinks(body, SAMPLE_INDEX);
    expect(out).toBe(body);
    expect(resolved).toHaveLength(0);
    expect(stripped).toHaveLength(0);
  });

  it("strips gracefully when postIndex is empty", () => {
    const body = "See [INTERNAL LINK: gut health tips].";
    const { body: out, stripped } = resolvePlaceholderLinks(body, []);
    expect(out).not.toContain("[INTERNAL LINK:");
    expect(stripped).toHaveLength(1);
  });

  it("does not double-resolve an already-resolved link", () => {
    // After resolution, the output should be a clean Markdown link, not a nested placeholder
    const body = "[INTERNAL LINK: cortisol stress health]";
    const { body: out } = resolvePlaceholderLinks(body, SAMPLE_INDEX);
    // Should be a real link, not [INTERNAL LINK: ...]
    expect(out).not.toContain("[INTERNAL LINK:");
    expect(out).toContain("https://theurbanmonk.com/stress-cortisol/");
  });
});
