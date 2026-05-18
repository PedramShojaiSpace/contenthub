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
 */

import puppeteer from "puppeteer-core";
import { storagePut } from "./storage";
import { generateImage } from "./_core/imageGeneration";

// ─── Platform dimensions ──────────────────────────────────────────────────────
export const PLATFORM_DIMS: Record<string, { w: number; h: number; label: string }> = {
  linkedin:        { w: 1200, h:  627, label: "LinkedIn"       },
  x:               { w: 1600, h:  900, label: "X / Twitter"    },
  meta:            { w: 1080, h: 1080, label: "Facebook / Meta" },
  instagram_feed:  { w: 1080, h: 1080, label: "Instagram Feed" },
  instagram_reel:  { w: 1080, h: 1920, label: "Instagram Reel" },
  instagram_story: { w: 1080, h: 1920, label: "Instagram Story" },
};

// ─── Background prompt (NO text instructions) ─────────────────────────────────
function backgroundPrompt(w: number, h: number): string {
  const ratio = w > h ? "landscape" : w === h ? "square" : "portrait";
  return (
    `Abstract ${ratio} background texture for a premium wellness brand. ` +
    `Dark forest green and deep charcoal tones, subtle organic texture like aged leather or stone, ` +
    `soft vignette edges, no text, no people, no objects, no symbols. ` +
    `Minimalist and sophisticated. Suitable as a backdrop for white serif typography. ` +
    `${w}×${h}px.`
  );
}

// ─── HTML template ────────────────────────────────────────────────────────────
function buildHtml(opts: {
  quoteText: string;
  authorName: string;
  bookTitle: string;
  brandName: string;
  backgroundUrl: string;
  w: number;
  h: number;
}): string {
  const { quoteText, authorName, bookTitle, brandName, backgroundUrl, w, h } = opts;

  // Scale font sizes relative to the card width
  const quoteFontSize  = Math.round(w * 0.042);   // ~45px at 1080w
  const attrFontSize   = Math.round(w * 0.022);   // ~24px
  const brandFontSize  = Math.round(w * 0.020);   // ~22px
  const padding        = Math.round(w * 0.085);   // ~92px

  // Escape HTML entities
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

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
    background: #1a2a1a;
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

  /* Background image */
  .bg {
    position: absolute;
    inset: 0;
    background-image: url("${backgroundUrl}");
    background-size: cover;
    background-position: center;
  }

  /* Dark overlay to ensure text readability */
  .overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      rgba(10, 20, 10, 0.45) 0%,
      rgba(10, 20, 10, 0.60) 50%,
      rgba(10, 20, 10, 0.70) 100%
    );
  }

  /* Decorative top/bottom accent lines */
  .accent-top, .accent-bottom {
    position: absolute;
    left: ${padding}px;
    right: ${padding}px;
    height: 1px;
    background: linear-gradient(to right, transparent, rgba(212,175,55,0.6), transparent);
  }
  .accent-top    { top: ${Math.round(h * 0.08)}px; }
  .accent-bottom { bottom: ${Math.round(h * 0.08)}px; }

  /* Content wrapper */
  .content {
    position: relative;
    z-index: 10;
    text-align: center;
    max-width: ${w - padding * 2}px;
  }

  /* Opening quote mark */
  .open-quote {
    font-family: 'Playfair Display', serif;
    font-size: ${Math.round(quoteFontSize * 3.2)}px;
    line-height: 0.6;
    color: rgba(212,175,55,0.55);
    display: block;
    margin-bottom: ${Math.round(h * 0.02)}px;
    font-style: normal;
  }

  /* Quote text */
  .quote {
    font-family: 'Playfair Display', serif;
    font-size: ${quoteFontSize}px;
    font-weight: 400;
    font-style: italic;
    color: #f5f0e8;
    line-height: 1.55;
    letter-spacing: 0.01em;
    text-shadow: 0 2px 12px rgba(0,0,0,0.6);
    margin-bottom: ${Math.round(h * 0.04)}px;
  }

  /* Attribution */
  .attribution {
    font-family: 'Lato', sans-serif;
    font-size: ${attrFontSize}px;
    font-weight: 300;
    color: #d4af37;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: ${Math.round(h * 0.012)}px;
  }

  .book-title {
    font-family: 'Lato', sans-serif;
    font-size: ${Math.round(attrFontSize * 0.85)}px;
    font-weight: 300;
    color: rgba(212,175,55,0.65);
    letter-spacing: 0.06em;
    font-style: italic;
  }

  /* Brand name at bottom */
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
    color: rgba(212,175,55,0.80);
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
      ${bookTitle ? `<p class="book-title">${esc(bookTitle)}</p>` : ""}
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
    existingBackgroundUrl,
  } = opts;

  const dim = PLATFORM_DIMS[platform] ?? PLATFORM_DIMS["meta"];
  const { w, h } = dim;

  // Step 1: Get background image (reuse if provided, otherwise generate)
  let backgroundUrl = existingBackgroundUrl ?? null;
  if (!backgroundUrl) {
    try {
      const result = await generateImage({ prompt: backgroundPrompt(w, h) });
      backgroundUrl = result.url ?? null;
    } catch (err) {
      console.error(`[compositor] background generation failed for ${platform}:`, err);
      // Fall back to a solid dark color — still typo-free
      backgroundUrl = null;
    }
  }

  // Step 2: Build HTML with real text
  const html = buildHtml({
    quoteText,
    authorName,
    bookTitle,
    brandName,
    backgroundUrl: backgroundUrl ?? "",
    w,
    h,
  });

  // Step 3: Render with Puppeteer
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    browser = await puppeteer.launch({
      executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium-browser",
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
    const key = `title-cards/${snippetId}-${platform}-${Date.now()}.png`;
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
}): Promise<Record<string, string | null>> {
  const platforms = Object.keys(PLATFORM_DIMS);
  const results: Record<string, string | null> = {};

  // Generate a single square background first (reused for all platforms)
  let sharedBackground: string | null = null;
  try {
    const result = await generateImage({ prompt: backgroundPrompt(1080, 1080) });
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
        existingBackgroundUrl: sharedBackground ?? undefined,
      });
      results[platform] = url;
    })
  );

  return results;
}
