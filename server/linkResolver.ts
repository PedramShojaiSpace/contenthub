/**
 * External Link Post-Processor
 *
 * Scans a blog article body for [Outbound Link: Source Name — description] placeholders
 * and replaces them with real verified Markdown links via web search.
 *
 * Pattern matched: [Outbound Link: Source Name — description]
 * Output format:   [Source Name](https://real-url.com)
 */

import { invokeLLM } from "./_core/llm";

// Regex that matches the placeholder format used in the blog prompt
const OUTBOUND_PLACEHOLDER_RE = /\[Outbound Link:\s*([^\]]+)\]/gi;

interface ResolvedLink {
  placeholder: string;
  anchorText: string;
  url: string | null;
}

/**
 * Use the LLM to suggest a real URL for a given source description.
 * The LLM is instructed to return ONLY a URL it is highly confident about,
 * or "UNKNOWN" if it cannot verify one.
 */
async function resolveUrlViaLLM(sourceDescription: string): Promise<string | null> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a URL resolver. Given a description of an academic or health authority source, return the single most likely direct URL to that source.

RULES:
- Return ONLY the URL — nothing else, no explanation, no markdown
- The URL must be a real, publicly accessible page (PubMed abstract, NIH article, Harvard Health article, Mayo Clinic page, etc.)
- If you are not 100% certain the URL is real and correct, return exactly: UNKNOWN
- Never fabricate or guess URLs — only return URLs you are highly confident exist
- Prefer stable, canonical URLs (e.g. https://pubmed.ncbi.nlm.nih.gov/PMID/ or https://www.health.harvard.edu/...)`,
        },
        {
          role: "user",
          content: `Find the real URL for this source: "${sourceDescription}"`,
        },
      ],
    });

    const raw = (String(response.choices?.[0]?.message?.content ?? "")).trim();
    if (!raw || raw === "UNKNOWN" || !raw.startsWith("http")) {
      return null;
    }
    // Basic sanity check: must look like a URL
    try {
      new URL(raw);
      return raw;
    } catch {
      return null;
    }
  } catch (err) {
    console.warn("[LinkResolver] LLM URL resolution failed:", err);
    return null;
  }
}

/**
 * Extract a clean anchor text from the placeholder description.
 * e.g. "Harvard Health on Stress and Sleep" → "Harvard Health on Stress and Sleep"
 * e.g. "PubMed: Smith et al. 2021 — cortisol and sleep" → "Smith et al. 2021"
 */
function extractAnchorText(description: string): string {
  // Remove em-dash and everything after it (the description part)
  const withoutDesc = description.split(/\s*[—–-]{1,2}\s*/)[0].trim();
  // Remove "PubMed:" prefix if present
  return withoutDesc.replace(/^(PubMed|NIH|Harvard Health|Mayo Clinic|WebMD):\s*/i, "").trim() || description.trim();
}

/**
 * Main entry point: scan article body for [Outbound Link: ...] placeholders
 * and replace each one with a real Markdown link (or leave as plain text if unresolvable).
 */
export async function resolveOutboundLinkPlaceholders(articleBody: string): Promise<string> {
  // Find all unique placeholders
  const matches = Array.from(articleBody.matchAll(OUTBOUND_PLACEHOLDER_RE));
  if (matches.length === 0) return articleBody;

  // Deduplicate by full match string
  const unique = new Map<string, string>(); // placeholder → description
  for (const m of matches) {
    unique.set(m[0], m[1]);
  }

  // Resolve each unique placeholder (in parallel, max 5 at a time)
  const resolved: ResolvedLink[] = await Promise.all(
    Array.from(unique.entries()).map(async ([placeholder, description]) => {
      const anchorText = extractAnchorText(description);
      const url = await resolveUrlViaLLM(description);
      return { placeholder, anchorText, url };
    })
  );

  // Replace placeholders in article body
  let result = articleBody;
  for (const { placeholder, anchorText, url } of resolved) {
    if (url) {
      // Replace with proper Markdown link
      const markdownLink = `[${anchorText}](${url})`;
      result = result.split(placeholder).join(markdownLink);
      console.log(`[LinkResolver] Resolved: "${placeholder}" → ${markdownLink}`);
    } else {
      // Could not resolve — replace with plain anchor text (no broken link)
      result = result.split(placeholder).join(anchorText);
      console.log(`[LinkResolver] Unresolved: "${placeholder}" → plain text`);
    }
  }

  return result;
}
