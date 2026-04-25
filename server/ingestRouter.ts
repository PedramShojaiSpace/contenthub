/**
 * Ingest Router — handles POST /api/ingest/research-report
 *
 * Accepts research reports pushed from external apps (e.g. Upstream Gut Health
 * Curriculum at learn.theurbanmonk.com). Validates the shared INGEST_SECRET,
 * saves the report to ingest_reports, and creates a matching ContentItem in the
 * Command Center so the report appears immediately in the Kanban board.
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

// ── Platform mapping ──────────────────────────────────────────────────────────

const formatToPlatform: Record<string, "blog" | "meta" | "linkedin" | "x" | "youtube" | "all"> = {
  blog: "blog",
  social: "meta",
  email: "all",
  summary: "all",
  raw_report: "all",
};

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

    // 3. Create a ContentItem in the Command Center (lands in "idea" status)
    const platform = formatToPlatform[body.format] ?? "all";
    const [contentResult] = await db.insert(contentItems).values({
      title: body.title,
      rawIdea: `[Ingest: ${body.source}] ${body.topic}`,
      platform,
      status: "idea",
      textContent: body.generatedContent ?? body.narrativeHtml,
      notes: [
        `Source: ${body.source}`,
        `Topic: ${body.topic}`,
        `Format: ${body.format}`,
        body.wordCount ? `Word count: ${body.wordCount}` : null,
        body.citationCount ? `Citations: ${body.citationCount}` : null,
        body.tags?.length ? `Tags: ${body.tags.join(", ")}` : null,
      ].filter(Boolean).join("\n"),
      ctaBlockLabel: "upstream-gut-health",
    });

    const contentItemId = (contentResult as any).insertId as number;

    // 4. Save the full ingest report record
    const [ingestResult] = await db.insert(ingestReports).values({
      source: body.source,
      topic: body.topic,
      title: body.title,
      narrativeHtml: body.narrativeHtml,
      wordCount: body.wordCount ?? 0,
      citationCount: body.citationCount ?? 0,
      format: body.format,
      generatedContent: body.generatedContent ?? null,
      pubmedCitations: body.pubmedCitations ? JSON.stringify(body.pubmedCitations) : null,
      tags: body.tags ? JSON.stringify(body.tags) : null,
      contentItemId,
      originalCreatedAt: body.createdAt ? new Date(body.createdAt) : new Date(),
    });

    const ingestId = (ingestResult as any).insertId as number;

    console.log(`[ingest] Received report "${body.title}" from ${body.source} → contentItemId=${contentItemId}, ingestId=${ingestId}`);

    return res.status(200).json({
      ok: true,
      ingestId,
      contentItemId,
      message: `Report "${body.title}" ingested successfully. ContentItem #${contentItemId} created in Command Center.`,
    });

  } catch (err) {
    console.error("[ingest] Error processing research report:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
}
