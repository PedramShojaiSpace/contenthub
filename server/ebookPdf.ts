/**
 * ebookPdf.ts — Branded PDF generation for Urban Monk e-books
 *
 * Uses WeasyPrint (system-installed Python PDF renderer) via child_process.
 * WeasyPrint renders the same rich HTML template as before — cover page, TOC,
 * chapters with CTAs, back cover — without requiring a headless browser.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { marked } from "marked";

const execFileAsync = promisify(execFile);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PdfChapter {
  chapterNumber: number;
  title: string;
  content: string; // Markdown
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

// ─── HTML Template ────────────────────────────────────────────────────────────

function buildHtml(opts: EbookPdfOptions): string {
  const {
    title,
    subtitle,
    author = "Dr. Pedram Shojai",
    chapters,
    globalCta,
  } = opts;

  // Convert each chapter's Markdown to HTML
  const chaptersHtml = chapters
    .map((ch) => {
      const contentHtml = marked.parse(ch.content || "") as string;

      const ctaHtml =
        ch.ctaText
          ? `
        <div class="chapter-cta">
          <div class="chapter-cta-inner">
            <p class="chapter-cta-text">${escapeHtml(ch.ctaText)}</p>
            ${
              ch.ctaUrl
                ? `<a class="chapter-cta-btn" href="${escapeHtml(ch.ctaUrl)}">${escapeHtml(ch.ctaLabel || "Learn More →")}</a>`
                : ""
            }
          </div>
        </div>`
          : "";

      return `
      <div class="chapter page-break">
        <div class="chapter-header">
          <span class="chapter-label">Chapter ${ch.chapterNumber}</span>
          <h2 class="chapter-title">${escapeHtml(ch.title)}</h2>
        </div>
        <div class="chapter-body">${contentHtml}</div>
        ${ctaHtml}
      </div>`;
    })
    .join("\n");

  // Table of contents
  const tocHtml = chapters
    .map(
      (ch) =>
        `<div class="toc-row">
          <span class="toc-num">${ch.chapterNumber}</span>
          <span class="toc-entry">${escapeHtml(ch.title)}</span>
        </div>`
    )
    .join("\n");

  // Back cover CTA
  const backCoverHtml = globalCta
    ? `
    <div class="back-cover page-break">
      <div class="back-cover-inner">
        <div class="back-logo">UM</div>
        <h2 class="back-cover-title">Ready to Go Deeper?</h2>
        <p class="back-cover-text">${escapeHtml(globalCta.text)}</p>
        ${
          globalCta.url
            ? `<a class="back-cover-btn" href="${escapeHtml(globalCta.url)}">${escapeHtml(globalCta.label || "Join the Urban Monk Academy →")}</a>`
            : ""
        }
        <p class="back-cover-author">— ${escapeHtml(author)}</p>
      </div>
    </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      size: A4;
      margin: 0;
    }
    @page chapter {
      size: A4;
      margin: 72pt 80pt 60pt 80pt;
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: 11pt; }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      color: #1a1a1a;
      background: #fff;
      line-height: 1.75;
    }

    .page-break { page-break-before: always; }

    /* ── Cover Page ── */
    .cover {
      width: 210mm;
      height: 297mm;
      background: #1a1a2e;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px 60px;
      text-align: center;
      position: relative;
      page-break-after: always;
    }
    .cover-logo {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      border: 2px solid rgba(212,175,55,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: Georgia, serif;
      font-size: 22pt;
      font-weight: bold;
      color: #d4af37;
      margin: 0 auto 40px;
    }
    .cover-eyebrow {
      font-size: 9pt;
      letter-spacing: 0.25em;
      text-transform: uppercase;
      color: rgba(212,175,55,0.8);
      margin-bottom: 20px;
    }
    .cover-title {
      font-size: 28pt;
      font-weight: bold;
      color: #ffffff;
      line-height: 1.2;
      margin-bottom: 20px;
      max-width: 500px;
      margin-left: auto;
      margin-right: auto;
    }
    .cover-divider {
      width: 60px;
      height: 2px;
      background: #d4af37;
      margin: 24px auto;
    }
    .cover-subtitle {
      font-size: 13pt;
      color: rgba(255,255,255,0.75);
      font-style: italic;
      margin-bottom: 48px;
      max-width: 420px;
      margin-left: auto;
      margin-right: auto;
    }
    .cover-author {
      font-size: 11pt;
      color: rgba(212,175,55,0.9);
      letter-spacing: 0.1em;
    }
    .cover-footer {
      margin-top: 60px;
      font-size: 8pt;
      color: rgba(255,255,255,0.3);
      letter-spacing: 0.15em;
      text-transform: uppercase;
    }

    /* ── Table of Contents ── */
    .toc {
      padding: 80px 80px 60px;
      page-break-after: always;
    }
    .toc-heading {
      font-size: 10pt;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #c4a020;
      margin-bottom: 8px;
    }
    .toc-title {
      font-size: 22pt;
      font-weight: bold;
      color: #1a1a2e;
      margin-bottom: 40px;
      padding-bottom: 16px;
      border-bottom: 2px solid #f0e6c0;
    }
    .toc-row {
      display: flex;
      align-items: baseline;
      gap: 16px;
      padding: 10px 0;
      border-bottom: 1px solid #f5f0e8;
    }
    .toc-num {
      font-size: 9pt;
      color: #c4a020;
      font-weight: bold;
      min-width: 24px;
    }
    .toc-entry {
      font-size: 11pt;
      color: #1a1a2e;
      font-style: italic;
    }

    /* ── Chapter ── */
    .chapter {
      padding: 72px 80px 60px;
    }
    .chapter-header {
      margin-bottom: 36px;
      padding-bottom: 20px;
      border-bottom: 2px solid #f0e6c0;
    }
    .chapter-label {
      display: block;
      font-size: 8.5pt;
      letter-spacing: 0.25em;
      text-transform: uppercase;
      color: #c4a020;
      margin-bottom: 8px;
    }
    .chapter-title {
      font-size: 22pt;
      font-weight: bold;
      color: #1a1a2e;
      line-height: 1.2;
    }

    /* ── Chapter Body ── */
    .chapter-body h1, .chapter-body h2, .chapter-body h3 {
      color: #1a1a2e;
      margin-top: 28px;
      margin-bottom: 12px;
      line-height: 1.3;
    }
    .chapter-body h2 { font-size: 15pt; }
    .chapter-body h3 { font-size: 12pt; }
    .chapter-body p {
      margin-bottom: 14px;
      text-align: justify;
    }
    .chapter-body ul, .chapter-body ol {
      margin: 12px 0 16px 28px;
    }
    .chapter-body li { margin-bottom: 6px; }
    .chapter-body blockquote {
      margin: 20px 0;
      padding: 16px 24px;
      border-left: 4px solid #d4af37;
      background: #fdf8ec;
      font-style: italic;
      color: #3a3a3a;
    }
    .chapter-body strong { color: #1a1a2e; }
    .chapter-body em { color: #4a4a4a; }
    .chapter-body hr {
      border: none;
      border-top: 1px solid #e8dfc8;
      margin: 24px 0;
    }

    /* ── Chapter CTA ── */
    .chapter-cta { margin-top: 40px; }
    .chapter-cta-inner {
      background: #1a1a2e;
      border-radius: 8px;
      padding: 28px 32px;
      text-align: center;
    }
    .chapter-cta-text {
      color: rgba(255,255,255,0.9);
      font-size: 11pt;
      line-height: 1.6;
      margin-bottom: 16px;
      font-style: italic;
    }
    .chapter-cta-btn {
      display: inline-block;
      background: #d4af37;
      color: #1a1a2e;
      text-decoration: none;
      font-weight: bold;
      font-size: 10pt;
      letter-spacing: 0.05em;
      padding: 10px 28px;
      border-radius: 4px;
    }

    /* ── Back Cover ── */
    .back-cover {
      width: 210mm;
      height: 297mm;
      background: #1a1a2e;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 80px 60px;
    }
    .back-cover-inner {
      text-align: center;
      max-width: 520px;
      margin: 0 auto;
    }
    .back-logo {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      border: 2px solid rgba(212,175,55,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: Georgia, serif;
      font-size: 20pt;
      font-weight: bold;
      color: #d4af37;
      margin: 0 auto 32px;
    }
    .back-cover-title {
      font-size: 24pt;
      font-weight: bold;
      color: #ffffff;
      margin-bottom: 20px;
    }
    .back-cover-text {
      font-size: 12pt;
      color: rgba(255,255,255,0.8);
      line-height: 1.7;
      margin-bottom: 32px;
      font-style: italic;
    }
    .back-cover-btn {
      display: inline-block;
      background: #d4af37;
      color: #1a1a2e;
      text-decoration: none;
      font-weight: bold;
      font-size: 11pt;
      letter-spacing: 0.05em;
      padding: 14px 36px;
      border-radius: 4px;
      margin-bottom: 32px;
    }
    .back-cover-author {
      font-size: 10pt;
      color: rgba(212,175,55,0.7);
      letter-spacing: 0.1em;
      margin-top: 16px;
    }
  </style>
</head>
<body>

  <!-- Cover Page -->
  <div class="cover">
    <div class="cover-logo">UM</div>
    <p class="cover-eyebrow">The Urban Monk · Dr. Pedram Shojai</p>
    <h1 class="cover-title">${escapeHtml(title)}</h1>
    <div class="cover-divider"></div>
    ${subtitle ? `<p class="cover-subtitle">${escapeHtml(subtitle)}</p>` : ""}
    <p class="cover-author">${escapeHtml(author)}</p>
    <p class="cover-footer">theurbanmonk.com · Urban Monk Academy</p>
  </div>

  <!-- Table of Contents -->
  <div class="toc">
    <p class="toc-heading">Contents</p>
    <h2 class="toc-title">Table of Contents</h2>
    ${tocHtml}
  </div>

  <!-- Chapters -->
  ${chaptersHtml}

  <!-- Back Cover -->
  ${backCoverHtml}

</body>
</html>`;
}

// ─── PDF Generation via WeasyPrint ───────────────────────────────────────────

export async function generateEbookPdf(opts: EbookPdfOptions): Promise<Buffer> {
  const html = buildHtml(opts);

  // Write HTML to a temp file
  const suffix = Math.random().toString(36).substring(2, 8);
  const htmlPath = join(tmpdir(), `ebook-${suffix}.html`);
  const pdfPath = join(tmpdir(), `ebook-${suffix}.pdf`);

  try {
    await writeFile(htmlPath, html, "utf8");

    // Run WeasyPrint: weasyprint <input.html> <output.pdf>
    await execFileAsync("weasyprint", [htmlPath, pdfPath], {
      timeout: 120_000, // 2 minutes max
      env: { ...process.env, HOME: "/tmp" }, // WeasyPrint needs HOME for font cache
    });

    const pdfBuffer = await readFile(pdfPath);
    return pdfBuffer;
  } finally {
    // Clean up temp files (ignore errors)
    unlink(htmlPath).catch(() => {});
    unlink(pdfPath).catch(() => {});
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
