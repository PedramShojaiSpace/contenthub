/**
 * Ingest Router — handles POST /api/ingest/research-report
 *
 * Accepts research reports pushed from external apps (e.g. Upstream Gut Health
 * Curriculum at learn.theurbanmonk.com). Validates the shared INGEST_SECRET,
 * saves the report to ingest_reports, and creates ContentItems in the Command
 * Center so the report appears immediately in the Kanban board.
 *
 * MULTI-PLATFORM PARSING:
 * When format="social" and generatedContent contains a "5-POST SOCIAL MEDIA
 * CONTENT PACK" (or similar structured markdown), the handler parses each
 * ## POST N section and extracts:
 *   - TWITTER/X VERSION  → platform "x"
 *   - INSTAGRAM VERSION  → platform "meta"
 *   - LINKEDIN VERSION   → platform "linkedin"
 *   - FACEBOOK VERSION   → platform "meta"
 *   - EMAIL VERSION      → platform "all"
 * Each parsed piece becomes its own ContentItem in the Kanban.
 */

import { Request, Response } from "express";
import { getDb } from "./db";
import { ingestReports, contentItems } from "../drizzle/schema";
import { ENV } from "./_core/env";

// ── Payload types ─────────────────────────────────────────────────────────────

interface PubmedCitation {
  num: number;
  pmid: string;
  title: string;
  authors: string;
  journal: string;
  year: string;
  url: string;
}

interface IngestPayload {
  secret: string;
  source: string;
  topic: string;
  title: string;
  narrativeHtml: string;
  wordCount?: number;
  citationCount?: number;
  format: "blog" | "social" | "email" | "summary" | "raw_report";
  generatedContent?: string;
  pubmedCitations?: PubmedCitation[];
  tags?: string[];
  createdAt?: string;
}

// ── Parsed content piece ──────────────────────────────────────────────────────

interface ParsedPiece {
  platform: "x" | "meta" | "linkedin" | "youtube" | "tiktok" | "blog" | "all";
  postType: string;       // e.g. "Hook/Stat Post", "Myth-Busting Post"
  postNumber: number;
  textContent: string;
}

// ── Multi-platform content pack parser ────────────────────────────────────────

/**
 * Detects whether generatedContent is a structured multi-platform content pack
 * (markdown with ## POST N sections and platform sub-headers).
 */
function isMultiPlatformPack(content: string): boolean {
  return /##\s+POST\s+\d+/i.test(content) &&
    /\*\*(TWITTER\/X|INSTAGRAM|LINKEDIN|FACEBOOK|EMAIL)\s+VERSION/i.test(content);
}

/**
 * Maps platform header keywords to our platform enum values.
 */
function headerToPlatform(header: string): ParsedPiece["platform"] {
  const h = header.toUpperCase();
  if (h.includes("TWITTER") || h.includes("X VERSION") || h.includes("TWITTER/X")) return "x";
  if (h.includes("INSTAGRAM")) return "meta";
  if (h.includes("LINKEDIN")) return "linkedin";
  if (h.includes("FACEBOOK")) return "meta";
  if (h.includes("TIKTOK")) return "tiktok";
  if (h.includes("YOUTUBE")) return "youtube";
  if (h.includes("EMAIL")) return "all";
  return "all";
}

/**
 * Parses a multi-platform content pack markdown into individual pieces.
 *
 * Expected structure:
 *   ## POST 1: Hook/Stat Post
 *   **TWITTER/X VERSION (N characters):**
 *   <text>
 *   **INSTAGRAM VERSION:**
 *   <text>
 *   #hashtags
 *   ---
 *   ## POST 2: ...
 */
function parseMultiPlatformPack(content: string, baseTitle: string): ParsedPiece[] {
  const pieces: ParsedPiece[] = [];

  // Split on ## POST N headers
  const postSections = content.split(/(?=##\s+POST\s+\d+)/i).filter(Boolean);

  for (const section of postSections) {
    // Extract post number and type from header line
    const headerMatch = section.match(/##\s+POST\s+(\d+)(?:\s*:\s*(.+?))?(?:\n|$)/i);
    if (!headerMatch) continue;

    const postNumber = parseInt(headerMatch[1], 10);
    const postType = (headerMatch[2] ?? "").trim().replace(/\*+/g, "").trim() || `Post ${postNumber}`;

    // Split section on **PLATFORM VERSION (optional chars):** markers
    // Note: the colon is INSIDE the ** markers: **TWITTER/X VERSION (279 characters):**
    // So we match **...:**, then filter to only VERSION-containing groups
    const boldMarkerRe = /\*\*([^*]+)\*\*/gi;
    const allBoldMatches = Array.from(section.matchAll(boldMarkerRe));
    const platformMatches = allBoldMatches.filter((m) => /VERSION/i.test(m[1]));

    for (let i = 0; i < platformMatches.length; i++) {
      const match = platformMatches[i];
      const platformHeader = match[1].trim();
      const platform = headerToPlatform(platformHeader);

      // Content starts after this match, ends before the next match (or end of section)
      const contentStart = (match.index ?? 0) + match[0].length;
      const contentEnd = i + 1 < platformMatches.length
        ? (platformMatches[i + 1].index ?? section.length)
        : section.length;

      let text = section.slice(contentStart, contentEnd).trim();

      // Remove trailing --- dividers
      text = text.replace(/\n---\s*$/, "").trim();

      if (!text) continue;

      // Avoid duplicate meta entries: if we already have a "meta" piece for this
      // post number from an Instagram version, skip a Facebook version (or vice versa).
      const alreadyHasPlatform = pieces.some(
        (p) => p.postNumber === postNumber && p.platform === platform
      );
      if (alreadyHasPlatform) continue;

      pieces.push({ platform, postType, postNumber, textContent: text });
    }
  }

  return pieces;
}

// ── Topic-aware image prompt ──────────────────────────────────────────────────

/**
 * Generates a concise, topic-relevant image prompt from the report topic and tags.
 * Used to seed imagePrompt on ContentItems so "Regenerate Image" produces relevant visuals.
 */
function buildImagePrompt(topic: string, tags: string[], postType: string): string {
  const topicLower = topic.toLowerCase();
  const tagStr = tags.slice(0, 4).join(", ");

  // Build a descriptive subject from topic + tags
  let subject = topic;
  if (tagStr) subject = `${topic} — ${tagStr}`;

  // Post-type emotional tone
  let tone = "";
  if (/myth|busting|truth/i.test(postType)) tone = "thought-provoking, myth-busting";
  else if (/tip|practical|hack/i.test(postType)) tone = "actionable, practical wellness";
  else if (/quote|insight/i.test(postType)) tone = "contemplative, wisdom-focused";
  else if (/cta|call.to.action/i.test(postType)) tone = "inviting, hopeful, transformative";
  else tone = "educational, health-focused";

  return `${tone} image representing: ${subject}. Anonymous human figure or symbolic visual metaphor. No text overlay. Warm, natural light. Wellness editorial aesthetic.`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function handleIngestResearchReport(req: Request, res: Response) {
  try {
    const body = req.body as IngestPayload;

    // 1. Validate secret
    const expectedSecret = ENV.ingestSecret;
    if (!expectedSecret) {
      console.error("[ingest] INGEST_SECRET is not configured on this server");
      return res.status(500).json({ ok: false, error: "Ingest not configured" });
    }
    if (!body.secret || body.secret !== expectedSecret) {
      console.warn("[ingest] Invalid secret from", req.ip);
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    // 2. Validate required fields
    const required = ["source", "topic", "title", "narrativeHtml", "format"] as const;
    for (const field of required) {
      if (!body[field]) {
        return res.status(400).json({ ok: false, error: `Missing required field: ${field}` });
      }
    }

    const validFormats = ["blog", "social", "email", "summary", "raw_report"];
    if (!validFormats.includes(body.format)) {
      return res.status(400).json({ ok: false, error: `Invalid format. Must be one of: ${validFormats.join(", ")}` });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ ok: false, error: "Database unavailable" });
    }

    const tags: string[] = body.tags ?? [];
    const generatedContent = body.generatedContent ?? "";

    // 3. Decide whether to parse as multi-platform pack or single item
    const contentItemIds: number[] = [];

    if (body.format === "social" && generatedContent && isMultiPlatformPack(generatedContent)) {
      // ── Multi-platform pack: parse and create one ContentItem per platform per post ──
      const pieces = parseMultiPlatformPack(generatedContent, body.title);

      if (pieces.length === 0) {
        // Fallback: treat as single item if parsing yields nothing
        const [r] = await db.insert(contentItems).values({
          title: body.title,
          rawIdea: `[Ingest: ${body.source}] ${body.topic}`,
          platform: "meta",
          status: "idea",
          textContent: generatedContent || body.narrativeHtml,
          imagePrompt: buildImagePrompt(body.topic, tags, "social"),
          notes: buildNotes(body, tags),
          ctaBlockLabel: "upstream-gut-health",
        });
        contentItemIds.push((r as any).insertId as number);
      } else {
        for (const piece of pieces) {
          const itemTitle = `${body.title} — ${piece.postType} [${piece.platform.toUpperCase()}]`;
          const [r] = await db.insert(contentItems).values({
            title: itemTitle,
            rawIdea: `[Ingest: ${body.source}] ${body.topic}`,
            platform: piece.platform,
            status: "idea",
            textContent: piece.textContent,
            imagePrompt: buildImagePrompt(body.topic, tags, piece.postType),
            notes: buildNotes(body, tags, `Post ${piece.postNumber}: ${piece.postType}`),
            ctaBlockLabel: "upstream-gut-health",
          });
          contentItemIds.push((r as any).insertId as number);
        }
      }
    } else {
      // ── Single-format content: create one ContentItem ──
      const formatToPlatform: Record<string, "blog" | "meta" | "linkedin" | "x" | "youtube" | "all"> = {
        blog: "blog",
        social: "meta",
        email: "all",
        summary: "all",
        raw_report: "all",
      };
      const platform = formatToPlatform[body.format] ?? "all";
      const [r] = await db.insert(contentItems).values({
        title: body.title,
        rawIdea: `[Ingest: ${body.source}] ${body.topic}`,
        platform,
        status: "idea",
        textContent: generatedContent || body.narrativeHtml,
        imagePrompt: buildImagePrompt(body.topic, tags, body.format),
        notes: buildNotes(body, tags),
        ctaBlockLabel: "upstream-gut-health",
      });
      contentItemIds.push((r as any).insertId as number);
    }

    // 4. Save the full ingest report record (linked to first ContentItem for backward compat)
    const [ingestResult] = await db.insert(ingestReports).values({
      source: body.source,
      topic: body.topic,
      title: body.title,
      narrativeHtml: body.narrativeHtml,
      wordCount: body.wordCount ?? 0,
      citationCount: body.citationCount ?? 0,
      format: body.format,
      generatedContent: generatedContent || null,
      pubmedCitations: body.pubmedCitations ? JSON.stringify(body.pubmedCitations) : null,
      tags: tags.length ? JSON.stringify(tags) : null,
      contentItemId: contentItemIds[0] ?? null,
      originalCreatedAt: body.createdAt ? new Date(body.createdAt) : new Date(),
    });

    const ingestId = (ingestResult as any).insertId as number;

    console.log(
      `[ingest] Received "${body.title}" from ${body.source} → ` +
      `ingestId=${ingestId}, contentItems=[${contentItemIds.join(", ")}] (${contentItemIds.length} created)`
    );

    return res.status(200).json({
      ok: true,
      ingestId,
      contentItemIds,
      contentItemCount: contentItemIds.length,
      message: `Report "${body.title}" ingested successfully. ${contentItemIds.length} ContentItem(s) created in Command Center.`,
    });

  } catch (err) {
    console.error("[ingest] Error processing research report:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildNotes(body: IngestPayload, tags: string[], postLabel?: string): string {
  return [
    `Source: ${body.source}`,
    `Topic: ${body.topic}`,
    `Format: ${body.format}`,
    postLabel ? `Post: ${postLabel}` : null,
    body.wordCount ? `Word count: ${body.wordCount}` : null,
    body.citationCount ? `Citations: ${body.citationCount}` : null,
    tags.length ? `Tags: ${tags.join(", ")}` : null,
  ].filter(Boolean).join("\n");
}
