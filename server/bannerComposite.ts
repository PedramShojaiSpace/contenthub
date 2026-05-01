/**
 * bannerComposite.ts
 *
 * Downloads an AI-generated CTA banner image, composites a headline and
 * CTA button label on top using node-canvas, then uploads the result to S3.
 *
 * Layout (1200 × 675 — standard 16:9 blog banner):
 *   - Top 20%: headline text (cream, bold, centred, wrapping)
 *   - Bottom 18%: amber pill button with white CTA label text
 *   - Centre: the original AI image (scaled to fill)
 */

import { createCanvas, loadImage, registerFont } from "canvas";
import type { CanvasRenderingContext2D as NodeCanvasRenderingContext2D, Image as NodeCanvasImage } from "canvas";
import { storagePut } from "./storage";
import path from "path";
import { fileURLToPath } from "url";

// ─── Font setup ───────────────────────────────────────────────────────────────
// Register Montserrat (Urban Monk brand font) from the bundled .ttf files.
// registerFont must be called before any canvas is created.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.join(__dirname, "fonts");
try {
  registerFont(path.join(FONTS_DIR, "Montserrat-Bold.ttf"), { family: "Montserrat", weight: "bold" });
  registerFont(path.join(FONTS_DIR, "Montserrat-Regular.ttf"), { family: "Montserrat", weight: "normal" });
} catch {
  // Fonts may already be registered or path differs in production — safe to ignore
}

const CANVAS_W = 1200;
const CANVAS_H = 675;

// Brand palette
const HEADLINE_COLOR = "#F5F0E8"; // warm cream
const HEADLINE_SHADOW = "rgba(0,0,0,0.65)";
const BUTTON_BG = "#C8860A"; // amber/gold
const BUTTON_TEXT_COLOR = "#FFFFFF";
const OVERLAY_TOP = "rgba(0,0,0,0.42)"; // darkens top for legibility
const OVERLAY_BOTTOM = "rgba(0,0,0,0.52)"; // darkens bottom for button area

/**
 * Wrap text into lines that fit within maxWidth pixels.
 */
function wrapText(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
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

export interface CompositeBannerOptions {
  /** URL of the AI-generated banner image */
  imageUrl: string;
  /** Main headline text (e.g. first sentence of CTA text) */
  headline: string;
  /** CTA button label (e.g. "Join Lights On — Free") */
  ctaButtonLabel: string;
  /** S3 key prefix for the output file */
  keyPrefix?: string;
}

export async function compositeCtaBanner(
  opts: CompositeBannerOptions
): Promise<{ url: string; key: string }> {
  const { imageUrl, headline, ctaButtonLabel, keyPrefix = "cta-banners" } = opts;

  // ── 1. Create canvas ────────────────────────────────────────────────────────
  const canvas = createCanvas(CANVAS_W, CANVAS_H);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = canvas.getContext("2d") as unknown as NodeCanvasRenderingContext2D;

  // ── 2. Draw background image ────────────────────────────────────────────────
  try {
    const img = await loadImage(imageUrl) as unknown as NodeCanvasImage;
    // Cover-fit: scale to fill canvas, centred
    const scale = Math.max(CANVAS_W / (img.width as number), CANVAS_H / (img.height as number));
    const sw = (img.width as number) * scale;
    const sh = (img.height as number) * scale;
    const sx = (CANVAS_W - sw) / 2;
    const sy = (CANVAS_H - sh) / 2;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ctx as any).drawImage(img, sx, sy, sw, sh);
  } catch {
    // Fallback: dark gradient background if image fails to load
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, "#1a2e1a");
    grad.addColorStop(1, "#0d1a0d");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  // ── 3. Top gradient overlay (for headline legibility) ──────────────────────
  const topGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H * 0.45);
  topGrad.addColorStop(0, OVERLAY_TOP);
  topGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H * 0.45);

  // ── 4. Bottom gradient overlay (for button area legibility) ────────────────
  const botGrad = ctx.createLinearGradient(0, CANVAS_H * 0.65, 0, CANVAS_H);
  botGrad.addColorStop(0, "rgba(0,0,0,0)");
  botGrad.addColorStop(1, OVERLAY_BOTTOM);
  ctx.fillStyle = botGrad;
  ctx.fillRect(0, CANVAS_H * 0.65, CANVAS_W, CANVAS_H * 0.35);

  // ── 5. Headline text ────────────────────────────────────────────────────────
  const headlineFontSize = headline.length > 60 ? 42 : headline.length > 40 ? 48 : 54;
  ctx.font = `bold ${headlineFontSize}px "Montserrat", "DejaVu Sans", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const maxTextWidth = CANVAS_W * 0.82;
  const lines = wrapText(ctx, headline.toUpperCase(), maxTextWidth);
  const lineHeight = headlineFontSize * 1.25;
  const totalTextHeight = lines.length * lineHeight;
  // Centre the text block in the top 35% of the canvas
  const textBlockTop = (CANVAS_H * 0.35 - totalTextHeight) / 2;

  lines.forEach((line, i) => {
    const y = textBlockTop + i * lineHeight;
    // Shadow
    ctx.shadowColor = HEADLINE_SHADOW;
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = HEADLINE_COLOR;
    ctx.fillText(line, CANVAS_W / 2, y);
  });

  // Reset shadow
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // ── 6. CTA button pill ──────────────────────────────────────────────────────
  const btnLabel = ctaButtonLabel.length > 50
    ? ctaButtonLabel.substring(0, 47) + "…"
    : ctaButtonLabel;

  const btnFontSize = 28;
  ctx.font = `bold ${btnFontSize}px "Montserrat", "DejaVu Sans", Arial, sans-serif`;
  const btnTextWidth = ctx.measureText(btnLabel).width;
  const btnPaddingX = 48;
  const btnPaddingY = 16;
  const btnW = btnTextWidth + btnPaddingX * 2;
  const btnH = btnFontSize + btnPaddingY * 2;
  const btnX = (CANVAS_W - btnW) / 2;
  const btnY = CANVAS_H - btnH - 48; // 48px from bottom
  const btnRadius = btnH / 2;

  // Button shadow
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;

  // Draw pill
  ctx.beginPath();
  ctx.moveTo(btnX + btnRadius, btnY);
  ctx.lineTo(btnX + btnW - btnRadius, btnY);
  ctx.arcTo(btnX + btnW, btnY, btnX + btnW, btnY + btnH, btnRadius);
  ctx.lineTo(btnX + btnW, btnY + btnH - btnRadius);
  ctx.arcTo(btnX + btnW, btnY + btnH, btnX + btnW - btnRadius, btnY + btnH, btnRadius);
  ctx.lineTo(btnX + btnRadius, btnY + btnH);
  ctx.arcTo(btnX, btnY + btnH, btnX, btnY + btnH - btnRadius, btnRadius);
  ctx.lineTo(btnX, btnY + btnRadius);
  ctx.arcTo(btnX, btnY, btnX + btnRadius, btnY, btnRadius);
  ctx.closePath();
  ctx.fillStyle = BUTTON_BG;
  ctx.fill();

  // Button text
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = BUTTON_TEXT_COLOR;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(btnLabel, CANVAS_W / 2, btnY + btnH / 2);

  // ── 7. Urban Monk brand watermark ───────────────────────────────────────────
  ctx.font = `normal 18px "Montserrat", "DejaVu Sans", Arial, sans-serif`;
  ctx.fillStyle = "rgba(245,240,232,0.55)";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText("theurbanmonk.com", CANVAS_W - 24, CANVAS_H - 16);

  // ── 8. Export as JPEG buffer and upload to S3 ───────────────────────────────
  const buffer = canvas.toBuffer("image/jpeg", { quality: 0.88 });
  const suffix = Date.now().toString(36);
  const key = `${keyPrefix}/banner-${suffix}.jpg`;
  const { url } = await storagePut(key, buffer, "image/jpeg");

  return { url, key };
}
