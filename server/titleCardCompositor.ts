/**
 * titleCardCompositor.ts
 *
 * Hybrid title card generation using sharp (no Puppeteer/Chromium required):
 *   1. Ask the AI to generate a BACKGROUND ONLY (no text in the image prompt)
 *   2. Download the background image
 *   3. Composite an SVG text overlay on top using sharp
 *   4. Upload the final composite PNG to S3
 *
 * Works in both local dev and serverless production (no browser dependency).
 * Supports 4 mood styles and 3 font sizes.
 */
import sharp, { type Sharp } from "sharp";
import { storagePut } from "./storage";
import { generateImage } from "./_core/imageGeneration";

// ─── Platform dimensions ──────────────────────────────────────────────────────
export const PLATFORM_DIMS: Record<string, { w: number; h: number; label: string }> = {
  linkedin:        { w: 1200, h:  627, label: "LinkedIn"        },
  x:               { w: 1600, h:  900, label: "X / Twitter"     },
  meta:            { w: 1080, h: 1080, label: "Facebook / Meta"  },
  instagram_feed:  { w: 1080, h: 1080, label: "Instagram Feed"  },
  instagram_reel:  { w: 1080, h: 1920, label: "Instagram Reel"  },
  instagram_story: { w: 1080, h: 1920, label: "Instagram Story" },
};

// ─── Mood definitions ─────────────────────────────────────────────────────────
export type CardMood = "forest_dark" | "stone_gray" | "ink_black" | "warm_amber";
export type CardFontSize = "large" | "medium" | "small";

interface MoodConfig {
  bgPrompt: (ratio: string) => string;
  fallbackBg: string;       // hex fallback background color
  overlayColor: string;     // rgba for the dark overlay
  quoteColor: string;       // Quote text color
  accentColor: string;      // Gold/accent color
  brandColor: string;       // Brand name color
}

const MOODS: Record<CardMood, MoodConfig> = {
  forest_dark: {
    bgPrompt: (ratio) =>
      `Abstract ${ratio} background texture for a premium wellness brand. ` +
      `Dark forest green and deep charcoal tones, subtle organic texture like aged leather or moss, ` +
      `soft vignette edges, no text, no people, no objects, no symbols. Minimalist and sophisticated.`,
    fallbackBg: "#1a2a1a",
    overlayColor: "rgba(10,20,10,0.60)",
    quoteColor: "#f5f0e8",
    accentColor: "#d4af37",
    brandColor: "#d4af37",
  },
  stone_gray: {
    bgPrompt: (ratio) =>
      `Abstract ${ratio} background texture for a premium mindfulness brand. ` +
      `Cool stone gray and slate tones, subtle concrete or granite texture, ` +
      `soft vignette edges, no text, no people, no objects, no symbols. Minimalist and sophisticated.`,
    fallbackBg: "#2a2a2a",
    overlayColor: "rgba(20,20,20,0.58)",
    quoteColor: "#f0f0f0",
    accentColor: "#c8c8c8",
    brandColor: "#c8c8c8",
  },
  ink_black: {
    bgPrompt: (ratio) =>
      `Abstract ${ratio} background texture for a luxury brand. ` +
      `Deep black and near-black tones, subtle paper or linen texture, very dark, ` +
      `soft vignette edges, no text, no people, no objects, no symbols. Minimalist and elegant.`,
    fallbackBg: "#0a0a0a",
    overlayColor: "rgba(0,0,0,0.65)",
    quoteColor: "#f8f4ee",
    accentColor: "#e8c96a",
    brandColor: "#e8c96a",
  },
  warm_amber: {
    bgPrompt: (ratio) =>
      `Abstract ${ratio} background texture for a warm wellness brand. ` +
      `Rich amber, burnt sienna, and deep ochre tones, subtle aged parchment or warm wood texture, ` +
      `soft vignette edges, no text, no people, no objects, no symbols. Warm and sophisticated.`,
    fallbackBg: "#2a1a08",
    overlayColor: "rgba(20,10,0,0.58)",
    quoteColor: "#fdf6e3",
    accentColor: "#e8a030",
    brandColor: "#e8a030",
  },
};

// ─── Font size multipliers ────────────────────────────────────────────────────
const FONT_SCALE: Record<CardFontSize, number> = {
  large:  1.22,
  medium: 1.00,
  small:  0.80,
};

// ─── SVG text wrapping helper ─────────────────────────────────────────────────
/**
 * Wrap text into lines that fit within maxCharsPerLine.
 * Tries to break on word boundaries.
 */
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length <= maxCharsPerLine) {
      current = (current + " " + word).trim();
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Escape XML/SVG special characters */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ─── SVG overlay builder ──────────────────────────────────────────────────────
function buildSvgOverlay(opts: {
  quoteText: string;
  authorName: string;
  bookTitle: string;
  brandName: string;
  w: number;
  h: number;
  mood: CardMood;
  fontSize: CardFontSize;
}): Buffer {
  const { quoteText, authorName, bookTitle, brandName, w, h, mood, fontSize } = opts;
  const m = MOODS[mood];
  const scale = FONT_SCALE[fontSize];

  // Auto-scale font for long quotes
  const charCount = quoteText.length;
  const autoScale = charCount > 300 ? 0.72 : charCount > 200 ? 0.84 : charCount > 140 ? 0.93 : 1.0;

  const quoteFontSize  = Math.round(w * 0.042 * scale * autoScale);
  const attrFontSize   = Math.round(w * 0.022 * scale);
  const brandFontSize  = Math.round(w * 0.020);
  const padding        = Math.round(w * 0.085);
  const lineHeight     = Math.round(quoteFontSize * 1.55);

  // Wrap quote text
  const charsPerLine = Math.floor((w - padding * 2) / (quoteFontSize * 0.52));
  const lines = wrapText(quoteText, Math.max(charsPerLine, 20));

  // Calculate text block height
  const openQuoteH   = Math.round(quoteFontSize * 1.8);
  const quoteBlockH  = lines.length * lineHeight;
  const attrH        = attrFontSize + Math.round(h * 0.015);
  const bookH        = Math.round(attrFontSize * 0.82) + Math.round(h * 0.01);
  const totalTextH   = openQuoteH + quoteBlockH + attrH + bookH;

  // Center the text block vertically (leaving bottom 18% for brand)
  const usableH      = h - Math.round(h * 0.18) - Math.round(h * 0.08);
  const textStartY   = Math.round(h * 0.08) + Math.max(0, Math.round((usableH - totalTextH) / 2));

  // Build SVG tspan elements for wrapped quote lines
  let currentY = textStartY + openQuoteH;
  const quoteTspans = lines.map((line) => {
    const y = currentY;
    currentY += lineHeight;
    return `<tspan x="${w / 2}" dy="0" y="${y}">${esc(line)}</tspan>`;
  }).join("\n      ");

  const attrY   = currentY + Math.round(h * 0.03);
  const bookY   = attrY + attrFontSize + Math.round(h * 0.012);
  const brandY  = h - Math.round(h * 0.06);

  // Accent line positions
  const accentTopY    = Math.round(h * 0.08);
  const accentBottomY = Math.round(h * 0.92);

  // Parse overlay color for SVG
  const overlayMatch = m.overlayColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
  const overlayR = overlayMatch ? overlayMatch[1] : "0";
  const overlayG = overlayMatch ? overlayMatch[2] : "0";
  const overlayB = overlayMatch ? overlayMatch[3] : "0";
  const overlayA = overlayMatch ? parseFloat(overlayMatch[4]) : 0.6;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="overlayGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgb(${overlayR},${overlayG},${overlayB})" stop-opacity="${Math.max(0, overlayA - 0.15)}"/>
      <stop offset="50%" stop-color="rgb(${overlayR},${overlayG},${overlayB})" stop-opacity="${overlayA}"/>
      <stop offset="100%" stop-color="rgb(${overlayR},${overlayG},${overlayB})" stop-opacity="${Math.min(1, overlayA + 0.12)}"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${m.accentColor}" stop-opacity="0"/>
      <stop offset="50%" stop-color="${m.accentColor}" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="${m.accentColor}" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- Dark gradient overlay -->
  <rect width="${w}" height="${h}" fill="url(#overlayGrad)"/>

  <!-- Accent lines -->
  <line x1="${padding}" y1="${accentTopY}" x2="${w - padding}" y2="${accentTopY}" stroke="url(#accentGrad)" stroke-width="1"/>
  <line x1="${padding}" y1="${accentBottomY}" x2="${w - padding}" y2="${accentBottomY}" stroke="url(#accentGrad)" stroke-width="1"/>

  <!-- Open quote mark -->
  <text
    x="${w / 2}"
    y="${textStartY + Math.round(quoteFontSize * 1.2)}"
    text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="${Math.round(quoteFontSize * 3.2)}"
    fill="${m.accentColor}"
    fill-opacity="0.5"
    font-style="normal">\u201C</text>

  <!-- Quote text -->
  <text
    text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="${quoteFontSize}"
    font-style="italic"
    fill="${m.quoteColor}"
    filter="url(#textShadow)">
      ${quoteTspans}
  </text>

  <!-- Attribution -->
  <text
    x="${w / 2}"
    y="${attrY}"
    text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif"
    font-size="${attrFontSize}"
    font-weight="300"
    fill="${m.accentColor}"
    letter-spacing="${Math.round(attrFontSize * 0.08)}">\u2014 ${esc(authorName)}</text>

  <!-- Book title -->
  <text
    x="${w / 2}"
    y="${bookY}"
    text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif"
    font-size="${Math.round(attrFontSize * 0.82)}"
    font-style="italic"
    font-weight="300"
    fill="${m.accentColor}"
    fill-opacity="0.7">${esc(bookTitle)}</text>

  <!-- Brand name -->
  <text
    x="${w / 2}"
    y="${brandY}"
    text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif"
    font-size="${brandFontSize}"
    font-weight="400"
    letter-spacing="${Math.round(brandFontSize * 0.22)}"
    fill="${m.brandColor}"
    fill-opacity="0.85">${esc(brandName.toUpperCase())}</text>
</svg>`;

  return Buffer.from(svg, "utf-8");
}

// ─── Main compositor ──────────────────────────────────────────────────────────
export async function compositeCard(opts: {
  quoteText: string;
  authorName?: string;
  bookTitle?: string;
  brandName?: string;
  platform: string;
  snippetId: number;
  mood?: CardMood;
  fontSize?: CardFontSize;
  /** Optional: reuse an already-generated background URL to avoid re-generating */
  existingBackgroundUrl?: string;
}): Promise<string | null> {
  const {
    quoteText,
    authorName = "Dr. Pedram Shojai",
    bookTitle = "",
    brandName = "The Urban Monk",
    platform,
    snippetId,
    mood = "forest_dark",
    fontSize = "medium",
    existingBackgroundUrl,
  } = opts;

  const dim = PLATFORM_DIMS[platform] ?? PLATFORM_DIMS["meta"];
  const { w, h } = dim;
  const ratio = w > h ? "landscape" : w === h ? "square" : "portrait";

  // Step 1: Get background image
  let backgroundBuffer: Buffer | null = null;

  if (existingBackgroundUrl) {
    try {
      const res = await fetch(existingBackgroundUrl, { signal: AbortSignal.timeout(15_000) });
      if (res.ok) {
        backgroundBuffer = Buffer.from(await res.arrayBuffer());
      }
    } catch (err) {
      console.error(`[compositor] Failed to download existing background:`, err);
    }
  }

  if (!backgroundBuffer) {
    try {
      const prompt = MOODS[mood].bgPrompt(ratio) + ` ${w}×${h}px.`;
      const result = await generateImage({ prompt });
      if (result.url) {
        const res = await fetch(result.url, { signal: AbortSignal.timeout(15_000) });
        if (res.ok) {
          backgroundBuffer = Buffer.from(await res.arrayBuffer());
        }
      }
    } catch (err) {
      console.error(`[compositor] background generation failed for ${platform}:`, err);
    }
  }

  try {
    // Step 2: Build base image (background or solid color fallback)
    let base: Sharp;
    if (backgroundBuffer) {
      base = sharp(backgroundBuffer).resize(w, h, { fit: "cover", position: "center" });
    } else {
      // Parse fallback hex color
      const hex = MOODS[mood].fallbackBg.replace("#", "");
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      base = sharp({
        create: { width: w, height: h, channels: 3, background: { r, g, b } },
      });
    }

    // Step 3: Build SVG overlay with text
    const svgOverlay = buildSvgOverlay({
      quoteText,
      authorName,
      bookTitle: bookTitle || "The Urban Monk",
      brandName,
      w,
      h,
      mood,
      fontSize,
    });

    // Step 4: Composite SVG on top of background
    const outputBuffer = await base
      .composite([{ input: svgOverlay, top: 0, left: 0 }])
      .png()
      .toBuffer();

    // Step 5: Upload to S3
    const key = `title-cards/${snippetId}-${platform}-${mood}-${Date.now()}.png`;
    const { url: s3Url } = await storagePut(key, outputBuffer, "image/png");
    return s3Url;
  } catch (err) {
    console.error(`[compositor] sharp render failed for ${platform}:`, err);
    return null;
  }
}

/**
 * Generate all 6 platform cards for a snippet.
 * Generates ONE shared background, then composites all 6 sizes from it.
 * This is faster and ensures visual consistency across platforms.
 */
export async function compositeAllPlatformCards(opts: {
  quoteText: string;
  authorName?: string;
  bookTitle?: string;
  brandName?: string;
  snippetId: number;
  mood?: CardMood;
  fontSize?: CardFontSize;
}): Promise<Record<string, string | null>> {
  const { mood = "forest_dark", fontSize = "medium" } = opts;
  const platforms = Object.keys(PLATFORM_DIMS);
  const results: Record<string, string | null> = {};

  // Generate a single square background first (reused for all platforms)
  let sharedBackgroundUrl: string | null = null;
  try {
    const prompt = MOODS[mood].bgPrompt("square") + ` 1080×1080px.`;
    const result = await generateImage({ prompt });
    sharedBackgroundUrl = result.url ?? null;
  } catch {
    sharedBackgroundUrl = null;
  }

  // Composite all 6 platforms in parallel, sharing the background
  await Promise.all(
    platforms.map(async (platform) => {
      const url = await compositeCard({
        ...opts,
        platform,
        mood,
        fontSize,
        existingBackgroundUrl: sharedBackgroundUrl ?? undefined,
      });
      results[platform] = url;
    })
  );

  return results;
}
