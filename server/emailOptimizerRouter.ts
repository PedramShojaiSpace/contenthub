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
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { minify } from "html-minifier-terser";
import juice from "juice";
import * as cheerio from "cheerio";

interface OptimizationResult {
  optimizedHtml: string;
  originalBytes: number;
  optimizedBytes: number;
  reductionPercent: number;
  changes: string[];
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
    value: `${ratio}%`,
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
    value: `${sizeKb} KB`,
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

  return { score, signals };
}

/** Run the full optimization pipeline */
async function optimizeEmailHtml(rawHtml: string): Promise<OptimizationResult> {
  const changes: string[] = [];
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
  const $ = cheerio.load(html, { decodeEntities: false });

  // Remove class and id attributes (marketing template signals)
  let classIdCount = 0;
  $("[class], [id]").each((_, el) => {
    $(el).removeAttr("class").removeAttr("id");
    classIdCount++;
  });
  if (classIdCount > 0) {
    changes.push(`Removed class/id attributes from ${classIdCount} elements`);
  }

  // Remove data-* attributes (tracking/template metadata)
  let dataAttrCount = 0;
  $("*").each((_, el) => {
    const attribs = (el as cheerio.Element & { attribs?: Record<string, string> }).attribs || {};
    for (const attr of Object.keys(attribs)) {
      if (attr.startsWith("data-")) {
        $(el).removeAttr(attr);
        dataAttrCount++;
      }
    }
  });
  if (dataAttrCount > 0) {
    changes.push(`Removed ${dataAttrCount} data-* tracking attributes`);
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
    changes.push(`Removed ${pixelCount} tracking pixel(s)`);
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
    changes.push(`Added missing ALT tags to ${altCount} image(s)`);
  }

  // Remove empty style attributes
  $("[style=''], [style=\"\"]").removeAttr("style");

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
    changes.push(`Normalized ${nonAsciiCount} non-ASCII characters`);
  }

  // Step 4: Control character removal
  const controlCount = (html.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g) || []).length;
  if (controlCount > 0) {
    html = html.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
    changes.push(`Removed ${controlCount} control/non-printable characters`);
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
    changes.push(`Removed ${commentsBefore} HTML comments`);
  }
  changes.push("Minified HTML (collapsed whitespace, optimized attributes)");

  html = minified;

  const optimizedBytes = Buffer.byteLength(html, "utf8");
  const reductionPercent = Math.round(((originalBytes - optimizedBytes) / originalBytes) * 100);

  // Analyze before and after
  const beforeAnalysis = analyzeHtml(rawHtml);
  const afterAnalysis = analyzeHtml(html);

  return {
    optimizedHtml: html,
    originalBytes,
    optimizedBytes,
    reductionPercent,
    changes,
    spamScore: {
      before: beforeAnalysis.score,
      after: afterAnalysis.score,
      signals: afterAnalysis.signals,
    },
  };
}

export const emailOptimizerRouter = router({
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
