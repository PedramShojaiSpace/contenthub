/**
 * ebookPdf.ts — Branded PDF generation for Urban Monk e-books
 *
 * Uses PDFKit — a pure Node.js PDF library with zero system dependencies.
 * Generates a branded ebook with cover page, table of contents, chapters,
 * and a back cover CTA. No external binaries or shared libraries required.
 */

import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PdfChapter {
  chapterNumber: number;
  title: string;
  content: string; // Markdown (stripped to plain text for PDF)
  ctaText?: string | null;
  ctaUrl?: string | null;
  ctaLabel?: string | null;
}

export interface PdfCtaBlock {
  text: string;
  url?: string | null;
  label?: string | null;
}

export interface EbookPdfOptions {
  title: string;
  subtitle?: string;
  author?: string;
  topic?: string;
  targetPersona?: string | null;
  chapters: PdfChapter[];
  globalCta?: PdfCtaBlock | null;
  funnelStage?: string | null;
  /** Buffer of the AI-generated cover image (JPEG/PNG). When provided, it is
   *  rendered as a full-bleed page 1 before the branded cover page. */
  coverImageBuffer?: Buffer | null;
}

// ─── Color Palette ────────────────────────────────────────────────────────────

const DARK_NAVY = "#1a1a2e";
const GOLD = "#d4af37";
const GOLD_LIGHT = "#f0e6c0";
const WHITE = "#ffffff";
const BODY_TEXT = "#1a1a1a";
const MUTED = "#6b6b6b";

// ─── Logo ─────────────────────────────────────────────────────────────────────

/** Load the Urban Monk logo PNG from the bundled server assets directory.
 *  Falls back gracefully if the file is missing (e.g., in test environments). */
function loadLogoBuffer(): Buffer | null {
  try {
    const logoPath = path.join(__dirname, "assets", "urban-monk-logo.png");
    if (fs.existsSync(logoPath)) {
      return fs.readFileSync(logoPath);
    }
  } catch {
    // ignore
  }
  return null;
}

const LOGO_BUFFER = loadLogoBuffer();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip Markdown syntax to plain text for PDF rendering */
function stripMarkdown(md: string): string {
  return md
    .replace(/#{1,6}\s+/g, "") // headings
    .replace(/\*\*(.+?)\*\*/g, "$1") // bold
    .replace(/\*(.+?)\*/g, "$1") // italic
    .replace(/__(.+?)__/g, "$1") // bold alt
    .replace(/_(.+?)_/g, "$1") // italic alt
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .replace(/`{1,3}[^`]*`{1,3}/g, "") // code
    .replace(/^[-*+]\s+/gm, "• ") // unordered list
    .replace(/^\d+\.\s+/gm, "") // ordered list
    .replace(/^>\s+/gm, "") // blockquotes
    .replace(/---+/g, "") // hr
    .replace(/\n{3,}/g, "\n\n") // collapse extra newlines
    .trim();
}
/** Parse markdown into segments: heading, bullet, or paragraph */
interface TextSegment {
  type: "h2" | "h3" | "bullet" | "blockquote" | "paragraph" | "hr";
  text: string;
}

function parseMarkdown(md: string): TextSegment[] {
  const lines = md.split("\n");
  const segments: TextSegment[] = [];
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    const text = paragraphLines.join(" ").trim();
    if (text) segments.push({ type: "paragraph", text: stripMarkdown(text) });
    paragraphLines = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^#{1,2}\s/.test(line)) {
      flushParagraph();
      segments.push({ type: "h2", text: line.replace(/^#{1,2}\s+/, "") });
    } else if (/^#{3,6}\s/.test(line)) {
      flushParagraph();
      segments.push({ type: "h3", text: line.replace(/^#{3,6}\s+/, "") });
    } else if (/^[-*+]\s/.test(line)) {
      flushParagraph();
      segments.push({ type: "bullet", text: stripMarkdown(line.replace(/^[-*+]\s+/, "")) });
    } else if (/^\d+\.\s/.test(line)) {
      flushParagraph();
      segments.push({ type: "bullet", text: stripMarkdown(line.replace(/^\d+\.\s+/, "")) });
    } else if (/^>\s/.test(line)) {
      flushParagraph();
      segments.push({ type: "blockquote", text: stripMarkdown(line.replace(/^>\s+/, "")) });
    } else if (/^---+$/.test(line.trim())) {
      flushParagraph();
      segments.push({ type: "hr", text: "" });
    } else if (line === "") {
      flushParagraph();
    } else {
      paragraphLines.push(line);
    }
  }
  flushParagraph();
  return segments;
}

/** Draw the Urban Monk logo image (or fall back to the "UM" circle) at the given centre-x, top-y position */
function drawLogo(
  doc: InstanceType<typeof PDFDocument>,
  cx: number,
  topY: number,
  targetWidth: number,
): number {
  if (LOGO_BUFFER) {
    // The logo PNG is landscape (1639×808). Scale to targetWidth and derive height.
    const aspectRatio = 808 / 1639;
    const w = targetWidth;
    const h = w * aspectRatio;
    const x = cx - w / 2;
    doc.image(LOGO_BUFFER, x, topY, { width: w });
    return topY + h; // return bottom Y of the logo
  }
  // Fallback: draw the "UM" circle in gold
  const r = 36;
  doc.circle(cx, topY + r, r).stroke(GOLD);
  doc.font("Helvetica-Bold").fontSize(18).fillColor(GOLD).text("UM", cx - 13, topY + r - 11);
  return topY + r * 2 + 8;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export async function generateEbookPdf(opts: EbookPdfOptions): Promise<Buffer> {
  const {
    title,
    subtitle,
    author = "Dr. Pedram Shojai",
    chapters,
    globalCta,
    coverImageBuffer,
  } = opts;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 72, bottom: 60, left: 80, right: 80 },
      info: {
        Title: title,
        Author: author,
        Subject: opts.topic || title,
        Creator: "Urban Monk Content Hub",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const contentWidth = pageWidth - 160; // left + right margins

    // ── AI-Generated Cover Image (Page 1, if provided) ────────────────────────
    if (coverImageBuffer && coverImageBuffer.length > 0) {
      // Full-bleed cover image page
      doc.rect(0, 0, pageWidth, pageHeight).fill(DARK_NAVY);
      try {
        doc.image(coverImageBuffer, 0, 0, {
          width: pageWidth,
          height: pageHeight,
          cover: [pageWidth, pageHeight],
        });
      } catch {
        // If image embedding fails, just leave the dark background
      }
      doc.addPage();
    }

    // ── Branded Cover Page ────────────────────────────────────────────────────
    // Dark navy background
    doc.rect(0, 0, pageWidth, pageHeight).fill(DARK_NAVY);

    // Urban Monk logo — centred, 200px wide
    const logoTopY = 80;
    const logoBottomY = drawLogo(doc, pageWidth / 2, logoTopY, 200);

    // Eyebrow text
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(GOLD)
      .text("THE URBAN MONK  ·  DR. PEDRAM SHOJAI", 0, logoBottomY + 20, {
        align: "center",
        characterSpacing: 1.5,
      });

    // Title
    doc
      .font("Helvetica-Bold")
      .fontSize(28)
      .fillColor(WHITE)
      .text(title, 60, logoBottomY + 50, {
        align: "center",
        width: pageWidth - 120,
        lineGap: 6,
      });

    // Gold divider line
    const titleBottom = doc.y + 20;
    doc
      .moveTo(pageWidth / 2 - 30, titleBottom)
      .lineTo(pageWidth / 2 + 30, titleBottom)
      .strokeColor(GOLD)
      .lineWidth(1.5)
      .stroke();

    // Subtitle
    if (subtitle) {
      doc
        .font("Helvetica-Oblique")
        .fontSize(13)
        .fillColor(WHITE)
        .fillOpacity(0.75)
        .text(subtitle, 60, titleBottom + 20, {
          align: "center",
          width: pageWidth - 120,
        });
    }

    // Author
    doc.fillOpacity(1);
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor(GOLD)
      .text(author, 0, pageHeight - 160, { align: "center" });

    // Footer
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(WHITE)
      .fillOpacity(0.3)
      .text("THEURBANMONK.COM  ·  URBAN MONK ACADEMY", 0, pageHeight - 120, {
        align: "center",
        characterSpacing: 1,
      });

    doc.fillOpacity(1);

    // ── Table of Contents ─────────────────────────────────────────────────────
    doc.addPage();

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(GOLD)
      .text("CONTENTS", 80, 80, { characterSpacing: 2 });

    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor(DARK_NAVY)
      .text("Table of Contents", 80, 100);

    doc
      .moveTo(80, doc.y + 12)
      .lineTo(pageWidth - 80, doc.y + 12)
      .strokeColor(GOLD_LIGHT)
      .lineWidth(0.5)
      .stroke();

    let tocY = doc.y + 24;
    chapters.forEach((ch) => {
      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor(BODY_TEXT)
        .text(`${ch.chapterNumber}. ${ch.title}`, 80, tocY, {
          width: contentWidth - 40,
          continued: false,
        });
      tocY = doc.y + 8;
    });

    // ── Chapters ──────────────────────────────────────────────────────────────
    chapters.forEach((ch) => {
      doc.addPage();

      // Chapter header band
      doc.rect(0, 0, pageWidth, 8).fill(GOLD);

      // Chapter number label
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(GOLD)
        .text(`CHAPTER ${ch.chapterNumber}`, 80, 30, { characterSpacing: 1.5 });

      // Chapter title
      doc
        .font("Helvetica-Bold")
        .fontSize(22)
        .fillColor(DARK_NAVY)
        .text(ch.title, 80, 50, { width: contentWidth });

      // Divider
      doc
        .moveTo(80, doc.y + 10)
        .lineTo(pageWidth - 80, doc.y + 10)
        .strokeColor(GOLD_LIGHT)
        .lineWidth(0.5)
        .stroke();

      let y = doc.y + 20;

      // Render markdown segments
      const segments = parseMarkdown(ch.content);
      segments.forEach((seg) => {
        if (y > pageHeight - 120) {
          doc.addPage();
          doc.rect(0, 0, pageWidth, 8).fill(GOLD);
          y = 40;
        }

        switch (seg.type) {
          case "h2":
            doc
              .font("Helvetica-Bold")
              .fontSize(16)
              .fillColor(DARK_NAVY)
              .text(seg.text, 80, y, { width: contentWidth });
            y = doc.y + 10;
            break;
          case "h3":
            doc
              .font("Helvetica-Bold")
              .fontSize(13)
              .fillColor(DARK_NAVY)
              .text(seg.text, 80, y, { width: contentWidth });
            y = doc.y + 8;
            break;
          case "bullet":
            doc
              .font("Helvetica")
              .fontSize(11)
              .fillColor(BODY_TEXT)
              .text(`• ${seg.text}`, 92, y, { width: contentWidth - 12, lineGap: 2 });
            y = doc.y + 6;
            break;
          case "blockquote":
            doc.rect(80, y, 3, 20).fill(GOLD);
            doc
              .font("Helvetica-Oblique")
              .fontSize(11)
              .fillColor(MUTED)
              .text(seg.text, 92, y, { width: contentWidth - 12, lineGap: 2 });
            y = doc.y + 10;
            break;
          case "hr":
            doc
              .moveTo(80, y + 4)
              .lineTo(pageWidth - 80, y + 4)
              .strokeColor(GOLD_LIGHT)
              .lineWidth(0.5)
              .stroke();
            y += 16;
            break;
          default:
            doc
              .font("Helvetica")
              .fontSize(11)
              .fillColor(BODY_TEXT)
              .text(seg.text, 80, y, { width: contentWidth, lineGap: 3 });
            y = doc.y + 10;
        }
      });

      // Per-chapter CTA box
      if (ch.ctaText && ch.ctaUrl) {
        if (y > pageHeight - 160) {
          doc.addPage();
          doc.rect(0, 0, pageWidth, 8).fill(GOLD);
          y = 40;
        }
        const boxH = 70;
        doc.rect(80, y + 10, contentWidth, boxH).fill(GOLD_LIGHT);
        doc
          .font("Helvetica-Bold")
          .fontSize(11)
          .fillColor(DARK_NAVY)
          .text(ch.ctaText, 100, y + 22, {
            width: contentWidth - 40,
            align: "center",
          });
        doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .fillColor(GOLD)
          .text(ch.ctaLabel || "Learn More →", 100, doc.y + 8, {
            width: contentWidth - 40,
            align: "center",
            link: ch.ctaUrl,
          });
        doc.fillOpacity(1);
      }
    });

    // ── Back Cover ────────────────────────────────────────────────────────────
    if (globalCta) {
      doc.addPage();
      doc.rect(0, 0, pageWidth, pageHeight).fill(DARK_NAVY);

      // Urban Monk logo on back cover — smaller, 160px wide
      const bcLogoTopY = pageHeight / 2 - 180;
      const bcLogoBottomY = drawLogo(doc, pageWidth / 2, bcLogoTopY, 160);

      doc
        .font("Helvetica-Bold")
        .fontSize(24)
        .fillColor(WHITE)
        .text("Ready to Go Deeper?", 60, bcLogoBottomY + 24, {
          align: "center",
          width: pageWidth - 120,
        });

      doc
        .font("Helvetica-Oblique")
        .fontSize(12)
        .fillColor(WHITE)
        .fillOpacity(0.8)
        .text(globalCta.text, 80, doc.y + 16, {
          align: "center",
          width: pageWidth - 160,
          lineGap: 4,
        });

      if (globalCta.url) {
        doc.fillOpacity(1);
        const btnY = doc.y + 20;
        const btnLabel = globalCta.label || "Discover Lights On →";
        const btnW = 280;
        const btnX = (pageWidth - btnW) / 2;
        doc.rect(btnX, btnY, btnW, 36).fill(GOLD);
        doc
          .font("Helvetica-Bold")
          .fontSize(11)
          .fillColor(DARK_NAVY)
          .text(btnLabel, btnX, btnY + 11, {
            width: btnW,
            align: "center",
            link: globalCta.url,
          });
      }

      doc.fillOpacity(0.7);
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(GOLD)
        .text(`— ${author}`, 0, doc.y + 24, { align: "center" });

      doc.fillOpacity(1);
    }

    doc.end();
  });
}
