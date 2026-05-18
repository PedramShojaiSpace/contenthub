/**
 * TitleCardRenderer.tsx
 *
 * Client-side title card compositor.
 * - Renders a styled HTML div at each platform's exact pixel dimensions
 * - Uses the native Canvas API (drawImage + fillText) to composite:
 *     1. AI-generated background image (from server)
 *     2. Dark gradient overlay
 *     3. Real CSS text (quote, attribution, book title, brand)
 * - Uploads each PNG to S3 via the /api/upload-card endpoint
 * - Returns a map of platform → S3 URL
 *
 * This approach is 100% environment-independent — no Puppeteer, no headless
 * browser, no server-side rendering. Works in any deployment.
 */

export type CardMood = "forest_dark" | "stone_gray" | "ink_black" | "warm_amber";
export type CardFontSize = "large" | "medium" | "small";

export const PLATFORM_DIMS: Record<string, { w: number; h: number; label: string }> = {
  linkedin:        { w: 1200, h:  627, label: "LinkedIn"        },
  x:               { w: 1600, h:  900, label: "X / Twitter"     },
  meta:            { w: 1080, h: 1080, label: "Facebook / Meta" },
  instagram_feed:  { w: 1080, h: 1080, label: "Instagram Feed"  },
  instagram_reel:  { w: 1080, h: 1920, label: "Instagram Reel"  },
  instagram_story: { w: 1080, h: 1920, label: "Instagram Story" },
};

interface MoodStyle {
  overlay: string;       // CSS gradient string for the dark overlay
  quoteColor: string;
  accentColor: string;   // gold/silver accent
  brandColor: string;
  fallbackBg: string;    // solid color if no background image
}

const MOODS: Record<CardMood, MoodStyle> = {
  forest_dark: {
    overlay:     "rgba(10,20,10,0.55)",
    quoteColor:  "#f5f0e8",
    accentColor: "#d4af37",
    brandColor:  "rgba(212,175,55,0.80)",
    fallbackBg:  "#1a2a1a",
  },
  stone_gray: {
    overlay:     "rgba(20,20,20,0.52)",
    quoteColor:  "#f0f0f0",
    accentColor: "#c8c8c8",
    brandColor:  "rgba(200,200,200,0.75)",
    fallbackBg:  "#2a2a2a",
  },
  ink_black: {
    overlay:     "rgba(0,0,0,0.62)",
    quoteColor:  "#f8f4ee",
    accentColor: "#e8c96a",
    brandColor:  "rgba(232,201,106,0.85)",
    fallbackBg:  "#0a0a0a",
  },
  warm_amber: {
    overlay:     "rgba(20,10,0,0.55)",
    quoteColor:  "#fdf6e3",
    accentColor: "#e8a030",
    brandColor:  "rgba(232,160,48,0.85)",
    fallbackBg:  "#2a1a08",
  },
};

const FONT_SCALE: Record<CardFontSize, number> = {
  large:  1.22,
  medium: 1.00,
  small:  0.80,
};

/** Load an image cross-origin into an HTMLImageElement */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

/** Wrap text into lines that fit within maxWidth */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Render one title card to a canvas and return a PNG Blob.
 */
async function renderCardToBlob(opts: {
  quoteText: string;
  authorName: string;
  bookTitle: string;
  brandName: string;
  backgroundUrl: string | null;
  w: number;
  h: number;
  mood: CardMood;
  fontSize: CardFontSize;
}): Promise<Blob> {
  const { quoteText, authorName, bookTitle, brandName, backgroundUrl, w, h, mood, fontSize } = opts;
  const m = MOODS[mood];
  const scale = FONT_SCALE[fontSize];

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // ── 1. Background ──────────────────────────────────────────────────────────
  if (backgroundUrl) {
    try {
      const img = await loadImage(backgroundUrl);
      // Cover-fit the background
      const imgAspect = img.width / img.height;
      const canvasAspect = w / h;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (imgAspect > canvasAspect) {
        sw = img.height * canvasAspect;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / canvasAspect;
        sy = (img.height - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
    } catch {
      ctx.fillStyle = m.fallbackBg;
      ctx.fillRect(0, 0, w, h);
    }
  } else {
    ctx.fillStyle = m.fallbackBg;
    ctx.fillRect(0, 0, w, h);
  }

  // ── 2. Dark overlay ────────────────────────────────────────────────────────
  ctx.fillStyle = m.overlay;
  ctx.fillRect(0, 0, w, h);

  // ── 3. Accent lines ────────────────────────────────────────────────────────
  const padX = Math.round(w * 0.085);
  const lineY1 = Math.round(h * 0.08);
  const lineY2 = h - Math.round(h * 0.08);
  const grad1 = ctx.createLinearGradient(padX, 0, w - padX, 0);
  grad1.addColorStop(0, "transparent");
  grad1.addColorStop(0.5, m.accentColor + "99");
  grad1.addColorStop(1, "transparent");
  ctx.strokeStyle = grad1;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(padX, lineY1); ctx.lineTo(w - padX, lineY1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(padX, lineY2); ctx.lineTo(w - padX, lineY2); ctx.stroke();

  // ── 4. Quote text ──────────────────────────────────────────────────────────
  const quoteFontSize = Math.round(w * 0.042 * scale);
  const attrFontSize  = Math.round(w * 0.022 * scale);
  const brandFontSize = Math.round(w * 0.020);
  const maxTextWidth  = w - padX * 2;

  // Opening quote mark
  ctx.font = `italic ${Math.round(quoteFontSize * 2.4)}px Georgia, serif`;
  ctx.fillStyle = m.accentColor + "66";
  ctx.textAlign = "center";
  ctx.fillText("\u201C", w / 2, Math.round(h * 0.30));

  // Quote body
  ctx.font = `italic ${quoteFontSize}px Georgia, serif`;
  ctx.fillStyle = m.quoteColor;
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 12;
  const lines = wrapText(ctx, quoteText, maxTextWidth);
  const lineHeight = Math.round(quoteFontSize * 1.55);
  const totalTextHeight = lines.length * lineHeight;
  let textY = Math.round(h / 2 - totalTextHeight / 2);
  for (const line of lines) {
    ctx.fillText(line, w / 2, textY);
    textY += lineHeight;
  }
  ctx.shadowBlur = 0;

  // Attribution
  const attrY = textY + Math.round(h * 0.04);
  ctx.font = `300 ${attrFontSize}px Arial, sans-serif`;
  ctx.fillStyle = m.accentColor;
  ctx.letterSpacing = "0.08em";
  ctx.fillText(`\u2014 ${authorName}`, w / 2, attrY);

  // Book title
  const bookY = attrY + Math.round(attrFontSize * 1.6);
  ctx.font = `italic 300 ${Math.round(attrFontSize * 0.82)}px Arial, sans-serif`;
  ctx.fillStyle = m.accentColor + "aa";
  ctx.fillText(bookTitle, w / 2, bookY);

  // ── 5. Brand name (bottom center) ─────────────────────────────────────────
  ctx.font = `400 ${brandFontSize}px Arial, sans-serif`;
  ctx.fillStyle = m.brandColor;
  ctx.fillText(brandName.toUpperCase(), w / 2, h - Math.round(h * 0.055));

  // ── 6. Export PNG ──────────────────────────────────────────────────────────
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("canvas.toBlob returned null"));
    }, "image/png");
  });
}

/**
 * Main export: generate all 6 platform cards and upload them.
 * Returns a map of platform key → S3 URL (or null on failure).
 *
 * @param backgroundUrl  AI-generated background URL from the server
 * @param onProgress     Called after each card is done with (completed, total)
 */
export async function generateAllCards(opts: {
  quoteText: string;
  authorName?: string;
  bookTitle?: string;
  brandName?: string;
  backgroundUrl: string | null;
  mood?: CardMood;
  fontSize?: CardFontSize;
  onProgress?: (done: number, total: number) => void;
}): Promise<Record<string, string | null>> {
  const {
    quoteText,
    authorName = "Dr. Pedram Shojai",
    bookTitle = "The Urban Monk",
    brandName = "The Urban Monk",
    backgroundUrl,
    mood = "forest_dark",
    fontSize = "medium",
    onProgress,
  } = opts;

  const platforms = Object.keys(PLATFORM_DIMS);
  const results: Record<string, string | null> = {};
  let done = 0;

  // Process platforms sequentially to avoid memory issues with large canvases
  for (const platform of platforms) {
    const { w, h } = PLATFORM_DIMS[platform];
    try {
      const blob = await renderCardToBlob({
        quoteText,
        authorName,
        bookTitle,
        brandName,
        backgroundUrl,
        w,
        h,
        mood,
        fontSize,
      });

      // Upload to S3 via the server upload endpoint
      const formData = new FormData();
      formData.append("file", blob, `card-${platform}.png`);
      formData.append("platform", platform);

      const res = await fetch("/api/upload-card", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (res.ok) {
        const json = await res.json() as { url: string };
        results[platform] = json.url;
      } else {
        results[platform] = null;
      }
    } catch (err) {
      console.error(`[TitleCardRenderer] Failed for ${platform}:`, err);
      results[platform] = null;
    }

    done++;
    onProgress?.(done, platforms.length);
  }

  return results;
}
