/**
 * CarouselSlideRenderer
 * Renders branded Urban Monk carousel slides on an HTML Canvas.
 * Each slide is 1080×1080 (1:1 square) for Meta.
 *
 * Design system: The Urban Monk Visual Identity Guidelines (May 2020)
 *   - Taoist five-element color palette
 *   - Flat solid color backgrounds (NO gradients)
 *   - White text on colored backgrounds
 *   - Dark (#161513) text on cream backgrounds
 *   - Urban Monk logo mark (circle + infinity/wave) bottom-right
 *   - "Life Garden" abstract decorative elements as watermarks
 *
 * Template types:
 *   cover   — large hook headline, solid brand color bg, white text
 *   content — headline + body/bullets, cream bg, dark text
 *   cta     — call to action, cream bg, Fire accent
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

// ── Brand tokens (Urban Monk Visual Identity Guidelines) ──────────────────────
const BRAND = {
  // Taoist element colors
  fire:    "#ed5939",  // Fire — primary brand red-orange
  wood:    "#3d7e51",  // Wood — forest green
  water:   "#5870aa",  // Water — muted blue
  earth:   "#f6a032",  // Earth — warm amber
  metal:   "#f7f4ef",  // Metal — warm cream (primary bg)
  yin:     "#161513",  // Yin — near-black (primary text)
  yang:    "#ffffff",  // Yang — pure white

  // Tints
  yinLight: "rgba(22,21,19,0.12)",   // subtle dark tint for watermarks
  fireLight: "rgba(237,89,57,0.08)", // faint fire for decorative elements
  woodLight: "rgba(61,126,81,0.08)", // faint wood for decorative elements
};

// Cover slide backgrounds rotate through brand colors
const COVER_COLORS = [BRAND.fire, BRAND.wood, BRAND.water, BRAND.earth];

const SLIDE_SIZE = 1080;

// ── Font loading helper ───────────────────────────────────────────────────────
let fontsLoaded = false;
async function ensureFonts() {
  if (fontsLoaded) return;
  try {
    // Load Google Fonts equivalents for Raisonne Pro / Sofia Pro
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,700;1,400&family=Nunito:wght@400;600;700;800&display=swap";
    if (!document.querySelector('link[href*="DM+Sans"]')) {
      document.head.appendChild(link);
    }
    await document.fonts.ready;
    fontsLoaded = true;
  } catch {
    fontsLoaded = true;
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
  maxLines = 8,
  align: CanvasTextAlign = "left"
): number {
  const words = text.split(" ");
  let line = "";
  let currentY = y;
  let lineCount = 0;

  const drawX = align === "center" ? x + maxWidth / 2 : x;
  const savedAlign = ctx.textAlign;
  ctx.textAlign = align;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line) {
      if (lineCount >= maxLines) break;
      ctx.fillText(line, drawX, currentY);
      line = word;
      currentY += lineHeight;
      lineCount++;
    } else {
      line = testLine;
    }
  }
  if (line && lineCount < maxLines) {
    ctx.fillText(line, drawX, currentY);
    currentY += lineHeight;
  }

  ctx.textAlign = savedAlign;
  return currentY;
}

// ── Urban Monk Logo Mark ──────────────────────────────────────────────────────
// Draws the circular logo mark: circle + mountain waves + infinity symbol
function drawLogoMark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = "transparent";
  ctx.lineWidth = radius * 0.08;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Outer circle
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Sun dot (top)
  const dotR = radius * 0.09;
  ctx.beginPath();
  ctx.arc(cx, cy - radius * 0.42, dotR, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Mountain waves (middle) — two arcs
  const waveY = cy - radius * 0.1;
  const waveW = radius * 0.55;
  ctx.beginPath();
  ctx.moveTo(cx - waveW, waveY + radius * 0.12);
  ctx.quadraticCurveTo(cx - waveW * 0.5, waveY - radius * 0.18, cx, waveY + radius * 0.12);
  ctx.quadraticCurveTo(cx + waveW * 0.5, waveY - radius * 0.18, cx + waveW, waveY + radius * 0.12);
  ctx.strokeStyle = color;
  ctx.stroke();

  // Infinity symbol (bottom)
  const infY = cy + radius * 0.35;
  const infW = radius * 0.45;
  const infH = radius * 0.22;
  ctx.beginPath();
  // Left lobe
  ctx.moveTo(cx, infY);
  ctx.bezierCurveTo(cx - infW * 0.3, infY - infH, cx - infW, infY - infH, cx - infW, infY);
  ctx.bezierCurveTo(cx - infW, infY + infH, cx - infW * 0.3, infY + infH, cx, infY);
  // Right lobe
  ctx.bezierCurveTo(cx + infW * 0.3, infY - infH, cx + infW, infY - infH, cx + infW, infY);
  ctx.bezierCurveTo(cx + infW, infY + infH, cx + infW * 0.3, infY + infH, cx, infY);
  ctx.stroke();

  ctx.restore();
}

// ── Life Garden decorative elements ──────────────────────────────────────────

// Scattered dot cluster (like "Seeds" or "Water" pattern)
function drawDotCluster(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  opacity: number,
  dotR = 8,
  cols = 4,
  rows = 5,
  spacing = 28
) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const offsetX = (r % 2) * (spacing / 2);
      ctx.beginPath();
      ctx.arc(x + c * spacing + offsetX, y + r * spacing, dotR * (0.7 + Math.random() * 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// Zigzag / mountain line (like "Mountains" element)
function drawZigzag(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  amplitude: number,
  segments: number,
  color: string,
  opacity: number,
  lineWidth = 4
) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  const segW = width / segments;
  for (let i = 0; i < segments; i++) {
    const px = x + i * segW + segW / 2;
    const py = i % 2 === 0 ? y - amplitude : y + amplitude;
    ctx.lineTo(px, py);
  }
  ctx.lineTo(x + width, y);
  ctx.stroke();
  ctx.restore();
}

// Organic oval rings (like "Crops" element)
function drawOvalRings(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  count: number,
  color: string,
  opacity: number
) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  for (let i = 0; i < count; i++) {
    ctx.beginPath();
    ctx.ellipse(x + i * 72, y, 28, 36, -0.2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// Sketch circle (like "Moon" element)
function drawSketchCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  opacity: number
) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ── Cover slide ───────────────────────────────────────────────────────────────
function renderCover(
  ctx: CanvasRenderingContext2D,
  slide: CarouselSlideData,
  total: number,
  colorIndex: number
) {
  const bgColor = COVER_COLORS[colorIndex % COVER_COLORS.length];

  // Solid brand color background (NO gradient — brand spec)
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, SLIDE_SIZE, SLIDE_SIZE);

  // Watermark: faint Life Garden elements (same hue, lighter tone)
  const watermarkColor = BRAND.yang; // white at low opacity

  // Dot cluster — top-right area
  drawDotCluster(ctx, SLIDE_SIZE - 260, 60, watermarkColor, 0.12, 9, 4, 5, 36);

  // Oval rings — bottom-left
  drawOvalRings(ctx, 60, SLIDE_SIZE - 120, 4, watermarkColor, 0.1);

  // Sketch circle — mid-right
  drawSketchCircle(ctx, SLIDE_SIZE - 120, SLIDE_SIZE / 2, 90, watermarkColor, 0.08);

  // Swipe hint — top right
  ctx.font = "500 24px 'DM Sans', system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.textAlign = "right";
  ctx.fillText("swipe →", SLIDE_SIZE - 56, 72);

  // Slide number — top left
  ctx.font = "400 22px 'DM Sans', system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.textAlign = "left";
  ctx.fillText(`${slide.slide} of ${total}`, 56, 72);

  // Headline — large, centered, white, sentence case
  ctx.font = "700 80px 'Nunito', 'DM Sans', system-ui, sans-serif";
  ctx.fillStyle = BRAND.yang;
  ctx.textAlign = "left";

  // Vertically center the headline block
  const headlineMaxWidth = SLIDE_SIZE - 112;
  const lineH = 96;
  const approxLines = Math.ceil((slide.headline.length * 40) / headlineMaxWidth) + 1;
  const blockH = approxLines * lineH;
  const startY = (SLIDE_SIZE - blockH) / 2 + lineH;

  wrapText(ctx, slide.headline, 56, startY, headlineMaxWidth, lineH, 5, "left");

  // Logo mark — bottom-right, white
  drawLogoMark(ctx, SLIDE_SIZE - 80, SLIDE_SIZE - 80, 52, BRAND.yang);
}

// ── Content slide ─────────────────────────────────────────────────────────────
function renderContent(
  ctx: CanvasRenderingContext2D,
  slide: CarouselSlideData,
  total: number,
  colorIndex: number
) {
  // Cream background
  ctx.fillStyle = BRAND.metal;
  ctx.fillRect(0, 0, SLIDE_SIZE, SLIDE_SIZE);

  // Pick an accent color for this slide (cycles through brand colors)
  const accentColor = COVER_COLORS[colorIndex % COVER_COLORS.length];

  // Watermark: faint Life Garden elements in accent color
  drawDotCluster(ctx, SLIDE_SIZE - 220, SLIDE_SIZE - 280, accentColor, 0.1, 10, 3, 4, 38);
  drawZigzag(ctx, 40, SLIDE_SIZE - 160, 300, 22, 8, accentColor, 0.12, 5);

  // Slide number — top left
  ctx.font = "400 22px 'DM Sans', system-ui, sans-serif";
  ctx.fillStyle = "rgba(22,21,19,0.4)";
  ctx.textAlign = "left";
  ctx.fillText(`${slide.slide} of ${total}`, 56, 72);

  // Accent color bar — left edge
  ctx.fillStyle = accentColor;
  ctx.fillRect(0, 0, 12, SLIDE_SIZE);

  // Headline — dark, large
  ctx.font = "700 64px 'Nunito', 'DM Sans', system-ui, sans-serif";
  ctx.fillStyle = BRAND.yin;
  ctx.textAlign = "left";
  const afterHeadline = wrapText(ctx, slide.headline, 72, 160, SLIDE_SIZE - 128, 78, 3);

  // Divider line in accent color
  ctx.fillStyle = accentColor;
  ctx.fillRect(72, afterHeadline + 16, 80, 4);

  // Body text
  const bodyY = afterHeadline + 56;
  if (slide.bullets && slide.bullets.length > 0) {
    let bulletY = bodyY;
    ctx.font = "400 38px 'DM Sans', system-ui, sans-serif";
    ctx.fillStyle = BRAND.yin;
    for (const bullet of slide.bullets.slice(0, 5)) {
      // Bullet dot in accent color
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(72 + 10, bulletY - 12, 7, 0, Math.PI * 2);
      ctx.fill();
      // Bullet text
      ctx.fillStyle = BRAND.yin;
      const nextY = wrapText(ctx, bullet, 72 + 32, bulletY, SLIDE_SIZE - 160, 48, 2);
      bulletY = nextY + 20;
    }
  } else if (slide.body) {
    ctx.font = "400 40px 'DM Sans', system-ui, sans-serif";
    ctx.fillStyle = BRAND.yin;
    wrapText(ctx, slide.body, 72, bodyY, SLIDE_SIZE - 128, 58, 6);
  }

  // Logo mark — bottom-right, accent color
  drawLogoMark(ctx, SLIDE_SIZE - 80, SLIDE_SIZE - 80, 52, accentColor);
}

// ── CTA slide ─────────────────────────────────────────────────────────────────
function renderCta(ctx: CanvasRenderingContext2D, slide: CarouselSlideData, total: number) {
  // Cream background
  ctx.fillStyle = BRAND.metal;
  ctx.fillRect(0, 0, SLIDE_SIZE, SLIDE_SIZE);

  // Fire accent — top color block (top 1/3)
  ctx.fillStyle = BRAND.fire;
  ctx.fillRect(0, 0, SLIDE_SIZE, 340);

  // Watermark on fire block: oval rings
  drawOvalRings(ctx, 60, 280, 5, BRAND.yang, 0.12);
  drawDotCluster(ctx, SLIDE_SIZE - 240, 40, BRAND.yang, 0.1, 9, 4, 3, 34);

  // Slide number
  ctx.font = "400 22px 'DM Sans', system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.textAlign = "left";
  ctx.fillText(`${slide.slide} of ${total}`, 56, 56);

  // Headline — white on fire block
  ctx.font = "700 68px 'Nunito', 'DM Sans', system-ui, sans-serif";
  ctx.fillStyle = BRAND.yang;
  ctx.textAlign = "left";
  wrapText(ctx, slide.headline, 56, 120, SLIDE_SIZE - 112, 82, 3);

  // Body — dark on cream
  if (slide.body) {
    ctx.font = "400 38px 'DM Sans', system-ui, sans-serif";
    ctx.fillStyle = BRAND.yin;
    ctx.textAlign = "center";
    wrapText(ctx, slide.body, 56, 400, SLIDE_SIZE - 112, 54, 4, "center");
  }

  // CTA button pill — Fire color
  const btnY = SLIDE_SIZE - 260;
  const btnW = 680;
  const btnH = 88;
  const btnX = (SLIDE_SIZE - btnW) / 2;
  ctx.fillStyle = BRAND.fire;
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnW, btnH, 44);
  ctx.fill();

  ctx.font = "700 30px 'DM Sans', system-ui, sans-serif";
  ctx.fillStyle = BRAND.yang;
  ctx.textAlign = "center";
  ctx.fillText("go.theurbanmonk.com", SLIDE_SIZE / 2, btnY + 56);

  // "Free access" sub-label
  ctx.font = "400 26px 'DM Sans', system-ui, sans-serif";
  ctx.fillStyle = "rgba(22,21,19,0.5)";
  ctx.fillText("Join the Urban Monk Academy", SLIDE_SIZE / 2, btnY + 120);

  // Logo mark — bottom-right, Fire color
  drawLogoMark(ctx, SLIDE_SIZE - 80, SLIDE_SIZE - 80, 52, BRAND.fire);
}

// ── Main render function ──────────────────────────────────────────────────────
export async function renderSlideToCanvas(
  canvas: HTMLCanvasElement,
  slide: CarouselSlideData,
  total: number,
  colorIndex?: number
) {
  await ensureFonts();
  canvas.width = SLIDE_SIZE;
  canvas.height = SLIDE_SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, SLIDE_SIZE, SLIDE_SIZE);

  // colorIndex cycles through brand palette per slide
  const idx = colorIndex !== undefined ? colorIndex : slide.slide - 1;

  if (slide.type === "cover") {
    renderCover(ctx, slide, total, idx);
  } else if (slide.type === "cta") {
    renderCta(ctx, slide, total);
  } else {
    renderContent(ctx, slide, total, idx);
  }
}

// ── Export slide as PNG blob ──────────────────────────────────────────────────
export async function slideToBlob(slide: CarouselSlideData, total: number, colorIndex?: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  await renderSlideToCanvas(canvas, slide, total, colorIndex);
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
  for (let i = 0; i < slides.length; i++) {
    const canvas = document.createElement("canvas");
    await renderSlideToCanvas(canvas, slides[i], slides.length, i);
    results.push(canvas.toDataURL("image/png"));
  }
  return results;
}
