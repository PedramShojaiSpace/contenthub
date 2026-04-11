/**
 * Tests for the blog JSON extraction logic.
 * The LLM sometimes returns a full JSON object even when instructed to return
 * only clean Markdown. These tests verify the extractor handles all variants.
 */
import { describe, it, expect } from "vitest";

// ── Inline copy of the extractor (mirrors routers.ts) ──────────────────────
// Keep this in sync with the implementation in routers.ts.
function extractArticleFromJson(raw: string): string | null {
  try {
    const stripped = raw
      .replace(/^```+\s*json\s*\n?/i, "")
      .replace(/^```+\s*\n?/i, "")
      .replace(/\n?```+\s*$/i, "")
      .trim();

    // Try JSON.parse first
    try {
      const firstBrace = stripped.indexOf("{");
      const lastBrace = stripped.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1) {
        const jsonStr = stripped.slice(firstBrace, lastBrace + 1);
        const parsed = JSON.parse(jsonStr);
        if (parsed.article && typeof parsed.article === "string" && parsed.article.length > 200) {
          return parsed.article;
        }
      }
    } catch {
      // fall through to regex extraction
    }

    // Regex extraction for unescaped newlines in article field
    const articleKeyMatch = stripped.match(/"article"\s*:\s*"/);
    if (!articleKeyMatch || articleKeyMatch.index === undefined) return null;

    const valueStart = articleKeyMatch.index + articleKeyMatch[0].length;
    let i = valueStart;
    let result = "";
    while (i < stripped.length) {
      const ch = stripped[i];
      if (ch === "\\" && i + 1 < stripped.length) {
        const next = stripped[i + 1];
        if (next === "n") { result += "\n"; i += 2; continue; }
        if (next === "t") { result += "\t"; i += 2; continue; }
        if (next === "\\") { result += "\\"; i += 2; continue; }
        if (next === '"') { result += '"'; i += 2; continue; }
        result += next; i += 2; continue;
      }
      if (ch === '"') break;
      result += ch;
      i++;
    }

    if (result.length > 200) return result;
    return null;
  } catch {
    return null;
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

const LONG_ARTICLE = "You wake up exhausted. Another morning, another battle against the heavy blanket of fatigue. Your brain feels foggy. ".repeat(20);

describe("extractArticleFromJson", () => {
  it("extracts article from a ```json\\n{...}\\n``` fenced response", () => {
    const input = "```json\n" + JSON.stringify({
      title: "Gut Dysbiosis",
      slug: "gut-dysbiosis",
      metaDescription: "desc",
      focusKeyword: "gut dysbiosis",
      article: LONG_ARTICLE,
    }) + "\n```";

    const result = extractArticleFromJson(input);
    expect(result).toBe(LONG_ARTICLE);
  });

  it("extracts article from a raw JSON object (no fence)", () => {
    const input = JSON.stringify({
      title: "Gut Dysbiosis",
      slug: "gut-dysbiosis",
      metaDescription: "desc",
      focusKeyword: "gut dysbiosis",
      article: LONG_ARTICLE,
    });

    const result = extractArticleFromJson(input);
    expect(result).toBe(LONG_ARTICLE);
  });

  it("extracts article when JSON contains escaped newlines in article field", () => {
    // Simulate the exact format shown in the screenshot: article value uses \n escapes
    const articleWithNewlines = "You wake up exhausted.\\n\\nAnother morning.\\n\\n## Section Two\\n\\nMore content here. ".repeat(10);
    const raw = `{"title":"Gut Dysbiosis","slug":"gut-dysbiosis","metaDescription":"desc","focusKeyword":"gut","article":"${articleWithNewlines}"}`;

    const result = extractArticleFromJson(raw);
    // Should decode \n escape sequences to real newlines
    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThan(200);
    expect(result!).toContain("\n\nAnother morning.");
  });

  it("returns null for clean markdown (not JSON)", () => {
    const markdown = "## Introduction\n\nThis is a clean article body.\n\nMore content here with enough words to pass the length check. ".repeat(5);
    const result = extractArticleFromJson(markdown);
    expect(result).toBeNull();
  });

  it("returns null when article field is too short", () => {
    const input = JSON.stringify({ title: "Test", article: "Short." });
    const result = extractArticleFromJson(input);
    expect(result).toBeNull();
  });

  it("handles ```json fence with no newline between fence and {", () => {
    const input = "```json{" + JSON.stringify({
      title: "Test",
      article: LONG_ARTICLE,
    }).slice(1) + "```";

    const result = extractArticleFromJson(input);
    expect(result).toBe(LONG_ARTICLE);
  });
});
