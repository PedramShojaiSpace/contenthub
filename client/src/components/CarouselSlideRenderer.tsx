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

// ── Urban Monk Logo Variants ───────────────────────────────────────────────────
// All 7 official color variants from the brand identity package.
// Each logo file is pre-colored — no pixel manipulation needed.
//
// Usage rules (from brand spec):
//   Colored bg (Fire/Wood/Water/Earth) → Yang (white) logo
//   Cream/Metal bg                     → Yin (black) or element-colored logo
//   Dark bg                            → Yang (white) logo

const CDN = "https://d2xsxph8kpxj0f.cloudfront.net/310519663158996687/iUgsiz76NwfDUVHZHV7CyJ";

export const LOGO_URLS = {
  yin:   `${CDN}/The_Urban_Monk-Icon-Yin_90acff39.png`,   // black
  yang:  `${CDN}/The_Urban_Monk-Icon-Yang_b22ccc65.png`,  // white
  fire:  `${CDN}/The_Urban_Monk-Icon-Fire_0b452e9b.png`,  // red-orange #ed5939
  wood:  `${CDN}/The_Urban_Monk-Icon-Wood_0a2e7212.png`,  // forest green #3d7e51
  water: `${CDN}/The_Urban_Monk-Icon-Water_86df5580.png`, // muted blue #5870aa
  earth: `${CDN}/The_Urban_Monk-Icon-Earth_04456ace.png`, // warm amber #f6a032
  metal: `${CDN}/The_Urban_Monk-Icon-Metal_47202c2f.png`, // cream (use on dark bg)
} as const;

export type LogoVariant = keyof typeof LOGO_URLS;

// Image cache — one entry per variant
const _logoCache: Partial<Record<LogoVariant, HTMLImageElement>> = {};
const _logoPromises: Partial<Record<LogoVariant, Promise<HTMLImageElement>>> = {};

function getLogoImage(variant: LogoVariant): Promise<HTMLImageElement> {
  if (_logoCache[variant]) return Promise.resolve(_logoCache[variant]!);
  if (_logoPromises[variant]) return _logoPromises[variant]!;
  _logoPromises[variant] = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { _logoCache[variant] = img; resolve(img); };
    img.onerror = reject;
    img.src = LOGO_URLS[variant];
  });
  return _logoPromises[variant]!;
}

/**
 * Map a brand background color to the correct logo variant.
 * - Colored backgrounds (Fire/Wood/Water/Earth) → Yang (white)
 * - Cream (Metal) background → Yin (black)
 * - Explicit element override → matching element logo
 */
export function logoVariantForBg(bgColor: string): LogoVariant {
  switch (bgColor) {
    case BRAND.fire:  return "yang";  // white on red-orange
    case BRAND.wood:  return "yang";  // white on green
    case BRAND.water: return "yang";  // white on blue
    case BRAND.earth: return "yang";  // white on amber
    case BRAND.metal: return "yin";   // black on cream
    default:          return "yin";
  }
}

/**
 * Map a brand background color to the element-colored logo variant.
 * Used on cream/content slides where the logo echoes the accent color.
 */
export function logoVariantForAccent(accentColor: string): LogoVariant {
  switch (accentColor) {
    case BRAND.fire:  return "fire";
    case BRAND.wood:  return "wood";
    case BRAND.water: return "water";
    case BRAND.earth: return "earth";
    default:          return "yin";
  }
}

/**
 * Draw the Urban Monk logo onto the canvas using the correct pre-colored variant.
 * cx/cy = center point, size = width & height in canvas pixels.
 */
async function drawLogoMark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  variant: LogoVariant
) {
  try {
    const img = await getLogoImage(variant);
    const half = size / 2;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.drawImage(img, cx - half, cy - half, size, size);
    ctx.restore();
  } catch {
    // Fallback: simple circle outline
    ctx.save();
    ctx.strokeStyle = variant === "yang" ? "#ffffff" : "#161513";
    ctx.lineWidth = size * 0.06;
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2 - size * 0.04, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
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
async function renderCover(
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

  // Logo mark — bottom-right: Yang (white) on colored bg
  await drawLogoMark(ctx, SLIDE_SIZE - 80, SLIDE_SIZE - 80, 110, logoVariantForBg(bgColor));
}

// ── Content slide ─────────────────────────────────────────────────────────────
async function renderContent(
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

  // Logo mark — bottom-right: element-colored logo on cream bg
  await drawLogoMark(ctx, SLIDE_SIZE - 80, SLIDE_SIZE - 80, 110, logoVariantForAccent(accentColor));
}

// ── CTA slide ─────────────────────────────────────────────────────────────────
async function renderCta(ctx: CanvasRenderingContext2D, slide: CarouselSlideData, total: number) {
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

  // Logo mark — bottom-right: Fire-colored logo on CTA cream section
  await drawLogoMark(ctx, SLIDE_SIZE - 80, SLIDE_SIZE - 80, 110, "fire");
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
    await renderCover(ctx, slide, total, idx);
  } else if (slide.type === "cta") {
    await renderCta(ctx, slide, total);
  } else {
    await renderContent(ctx, slide, total, idx);
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
