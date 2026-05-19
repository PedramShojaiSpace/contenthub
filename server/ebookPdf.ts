/**
 * ebookPdf.ts — Branded PDF generation for Urban Monk e-books
 *
 * Uses PDFKit — a pure Node.js PDF library with zero system dependencies.
 * Generates a branded ebook with cover page, table of contents, chapters,
 * and a back cover CTA. No external binaries or shared libraries required.
 */

import PDFDocument from "pdfkit";

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
}

// ─── Color Palette ────────────────────────────────────────────────────────────

const DARK_NAVY = "#1a1a2e";
const GOLD = "#d4af37";
const GOLD_LIGHT = "#f0e6c0";
const WHITE = "#ffffff";
const BODY_TEXT = "#1a1a1a";
const MUTED = "#6b6b6b";

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
  const segments: TextSegment[] = [];
  const lines = md.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trimEnd();

    if (!line.trim()) {
      i++;
      continue;
    }

    if (/^#{1,2}\s+/.test(line)) {
      segments.push({ type: "h2", text: line.replace(/^#{1,2}\s+/, "").trim() });
    } else if (/^###\s+/.test(line)) {
      segments.push({ type: "h3", text: line.replace(/^###\s+/, "").trim() });
    } else if (/^[-*+]\s+/.test(line)) {
      segments.push({ type: "bullet", text: line.replace(/^[-*+]\s+/, "").trim() });
    } else if (/^\d+\.\s+/.test(line)) {
      segments.push({ type: "bullet", text: line.replace(/^\d+\.\s+/, "").trim() });
    } else if (/^>\s+/.test(line)) {
      segments.push({ type: "blockquote", text: line.replace(/^>\s+/, "").trim() });
    } else if (/^---+$/.test(line.trim())) {
      segments.push({ type: "hr", text: "" });
    } else {
      // Accumulate paragraph lines
      const paraLines: string[] = [line];
      while (i + 1 < lines.length && lines[i + 1].trim() !== "" && !/^[#>*\-\d]/.test(lines[i + 1])) {
        i++;
        paraLines.push(lines[i].trimEnd());
      }
      segments.push({ type: "paragraph", text: paraLines.join(" ").trim() });
    }
    i++;
  }

  return segments;
}

/** Clean inline markdown from a string */
function cleanInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

// ─── PDF Generation ───────────────────────────────────────────────────────────

export async function generateEbookPdf(opts: EbookPdfOptions): Promise<Buffer> {
  const {
    title,
    subtitle,
    author = "Dr. Pedram Shojai",
    chapters,
    globalCta,
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

    // ── Cover Page ────────────────────────────────────────────────────────────
    // Dark navy background
    doc.rect(0, 0, pageWidth, pageHeight).fill(DARK_NAVY);

    // Gold circle logo
    const logoX = pageWidth / 2;
    const logoY = 160;
    doc.circle(logoX, logoY, 36).stroke(GOLD);
    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor(GOLD)
      .text("UM", logoX - 13, logoY - 11);

    // Eyebrow text
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(GOLD)
      .text("THE URBAN MONK  ·  DR. PEDRAM SHOJAI", 0, logoY + 52, {
        align: "center",
        characterSpacing: 1.5,
      });

    // Title
    doc
      .font("Helvetica-Bold")
      .fontSize(28)
      .fillColor(WHITE)
      .text(title, 60, logoY + 90, {
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
        .fillColor("rgba(255,255,255,0.75)")
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
      .lineWidth(1.5)
      .stroke();

    let tocY = doc.y + 28;
    chapters.forEach((ch) => {
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(GOLD)
        .text(`${ch.chapterNumber}`, 80, tocY, { width: 24 });

      doc
        .font("Helvetica-Oblique")
        .fontSize(11)
        .fillColor(DARK_NAVY)
        .text(ch.title, 110, tocY, { width: contentWidth - 30 });

      tocY = doc.y + 4;

      doc
        .moveTo(80, tocY)
        .lineTo(pageWidth - 80, tocY)
        .strokeColor(GOLD_LIGHT)
        .lineWidth(0.5)
        .stroke();

      tocY += 8;
    });

    // ── Chapters ──────────────────────────────────────────────────────────────
    chapters.forEach((ch) => {
      doc.addPage();

      // Chapter label
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor(GOLD)
        .text(`CHAPTER ${ch.chapterNumber}`, 80, 72, { characterSpacing: 2 });

      // Chapter title
      doc
        .font("Helvetica-Bold")
        .fontSize(22)
        .fillColor(DARK_NAVY)
        .text(ch.title, 80, 90, { width: contentWidth });

      // Divider
      doc
        .moveTo(80, doc.y + 12)
        .lineTo(pageWidth - 80, doc.y + 12)
        .strokeColor(GOLD_LIGHT)
        .lineWidth(1.5)
        .stroke();

      doc.moveDown(1.5);

      // Chapter body — parse markdown into segments
      const segments = parseMarkdown(ch.content || "");

      segments.forEach((seg) => {
        if (doc.y > pageHeight - 120) {
          doc.addPage();
        }

        const cleanText = cleanInline(seg.text);

        switch (seg.type) {
          case "h2":
            doc.moveDown(0.5);
            doc
              .font("Helvetica-Bold")
              .fontSize(15)
              .fillColor(DARK_NAVY)
              .text(cleanText, 80, doc.y, { width: contentWidth });
            doc.moveDown(0.3);
            break;

          case "h3":
            doc.moveDown(0.4);
            doc
              .font("Helvetica-Bold")
              .fontSize(12)
              .fillColor(DARK_NAVY)
              .text(cleanText, 80, doc.y, { width: contentWidth });
            doc.moveDown(0.2);
            break;

          case "bullet":
            doc
              .font("Helvetica")
              .fontSize(11)
              .fillColor(BODY_TEXT)
              .text(`• ${cleanText}`, 88, doc.y, {
                width: contentWidth - 8,
                lineGap: 3,
              });
            doc.moveDown(0.2);
            break;

          case "blockquote":
            doc.moveDown(0.3);
            // Gold left bar
            doc
              .rect(80, doc.y, 3, 40)
              .fill(GOLD);
            doc
              .font("Helvetica-Oblique")
              .fontSize(11)
              .fillColor("#3a3a3a")
              .text(cleanText, 92, doc.y - 40, {
                width: contentWidth - 12,
                lineGap: 3,
              });
            doc.moveDown(0.5);
            break;

          case "hr":
            doc.moveDown(0.5);
            doc
              .moveTo(80, doc.y)
              .lineTo(pageWidth - 80, doc.y)
              .strokeColor(GOLD_LIGHT)
              .lineWidth(0.5)
              .stroke();
            doc.moveDown(0.5);
            break;

          case "paragraph":
          default:
            doc
              .font("Helvetica")
              .fontSize(11)
              .fillColor(BODY_TEXT)
              .text(cleanText, 80, doc.y, {
                width: contentWidth,
                align: "justify",
                lineGap: 3,
              });
            doc.moveDown(0.6);
            break;
        }
      });

      // Chapter CTA box
      if (ch.ctaText) {
        if (doc.y > pageHeight - 180) doc.addPage();
        doc.moveDown(1);

        const ctaBoxY = doc.y;
        const ctaBoxHeight = ch.ctaUrl ? 90 : 70;
        doc.rect(80, ctaBoxY, contentWidth, ctaBoxHeight).fill(DARK_NAVY);

        doc
          .font("Helvetica-Oblique")
          .fontSize(11)
          .fillColor(WHITE)
          .fillOpacity(0.9)
          .text(ch.ctaText, 100, ctaBoxY + 16, {
            width: contentWidth - 40,
            align: "center",
          });

        if (ch.ctaUrl) {
          doc
            .font("Helvetica-Bold")
            .fontSize(10)
            .fillColor(GOLD)
            .text(ch.ctaLabel || "Learn More →", 100, doc.y + 8, {
              width: contentWidth - 40,
              align: "center",
              link: ch.ctaUrl,
            });
        }

        doc.fillOpacity(1);
      }
    });

    // ── Back Cover ────────────────────────────────────────────────────────────
    if (globalCta) {
      doc.addPage();
      doc.rect(0, 0, pageWidth, pageHeight).fill(DARK_NAVY);

      // Gold circle logo
      const bcLogoX = pageWidth / 2;
      const bcLogoY = pageHeight / 2 - 140;
      doc.circle(bcLogoX, bcLogoY, 32).stroke(GOLD);
      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor(GOLD)
        .text("UM", bcLogoX - 11, bcLogoY - 10);

      doc
        .font("Helvetica-Bold")
        .fontSize(24)
        .fillColor(WHITE)
        .text("Ready to Go Deeper?", 60, bcLogoY + 50, {
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
        const btnLabel = globalCta.label || "Join the Urban Monk Academy →";
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
