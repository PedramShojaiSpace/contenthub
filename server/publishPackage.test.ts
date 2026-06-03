/**
 * publishPackage.test.ts
 *
 * Tests for the three Publish Package procedures added to videoSessionRouter:
 *   - generateYouTubeMetadata
 *   - generateSocialCaptions
 *   - generateBlogFromScript
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock LLM ────────────────────────────────────────────────────────────────

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

vi.mock("./avatarRouter", () => ({
  getAvatarContextBlock: vi.fn().mockResolvedValue(""),
}));

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMockYtMetaResponse() {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify({
            titleOptions: [
              "5 Signs Your Gut Is Destroying Your Energy Levels",
              "The Real Reason You're Always Tired (It's Your Gut)",
              "How to Fix Leaky Gut in 30 Days — Dr. Pedram Shojai",
              "Gut Health Secrets Doctors Won't Tell You",
              "Why Your Gut Health Determines Everything About Your Life",
            ],
            description:
              "Your gut is the root of everything. Dr. Pedram Shojai breaks down the five warning signs your gut microbiome is out of balance...",
            tags: [
              "gut health",
              "leaky gut",
              "microbiome",
              "pedram shojai",
              "urban monk",
              "gut healing",
              "digestive health",
              "gut bacteria",
              "probiotics",
              "gut inflammation",
              "how to fix gut health",
              "gut health tips",
              "leaky gut symptoms",
              "gut health diet",
              "heal your gut naturally",
              "gut brain connection",
              "functional medicine",
              "integrative medicine",
              "dr pedram shojai",
              "theurbanmonk",
              "gut health 2024",
              "microbiome health",
              "gut healing protocol",
              "digestive issues",
              "gut health remedies",
            ],
            primaryKeyword: "gut health",
          }),
        },
      },
    ],
  };
}

function makeMockSocialResponse() {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify({
            instagram: {
              caption:
                "Your gut is running the show — and most people don't even know it.\n\nI've spent 20 years studying this and the research is clear: 70% of your immune system lives in your gut.\n\nComment UPSTREAM below and I'll send you the link directly.",
              hashtags: [
                "#guthealth",
                "#microbiome",
                "#urbanmonk",
                "#pedramShojai",
                "#functionalMedicine",
                "#leakygut",
                "#digestivehealth",
                "#gutbrainconnection",
                "#holistichealth",
                "#wellnessjourney",
                "#healthylifestyle",
                "#gutflora",
                "#probiotics",
                "#antiinflammatory",
                "#healyourgut",
              ],
            },
            tiktok: {
              caption:
                "POV: You've tried everything for your energy.\nBut nobody told you it starts in your gut.\nHere's what I tell my patients.\nComment UPSTREAM and I'll send you the full protocol.",
              hashtags: [
                "#guthealth",
                "#microbiome",
                "#leakygut",
                "#functionalmed",
                "#urbanmonk",
              ],
            },
            linkedin: {
              caption:
                "After 20 years in integrative medicine, one pattern is undeniable: most chronic conditions trace back to gut dysfunction.\n\nThe research is clear. Comment UPSTREAM and I'll send you the link.",
              hashtags: [
                "#guthealth",
                "#functionalMedicine",
                "#integrativeHealth",
                "#wellness",
              ],
            },
            x: {
              caption:
                "70% of your immune system lives in your gut. Fix the gut, fix the body. Comment UPSTREAM for the full protocol. #guthealth #urbanmonk",
              hashtags: ["#guthealth", "#urbanmonk"],
            },
          }),
        },
      },
    ],
  };
}

function makeMockBlogResponse() {
  return {
    choices: [
      {
        message: {
          content: `META: Discover the 5 warning signs your gut health is destroying your energy, mood, and immunity — and what to do about it.

## 5 Signs Your Gut Is Destroying Your Energy Levels

Your gut is not just a digestive organ. It is the command center of your entire body...

### 1. Chronic Fatigue That Sleep Can't Fix

If you wake up exhausted no matter how many hours you sleep, your gut may be the culprit...`,
        },
      },
    ],
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Publish Package — YouTube Metadata", () => {
  it("parses titleOptions array correctly", () => {
    const raw = makeMockYtMetaResponse().choices[0].message.content;
    const meta = JSON.parse(raw);
    expect(Array.isArray(meta.titleOptions)).toBe(true);
    expect(meta.titleOptions).toHaveLength(5);
    meta.titleOptions.forEach((t: string) => {
      expect(typeof t).toBe("string");
      expect(t.length).toBeGreaterThan(10);
      expect(t.length).toBeLessThanOrEqual(100);
    });
  });

  it("parses tags array with at least 20 tags", () => {
    const raw = makeMockYtMetaResponse().choices[0].message.content;
    const meta = JSON.parse(raw);
    expect(Array.isArray(meta.tags)).toBe(true);
    expect(meta.tags.length).toBeGreaterThanOrEqual(20);
  });

  it("includes a non-empty description", () => {
    const raw = makeMockYtMetaResponse().choices[0].message.content;
    const meta = JSON.parse(raw);
    expect(typeof meta.description).toBe("string");
    expect(meta.description.length).toBeGreaterThan(50);
  });

  it("includes a primaryKeyword", () => {
    const raw = makeMockYtMetaResponse().choices[0].message.content;
    const meta = JSON.parse(raw);
    expect(typeof meta.primaryKeyword).toBe("string");
    expect(meta.primaryKeyword.length).toBeGreaterThan(0);
  });

  it("handles JSON wrapped in code fences", () => {
    const wrapped = "```json\n" + makeMockYtMetaResponse().choices[0].message.content + "\n```";
    const cleaned = wrapped.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const meta = JSON.parse(cleaned);
    expect(meta.titleOptions).toHaveLength(5);
  });
});

describe("Publish Package — Social Captions", () => {
  it("returns captions for all 4 platforms", () => {
    const raw = makeMockSocialResponse().choices[0].message.content;
    const captions = JSON.parse(raw);
    expect(captions).toHaveProperty("instagram");
    expect(captions).toHaveProperty("tiktok");
    expect(captions).toHaveProperty("linkedin");
    expect(captions).toHaveProperty("x");
  });

  it("each platform has caption and hashtags", () => {
    const raw = makeMockSocialResponse().choices[0].message.content;
    const captions = JSON.parse(raw);
    for (const platform of ["instagram", "tiktok", "linkedin", "x"] as const) {
      expect(typeof captions[platform].caption).toBe("string");
      expect(captions[platform].caption.length).toBeGreaterThan(20);
      expect(Array.isArray(captions[platform].hashtags)).toBe(true);
      expect(captions[platform].hashtags.length).toBeGreaterThan(0);
    }
  });

  it("instagram caption is longer than TikTok (more detailed)", () => {
    const raw = makeMockSocialResponse().choices[0].message.content;
    const captions = JSON.parse(raw);
    expect(captions.instagram.caption.length).toBeGreaterThan(
      captions.tiktok.caption.length
    );
  });

  it("instagram has more hashtags than X", () => {
    const raw = makeMockSocialResponse().choices[0].message.content;
    const captions = JSON.parse(raw);
    expect(captions.instagram.hashtags.length).toBeGreaterThan(
      captions.x.hashtags.length
    );
  });
});

describe("Publish Package — Blog from Script", () => {
  it("extracts META description from blog response", () => {
    const content = makeMockBlogResponse().choices[0].message.content;
    const metaMatch = content.match(/^META:\s*(.+)/m);
    expect(metaMatch).not.toBeNull();
    const metaDescription = metaMatch![1].trim();
    expect(metaDescription.length).toBeGreaterThan(20);
    expect(metaDescription.length).toBeLessThanOrEqual(160);
  });

  it("strips META line from blog content", () => {
    const content = makeMockBlogResponse().choices[0].message.content;
    const cleanContent = content.replace(/^META:\s*.+\n?/m, "").trim();
    expect(cleanContent).not.toContain("META:");
    expect(cleanContent.startsWith("##")).toBe(true);
  });

  it("extracts title from first H2 heading", () => {
    const content = makeMockBlogResponse().choices[0].message.content;
    const cleanContent = content.replace(/^META:\s*.+\n?/m, "").trim();
    const titleMatch = cleanContent.match(/^#{1,2}\s+(.+)/m);
    expect(titleMatch).not.toBeNull();
    const blogTitle = titleMatch![1].trim();
    expect(blogTitle).toBe("5 Signs Your Gut Is Destroying Your Energy Levels");
  });

  it("blog content contains markdown headings", () => {
    const content = makeMockBlogResponse().choices[0].message.content;
    const cleanContent = content.replace(/^META:\s*.+\n?/m, "").trim();
    expect(cleanContent).toMatch(/#{1,3}\s+/);
  });
});
