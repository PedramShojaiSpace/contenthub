/**
 * PART 3C — RESEARCH-FIRST GENERATION: hook references + structure summary.
 *
 * STYLE/DESIGN NOTE FOR THIS FILE
 * Everything here exists to make generated openings imitate the STRUCTURE of
 * videos that already won on this topic, while writing entirely original words.
 * Two rules drive every function below:
 *   1. Never hand the model text it could copy verbatim without noticing.
 *      Hook references are labelled by structure so the model reasons about
 *      shape, not phrasing.
 *   2. Never let weak research quietly degrade into confident output. When
 *      research is thin or off-topic, that is REPORTED, not padded.
 *
 * MEASURED CONTEXT (docs/build-reports/v22r/proof_discovery_sources.txt):
 * `vidiq_outliers` returned on-topic results for only 8/15 health keywords,
 * while `vidiq_trending_videos` returned 15/15. Mining hooks from a Roblox
 * horror game because it "outperformed" is worse than having no hook reference,
 * so `scoreTopicalRelevance` exists to let the pipeline prefer results that
 * actually match the seed.
 */

/** A transcript opening, stored as a hook reference pattern. */
export interface HookReference {
  videoId: string;
  title: string;
  views: number;
  /** Structure label, e.g. "contradiction" — what the opening DOES. */
  structureLabel: string;
  /** The opening ~200 words, verbatim, for structural analysis only. */
  openingText: string;
}

/**
 * Structural taxonomy for openings.
 *
 * Deliberately about MOVES, not topics: the model is being asked "which shape
 * fits my material", and a shape transfers across subjects where a topic does
 * not.
 */
export const HOOK_STRUCTURES = [
  "contradiction",      // states the accepted view, then negates it
  "stakes_escalation",  // small symptom → serious consequence
  "credential_pivot",   // authority claim, then a surprising concession
  "direct_address",     // names the viewer's exact situation
  "mechanism_tease",    // promises the hidden "why" up front
  "enumeration",        // "three things that…" scaffolding
  "in_medias_res",      // opens mid-scene or mid-argument
  "unlabeled",          // classifier abstained; better than a wrong label
] as const;
export type HookStructure = (typeof HOOK_STRUCTURES)[number];

/** Words of opening kept per reference. Enough for shape, short enough to resist copying. */
export const HOOK_OPENING_WORDS = 200;

/** Max hook references injected into a prompt (spec: ≤6). */
export const MAX_HOOK_REFERENCES = 6;

/** Take the first N words of a transcript, collapsing whitespace. */
export function extractOpening(text: string, words = HOOK_OPENING_WORDS): string {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, words)
    .join(" ");
}

/**
 * Label an opening's structure with cheap, deterministic heuristics.
 *
 * An LLM call per transcript would be more accurate and is not worth the
 * latency or spend: the label is advisory context, and a wrong label is more
 * harmful than "unlabeled" because it teaches the model the wrong shape. So
 * every branch requires reasonably specific evidence and the default abstains.
 */
export function classifyHookStructure(opening: string): HookStructure {
  const t = String(opening ?? "").toLowerCase();
  if (!t.trim()) return "unlabeled";

  // Contradiction: an asserted consensus followed by negation.
  if (
    /\b(everything|everyone|most people|they|you've been|doctors?)\b[^.!?]{0,80}\b(told|taught|think|believe|says?|said)\b/.test(t) &&
    /\b(wrong|false|myth|lie|backwards|not true|isn't true)\b/.test(t)
  ) return "contradiction";

  // Enumeration: an explicit count of forthcoming items.
  if (/\b(three|four|five|3|4|5|seven|7)\s+(things|reasons|signs|mistakes|foods|ways|symptoms)\b/.test(t))
    return "enumeration";

  // Stakes escalation: a mild symptom tied to a severe outcome.
  if (
    /\b(fatigue|bloating|brain fog|tired|headache|gas|constipation)\b/.test(t) &&
    /\b(cancer|autoimmune|alzheimer|dementia|heart disease|dying|kill|permanent)\b/.test(t)
  ) return "stakes_escalation";

  // Credential pivot: authority established, then conceded.
  if (
    /\b(i'm a|i am a|as a|i've been a|dr\.|doctor|years? (of|in) practice|board.certified)\b/.test(t) &&
    /\b(but|however|and yet|what i didn't|i was wrong)\b/.test(t)
  ) return "credential_pivot";

  // Mechanism tease: promises the hidden cause.
  if (/\b(here's (why|what|how)|the real reason|what's actually happening|the mechanism|hidden cause)\b/.test(t))
    return "mechanism_tease";

  // Direct address: names the viewer's situation specifically.
  if (/\b(if you'?re|if you have|you know that feeling|you wake up|for those of you)\b/.test(t))
    return "direct_address";

  // In medias res: opens mid-scene.
  if (/^(so|and|then|it was|last week|yesterday|i walked|she walked|he walked)\b/.test(t.trim()))
    return "in_medias_res";

  return "unlabeled";
}

/**
 * Cheap topical-relevance score in [0,1] between a seed keyword and a title.
 *
 * DELIBERATELY CRUDE and deliberately transparent. It is a filter against
 * obvious noise (a gaming video for a gut-health keyword), not a semantic
 * ranker. It over-accepts: a title containing "fatigue" scores as relevant even
 * when it is about superhero movies. That bias is the safe direction — dropping
 * a genuinely relevant video costs real grounding, while keeping a marginal one
 * costs a little prompt space.
 */
export function scoreTopicalRelevance(seed: string, title: string): number {
  const stop = new Set([
    "the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "is", "are",
    "why", "how", "what", "your", "you", "my", "with", "from", "does", "do",
  ]);
  const norm = (s: string) =>
    String(s ?? "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);

  const seedTerms = norm(seed).filter((w) => w.length > 2 && !stop.has(w));
  if (seedTerms.length === 0) return 0;
  const titleTerms = new Set(norm(title));

  let hits = 0;
  for (const term of seedTerms) {
    if (titleTerms.has(term)) { hits++; continue; }
    // Light stemming via SHARED PREFIX, not startsWith.
    //
    // Calibrated against real captured titles: "inflammation" and
    // "inflammatory" share only their first 7 characters, so neither string
    // startsWith the other and the previous version scored them 0. A shared
    // prefix of >=5 chars connects gut/guts, inflammation/inflammatory and
    // fatigue/fatigued without joining unrelated short words.
    for (const tt of Array.from(titleTerms)) {
      if (tt.length > 3 && term.length > 3 && sharedPrefixLength(tt, term) >= 5) {
        hits += 0.5;
        break;
      }
    }
  }
  return Math.min(1, hits / seedTerms.length);
}

/** Number of leading characters two words share. */
function sharedPrefixLength(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

/**
 * Minimum relevance for a discovery result to be trusted as grounding.
 *
 * CALIBRATED, not chosen. Real on-topic titles often match only one term of a
 * three-term seed: "How To Heal 20 Years of Gut Damage in 30 Days" scores
 * 1/3 = 0.333 against "leaky gut fatigue" — unmistakably a gut video, yet an
 * earlier 0.34 threshold rejected it by 0.007. The real off-topic outlier
 * results (Sprunki, Corpus Christi, Roblox horror) all score 0.0, so the gap
 * between signal and noise is wide and this threshold sits inside it.
 */
export const MIN_TOPICAL_RELEVANCE = 0.3;

/**
 * Partition discovery results into topically-relevant and off-topic sets,
 * preserving input order within each. Nothing is discarded silently — callers
 * report the off-topic count so thin research is visible.
 */
export function partitionByRelevance<T extends { title: string }>(
  seed: string,
  items: T[]
): { relevant: T[]; offTopic: T[] } {
  const relevant: T[] = [];
  const offTopic: T[] = [];
  for (const it of items) {
    (scoreTopicalRelevance(seed, it.title) >= MIN_TOPICAL_RELEVANCE ? relevant : offTopic).push(it);
  }
  return { relevant, offTopic };
}

/** The aggregate structure summary persisted on `research_jobs`. */
export interface StructureSummary {
  sectionFlow: string[];
  pacingNotes: string;
  firstPayoffPoint: string;
  reHookPlacement: string;
  ctaPlacement: string;
  sourceVideoIds: string[];
  sourceCount: number;
}

export const STRUCTURE_SUMMARY_PROMPT = [
  "You are analysing how successful YouTube videos on one topic are STRUCTURED.",
  "You are NOT summarising their content. Return ONLY JSON.",
  "",
  "You will be given SEVERAL transcripts. Return ONE aggregate object describing",
  "the pattern ACROSS them — not an array, and not one object per video.",
  "",
  "Schema:",
  "{",
  '  "sectionFlow": string[],      // ordered beats, e.g. ["cold open contradiction","credential","problem mechanism"]',
  '  "pacingNotes": string,        // where they slow down and speed up',
  '  "firstPayoffPoint": string,   // when the viewer first gets something usable',
  '  "reHookPlacement": string,    // where attention is re-captured mid-video',
  '  "ctaPlacement": string        // where and how the ask appears',
  "}",
  "",
  "RULES:",
  "- Describe STRUCTURE and TIMING, never claims, facts, or medical content.",
  "- If the transcripts disagree, describe the dominant pattern and say so.",
  "- Base every field on the transcripts provided. Do not generalise from",
  "  YouTube conventions you already believe.",
  "- Return a single JSON object. Do NOT wrap it in an array.",
].join("\n");

/** Validate an LLM structure summary; a malformed field becomes a safe default. */
export function validateStructureSummary(
  raw: unknown,
  sourceVideoIds: string[]
): StructureSummary | null {
  let obj: any = raw;
  if (typeof obj === "string") {
    try { obj = JSON.parse(obj); } catch { return null; }
  }
  if (!obj || typeof obj !== "object") return null;

  /*
   * MEASURED REJECTION (docs/build-reports/v22r/proof_structure_summary.txt).
   *
   * EVERY research job recorded `structure_summary=no`, including jobs that
   * completed with real transcripts. Cause: the prompt showed a SINGLE-object
   * schema but handed the model THREE transcripts, so it reasonably returned one
   * object per video — `[{...},{...},{...}]`. JSON.parse succeeded,
   * `obj.sectionFlow` was undefined on an array, flow came out empty, and the
   * summary was silently discarded. The model was not wrong; the prompt was
   * ambiguous and the validator was too literal about a shape it never pinned.
   *
   * The prompt is now explicit, but a model may still return an array, and an
   * aggregate is what this feature wants — so per-video objects are MERGED
   * rather than refused. Section flows concatenate in order and are deduped
   * (winning videos in one niche genuinely share beats, and a flow listing
   * "cold open" three times is noise). Prose fields take the first non-empty
   * value rather than gluing three paragraphs into an unreadable wall.
   */
  if (Array.isArray(obj)) {
    const parts = obj.filter((p) => p && typeof p === "object" && !Array.isArray(p));
    if (parts.length === 0) return null;

    const seen = new Set<string>();
    const mergedFlow: string[] = [];
    for (const p of parts) {
      if (!Array.isArray(p.sectionFlow)) continue;
      for (const beat of p.sectionFlow) {
        if (typeof beat !== "string" || !beat.trim()) continue;
        const key = beat.trim().toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        mergedFlow.push(beat.trim().slice(0, 200));
      }
    }

    const firstNonEmpty = (field: string): string => {
      for (const p of parts) {
        const v = p[field];
        if (typeof v === "string" && v.trim()) return v.trim();
      }
      return "";
    };

    obj = {
      sectionFlow: mergedFlow,
      pacingNotes: firstNonEmpty("pacingNotes"),
      firstPayoffPoint: firstNonEmpty("firstPayoffPoint"),
      reHookPlacement: firstNonEmpty("reHookPlacement"),
      ctaPlacement: firstNonEmpty("ctaPlacement"),
    };
  }

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 1000) : "");
  const flow = Array.isArray(obj.sectionFlow)
    ? obj.sectionFlow.filter((s: unknown) => typeof s === "string" && s.trim()).map((s: string) => s.trim().slice(0, 200))
    : [];

  // A summary with no flow and no notes carries no guidance; treat as absent
  // rather than persisting an empty object that looks like real data.
  if (flow.length === 0 && !str(obj.pacingNotes)) return null;

  return {
    sectionFlow: flow,
    pacingNotes: str(obj.pacingNotes),
    firstPayoffPoint: str(obj.firstPayoffPoint),
    reHookPlacement: str(obj.reHookPlacement),
    ctaPlacement: str(obj.ctaPlacement),
    sourceVideoIds,
    sourceCount: sourceVideoIds.length,
  };
}

/**
 * `=== HOOK REFERENCES ===` prompt block.
 *
 * The 15-second rule is stated as a prohibition with a named counter-example,
 * because "write a strong hook" produces exactly the soft rhetorical question
 * the spec bans.
 */
export function buildHookReferenceBlock(refs: HookReference[]): string {
  const lines: string[] = [];
  lines.push("=== HOOK REFERENCES — OPENINGS FROM WINNING VIDEOS ON THIS TOPIC ===");
  lines.push("");

  if (refs.length === 0) {
    // No research: the structural menu and the 15-second rule still apply.
    lines.push("No competitor openings were secured for this topic. Choose one of these");
    lines.push("opening structures and execute it deliberately:");
    for (const s of HOOK_STRUCTURES.filter((s) => s !== "unlabeled")) {
      lines.push(`  - ${s.replace(/_/g, " ")}`);
    }
  } else {
    lines.push("These openings earned attention on this exact topic. Study WHAT THEY DO,");
    lines.push("not what they say.");
    lines.push("");
    refs.slice(0, MAX_HOOK_REFERENCES).forEach((r, i) => {
      lines.push(`--- Reference ${i + 1} · structure: ${r.structureLabel.replace(/_/g, " ")} ---`);
      lines.push(`Video: ${r.title} (${r.views.toLocaleString()} views)`);
      lines.push(`Opening: ${r.openingText}`);
      lines.push("");
    });
  }

  lines.push("");
  lines.push("HOW TO USE THESE:");
  lines.push("- Choose the ONE structure that best fits your material.");
  lines.push("- Write a COMPLETELY ORIGINAL opening in that structure. Never reuse their");
  lines.push("  words, examples, or numbers. You are borrowing shape, not sentences.");
  lines.push("- The first 15 seconds MUST contain a pattern interrupt or a curiosity gap:");
  lines.push("  something that contradicts an assumption, or names a specific consequence");
  lines.push("  the viewer has not connected to their symptoms.");
  lines.push("- A soft rhetorical question is NOT an acceptable opening. These all fail:");
  lines.push('    "Have you ever felt tired for no reason?"');
  lines.push('    "Do you struggle with bloating?"');
  lines.push('    "What if I told you there was another way?"');
  lines.push("  They ask permission to be interesting. Open with a claim instead.");
  lines.push("=== END HOOK REFERENCES ===");
  return lines.join("\n");
}

/** `=== PROVEN STRUCTURE ===` block — advisory, subordinate to Northstar/offer. */
export function buildStructureSummaryBlock(s: StructureSummary): string {
  const lines: string[] = [];
  lines.push("=== PROVEN STRUCTURE (advisory) ===");
  lines.push(`Aggregated from ${s.sourceCount} winning video${s.sourceCount === 1 ? "" : "s"} on this topic.`);
  lines.push("");
  if (s.sectionFlow.length) {
    lines.push("Section flow they share:");
    s.sectionFlow.forEach((beat, i) => lines.push(`  ${i + 1}. ${beat}`));
    lines.push("");
  }
  if (s.pacingNotes) lines.push(`Pacing: ${s.pacingNotes}`);
  if (s.firstPayoffPoint) lines.push(`First payoff: ${s.firstPayoffPoint}`);
  if (s.reHookPlacement) lines.push(`Re-hook: ${s.reHookPlacement}`);
  if (s.ctaPlacement) lines.push(`CTA placement: ${s.ctaPlacement}`);
  lines.push("");
  lines.push("This is GUIDANCE, not instruction. Where it conflicts with the Northstar");
  lines.push("model, the offer requirements, or story integrity, those win.");
  lines.push("=== END PROVEN STRUCTURE ===");
  return lines.join("\n");
}
