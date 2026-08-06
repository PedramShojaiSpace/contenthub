/**
 * ─── v2.4 Part 3 — THE SELL-DENSITY LINT ─────────────────────────────────────
 *
 * Measures how often a value_first script sells OUTSIDE its [CTA] section, which
 * is the thing the operator's audit actually complained about: "the branded
 * product is named or pitched in 8 of 13 sections; the deliverables list is
 * restated four times; sales-page urgency appears mid-teach."
 *
 * WHY A SEPARATE FILE rather than more surface in scriptFactoryRouter.ts: this is
 * pure text analysis over a body plus an offer profile, with no db, no tRPC and
 * no LLM. Keeping it standalone means it is unit-testable without a mock harness,
 * and it sits beside scriptMetrics.ts, which is the same kind of module. It is
 * INSIDE the v2.4 scope wall in spirit — a new file, not an edit to a shared one.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: it does not decide whether to save. The lint
 * reports; the pipeline decides. The operator was explicit that sell density is a
 * correctness problem to be flagged loudly and fixed by editing, not a legal
 * hazard like a fabricated patient — so unlike story integrity, nothing here ever
 * throws.
 */
import { parseSectionInstances, estimateRuntimeSeconds, type SectionInstance } from "./scriptMetrics";
import type { OfferProfile } from "./offerProfile";

/**
 * Static urgency/scarcity phrases, lowercased.
 *
 * The first three are the operator's own examples from the audit. The rest are
 * the direct-response stock phrases that the balanced block legitimately
 * encourages and that must not appear mid-teach in a value_first script.
 *
 * Substring matching on purpose: "slots are limited" must also catch "coaching
 * slots are limited to". Word-boundary regexes per phrase would be stricter but
 * would miss exactly the inflected forms a model actually writes.
 */
export const STATIC_URGENCY_PHRASES: readonly string[] = [
  "slots are limited",
  "don't wait",
  "dont wait",
  "you cannot go on",
  "you can't go on",
  "limited time",
  "spots are limited",
  "act now",
  "before it's too late",
  "before its too late",
  "only a few",
  "closing soon",
  "last chance",
  "while supplies last",
  "reserve your spot",
  "space is limited",
];

/** One thing the lint found, with enough context for the operator to act on it. */
export interface SellDensityFinding {
  kind: "branded_mention" | "deliverables_list" | "price_mention" | "urgency_phrase";
  /** Section tag the finding sits in, e.g. "TEACH". */
  section: string;
  /** Zero-based instance index of that section, so "TEACH #3" is addressable. */
  sectionIndex: number;
  /** The matched text, trimmed for display. */
  matched: string;
  /** The sentence it appeared in — this is what a targeted rewrite pass edits. */
  sentence: string;
}

export interface SellDensityReport {
  /** Branded product-name mentions outside [CTA]. Budget: <= 1 (the mid-roll). */
  brandedMentions: number;
  /** Deliverables-list restatements outside [CTA]. Budget: 0. */
  deliverablesLists: number;
  /** Price mentions outside [CTA]. Budget: 0. */
  priceMentions: number;
  /** Urgency/scarcity phrases outside [CTA]. Budget: 0. */
  urgencyPhrases: number;
  /** True when every count is inside budget. */
  withinBudget: boolean;
  findings: SellDensityFinding[];
  /**
   * Where the single permitted mid-roll mention sits, as a percentage of
   * estimated runtime. NULL when there is no mention outside the CTA at all —
   * which is within budget but means the soft mention was omitted.
   */
  midRollPercent: number | null;
  /** Runtime position of the [CTA] section start, as "MM:SS". Null if no CTA. */
  ctaAt: string | null;
  /**
   * True when a mid-roll exists and sits in the 40–60% window the spec asks for.
   * Reported, never enforced: placement is a quality signal, and a good mention
   * at 63% is not worth spending a rewrite pass on.
   */
  midRollInWindow: boolean;
  /** One-line operator-facing summary for the right rail. */
  summary: string;
}

/** Split into sentences well enough to quote one back. Not linguistics. */
function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Distinctive tokens from the offer name, for branded-mention detection.
 *
 * WHY NOT MATCH THE WHOLE NAME: "KBMO Clinical Ecosystem — Diagnostic Intake"
 * appears in full almost nowhere. A model writes "the KBMO panel" or "the FIT 22"
 * or "the Clinical Ecosystem", and a full-string match would score all three as
 * clean while the script reads as a branded pitch throughout.
 *
 * WHY THE STOPWORD LIST: matching on "clinical" or "panel" alone would fire on
 * every legitimate category-level reference — and category references are
 * EXPLICITLY allowed by rule 3. Those words are generic vocabulary in this
 * domain, so they are excluded and only distinctive tokens survive: brand words
 * (KBMO), product codes (FIT), and capitalised multiword marks.
 */
export function brandTokens(profile: OfferProfile): string[] {
  const GENERIC = new Set([
    "the", "and", "for", "with", "your", "you", "a", "an", "of", "to", "in", "on",
    "clinical", "panel", "test", "testing", "kit", "report", "session", "plan",
    "health", "gut", "food", "program", "programme", "intake", "diagnostic",
    "ecosystem", "coach", "coaching", "analysis", "lab", "labs", "barrier",
    "sensitivity", "personalized", "personalised", "full", "private", "hour",
    "complete", "detailed", "upstream", "action", "biome", "grade", "primary",
  ]);
  const tokens = new Set<string>();
  for (const raw of profile.offerName.split(/[\s—–\-/&,()]+/)) {
    const t = raw.trim().replace(/[^A-Za-z0-9]/g, "");
    if (t.length < 3) continue;
    if (GENERIC.has(t.toLowerCase())) continue;
    tokens.add(t.toLowerCase());
  }
  /*
   * Product codes from the deliverables, e.g. "FIT 22" in "KBMO FIT 22 & Gut
   * Barrier Permeability Panel". These read as branded even when the offer name
   * itself is absent, and they are the single most common way the audited script
   * named the product mid-teach.
   */
  for (const d of profile.deliverables) {
    // exec loop rather than matchAll/spread: this project's tsconfig target does
    // not permit iterating a RegExpStringIterator (TS2802).
    const re = /\b([A-Z]{2,}(?:\s?\d{1,3})?)\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(d)) !== null) {
      const t = m[1].trim();
      if (t.length >= 3 && !GENERIC.has(t.toLowerCase())) tokens.add(t.toLowerCase());
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  const out: string[] = [];
  tokens.forEach((t) => out.push(t));
  return out;
}

/**
 * Phrases that indicate a deliverables list has been restated.
 *
 * A "list" is scored when a sentence contains two or more distinct deliverable
 * fingerprints. One deliverable mentioned in passing is not a restated list, and
 * treating it as one would flag the sanctioned pre-CTA bridge paragraph.
 */
function deliverableFingerprints(profile: OfferProfile): string[] {
  return profile.deliverables
    .map((d) => {
      const head = d.split(/[—–\-(:,]/)[0].trim().toLowerCase();
      return head.length >= 8 ? head : d.trim().toLowerCase().slice(0, 40);
    })
    .filter((s) => s.length >= 8);
}

/** Price fragments to look for, derived from the profile rather than guessed. */
function priceNeedles(profile: OfferProfile): string[] {
  const out: string[] = [];
  if (profile.pricePoint) {
    const p = profile.pricePoint.trim().toLowerCase();
    out.push(p);
    const digits = p.replace(/[^0-9]/g, "");
    if (digits.length >= 2) out.push(`$${digits}`);
  }
  return out;
}

/**
 * Run the lint over a script body.
 *
 * Only sections OUTSIDE [CTA] are scanned. The CTA is where all of this is
 * supposed to happen, and scanning it would flag the correct behaviour as a
 * defect. [CLOSE] is also exempt: it follows the CTA and is part of the close.
 */
export function lintSellDensity(scriptBody: string, profile: OfferProfile): SellDensityReport {
  const sections = parseSectionInstances(scriptBody);
  const brands = brandTokens(profile);
  const fingerprints = deliverableFingerprints(profile);
  const prices = priceNeedles(profile);

  const findings: SellDensityFinding[] = [];
  const scanned = sections.filter((s) => s.tag !== "CTA" && s.tag !== "CLOSE");

  for (const sec of scanned) {
    for (const sentence of sentencesOf(sec.text)) {
      const lower = sentence.toLowerCase();
      const add = (kind: SellDensityFinding["kind"], matched: string) =>
        findings.push({
          kind,
          section: sec.tag,
          sectionIndex: sec.index,
          matched,
          sentence: sentence.length > 300 ? sentence.slice(0, 300) + "…" : sentence,
        });

      const hitBrand = brands.find((b) => lower.includes(b));
      if (hitBrand) add("branded_mention", hitBrand);

      const hitFingerprints = fingerprints.filter((f) => lower.includes(f));
      if (hitFingerprints.length >= 2) {
        add("deliverables_list", `${hitFingerprints.length} deliverables in one sentence`);
      }

      const hitPrice = prices.find((p) => lower.includes(p));
      if (hitPrice) add("price_mention", hitPrice);

      const hitUrgency = STATIC_URGENCY_PHRASES.find((p) => lower.includes(p));
      if (hitUrgency) add("urgency_phrase", hitUrgency);
    }
  }

  const brandedMentions = findings.filter((f) => f.kind === "branded_mention").length;
  const deliverablesLists = findings.filter((f) => f.kind === "deliverables_list").length;
  const priceMentions = findings.filter((f) => f.kind === "price_mention").length;
  const urgencyPhrases = findings.filter((f) => f.kind === "urgency_phrase").length;

  const withinBudget =
    brandedMentions <= 1 && deliverablesLists === 0 && priceMentions === 0 && urgencyPhrases === 0;

  /*
   * Mid-roll placement. Computed from the WORD OFFSET of the first branded
   * mention over total words, which is the same words-per-minute model every
   * timestamp in this system uses (SPEAKING_WPM). Character offsets would skew
   * against sections with long slot instructions.
   */
  const firstBrand = findings.find((f) => f.kind === "branded_mention");
  let midRollPercent: number | null = null;
  if (firstBrand) {
    const idx = scriptBody.indexOf(firstBrand.sentence.slice(0, 60));
    if (idx >= 0) {
      const wordsBefore = scriptBody.slice(0, idx).trim().split(/\s+/).filter(Boolean).length;
      const totalWords = scriptBody.trim().split(/\s+/).filter(Boolean).length;
      if (totalWords > 0) midRollPercent = Math.round((wordsBefore / totalWords) * 100);
    }
  }
  const midRollInWindow = midRollPercent !== null && midRollPercent >= 40 && midRollPercent <= 60;

  // Runtime position of the CTA, using the shared WPM model.
  let ctaAt: string | null = null;
  const ctaSection = sections.find((s) => s.tag === "CTA");
  if (ctaSection) {
    const ctaIdx = scriptBody.indexOf(ctaSection.text.slice(0, 60));
    if (ctaIdx > 0) {
      const secs = estimateRuntimeSeconds(scriptBody.slice(0, ctaIdx));
      // floor, not round — the navigator/body stamp mismatch bug from v2.3 Part 1.
      ctaAt = `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;
    }
  }

  const parts: string[] = [];
  parts.push(
    brandedMentions === 0
      ? "No mid-roll mention"
      : brandedMentions === 1
        ? `1 mid-roll mention${midRollPercent !== null ? ` at ${midRollPercent}%` : ""}`
        : `${brandedMentions} mentions outside CTA`
  );
  if (ctaAt) parts.push(`CTA at ${ctaAt}`);
  if (deliverablesLists > 0) parts.push(`${deliverablesLists} deliverables list${deliverablesLists === 1 ? "" : "s"}`);
  if (priceMentions > 0) parts.push(`${priceMentions} price mention${priceMentions === 1 ? "" : "s"}`);
  if (urgencyPhrases > 0) parts.push(`${urgencyPhrases} urgency phrase${urgencyPhrases === 1 ? "" : "s"}`);
  parts.push(withinBudget ? "within budget" : "OVER BUDGET");

  return {
    brandedMentions,
    deliverablesLists,
    priceMentions,
    urgencyPhrases,
    withinBudget,
    findings,
    midRollPercent,
    ctaAt,
    midRollInWindow,
    summary: parts.join(" · "),
  };
}

/**
 * Build the instruction for the ONE targeted rewrite pass.
 *
 * Deliberately narrow: it quotes the offending sentences and asks for those
 * sentences only. A "rewrite the script to be less salesy" instruction would
 * return a different script, which would invalidate the story-slot integrity and
 * cadence guarantees the pipeline has already verified on this body.
 */
export function buildSellDensityRewriteInstruction(report: SellDensityReport): string {
  const lines = [
    "The script below is otherwise correct. It violates the VALUE-FIRST SELL POLICY",
    "in a small number of specific sentences, listed here. Rewrite ONLY those",
    "sentences, in place, leaving every other sentence and every [SECTION] tag,",
    "timestamp and story slot byte-for-byte unchanged.",
    "",
    "Return the COMPLETE script with only those sentences changed.",
    "",
    "Violations:",
  ];
  for (const f of report.findings) {
    const why =
      f.kind === "branded_mention"
        ? `names the product ("${f.matched}") outside the CTA`
        : f.kind === "deliverables_list"
          ? `restates the deliverables list (${f.matched})`
          : f.kind === "price_mention"
            ? `states the price ("${f.matched}") outside the CTA`
            : `uses urgency/scarcity language ("${f.matched}") outside the CTA`;
    lines.push(`- In [${f.section}] #${f.sectionIndex + 1}, this sentence ${why}:`);
    lines.push(`  "${f.sentence}"`);
  }
  lines.push(
    "",
    "How to fix each one:",
    "- Branded mentions: replace with a CATEGORY-level description of the same",
    "  mechanism (e.g. 'proper food-inflammation testing'), or delete the clause if",
    "  the teaching does not need it. Do NOT relocate the mention elsewhere.",
    "- Deliverables lists and prices: delete them. They belong only in the CTA.",
    "- Urgency/scarcity: delete the urgency and keep any factual content.",
    "",
    "You may keep AT MOST ONE brief product mention outside the CTA — the two-",
    "sentence mid-roll signpost, if one of the sentences above already is that",
    "signpost. Every other mention must go."
  );
  return lines.join("\n");
}
