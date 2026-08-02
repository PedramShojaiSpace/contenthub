/*
 * ─────────────────────────────────────────────────────────────────────────────
 * PART 3E — HONEST METRICS, DETERMINISTIC TIMESTAMPS, CADENCE LINT
 *
 * Three separate concerns share this file because all three read the same
 * artefact — the script body with its structure tags — and splitting them would
 * mean three copies of the section-parsing regex drifting apart.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { STORY_SLOT_OPEN, STORY_SLOT_CLOSE, STORY_SLOT_WORD_CREDIT } from "./storyIntegrity";

/**
 * The structure tags the system prompt instructs the model to emit.
 *
 * Order matters only for display. `VERIFIED` is deliberately NOT here: it is an
 * inline grounding marker, not a section, and conflating the two is the original
 * bug this module fixes.
 */
export const SECTION_TAGS = [
  "HOOK",
  "PAIN",
  "PROOF",
  "STORY",
  "TEACH",
  "OBJECTION",
  "CTA",
  "CLOSE",
] as const;

export type SectionTag = (typeof SECTION_TAGS)[number];

const SECTION_TAG_RE = new RegExp(`\\[(${SECTION_TAGS.join("|")})\\]`, "g");

/** Words per minute used for every timestamp in the system. */
export const SPEAKING_WPM = 145;

export interface SectionInstance {
  tag: SectionTag;
  /** Zero-based position of this instance in the script. */
  index: number;
  /** Body text between this tag and the next section tag. */
  text: string;
  /** True when this instance contains at least one [VERIFIED] marker. */
  grounded: boolean;
  /**
   * True when the instance is nothing but a story slot and its instructions —
   * i.e. the operator is expected to paste their own case here.
   */
  slotOnly: boolean;
}

/**
 * Split a script body into SECTION INSTANCES.
 *
 * Instances, not distinct types. A 15-minute script has roughly 14 sections
 * because [TEACH] recurs; counting distinct types would let one grounded TEACH
 * block stand in for five ungrounded ones, which is exactly the sort of
 * flattering arithmetic this part removes.
 */
export function parseSectionInstances(scriptBody: string): SectionInstance[] {
  const body = scriptBody ?? "";
  const matches = matchSectionTags(body);
  if (matches.length === 0) return [];

  const instances: SectionInstance[] = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? body.length) : body.length;
    const text = body.slice(start, end);

    instances.push({
      tag: m[1] as SectionTag,
      index: i,
      text,
      grounded: hasVerifiedOutsideSlots(text),
      slotOnly: isSlotOnly(text),
    });
  }
  return instances;
}

/**
 * Collect every structure-tag match in document order.
 *
 * An explicit `exec` loop rather than `matchAll` because the project's TS target
 * predates downlevel iteration of regex iterators; `matchAll` here added two tsc
 * errors on an otherwise clean baseline. `lastIndex` is reset up front so a
 * module-level regex cannot carry state between calls.
 */
function matchSectionTags(body: string): RegExpExecArray[] {
  SECTION_TAG_RE.lastIndex = 0;
  const out: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  while ((m = SECTION_TAG_RE.exec(body)) !== null) {
    out.push(m);
    if (m.index === SECTION_TAG_RE.lastIndex) SECTION_TAG_RE.lastIndex++;
  }
  return out;
}

/** Strip every story slot (markers and enclosed instructions) from a chunk. */
function stripSlots(text: string): string {
  const open = STORY_SLOT_OPEN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const close = STORY_SLOT_CLOSE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`${open}[\\s\\S]*?${close}`, "g"), " ");
}

/*
 * A [VERIFIED] marker INSIDE slot instructional text does not count.
 *
 * The slot body is guidance addressed to the operator, not broadcast copy, so a
 * model that writes "[VERIFIED] include the patient's starting labs" inside the
 * slot has grounded nothing. Counting it would make the metric reward the model
 * for decorating instructions.
 */
function hasVerifiedOutsideSlots(text: string): boolean {
  return /\[VERIFIED\]/.test(stripSlots(text));
}

/**
 * True when a section is only a story slot — no real prose of its own.
 *
 * Slot-only sections are EXCLUDED from the grounding denominator: in `brief`
 * story mode the correct, compliant behaviour is to emit a slot and let the
 * operator supply the case. Penalising that would score compliance as a defect
 * and push the metric toward rewarding invented stories.
 *
 * The 12-word allowance covers a lead-in line like "Here's what this looked like
 * in practice:" without letting a genuinely written section escape the
 * denominator.
 */
function isSlotOnly(text: string): boolean {
  if (!text.includes(STORY_SLOT_OPEN)) return false;
  const remainder = stripSlots(text).replace(/\[[A-Z_ ]+\]/g, " ").trim();
  const words = remainder.split(/\s+/).filter(Boolean);
  return words.length <= 12;
}

export interface GroundingMetric {
  /** Section instances containing at least one [VERIFIED] marker. */
  grounded: number;
  /** All section instances EXCLUDING slot-only ones. */
  total: number;
  pct: number;
  /** Slot-only sections, excluded from `total`. Reported for transparency. */
  slotOnlySections: number;
  /** Per-tag counts, for the detail panel. */
  byTag: Record<string, { grounded: number; total: number }>;
  metricVersion: "v2.2-instance";
}

/**
 * INSTANCE-BASED GROUNDING METRIC (Part 3E).
 *
 * Replaces `countVerifiedTags()`, which divided [VERIFIED] count by the count of
 * ALL bracketed tokens. Structure labels sat in that denominator, so adding
 * section labels to a script LOWERED its "verified %" while changing nothing
 * about how grounded it was. The number could also exceed nothing sensible and
 * was routinely reported to the operator as a quality figure.
 *
 * Definition here: how many sections of this script are grounded in the corpus.
 * That is a question with an answer the operator can act on — an ungrounded
 * TEACH block is a block to go check.
 */
export function computeGroundingMetric(scriptBody: string): GroundingMetric {
  const instances = parseSectionInstances(scriptBody);
  const byTag: Record<string, { grounded: number; total: number }> = {};

  let grounded = 0;
  let total = 0;
  let slotOnlySections = 0;

  for (const inst of instances) {
    if (inst.slotOnly) {
      slotOnlySections++;
      continue;
    }
    total++;
    byTag[inst.tag] ??= { grounded: 0, total: 0 };
    byTag[inst.tag].total++;
    if (inst.grounded) {
      grounded++;
      byTag[inst.tag].grounded++;
    }
  }

  return {
    grounded,
    total,
    pct: total > 0 ? Math.round((grounded / total) * 100) : 0,
    slotOnlySections,
    byTag,
    metricVersion: "v2.2-instance",
  };
}

/** UI copy. One place, so `generate` and `update` cannot phrase it differently. */
export function describeGrounding(m: GroundingMetric): string {
  if (m.total === 0) return "No sections detected.";
  return `${m.grounded} of ${m.total} sections grounded`;
}

// ─── Deterministic timestamps ────────────────────────────────────────────────

/** Matches a leading `(m:ss)` or `(mm:ss)` stamp, with optional surrounding space. */
const TIMESTAMP_RE = /\(\d{1,3}:\d{2}\)\s*/g;

/**
 * Remove every `(m:ss)` marker from a script body.
 *
 * Exported because idempotency is the whole point: `insertTimestamps` strips
 * before it inserts, so running it after a story-correction pass or a cadence
 * rewrite cannot produce `(0:00) (0:00)`. Pass ordering then stops being
 * load-bearing, which matters because those passes are conditional.
 */
export function stripTimestamps(scriptBody: string): string {
  return (scriptBody ?? "").replace(TIMESTAMP_RE, "");
}

/** Format seconds as `m:ss`. */
function fmt(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Count spoken words in a chunk, crediting each story slot at
 * STORY_SLOT_WORD_CREDIT.
 *
 * A slot is ~15 words of instructions that the operator will replace with a real
 * case. Counting the instructions would make a 15-minute script's stamps drift
 * minutes early; the 200-word credit is the same figure the length budget uses,
 * so the two systems agree about how long a script is.
 */
function spokenWordsWithSlotCredit(text: string): number {
  const open = STORY_SLOT_OPEN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const close = STORY_SLOT_CLOSE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const slotRe = new RegExp(`${open}[\\s\\S]*?${close}`, "g");
  const slotCount = (text.match(slotRe) ?? []).length;

  const spoken = text
    .replace(slotRe, " ")
    .replace(/\[[A-Z_]+\]/g, " ")
    .replace(TIMESTAMP_RE, " ")
    .split(/\s+/)
    .filter(Boolean).length;

  return spoken + slotCount * STORY_SLOT_WORD_CREDIT;
}

/**
 * Insert a deterministic `(m:ss)` stamp after every structure tag.
 *
 * Strip-then-insert, so calling this twice yields the same string.
 *
 * The stamp on a tag is the cumulative spoken time of everything BEFORE it, so
 * [HOOK] is always (0:00) and each later section reads as "this is when you say
 * this". Word counts are converted at SPEAKING_WPM.
 */
export function insertTimestamps(scriptBody: string): string {
  const clean = stripTimestamps(scriptBody ?? "");
  const matches = matchSectionTags(clean);
  if (matches.length === 0) return clean;

  const wordsPerSecond = SPEAKING_WPM / 60;
  let out = "";
  let cursor = 0;
  let cumulativeWords = 0;

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const tagStart = m.index ?? 0;
    const tagEnd = tagStart + m[0].length;

    // Everything from the previous cursor up to and including this tag.
    out += clean.slice(cursor, tagEnd);
    out += ` (${fmt(cumulativeWords / wordsPerSecond)})`;
    cursor = tagEnd;

    // Advance the clock by this section's spoken content.
    const bodyEnd = i + 1 < matches.length ? (matches[i + 1].index ?? clean.length) : clean.length;
    cumulativeWords += spokenWordsWithSlotCredit(clean.slice(tagEnd, bodyEnd));
  }

  out += clean.slice(cursor);
  return out;
}

/** Total runtime in seconds implied by a script body, at SPEAKING_WPM. */
export function estimateRuntimeSeconds(scriptBody: string): number {
  const words = spokenWordsWithSlotCredit(stripTimestamps(scriptBody ?? ""));
  return Math.round(words / (SPEAKING_WPM / 60));
}

// ─── Cadence lint ────────────────────────────────────────────────────────────

/**
 * Banned openers and filler, as specified.
 *
 * `label` is what the operator sees. `pattern` uses BOUNDED-GAP tolerance:
 * models paraphrase clichés rather than reproducing them verbatim, so
 * "Now, I know what some of you might be thinking" has to be caught while a
 * literal matcher would catch only the form models rarely emit.
 *
 * Gaps are bounded (`.{0,N}?`, no newlines) rather than open-ended. An unbounded
 * `.*` would happily match across two unrelated sentences and flag innocent
 * prose — a lint nobody trusts gets ignored, which is worse than no lint.
 */
export interface CadenceRule {
  id: string;
  label: string;
  pattern: RegExp;
}

export const CADENCE_RULES: CadenceRule[] = [
  {
    id: "know_what_youre_thinking",
    label: "Now, I know what you're thinking",
    // Tolerates "some of you might be", "you're probably", "you may be".
    pattern: /\b(?:now,?\s+)?i\s+know\s+what\s+.{0,24}?\b(?:think|thinking)\b/i,
  },
  {
    id: "think_about_that",
    label: "Think about that for a moment",
    pattern: /\bthink\s+about\s+(?:that|this)\s+.{0,20}?\b(?:moment|second|minute)\b/i,
  },
  {
    id: "what_do_they_tell_you",
    label: "And what do they tell you?",
    pattern: /\band\s+what\s+do\s+.{0,16}?\b(?:tell|say\s+to)\s+you\b/i,
  },
  {
    id: "lets_dive_in",
    label: "Let's dive in",
    pattern: /\blet'?s\s+(?:just\s+)?dive\s+(?:right\s+)?in(?:to\s+it)?\b/i,
  },
  {
    id: "heres_the_thing",
    label: "But here's the thing",
    pattern: /\b(?:but|and)?\s*here'?s\s+the\s+thing\b/i,
  },
  {
    id: "in_todays_video",
    label: "In today's video",
    pattern: /\bin\s+(?:today'?s|this)\s+video\b/i,
  },
  {
    id: "without_further_ado",
    label: "Without further ado",
    pattern: /\bwithout\s+(?:any\s+)?further\s+ado\b/i,
  },
  {
    id: "important_to_note",
    label: "It's important to note",
    pattern: /\bit'?s\s+(?:also\s+)?important\s+to\s+(?:note|remember|understand)\b/i,
  },
  {
    id: "game_changer",
    label: "game-changer",
    pattern: /\bgame[\s-]?changer\b/i,
  },
];

export interface CadenceViolation {
  ruleId: string;
  label: string;
  /** The matched text, so the operator can find it. */
  excerpt: string;
}

export interface CadenceReport {
  violations: CadenceViolation[];
  /** Fraction of sentences that are within 3 words of the mean length. */
  uniformSentenceRatio: number;
  /** Sentences without a contraction, as a fraction. Advisory only. */
  contractionFreeRatio: number;
}

/**
 * Lint a script body for cadence problems.
 *
 * DEGRADES, NEVER BLOCKS. Unlike the story lint (where a violation means a
 * fabricated patient case and must be corrected), cadence is taste. A script the
 * operator can edit in thirty seconds must not be withheld from him.
 */
export function lintCadence(scriptBody: string): CadenceReport {
  // Slot instructions are guidance, not copy — they must not be linted.
  const body = stripSlots(scriptBody ?? "").replace(/\[[A-Z_]+\]/g, " ");

  const violations: CadenceViolation[] = [];
  for (const rule of CADENCE_RULES) {
    const m = rule.pattern.exec(body);
    if (m) {
      violations.push({
        ruleId: rule.id,
        label: rule.label,
        excerpt: m[0].trim().slice(0, 120),
      });
    }
  }

  const sentences = body
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).filter(Boolean).length >= 3);

  let uniformSentenceRatio = 0;
  let contractionFreeRatio = 0;
  if (sentences.length > 0) {
    const lengths = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    uniformSentenceRatio =
      lengths.filter((l) => Math.abs(l - mean) <= 3).length / lengths.length;
    contractionFreeRatio =
      sentences.filter((s) => !/['’](?:s|t|re|ve|ll|d|m)\b/i.test(s)).length / sentences.length;
  }

  return { violations, uniformSentenceRatio, contractionFreeRatio };
}

/** The prompt block that asks for human cadence in the first place. */
export function buildCadenceBlock(): string {
  return [
    "=== WRITE LIKE A HUMAN ON CAMERA ===",
    "You are writing words a person will SAY, not sentences a person will read.",
    "",
    "- Use contractions. \"You're\", \"it's\", \"doesn't\" — always, not occasionally.",
    "- Vary sentence length deliberately. Follow a long, winding explanation with three words.",
    "- Address one person as \"you\", never \"you guys\" or \"everyone\".",
    "- Cut every sentence that only announces what you are about to say.",
    "",
    "NEVER write any of these, in any paraphrased form:",
    ...CADENCE_RULES.map((r) => `  · "${r.label}"`),
    "",
    "If you catch yourself writing a transition that sounds like a YouTube script,",
    "delete it and start the next sentence with the actual point.",
  ].join("\n");
}
