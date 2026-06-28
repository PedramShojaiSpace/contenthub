/**
 * CarouselSlideRenderer
 * Renders branded Urban Monk carousel slides on an HTML Canvas.
 * Each slide is 1080×1080 (1:1 square) for Meta/Instagram/Facebook.
 *
 * Design system: The Urban Monk Visual Identity Guidelines (May 2020)
 *   - Daoist five-element color palette
 *   - Flat solid color backgrounds (NO gradients)
 *   - White text on colored backgrounds
 *   - Dark (#161513) text on cream backgrounds
 *   - Urban Monk logo mark (circle + infinity/wave) bottom-right
 *   - "Life Garden" abstract decorative elements as watermarks
 *
 * Typography hierarchy (La Perla / premium editorial standard):
 *   - Headline: 72px bold, max 2 lines, generous leading
 *   - Body: 52px regular, 72px line-height — large enough to read on phone
 *   - Slide number: 26px, muted
 *   - Minimum gap between headline bottom and body top: 100px
 *   - Content zone starts at y=180 (top padding) and ends at y=900 (bottom padding)
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
  // Daoist element colors
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

// ── Layout constants ──────────────────────────────────────────────────────────
// These define the "safe zone" — content never bleeds into margins or logo area
const MARGIN_X = 72;          // left/right margin
const CONTENT_WIDTH = SLIDE_SIZE - MARGIN_X * 2;  // 936px usable width
const SLIDE_NUM_Y = 68;       // slide number baseline
const CONTENT_TOP = 170;      // where headline starts (generous top padding)
const CONTENT_BOTTOM = 900;   // content must not go below this (logo lives at 1000)

// Typography scale
const TYPE = {
  // Cover slide
  coverHeadline:    { font: "700 76px 'Nunito', 'DM Sans', system-ui, sans-serif", lineH: 94 },
  coverSlideNum:    { font: "400 26px 'DM Sans', system-ui, sans-serif" },

  // Content slide
  contentHeadline:  { font: "700 68px 'Nunito', 'DM Sans', system-ui, sans-serif", lineH: 84 },
  contentBody:      { font: "400 48px 'DM Sans', system-ui, sans-serif", lineH: 70 },
  contentBullet:    { font: "400 46px 'DM Sans', system-ui, sans-serif", lineH: 66 },
  contentSlideNum:  { font: "400 26px 'DM Sans', system-ui, sans-serif" },

  // CTA slide
  ctaHeadline:      { font: "700 68px 'Nunito', 'DM Sans', system-ui, sans-serif", lineH: 84 },
  ctaBody:          { font: "400 44px 'DM Sans', system-ui, sans-serif", lineH: 64 },
  ctaButton:        { font: "700 32px 'DM Sans', system-ui, sans-serif" },
  ctaSub:           { font: "400 28px 'DM Sans', system-ui, sans-serif" },
};

// ── Font loading helper ───────────────────────────────────────────────────────
let fontsLoaded = false;
async function ensureFonts() {
  if (fontsLoaded) return;
  try {
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
/**
 * Wraps text onto canvas. Returns the Y coordinate of the line AFTER the last drawn line.
 * align: "left" | "center"
 */
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
const CDN = "https://d2xsxph8kpxj0f.cloudfront.net/310519663158996687/iUgsiz76NwfDUVHZHV7CyJ";

export const LOGO_URLS = {
  yin:   `${CDN}/The_Urban_Monk-Icon-Yin_90acff39.png`,
  yang:  `${CDN}/The_Urban_Monk-Icon-Yang_b22ccc65.png`,
  fire:  `${CDN}/The_Urban_Monk-Icon-Fire_0b452e9b.png`,
  wood:  `${CDN}/The_Urban_Monk-Icon-Wood_0a2e7212.png`,
  water: `${CDN}/The_Urban_Monk-Icon-Water_86df5580.png`,
  earth: `${CDN}/The_Urban_Monk-Icon-Earth_04456ace.png`,
  metal: `${CDN}/The_Urban_Monk-Icon-Metal_47202c2f.png`,
} as const;

export type LogoVariant = keyof typeof LOGO_URLS;

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

export function logoVariantForBg(bgColor: string): LogoVariant {
  switch (bgColor) {
    case BRAND.fire:  return "yang";
    case BRAND.wood:  return "yang";
    case BRAND.water: return "yang";
    case BRAND.earth: return "yang";
    case BRAND.metal: return "yin";
    default:          return "yin";
  }
}

export function logoVariantForAccent(accentColor: string): LogoVariant {
  switch (accentColor) {
    case BRAND.fire:  return "fire";
    case BRAND.wood:  return "wood";
    case BRAND.water: return "water";
    case BRAND.earth: return "earth";
    default:          return "yin";
  }
}

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

  // Solid brand color background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, SLIDE_SIZE, SLIDE_SIZE);

  // Watermark elements
  const watermarkColor = BRAND.yang;
  drawDotCluster(ctx, SLIDE_SIZE - 260, 60, watermarkColor, 0.10, 9, 4, 5, 36);
  drawOvalRings(ctx, 60, SLIDE_SIZE - 120, 4, watermarkColor, 0.09);
  drawSketchCircle(ctx, SLIDE_SIZE - 120, SLIDE_SIZE / 2, 90, watermarkColor, 0.07);

  // Swipe hint — top right
  ctx.font = "500 26px 'DM Sans', system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.60)";
  ctx.textAlign = "right";
  ctx.fillText("swipe →", SLIDE_SIZE - MARGIN_X, SLIDE_NUM_Y);

  // Slide number — top left
  ctx.font = TYPE.coverSlideNum.font;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.textAlign = "left";
  ctx.fillText(`${slide.slide} of ${total}`, MARGIN_X, SLIDE_NUM_Y);

  // Headline — large, white, vertically centered in the slide
  ctx.font = TYPE.coverHeadline.font;
  ctx.fillStyle = BRAND.yang;
  ctx.textAlign = "left";

  const lineH = TYPE.coverHeadline.lineH;
  // Estimate block height for vertical centering (max 4 lines)
  const approxLines = Math.min(4, Math.ceil((slide.headline.length * 38) / CONTENT_WIDTH) + 1);
  const blockH = approxLines * lineH;
  const startY = (SLIDE_SIZE - blockH) / 2 + lineH;

  wrapText(ctx, slide.headline, MARGIN_X, startY, CONTENT_WIDTH, lineH, 4, "left");

  // Logo mark — bottom-right
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

  const accentColor = COVER_COLORS[colorIndex % COVER_COLORS.length];

  // Watermark: Life Garden elements — pushed to bottom corners, low opacity
  drawDotCluster(ctx, SLIDE_SIZE - 200, SLIDE_SIZE - 260, accentColor, 0.08, 10, 3, 4, 38);
  drawZigzag(ctx, 40, SLIDE_SIZE - 170, 280, 20, 8, accentColor, 0.10, 5);

  // Accent color bar — left edge (full height)
  ctx.fillStyle = accentColor;
  ctx.fillRect(0, 0, 12, SLIDE_SIZE);

  // Slide number — top left, muted
  ctx.font = TYPE.contentSlideNum.font;
  ctx.fillStyle = "rgba(22,21,19,0.38)";
  ctx.textAlign = "left";
  ctx.fillText(`${slide.slide} of ${total}`, MARGIN_X, SLIDE_NUM_Y);

  // ── Headline ──────────────────────────────────────────────────────────────
  // Starts at CONTENT_TOP (170px). Max 2 lines to preserve space for body.
  ctx.font = TYPE.contentHeadline.font;
  ctx.fillStyle = BRAND.yin;
  ctx.textAlign = "left";

  const headlineLineH = TYPE.contentHeadline.lineH;
  const afterHeadline = wrapText(
    ctx,
    slide.headline,
    MARGIN_X,
    CONTENT_TOP,
    CONTENT_WIDTH,
    headlineLineH,
    2,   // ← hard cap: 2 lines max so body always has room
    "left"
  );

  // ── Divider ───────────────────────────────────────────────────────────────
  // 48px gap below headline, then a 4px accent rule, then 60px gap before body
  const dividerY = afterHeadline + 48;
  ctx.fillStyle = accentColor;
  ctx.fillRect(MARGIN_X, dividerY, 80, 4);

  // ── Body text ─────────────────────────────────────────────────────────────
  // Body starts 60px below the divider line — generous breathing room
  const bodyY = dividerY + 60;

  if (slide.bullets && slide.bullets.length > 0) {
    let bulletY = bodyY;
    ctx.font = TYPE.contentBullet.font;
    ctx.fillStyle = BRAND.yin;
    const bulletLineH = TYPE.contentBullet.lineH;
    const bulletIndent = MARGIN_X + 36;
    const bulletWidth = CONTENT_WIDTH - 36;

    for (const bullet of slide.bullets.slice(0, 4)) {
      // Bullet dot in accent color — vertically centered on first line
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(MARGIN_X + 10, bulletY - 14, 8, 0, Math.PI * 2);
      ctx.fill();

      // Bullet text
      ctx.fillStyle = BRAND.yin;
      const nextY = wrapText(ctx, bullet, bulletIndent, bulletY, bulletWidth, bulletLineH, 2);
      bulletY = nextY + 24;

      // Stop if we'd overflow the content zone
      if (bulletY > CONTENT_BOTTOM - 60) break;
    }
  } else if (slide.body) {
    ctx.font = TYPE.contentBody.font;
    ctx.fillStyle = BRAND.yin;
    // Max lines calculated from available vertical space
    const availableH = CONTENT_BOTTOM - bodyY;
    const maxLines = Math.floor(availableH / TYPE.contentBody.lineH);
    wrapText(ctx, slide.body, MARGIN_X, bodyY, CONTENT_WIDTH, TYPE.contentBody.lineH, Math.max(3, maxLines), "left");
  }

  // Logo mark — bottom-right, element-colored on cream
  await drawLogoMark(ctx, SLIDE_SIZE - 80, SLIDE_SIZE - 80, 110, logoVariantForAccent(accentColor));
}

// ── CTA slide ─────────────────────────────────────────────────────────────────
async function renderCta(ctx: CanvasRenderingContext2D, slide: CarouselSlideData, total: number) {
  // Cream background
  ctx.fillStyle = BRAND.metal;
  ctx.fillRect(0, 0, SLIDE_SIZE, SLIDE_SIZE);

  // Fire accent — top color block (top ~35%)
  ctx.fillStyle = BRAND.fire;
  ctx.fillRect(0, 0, SLIDE_SIZE, 370);

  // Watermarks on fire block
  drawOvalRings(ctx, 60, 310, 5, BRAND.yang, 0.12);
  drawDotCluster(ctx, SLIDE_SIZE - 240, 40, BRAND.yang, 0.10, 9, 4, 3, 34);

  // Slide number
  ctx.font = TYPE.coverSlideNum.font;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.textAlign = "left";
  ctx.fillText(`${slide.slide} of ${total}`, MARGIN_X, SLIDE_NUM_Y);

  // Headline — white on fire block, max 2 lines
  ctx.font = TYPE.ctaHeadline.font;
  ctx.fillStyle = BRAND.yang;
  ctx.textAlign = "left";
  wrapText(ctx, slide.headline, MARGIN_X, 130, CONTENT_WIDTH, TYPE.ctaHeadline.lineH, 2);

  // Body — dark on cream, centered, starts below fire block
  if (slide.body) {
    ctx.font = TYPE.ctaBody.font;
    ctx.fillStyle = BRAND.yin;
    ctx.textAlign = "center";
    wrapText(ctx, slide.body, MARGIN_X, 430, CONTENT_WIDTH, TYPE.ctaBody.lineH, 4, "center");
  }

  // CTA button pill
  const btnY = SLIDE_SIZE - 290;
  const btnW = 700;
  const btnH = 92;
  const btnX = (SLIDE_SIZE - btnW) / 2;
  ctx.fillStyle = BRAND.fire;
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnW, btnH, 46);
  ctx.fill();

  ctx.font = TYPE.ctaButton.font;
  ctx.fillStyle = BRAND.yang;
  ctx.textAlign = "center";
  ctx.fillText("lightson.theurbanmonk.com", SLIDE_SIZE / 2, btnY + 60);

  // Sub-label below button
  ctx.font = TYPE.ctaSub.font;
  ctx.fillStyle = "rgba(22,21,19,0.48)";
  ctx.fillText("Start your Lights On journey today", SLIDE_SIZE / 2, btnY + 130);

  // Logo mark
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
