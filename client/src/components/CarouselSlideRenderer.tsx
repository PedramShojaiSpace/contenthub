/**
 * CarouselSlideRenderer
 * Renders branded Urban Monk carousel slides on an HTML Canvas.
 * Each slide is 1080×1080 (1:1 square) for Meta.
 *
 * Template types:
 *   cover   — large hook headline, no body, slide number badge
 *   content — headline + body text (bullets or paragraph)
 *   cta     — headline + body + URL
 */

export type SlideType = "cover" | "content" | "cta";

export interface CarouselSlideData {
  slide: number;
  type: SlideType;
  headline: string;
  body: string;
  bullets?: string[];
  imagePrompt?: string;
  imageUrl?: string; // legacy — ignored in template mode
}

// ── Brand tokens ─────────────────────────────────────────────────────────────
const BRAND = {
  bg: "#0f1117",          // deep charcoal
  bgAlt: "#161b27",       // slightly lighter for content slides
  accent: "#c9a84c",      // Urban Monk gold
  accentLight: "#e8c96a", // lighter gold for highlights
  text: "#f0ece4",        // warm off-white
  textMuted: "#9a9080",   // muted warm grey
  border: "#2a2520",      // subtle border
  coverBg: "#0a0d14",     // darkest for cover
  ctaBg: "#1a1208",       // warm dark for CTA
};

const SLIDE_SIZE = 1080;

// ── Font loading helper ───────────────────────────────────────────────────────
let fontsLoaded = false;
async function ensureFonts() {
  if (fontsLoaded) return;
  try {
    await document.fonts.load("bold 72px Georgia");
    await document.fonts.load("normal 36px Georgia");
    await document.fonts.load("bold 42px system-ui");
    await document.fonts.load("normal 32px system-ui");
    fontsLoaded = true;
  } catch {
    fontsLoaded = true; // proceed anyway
  }
}

// ── Text wrapping helper ──────────────────────────────────────────────────────
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 8
): number {
  const words = text.split(" ");
  let line = "";
  let currentY = y;
  let lineCount = 0;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line) {
      if (lineCount >= maxLines) break;
      ctx.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
      lineCount++;
    } else {
      line = testLine;
    }
  }
  if (line && lineCount < maxLines) {
    ctx.fillText(line, x, currentY);
    currentY += lineHeight;
  }
  return currentY;
}

// ── Decorative elements ───────────────────────────────────────────────────────
function drawAccentLine(ctx: CanvasRenderingContext2D, x: number, y: number, width: number) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.strokeStyle = BRAND.accent;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawSlideNumber(ctx: CanvasRenderingContext2D, num: number, total: number) {
  // Bottom-right corner badge
  const text = `${num} / ${total}`;
  ctx.font = "500 26px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = BRAND.textMuted;
  ctx.textAlign = "right";
  ctx.fillText(text, SLIDE_SIZE - 48, SLIDE_SIZE - 44);
}

function drawBrandMark(ctx: CanvasRenderingContext2D) {
  // Bottom-left: "THE URBAN MONK" wordmark
  ctx.font = "600 22px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = BRAND.accent;
  ctx.textAlign = "left";
  ctx.letterSpacing = "3px";
  ctx.fillText("THE URBAN MONK", 56, SLIDE_SIZE - 44);
  ctx.letterSpacing = "0px";
}

function drawCornerAccent(ctx: CanvasRenderingContext2D) {
  // Top-left corner bracket
  ctx.beginPath();
  ctx.moveTo(40, 80);
  ctx.lineTo(40, 40);
  ctx.lineTo(80, 40);
  ctx.strokeStyle = BRAND.accent;
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

// ── Cover slide ───────────────────────────────────────────────────────────────
function renderCover(ctx: CanvasRenderingContext2D, slide: CarouselSlideData, total: number) {
  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, SLIDE_SIZE, SLIDE_SIZE);
  grad.addColorStop(0, BRAND.coverBg);
  grad.addColorStop(1, "#1a1208");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SLIDE_SIZE, SLIDE_SIZE);

  // Subtle diagonal texture lines
  ctx.strokeStyle = "rgba(201,168,76,0.04)";
  ctx.lineWidth = 1;
  for (let i = -SLIDE_SIZE; i < SLIDE_SIZE * 2; i += 60) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + SLIDE_SIZE, SLIDE_SIZE);
    ctx.stroke();
  }

  drawCornerAccent(ctx);

  // "SWIPE →" hint top-right
  ctx.font = "500 22px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = BRAND.textMuted;
  ctx.textAlign = "right";
  ctx.fillText("SWIPE →", SLIDE_SIZE - 48, 64);

  // Accent line
  drawAccentLine(ctx, 56, 380, 120);

  // Headline — large serif
  ctx.font = "bold 78px Georgia, 'Times New Roman', serif";
  ctx.fillStyle = BRAND.text;
  ctx.textAlign = "left";
  const headlineY = wrapText(ctx, slide.headline, 56, 440, SLIDE_SIZE - 112, 96, 4);

  // Gold accent dot
  ctx.beginPath();
  ctx.arc(56 + 8, headlineY + 32, 5, 0, Math.PI * 2);
  ctx.fillStyle = BRAND.accent;
  ctx.fill();

  drawBrandMark(ctx);
  drawSlideNumber(ctx, slide.slide, total);
}

// ── Content slide ─────────────────────────────────────────────────────────────
function renderContent(ctx: CanvasRenderingContext2D, slide: CarouselSlideData, total: number) {
  // Background
  ctx.fillStyle = BRAND.bgAlt;
  ctx.fillRect(0, 0, SLIDE_SIZE, SLIDE_SIZE);

  // Subtle top gradient
  const topGrad = ctx.createLinearGradient(0, 0, 0, 300);
  topGrad.addColorStop(0, "rgba(201,168,76,0.06)");
  topGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, SLIDE_SIZE, 300);

  drawCornerAccent(ctx);

  // Slide number badge top-right
  const badgeText = `${slide.slide}`;
  ctx.font = "bold 32px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = BRAND.accent;
  ctx.textAlign = "right";
  ctx.fillText(badgeText, SLIDE_SIZE - 48, 72);

  // Accent line
  drawAccentLine(ctx, 56, 160, 80);

  // Headline
  ctx.font = "bold 58px Georgia, 'Times New Roman', serif";
  ctx.fillStyle = BRAND.text;
  ctx.textAlign = "left";
  const afterHeadline = wrapText(ctx, slide.headline, 56, 210, SLIDE_SIZE - 112, 74, 3);

  // Body text
  if (slide.bullets && slide.bullets.length > 0) {
    // Bullet list
    let bulletY = afterHeadline + 48;
    ctx.font = "normal 36px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = BRAND.textMuted;
    for (const bullet of slide.bullets.slice(0, 5)) {
      // Bullet dot
      ctx.beginPath();
      ctx.arc(56 + 8, bulletY - 10, 5, 0, Math.PI * 2);
      ctx.fillStyle = BRAND.accent;
      ctx.fill();
      // Bullet text
      ctx.fillStyle = BRAND.textMuted;
      wrapText(ctx, bullet, 56 + 28, bulletY, SLIDE_SIZE - 140, 44, 2);
      bulletY += 72;
    }
  } else if (slide.body) {
    ctx.font = "normal 38px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = BRAND.textMuted;
    wrapText(ctx, slide.body, 56, afterHeadline + 48, SLIDE_SIZE - 112, 56, 6);
  }

  drawBrandMark(ctx);
  drawSlideNumber(ctx, slide.slide, total);
}

// ── CTA slide ─────────────────────────────────────────────────────────────────
function renderCta(ctx: CanvasRenderingContext2D, slide: CarouselSlideData, total: number) {
  // Warm dark background
  const grad = ctx.createLinearGradient(0, 0, 0, SLIDE_SIZE);
  grad.addColorStop(0, BRAND.ctaBg);
  grad.addColorStop(1, "#0f1117");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SLIDE_SIZE, SLIDE_SIZE);

  // Gold border frame
  ctx.strokeStyle = BRAND.accent;
  ctx.lineWidth = 3;
  ctx.strokeRect(32, 32, SLIDE_SIZE - 64, SLIDE_SIZE - 64);

  // Inner glow
  const innerGrad = ctx.createRadialGradient(SLIDE_SIZE / 2, SLIDE_SIZE / 2, 100, SLIDE_SIZE / 2, SLIDE_SIZE / 2, 600);
  innerGrad.addColorStop(0, "rgba(201,168,76,0.08)");
  innerGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = innerGrad;
  ctx.fillRect(0, 0, SLIDE_SIZE, SLIDE_SIZE);

  // "READY?" label
  ctx.font = "600 24px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = BRAND.accent;
  ctx.textAlign = "center";
  ctx.fillText("READY?", SLIDE_SIZE / 2, 200);

  // Headline
  ctx.font = "bold 64px Georgia, 'Times New Roman', serif";
  ctx.fillStyle = BRAND.text;
  const afterHeadline = wrapText(ctx, slide.headline, 80, 280, SLIDE_SIZE - 160, 80, 3);

  // Body
  if (slide.body) {
    ctx.font = "normal 36px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = BRAND.textMuted;
    ctx.textAlign = "center";
    wrapText(ctx, slide.body, 80, afterHeadline + 40, SLIDE_SIZE - 160, 50, 3);
  }

  // URL pill
  const urlY = SLIDE_SIZE - 200;
  ctx.fillStyle = BRAND.accent;
  ctx.beginPath();
  ctx.roundRect(SLIDE_SIZE / 2 - 280, urlY, 560, 72, 36);
  ctx.fill();
  ctx.font = "bold 28px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = BRAND.bg;
  ctx.textAlign = "center";
  ctx.fillText("go.theurbanmonk.com", SLIDE_SIZE / 2, urlY + 46);

  drawBrandMark(ctx);
}

// ── Main render function ──────────────────────────────────────────────────────
export async function renderSlideToCanvas(
  canvas: HTMLCanvasElement,
  slide: CarouselSlideData,
  total: number
) {
  await ensureFonts();
  canvas.width = SLIDE_SIZE;
  canvas.height = SLIDE_SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, SLIDE_SIZE, SLIDE_SIZE);

  if (slide.type === "cover") {
    renderCover(ctx, slide, total);
  } else if (slide.type === "cta") {
    renderCta(ctx, slide, total);
  } else {
    renderContent(ctx, slide, total);
  }
}

// ── Export slide as PNG blob ──────────────────────────────────────────────────
export async function slideToBlob(slide: CarouselSlideData, total: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  await renderSlideToCanvas(canvas, slide, total);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas toBlob failed"));
    }, "image/png", 1.0);
  });
}

// ── Export all slides as data URLs (for preview) ──────────────────────────────
export async function slidesToDataUrls(slides: CarouselSlideData[]): Promise<string[]> {
  const results: string[] = [];
  for (const slide of slides) {
    const canvas = document.createElement("canvas");
    await renderSlideToCanvas(canvas, slide, slides.length);
    results.push(canvas.toDataURL("image/png"));
  }
  return results;
}
