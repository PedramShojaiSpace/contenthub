/**
 * Script Factory v2 — shared pure helpers.
 *
 * Extracted into their own module so they can be unit-tested without pulling in
 * the tRPC router, the database, or any network client. Everything here is
 * deterministic and side-effect free.
 */

/**
 * ISO-8601 week label, e.g. "2026-W31".
 *
 * Uses the ISO week-numbering year (not the calendar year), so the last days of
 * December can correctly belong to week 1 of the following year — matching the
 * ISO standard rather than a naive `getFullYear()` + week arithmetic.
 */
export function isoWeekLabel(date: Date = new Date()): string {
  // Work on a UTC copy so local timezone can never shift the week boundary.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // ISO weeks run Monday(1)–Sunday(7); JS getUTCDay() gives Sunday as 0.
  const dayNum = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  // Shift to the Thursday of this week — the ISO year is whichever year owns it.
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${isoYear}-W${String(weekNo).padStart(2, "0")}`;
}

/**
 * Short random batch id (fits `varchar(32)`), used to group ideas generated in
 * one run. Prefixed so it is recognizable in the database.
 */
export function makeBatchId(now: Date = new Date()): string {
  const stamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 8);
  return `b${stamp}_${rand}`;
}

/**
 * Safely parse a JSON-in-TEXT column. Returns `null` on any malformed value
 * instead of throwing — several analog-data columns are hand-edited and cannot
 * be assumed well-formed.
 */
export function safeJsonParse<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Normalize a value that came out of a MySQL `JSON` column.
 *
 * The `mysql2` driver returns JSON columns as raw strings, so a Drizzle column
 * declared `json(...).$type<string[]>()` type-checks as an array at compile time
 * but arrives as a string at runtime. Passing that string onward produces
 * validation errors far from the cause (e.g. "expected array, received string"),
 * so every read path must funnel through here.
 *
 * Accepts already-parsed values untouched, and falls back to `fallback` on any
 * malformed input rather than throwing.
 */
export function parseJsonColumn<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "string") return value as T;
  try {
    const parsed = JSON.parse(value);
    return (parsed === null ? fallback : parsed) as T;
  } catch {
    return fallback;
  }
}

/** The shape of `analog_data_entries.extractedInsights` once parsed. */
export interface ExtractedInsights {
  hooks?: string[];
  painPoints?: string[];
  proofElements?: string[];
  objectionHandlers?: string[];
  ctas?: string[];
  keyPhrases?: string[];
  conversionMechanisms?: string[];
}

/**
 * Normalize an arbitrary phrase into something VidIQ will accept as a keyword:
 * alphanumerics and spaces only, collapsed whitespace, at most `maxWords` words.
 */
export function normalizeKeyword(phrase: string, maxWords = 6): string {
  return phrase
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords)
    .join(" ")
    .toLowerCase();
}

/**
 * Derive VidIQ seed keywords from the operator's own data.
 *
 * Priority order is fixed by spec:
 *   1. tags on analog entries
 *   2. top pain-point phrases from extractedInsights
 *   3. persona topQuestions
 *
 * Deduplicated case-insensitively, and anything shorter than 3 characters or
 * longer than 60 is dropped (VidIQ returns noise for both extremes).
 */
export function deriveSeedKeywords(
  analogEntries: { tags?: string | null; extractedInsights?: string | null }[],
  personaTopQuestions: string[] = [],
  maxSeeds = 5
): string[] {
  const seeds: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string | undefined | null) => {
    if (!raw || seeds.length >= maxSeeds) return;
    const k = normalizeKeyword(raw);
    if (k.length < 3 || k.length > 60) return;
    if (seen.has(k)) return;
    seen.add(k);
    seeds.push(k);
  };

  // 1. Tags — the operator's own labels, the highest-signal source.
  for (const entry of analogEntries) {
    const tags = safeJsonParse<string[]>(entry.tags ?? null);
    if (Array.isArray(tags)) for (const t of tags) push(t);
    if (seeds.length >= maxSeeds) return seeds;
  }

  // 2. Pain points — what the audience actually struggles with.
  for (const entry of analogEntries) {
    const insights = safeJsonParse<ExtractedInsights>(entry.extractedInsights ?? null);
    for (const p of insights?.painPoints ?? []) push(p);
    if (seeds.length >= maxSeeds) return seeds;
  }

  // 3. Persona questions — literal search-intent phrasing.
  for (const q of personaTopQuestions) push(q);

  return seeds;
}

/** Word count used for target-length budgeting and the stored `wordCount`. */
export function countWords(text: string): number {
  const cleaned = text
    // Structure/verification markup is not spoken copy.
    .replace(/\[[A-Z_]+\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return 0;
  return cleaned.split(" ").length;
}

/** Words per minute of delivered video script. 145 is the spec's figure. */
export const WORDS_PER_MINUTE = 145;

/**
 * Structure budget per target length. Encodes the spec's scaling table so both
 * the prompt builder and the tests read from one source of truth.
 */
export const LENGTH_STRUCTURE: Record<number, {
  storyArcs: string;
  teachBlocks: string;
  objectionBlocks: string;
  midRollRehook: boolean;
}> = {
  10: { storyArcs: "1", teachBlocks: "3", objectionBlocks: "0", midRollRehook: false },
  15: { storyArcs: "2", teachBlocks: "4-5", objectionBlocks: "1", midRollRehook: false },
  20: { storyArcs: "2-3", teachBlocks: "5-6", objectionBlocks: "2", midRollRehook: true },
};

/** Target word budget for a given number of minutes, with the ±10% band. */
export function wordBudget(minutes: number): { target: number; min: number; max: number } {
  const target = minutes * WORDS_PER_MINUTE;
  return {
    target,
    min: Math.round(target * 0.9),
    max: Math.round(target * 1.1),
  };
}

/**
 * Build the explicit length instruction block injected into the system prompt.
 * Returns "" when no target length applies, so callers can concatenate freely.
 */
export function buildLengthInstruction(minutes: number | undefined | null): string {
  if (!minutes || !LENGTH_STRUCTURE[minutes]) return "";
  const { target, min, max } = wordBudget(minutes);
  const s = LENGTH_STRUCTURE[minutes];
  const lines = [
    "=== TARGET LENGTH (STRICT) ===",
    `This is a ${minutes}-minute video. Spoken word target: ${target} words (acceptable range ${min}-${max}).`,
    "This is a hard requirement, not a suggestion. Do not stop early. Do not pad with filler.",
    "",
    "REQUIRED STRUCTURE FOR THIS LENGTH:",
    `- Story arcs: ${s.storyArcs}`,
    `- Teaching blocks ([TEACH]): ${s.teachBlocks}`,
    `- Objection blocks ([OBJECTION]): ${s.objectionBlocks}`,
  ];
  if (s.midRollRehook) {
    lines.push("- Mid-roll re-hook at the halfway mark: REQUIRED (re-open curiosity so viewers stay)");
  }
  lines.push("");
  lines.push("Depth over breadth: develop each teaching block fully with a concrete example,");
  lines.push("a specific mechanism, and an application the viewer can act on today.");
  lines.push("=== END TARGET LENGTH ===");
  return lines.join("\n");
}
