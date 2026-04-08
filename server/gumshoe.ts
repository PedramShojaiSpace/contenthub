/**
 * Gumshoe AI Report Parser
 *
 * Handles ingestion of two Gumshoe export formats:
 *   1. export.json  — full report with personas, queries, and LLM model answers
 *   2. questions_export.csv — structured query rows with topic tag columns
 *
 * The two files are merged on query ID (gumshoeQueryId) to produce enriched
 * ResearchQuery rows that include both competitor mentions and topic tags.
 */

import { desc, eq, sql } from "drizzle-orm";
import {
  InsertResearchCompetitorMention,
  InsertResearchQuery,
  InsertResearchReport,
  researchCompetitorMentions,
  researchQueries,
  researchReports,
} from "../drizzle/schema";
import { getDb } from "./db";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GumshoeAnswer {
  model: string;
  mentions: Array<{
    rank: number;
    brand: string;
    reason: string;
  }>;
  citations: Array<{ url: string; domain: string }>;
}

interface GumshoeQuestion {
  query: string;
  topics: string[];
  answers: GumshoeAnswer[];
}

interface GumshoePersona {
  name: string;
  description: string;
  questions: GumshoeQuestion[];
}

interface GumshoeJsonExport {
  reportId: number;
  reportName: string;
  reportFocus: string;
  reportDescription: string;
  reportCreatedAt: string;
  reportRunId: number;
  personas: GumshoePersona[];
}

interface CsvRow {
  id: number;
  persona: string;
  query: string;
  topicTags: string[]; // parsed from X-marked columns
}

// CSV topic tag column names (in order, matching the CSV header)
const TOPIC_TAG_COLUMNS = [
  "t-Evidence-Based Methods",
  "t-Stress Relief Outcomes",
  "t-Flexible Learning Format",
  "t-Program Depth",
  "t-Instructor Credibility",
  "t-Community Support",
  "t-Holistic Approach",
  "t-Practical Daily Use",
  "t-Time Commitment",
  "t-Price Value",
];

const URBAN_MONK_BRAND_NAMES = [
  "urban monk",
  "pedram shojai",
  "the urban monk",
  "urban monk academy",
];

// ─── CSV Parser ───────────────────────────────────────────────────────────────

export function parseCsv(csvText: string): CsvRow[] {
  const lines = csvText.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]);

  // Find indices of topic tag columns
  const tagIndices: Array<{ col: string; idx: number }> = TOPIC_TAG_COLUMNS.map((col) => ({
    col,
    idx: header.indexOf(col),
  })).filter((t) => t.idx >= 0);

  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    if (cells.length < 4) continue;

    const id = parseInt(cells[0] ?? "0", 10);
    const persona = (cells[1] ?? "").replace(/^"|"$/g, "").trim();
    const query = (cells[2] ?? "").replace(/^"|"$/g, "").trim();

    const topicTags: string[] = [];
    for (const { col, idx } of tagIndices) {
      const val = (cells[idx] ?? "").trim();
      if (val === "X" || val === "x") {
        // Strip the "t-" prefix for display
        topicTags.push(col.replace(/^t-/, ""));
      }
    }

    if (query) {
      rows.push({ id, persona, query, topicTags });
    }
  }

  return rows;
}

/** Simple CSV line parser that handles quoted fields */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ─── JSON Parser ──────────────────────────────────────────────────────────────

export function parseGumshoeJson(jsonText: string): GumshoeJsonExport {
  return JSON.parse(jsonText) as GumshoeJsonExport;
}

/** Check if any mention in any answer is for Urban Monk */
function checkUrbanMonkMentioned(answers: GumshoeAnswer[]): boolean {
  for (const answer of answers) {
    for (const mention of answer.mentions) {
      const brandLower = mention.brand.toLowerCase();
      if (URBAN_MONK_BRAND_NAMES.some((n) => brandLower.includes(n))) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Calculate gap score (0–10):
 * Number of distinct LLM models that answered the query WITHOUT mentioning Urban Monk.
 * Higher = bigger opportunity.
 */
function calcGapScore(answers: GumshoeAnswer[]): number {
  if (!answers || answers.length === 0) return 0;
  const modelsWithoutUM = answers.filter((a) => {
    const mentionsUM = a.mentions.some((m) =>
      URBAN_MONK_BRAND_NAMES.some((n) => m.brand.toLowerCase().includes(n))
    );
    return !mentionsUM;
  });
  return Math.min(10, modelsWithoutUM.length);
}

// ─── Ingestion ────────────────────────────────────────────────────────────────

export interface IngestResult {
  reportId: number;
  totalQueries: number;
  totalPersonas: number;
  totalCompetitorMentions: number;
  gapQueries: number;
}

/**
 * Main ingestion function.
 * Parses both files, merges data, and writes to the database.
 * Returns a summary of what was ingested.
 */
export async function ingestGumshoeReport(
  jsonText: string,
  csvText: string,
  weekLabel: string
): Promise<IngestResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const report = parseGumshoeJson(jsonText);
  const csvRows = parseCsv(csvText);

  // Build a lookup map from CSV: gumshoeQueryId -> topicTags
  const csvTagMap = new Map<number, string[]>();
  for (const row of csvRows) {
    csvTagMap.set(row.id, row.topicTags);
  }

  // Count totals
  let totalQueries = 0;
  let totalCompetitorMentions = 0;
  let gapQueries = 0;

  // Insert report record
  const reportInsert: InsertResearchReport = {
    gumshoeReportId: report.reportId,
    reportName: report.reportName,
    reportFocus: report.reportFocus,
    reportDescription: report.reportDescription,
    weekLabel,
    totalQueries: 0,
    totalPersonas: report.personas?.length ?? 0,
    totalCompetitorMentions: 0,
  };

  await db.insert(researchReports).values(reportInsert);

  // Get the inserted report's auto-increment id
  const reportRows = await db
    .select()
    .from(researchReports)
    .orderBy(desc(researchReports.id))
    .limit(1);
  const dbReportId = reportRows[0]!.id;

  // Process each persona and their questions
  for (const persona of report.personas ?? []) {
    for (const question of persona.questions ?? []) {
      totalQueries++;

      // Find the matching CSV row by query text (fallback: no tags)
      const matchingCsvRow = csvRows.find(
        (r) => r.query.trim().toLowerCase() === question.query.trim().toLowerCase()
      );
      const topicTags = matchingCsvRow?.topicTags ?? question.topics ?? [];
      const gumshoeQueryId = matchingCsvRow?.id ?? null;

      const urbanMonkMentioned = checkUrbanMonkMentioned(question.answers ?? []);
      const gapScore = calcGapScore(question.answers ?? []);

      if (!urbanMonkMentioned) gapQueries++;

      const queryInsert: InsertResearchQuery = {
        reportId: dbReportId,
        gumshoeQueryId: gumshoeQueryId ?? undefined,
        personaName: persona.name,
        query: question.query,
        topicTags: JSON.stringify(topicTags),
        gapScore,
        urbanMonkMentioned: urbanMonkMentioned ? 1 : 0,
        status: "unused",
      };

      await db.insert(researchQueries).values(queryInsert);

      // Get the inserted query id
      const queryRows = await db
        .select()
        .from(researchQueries)
        .orderBy(desc(researchQueries.id))
        .limit(1);
      const dbQueryId = queryRows[0]!.id;

      // Insert competitor mentions
      for (const answer of question.answers ?? []) {
        for (const mention of answer.mentions ?? []) {
          const brandLower = mention.brand.toLowerCase();
          // Skip Urban Monk self-mentions
          if (URBAN_MONK_BRAND_NAMES.some((n) => brandLower.includes(n))) continue;

          totalCompetitorMentions++;

          const mentionInsert: InsertResearchCompetitorMention = {
            reportId: dbReportId,
            queryId: dbQueryId,
            brand: mention.brand,
            model: answer.model,
            rank: mention.rank,
            reason: mention.reason,
          };

          await db.insert(researchCompetitorMentions).values(mentionInsert);
        }
      }
    }
  }

  // Update report totals
  await db
    .update(researchReports)
    .set({
      totalQueries,
      totalCompetitorMentions,
    })
    .where(eq(researchReports.id, dbReportId));

  return {
    reportId: dbReportId,
    totalQueries,
    totalPersonas: report.personas?.length ?? 0,
    totalCompetitorMentions,
    gapQueries,
  };
}

// ─── Query Helpers ────────────────────────────────────────────────────────────

export async function listResearchReports() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(researchReports).orderBy(desc(researchReports.createdAt));
}

export async function getResearchReport(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(researchReports).where(eq(researchReports.id, id)).limit(1);
  return rows[0];
}

export async function listResearchQueriesByReport(reportId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(researchQueries)
    .where(eq(researchQueries.reportId, reportId))
    .orderBy(desc(researchQueries.gapScore));
}

/** Top gap queries across all reports — highest gap score first, unused only */
export async function getTopGapQueries(limit = 5) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(researchQueries)
    .where(eq(researchQueries.status, "unused"))
    .orderBy(desc(researchQueries.gapScore))
    .limit(limit);
}

/** Competitor leaderboard: brands ranked by total mention count */
export async function getCompetitorLeaderboard(reportId?: number, limit = 15) {
  const db = await getDb();
  if (!db) return [];

  // Use raw SQL for GROUP BY aggregation
  const query = reportId
    ? sql`SELECT brand, COUNT(*) as mentionCount, AVG(\`rank\`) as avgRank
          FROM research_competitor_mentions
          WHERE reportId = ${reportId}
          GROUP BY brand
          ORDER BY mentionCount DESC
          LIMIT ${limit}`
    : sql`SELECT brand, COUNT(*) as mentionCount, AVG(\`rank\`) as avgRank
          FROM research_competitor_mentions
          GROUP BY brand
          ORDER BY mentionCount DESC
          LIMIT ${limit}`;

  const rows = await db.execute(query);
  return (rows[0] as unknown) as Array<{ brand: string; mentionCount: number; avgRank: number }>;
}

/** All queries for a specific persona in a report */
export async function getPersonaQueries(reportId: number, personaName: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(researchQueries)
    .where(
      sql`${researchQueries.reportId} = ${reportId} AND ${researchQueries.personaName} = ${personaName}`
    )
    .orderBy(desc(researchQueries.gapScore));
}

/** Competitor mentions for a specific query */
export async function getQueryCompetitors(queryId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(researchCompetitorMentions)
    .where(eq(researchCompetitorMentions.queryId, queryId))
    .orderBy(researchCompetitorMentions.rank);
}

/** Mark a gap query as in_progress and link to a content item */
export async function linkQueryToContentItem(queryId: number, contentItemId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(researchQueries)
    .set({ status: "in_progress", contentItemId })
    .where(eq(researchQueries.id, queryId));
}

/** Mark a gap query as published */
export async function markQueryPublished(queryId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(researchQueries)
    .set({ status: "published" })
    .where(eq(researchQueries.id, queryId));
}
