/**
 * titleCardCompositor.ts
 *
 * Hybrid title card generation:
 *   1. Ask the AI to generate a BACKGROUND ONLY (no text in the image prompt)
 *   2. Render an HTML template with the real quote text via Puppeteer
 *   3. Upload the final composite PNG to S3
 *
 * This completely eliminates AI text-rendering typos because the quote is
 * rendered as real CSS typography, not painted by the image model.
 *
 * Supports 4 mood styles and 3 font sizes.
 */
import puppeteer from "puppeteer-core";
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
  fallbackBg: string;       // CSS background for when AI fails
  overlayGradient: string;  // CSS gradient for the dark overlay
  quoteColor: string;       // Quote text color
  accentColor: string;      // Gold/accent color for attribution + lines
  brandColor: string;       // Brand name color
}

const MOODS: Record<CardMood, MoodConfig> = {
  forest_dark: {
    bgPrompt: (ratio) =>
      `Abstract ${ratio} background texture for a premium wellness brand. ` +
      `Dark forest green and deep charcoal tones, subtle organic texture like aged leather or moss, ` +
      `soft vignette edges, no text, no people, no objects, no symbols. Minimalist and sophisticated.`,
    fallbackBg: "#1a2a1a",
    overlayGradient: "linear-gradient(to bottom, rgba(10,20,10,0.45) 0%, rgba(10,20,10,0.60) 50%, rgba(10,20,10,0.72) 100%)",
    quoteColor: "#f5f0e8",
    accentColor: "#d4af37",
    brandColor: "rgba(212,175,55,0.80)",
  },
  stone_gray: {
    bgPrompt: (ratio) =>
      `Abstract ${ratio} background texture for a premium mindfulness brand. ` +
      `Cool stone gray and slate tones, subtle concrete or granite texture, ` +
      `soft vignette edges, no text, no people, no objects, no symbols. Minimalist and sophisticated.`,
    fallbackBg: "#2a2a2a",
    overlayGradient: "linear-gradient(to bottom, rgba(20,20,20,0.40) 0%, rgba(20,20,20,0.58) 50%, rgba(20,20,20,0.70) 100%)",
    quoteColor: "#f0f0f0",
    accentColor: "#c8c8c8",
    brandColor: "rgba(200,200,200,0.75)",
  },
  ink_black: {
    bgPrompt: (ratio) =>
      `Abstract ${ratio} background texture for a luxury brand. ` +
      `Deep black and near-black tones, subtle paper or linen texture, very dark, ` +
      `soft vignette edges, no text, no people, no objects, no symbols. Minimalist and elegant.`,
    fallbackBg: "#0a0a0a",
    overlayGradient: "linear-gradient(to bottom, rgba(0,0,0,0.50) 0%, rgba(0,0,0,0.65) 50%, rgba(0,0,0,0.78) 100%)",
    quoteColor: "#f8f4ee",
    accentColor: "#e8c96a",
    brandColor: "rgba(232,201,106,0.85)",
  },
  warm_amber: {
    bgPrompt: (ratio) =>
      `Abstract ${ratio} background texture for a warm wellness brand. ` +
      `Rich amber, burnt sienna, and deep ochre tones, subtle aged parchment or warm wood texture, ` +
      `soft vignette edges, no text, no people, no objects, no symbols. Warm and sophisticated.`,
    fallbackBg: "#2a1a08",
    overlayGradient: "linear-gradient(to bottom, rgba(20,10,0,0.42) 0%, rgba(20,10,0,0.58) 50%, rgba(20,10,0,0.70) 100%)",
    quoteColor: "#fdf6e3",
    accentColor: "#e8a030",
    brandColor: "rgba(232,160,48,0.85)",
  },
};

// ─── Font size multipliers ────────────────────────────────────────────────────
const FONT_SCALE: Record<CardFontSize, number> = {
  large:  1.22,
  medium: 1.00,
  small:  0.80,
};

// ─── HTML template ────────────────────────────────────────────────────────────
function buildHtml(opts: {
  quoteText: string;
  authorName: string;
  bookTitle: string;
  brandName: string;
  backgroundUrl: string;
  w: number;
  h: number;
  mood: CardMood;
  fontSize: CardFontSize;
}): string {
  const { quoteText, authorName, bookTitle, brandName, backgroundUrl, w, h, mood, fontSize } = opts;
  const m = MOODS[mood];
  const scale = FONT_SCALE[fontSize];

  // Base font sizes relative to card width, then scaled
  const quoteFontSize = Math.round(w * 0.042 * scale);
  const attrFontSize  = Math.round(w * 0.022 * scale);
  const brandFontSize = Math.round(w * 0.020);
  const padding       = Math.round(w * 0.085);

  // Escape HTML entities
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const bgStyle = backgroundUrl
    ? `background-image: url("${backgroundUrl}"); background-size: cover; background-position: center;`
    : `background: ${m.fallbackBg};`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Lato:wght@300;400&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${w}px;
    height: ${h}px;
    overflow: hidden;
    font-family: 'Playfair Display', Georgia, serif;
    background: ${m.fallbackBg};
  }
  .card {
    position: relative;
    width: ${w}px;
    height: ${h}px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: ${padding}px;
  }
  .bg {
    position: absolute;
    inset: 0;
    ${bgStyle}
  }
  .overlay {
    position: absolute;
    inset: 0;
    background: ${m.overlayGradient};
  }
  .accent-top, .accent-bottom {
    position: absolute;
    left: ${padding}px;
    right: ${padding}px;
    height: 1px;
    background: linear-gradient(to right, transparent, ${m.accentColor}99, transparent);
  }
  .accent-top    { top: ${Math.round(h * 0.08)}px; }
  .accent-bottom { bottom: ${Math.round(h * 0.08)}px; }
  .content {
    position: relative;
    z-index: 10;
    text-align: center;
    max-width: ${w - padding * 2}px;
  }
  .open-quote {
    font-family: 'Playfair Display', serif;
    font-size: ${Math.round(quoteFontSize * 3.2)}px;
    line-height: 0.6;
    color: ${m.accentColor}88;
    display: block;
    margin-bottom: ${Math.round(h * 0.02)}px;
    font-style: normal;
  }
  .quote {
    font-family: 'Playfair Display', serif;
    font-size: ${quoteFontSize}px;
    font-weight: 400;
    font-style: italic;
    color: ${m.quoteColor};
    line-height: 1.55;
    letter-spacing: 0.01em;
    text-shadow: 0 2px 12px rgba(0,0,0,0.6);
    margin-bottom: ${Math.round(h * 0.04)}px;
  }
  .attribution {
    font-family: 'Lato', sans-serif;
    font-size: ${attrFontSize}px;
    font-weight: 300;
    color: ${m.accentColor};
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: ${Math.round(h * 0.010)}px;
  }
  .book-title {
    font-family: 'Lato', sans-serif;
    font-size: ${Math.round(attrFontSize * 0.82)}px;
    font-weight: 300;
    color: ${m.accentColor}aa;
    letter-spacing: 0.06em;
    font-style: italic;
  }
  .brand {
    position: absolute;
    bottom: ${Math.round(h * 0.055)}px;
    left: 0;
    right: 0;
    text-align: center;
    font-family: 'Lato', sans-serif;
    font-size: ${brandFontSize}px;
    font-weight: 400;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: ${m.brandColor};
    z-index: 10;
  }
</style>
</head>
<body>
  <div class="card">
    <div class="bg"></div>
    <div class="overlay"></div>
    <div class="accent-top"></div>
    <div class="accent-bottom"></div>
    <div class="content">
      <span class="open-quote">&ldquo;</span>
      <p class="quote">${esc(quoteText)}</p>
      <p class="attribution">&mdash; ${esc(authorName)}</p>
      <p class="book-title">${esc(bookTitle)}</p>
    </div>
    <div class="brand">${esc(brandName)}</div>
  </div>
</body>
</html>`;
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
  let backgroundUrl = existingBackgroundUrl ?? null;
  if (!backgroundUrl) {
    try {
      const prompt = MOODS[mood].bgPrompt(ratio) + ` ${w}×${h}px.`;
      const result = await generateImage({ prompt });
      backgroundUrl = result.url ?? null;
    } catch (err) {
      console.error(`[compositor] background generation failed for ${platform}:`, err);
      backgroundUrl = null;
    }
  }

  // Step 2: Build HTML with real text
  const html = buildHtml({
    quoteText,
    authorName,
    bookTitle: bookTitle || "The Urban Monk",
    brandName,
    backgroundUrl: backgroundUrl ?? "",
    w,
    h,
    mood,
    fontSize,
  });

  // Step 3: Render with Puppeteer
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    browser = await puppeteer.launch({
      executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--font-render-hinting=none",
      ],
      headless: true,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });

    // Give Google Fonts a moment to load
    await new Promise((r) => setTimeout(r, 1500));

    const screenshotBuffer = await page.screenshot({ type: "png" });

    // Step 4: Upload to S3
    const key = `title-cards/${snippetId}-${platform}-${mood}-${Date.now()}.png`;
    const { url: s3Url } = await storagePut(key, screenshotBuffer as Buffer, "image/png");
    return s3Url;
  } catch (err) {
    console.error(`[compositor] Puppeteer render failed for ${platform}:`, err);
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
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
  let sharedBackground: string | null = null;
  try {
    const prompt = MOODS[mood].bgPrompt("square") + ` 1080×1080px.`;
    const result = await generateImage({ prompt });
    sharedBackground = result.url ?? null;
  } catch {
    sharedBackground = null;
  }

  // Composite all 6 platforms in parallel, sharing the background
  await Promise.all(
    platforms.map(async (platform) => {
      const url = await compositeCard({
        ...opts,
        platform,
        mood,
        fontSize,
        existingBackgroundUrl: sharedBackground ?? undefined,
      });
      results[platform] = url;
    })
  );

  return results;
}
