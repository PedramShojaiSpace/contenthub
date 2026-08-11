/**
 * Email Optimizer Router
 * Cleans and compresses Kajabi email HTML to improve inbox placement
 * and reduce Gmail promotions tab classification.
 *
 * Techniques applied:
 * 1. HTML minification (whitespace, comments)
 * 2. CSS inlining (juice)
 * 3. Class/ID attribute removal
 * 4. Non-ASCII character normalization
 * 5. Control character removal
 * 6. Redundant attribute cleanup
 * 7. Spam signal scoring (link count, image count, HTML:text ratio)
 * 8. S3 raw URL detection (major spam signal — flags for manual fix)
 * 9. target="_blank" + rel="noopener noreferrer" stripping (promotional pattern)
 * 10. Redundant per-element font-size span consolidation
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { minify } from "html-minifier-terser";
import juice from "juice";
import * as cheerio from "cheerio";
import { reviewWinningCopyPatterns, type CopyPatternReview } from "./emailCopyPatterns";

interface OptimizationResult {
  optimizedHtml: string;
  originalBytes: number;
  optimizedBytes: number;
  reductionPercent: number;
  changes: string[];
  warnings: string[];
  copyReview: CopyPatternReview[];
  spamScore: {
    before: number;
    after: number;
    signals: SpamSignal[];
  };
}

interface SpamSignal {
  name: string;
  value: string | number;
  severity: "ok" | "warning" | "bad";
  tip: string;
}

/** Analyze HTML for spam/promotional signals */
function analyzeHtml(html: string): { score: number; signals: SpamSignal[] } {
  const $ = cheerio.load(html);
  const signals: SpamSignal[] = [];
  let score = 0;

  // 1. Link count
  const linkCount = $("a").length;
  signals.push({
    name: "Link count",
    value: linkCount,
    severity: linkCount > 15 ? "bad" : linkCount > 8 ? "warning" : "ok",
    tip: "Gmail flags emails with many links as promotional. Aim for fewer than 8.",
  });
  if (linkCount > 15) score += 3;
  else if (linkCount > 8) score += 1;

  // 2. Image count
  const imageCount = $("img").length;
  signals.push({
    name: "Image count",
    value: imageCount,
    severity: imageCount > 5 ? "bad" : imageCount > 2 ? "warning" : "ok",
    tip: "Image-heavy emails are classified as promotional. Aim for 1-2 images max.",
  });
  if (imageCount > 5) score += 3;
  else if (imageCount > 2) score += 1;

  // 3. HTML:text ratio
  const textContent = $.text().replace(/\s+/g, " ").trim();
  const htmlLen = html.length;
  const textLen = textContent.length;
  const ratio = htmlLen > 0 ? Math.round((textLen / htmlLen) * 100) : 0;
  signals.push({
    name: "Text-to-HTML ratio",
    value: ratio + "%",
    severity: ratio < 10 ? "bad" : ratio < 20 ? "warning" : "ok",
    tip: "Low text-to-HTML ratio signals a marketing template. Aim for >20% text.",
  });
  if (ratio < 10) score += 3;
  else if (ratio < 20) score += 1;

  // 4. CSS class/ID count (marketing template signal)
  const classCount = (html.match(/class="/g) || []).length;
  const idCount = (html.match(/id="/g) || []).length;
  signals.push({
    name: "CSS classes & IDs",
    value: classCount + idCount,
    severity: classCount + idCount > 30 ? "bad" : classCount + idCount > 10 ? "warning" : "ok",
    tip: "CSS classes/IDs are a strong marketing template signal. Remove them.",
  });
  if (classCount + idCount > 30) score += 2;
  else if (classCount + idCount > 10) score += 1;

  // 5. HTML comments
  const commentCount = (html.match(/<!--/g) || []).length;
  signals.push({
    name: "HTML comments",
    value: commentCount,
    severity: commentCount > 5 ? "warning" : "ok",
    tip: "HTML comments add file size and can contain marketing template markers.",
  });
  if (commentCount > 5) score += 1;

  // 6. File size
  const sizeKb = Math.round(htmlLen / 1024);
  signals.push({
    name: "Email size",
    value: sizeKb + " KB",
    severity: sizeKb > 100 ? "bad" : sizeKb > 50 ? "warning" : "ok",
    tip: "Large emails are more likely to be clipped by Gmail and flagged as promotional.",
  });
  if (sizeKb > 100) score += 2;
  else if (sizeKb > 50) score += 1;

  // 7. Tracking pixels (1x1 images)
  let trackingPixels = 0;
  $("img").each((_, el) => {
    const width = $(el).attr("width");
    const height = $(el).attr("height");
    if ((width === "1" || width === "0") && (height === "1" || height === "0")) {
      trackingPixels++;
    }
  });
  if (trackingPixels > 0) {
    signals.push({
      name: "Tracking pixels",
      value: trackingPixels,
      severity: "warning",
      tip: "Tracking pixels are a known promotional signal. Consider removing them.",
    });
    score += 1;
  }

  // 8. Raw S3 / CDN links (major spam signal)
  const s3Links: string[] = [];
  $("a").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (
      href.includes("s3.amazonaws.com") ||
      href.includes("kajabi-storefronts-production") ||
      href.includes("klaviyo-images.s3") ||
      href.includes("d3k81ch9hvuctq.cloudfront.net") ||
      href.includes("cloudfront.net/") ||
      href.includes("s3-us-west") ||
      href.includes("s3-eu")
    ) {
      s3Links.push(href);
    }
  });
  if (s3Links.length > 0) {
    signals.push({
      name: "Raw S3/CDN links",
      value: s3Links.length,
      severity: "bad",
      tip: "Direct S3/CDN links (including Kajabi and Klaviyo CDN URLs) are a major spam trigger. Host files on your own domain and redirect (e.g. theurbanmonk.com/download/upstream-health → 301 to S3).",
    });
    score += 4;
  }

  // 9. target="_blank" with rel="noopener noreferrer" (promotional pattern)
  const blankLinks = $("a[target='_blank']").length;
  if (blankLinks > 0) {
    signals.push({
      name: "target=\"_blank\" links",
      value: blankLinks,
      severity: blankLinks > 1 ? "warning" : "ok",
      tip: "Multiple target=_blank links with rel=noopener noreferrer is a common email marketing template pattern. Removed by optimizer.",
    });
    if (blankLinks > 1) score += 1;
  }

  // 10. Per-element font-size spans (heavy inline styling)
  const fontSizeSpans = (html.match(/font-size:/g) || []).length;
  if (fontSizeSpans > 3) {
    signals.push({
      name: "Per-element font-size styles",
      value: fontSizeSpans,
      severity: fontSizeSpans > 8 ? "warning" : "ok",
      tip: "Repeating font-size on every span adds noise. Optimizer consolidates these into a single wrapper style.",
    });
    if (fontSizeSpans > 8) score += 1;
  }

  return { score, signals };
}

/**
 * Consolidate repeated font-size spans into a single wrapper.
 * If every top-level paragraph has font-size:18px on its first child span,
 * we wrap the entire body in a div with that font-size and strip the per-element declarations.
 */
function consolidateFontSizes($: cheerio.CheerioAPI, changes: string[]): void {
  // Collect all unique font-size values used in spans
  const fontSizeValues: Map<string, number> = new Map();
  $("span[style]").each((_, el) => {
    const style = $(el).attr("style") || "";
    const match = style.match(/font-size:\s*([^;]+)/);
    if (match) {
      const val = match[1].trim();
      fontSizeValues.set(val, (fontSizeValues.get(val) || 0) + 1);
    }
  });

  // Find the dominant font-size (used on 3+ spans)
  let dominantSize: string | null = null;
  let dominantCount = 0;
  Array.from(fontSizeValues.entries()).forEach(([size, count]) => {
    if (count > dominantCount) {
      dominantCount = count;
      dominantSize = size;
    }
  });

  if (!dominantSize || dominantCount < 3) return;

  const dominant = dominantSize;

  // Strip font-size from spans that use the dominant size
  let stripped = 0;
  $("span[style]").each((_, el) => {
    const style = $(el).attr("style") || "";
    const match = style.match(/font-size:\s*([^;]+)/);
    if (match && match[1].trim() === dominant) {
      const newStyle = style
        .replace(/font-size:\s*[^;]+;?/g, "")
        .replace(/;+/g, ";")
        .replace(/^;|;$/g, "")
        .trim();
      if (newStyle) {
        $(el).attr("style", newStyle);
      } else {
        // If span only had font-size, unwrap it (keep children)
        $(el).replaceWith($(el).html() || "");
      }
      stripped++;
    }
  });

  if (stripped > 0) {
    // Wrap the body content in a div with the dominant font-size
    const bodyHtml = $("body").html() || "";
    $("body").html('<div style="font-size:' + dominant + '">' + bodyHtml + "</div>");
    changes.push(
      "Consolidated " + stripped + " per-element font-size:" + dominant +
      " declarations into a single wrapper (reduces spam score)"
    );
  }
}

/** Run the full optimization pipeline */
async function optimizeEmailHtml(rawHtml: string): Promise<OptimizationResult> {
  const changes: string[] = [];
  const warnings: string[] = [];
  const originalBytes = Buffer.byteLength(rawHtml, "utf8");

  let html = rawHtml;

  // Step 1: Inline CSS using juice (converts <style> blocks to inline styles)
  try {
    const juiced = juice(html, {
      removeStyleTags: true,
      preserveImportant: true,
      preserveMediaQueries: false,
    });
    if (juiced !== html) {
      changes.push("Inlined CSS from <style> blocks into inline styles");
      html = juiced;
    }
  } catch {
    // juice can fail on malformed HTML — continue without it
  }

  // Step 2: Use cheerio for DOM-level cleanup
  // decodeEntities option removed — not supported in this cheerio version; entities preserved by default
  const $ = cheerio.load(html);

  // The supplied email exports contained legacy hidden boost-data blocks. They
  // can surface in plain-text readers, so remove them before any other cleanup.
  const boostDataBlocks = $("#boostData, [data-id='boostData']").length;
  if (boostDataBlocks > 0) {
    $("#boostData, [data-id='boostData']").remove();
    changes.push("Removed " + boostDataBlocks + " legacy hidden boost-data block(s)");
  }

  // Remove class and id attributes (marketing template signals)
  let classIdCount = 0;
  $("[class], [id]").each((_, el) => {
    $(el).removeAttr("class").removeAttr("id");
    classIdCount++;
  });
  if (classIdCount > 0) {
    changes.push("Removed class/id attributes from " + classIdCount + " elements");
  }

  // Remove data-* attributes (tracking/template metadata)
  let dataAttrCount = 0;
  $("*").each((_, el) => {
    const attribs = (el as unknown as { attribs?: Record<string, string> }).attribs || {};
    for (const attr of Object.keys(attribs)) {
      if (attr.startsWith("data-")) {
        $(el).removeAttr(attr);
        dataAttrCount++;
      }
    }
  });
  if (dataAttrCount > 0) {
    changes.push("Removed " + dataAttrCount + " data-* tracking attributes");
  }

  // Remove tracking pixels (1x1 images)
  let pixelCount = 0;
  $("img").each((_, el) => {
    const width = $(el).attr("width");
    const height = $(el).attr("height");
    const src = $(el).attr("src") || "";
    if (
      ((width === "1" || width === "0") && (height === "1" || height === "0")) ||
      src.includes("track") ||
      src.includes("pixel") ||
      src.includes("open")
    ) {
      $(el).remove();
      pixelCount++;
    }
  });
  if (pixelCount > 0) {
    changes.push("Removed " + pixelCount + " tracking pixel(s)");
  }

  // Add missing ALT tags to images
  let altCount = 0;
  $("img").each((_, el) => {
    if (!$(el).attr("alt")) {
      $(el).attr("alt", "");
      altCount++;
    }
  });
  if (altCount > 0) {
    changes.push("Added missing ALT tags to " + altCount + " image(s)");
  }

  // Remove empty style attributes
  $("[style=''], [style=\"\"]").removeAttr("style");

  // Strip target="_blank" and rel="noopener noreferrer" from links
  // These are strong promotional email template signals
  let blankTargetCount = 0;
  $("a[target='_blank']").each((_, el) => {
    $(el).removeAttr("target").removeAttr("rel");
    blankTargetCount++;
  });
  if (blankTargetCount > 0) {
    changes.push(
      "Removed target=\"_blank\" and rel=\"noopener noreferrer\" from " +
      blankTargetCount + " link(s) (promotional template signals)"
    );
  }

  // Detect raw S3/CDN links and warn (cannot auto-fix — needs domain redirect)
  const s3Links: string[] = [];
  $("a").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (
      href.includes("s3.amazonaws.com") ||
      href.includes("kajabi-storefronts-production") ||
      href.includes("klaviyo-images.s3") ||
      href.includes("d3k81ch9hvuctq.cloudfront.net") ||
      href.includes("cloudfront.net/") ||
      href.includes("s3-us-west") ||
      href.includes("s3-eu")
    ) {
      s3Links.push(href);
    }
  });
  if (s3Links.length > 0) {
    warnings.push(
      "RAW S3/CDN LINK DETECTED — this is the #1 reason this email is going to Promotions. " +
      "This includes Kajabi CDN (kajabi-storefronts-production) and Klaviyo CDN (klaviyo-images.s3) URLs. " +
      "Replace with a redirect on your own domain " +
      "(e.g. https://theurbanmonk.com/download/upstream-health → 301 redirect to the S3 PDF). " +
      "Affected links: " + s3Links.join(", ")
    );
  }

  // Consolidate repeated font-size declarations into a single wrapper
  consolidateFontSizes($, changes);

  html = $.html();

  // Step 3: Non-ASCII character normalization
  const nonAsciiCount = (html.match(/[^\x00-\x7F]/g) || []).length;
  if (nonAsciiCount > 0) {
    html = html
      .replace(/\u2018|\u2019/g, "'") // smart single quotes
      .replace(/\u201C|\u201D/g, '"') // smart double quotes
      .replace(/\u2013/g, "-") // en dash
      .replace(/\u2014/g, "--") // em dash
      .replace(/\u2026/g, "...") // ellipsis
      .replace(/\u00A0/g, " ") // non-breaking space
      .replace(/[\u200B-\u200D\uFEFF]/g, ""); // zero-width chars
    changes.push("Normalized " + nonAsciiCount + " non-ASCII characters");
  }

  // Step 4: Control character removal
  const controlCount = (html.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g) || []).length;
  if (controlCount > 0) {
    html = html.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
    changes.push("Removed " + controlCount + " control/non-printable characters");
  }

  // Step 5: HTML minification
  const minified = await minify(html, {
    collapseWhitespace: true,
    removeComments: true,
    removeEmptyAttributes: false,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    minifyCSS: true,
    minifyJS: false,
    preserveLineBreaks: false,
    trimCustomFragments: true,
  });

  const commentsBefore = (html.match(/<!--/g) || []).length;
  if (commentsBefore > 0) {
    changes.push("Removed " + commentsBefore + " HTML comments");
  }
  changes.push("Minified HTML (collapsed whitespace, optimized attributes)");

  html = minified;

  const optimizedBytes = Buffer.byteLength(html, "utf8");
  const reductionPercent = Math.round(((originalBytes - optimizedBytes) / originalBytes) * 100);

  // Analyze before and after
  const beforeAnalysis = analyzeHtml(rawHtml);
  const afterAnalysis = analyzeHtml(html);
  const copyReview = reviewWinningCopyPatterns(html);

  return {
    optimizedHtml: html,
    originalBytes,
    optimizedBytes,
    reductionPercent,
    changes,
    warnings,
    copyReview,
    spamScore: {
      before: beforeAnalysis.score,
      after: afterAnalysis.score,
      signals: afterAnalysis.signals,
    },
  };
}

// Exported for use by the public bookmarklet endpoint in index.ts
export { optimizeEmailHtml as optimizeEmailHtmlPublic };

export const emailOptimizerRouter = router({
  /** Bulk optimize multiple sequence emails at once */
  bulkOptimize: protectedProcedure
    .input(
      z.object({
        emails: z.array(
          z.object({
            label: z.string().min(1).max(200),
            html: z.string().min(10).max(500_000),
          })
        ).min(1).max(50),
      })
    )
    .mutation(async ({ input }) => {
      const results = await Promise.all(
        input.emails.map(async (email) => {
          try {
            const result = await optimizeEmailHtml(email.html);
            return {
              label: email.label,
              success: true,
              ...result,
              error: null,
            };
          } catch (err) {
            return {
              label: email.label,
              success: false,
              optimizedHtml: email.html,
              originalBytes: Buffer.byteLength(email.html, "utf8"),
              optimizedBytes: Buffer.byteLength(email.html, "utf8"),
              reductionPercent: 0,
              changes: [],
              warnings: [],
              copyReview: [],
              spamScore: { before: 0, after: 0, signals: [] },
              error: err instanceof Error ? err.message : "Unknown error",
            };
          }
        })
      );
      return { results };
    }),

  /** Optimize raw HTML pasted by the user */
  optimizeHtml: protectedProcedure
    .input(
      z.object({
        html: z.string().min(10).max(500_000),
      })
    )
    .mutation(async ({ input }) => {
      const result = await optimizeEmailHtml(input.html);
      return result;
    }),
});
