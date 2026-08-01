/**
 * PART 3A — STORY INTEGRITY.
 *
 * Context that justifies the strictness: a previous generation invented a named
 * patient with quoted dialogue and specific clinical findings inside content
 * that sells a health offer. The operator is a licensed practitioner with real
 * cases. The system's job is to hand him a story slot, not to invent a human.
 *
 * Three modes:
 *   brief     (default) no narrative at all — emit a delimited slot instead.
 *   composite narrative allowed, but audibly labelled and de-identified.
 *   none      story blocks omitted; the word budget moves to teaching.
 *
 * The lint matches VIOLATION CLASSES, not spec phrases. A literal `client named`
 * matcher misses "Sarah, a brilliant executive in her late 50s" — which is the
 * actual shape the model produced. False-positive coverage is mandatory and
 * tested: the slot template's own instructional text, the operator's own name,
 * and population statistics must never flag.
 */

export const STORY_MODES = ["brief", "composite", "none"] as const;
export type StoryMode = (typeof STORY_MODES)[number];

export const STORY_SLOT_OPEN = "[STORY SLOT — INSERT YOUR REAL CASE HERE]";
export const STORY_SLOT_CLOSE = "[END STORY SLOT]";

/** Words credited to each story slot for budgeting. Spec figure. */
export const STORY_SLOT_WORD_CREDIT = 200;

export type ViolationClass =
  | "named_patient"
  | "quoted_patient_dialogue"
  | "individual_clinical_specific"
  | "invented_recovery_timeline";

export interface StoryViolation {
  violationClass: ViolationClass;
  matchedText: string;
  /** Character offset in the linted body, for stable reporting. */
  index: number;
  explanation: string;
}

/**
 * Names that must never be treated as an invented patient: the operator, his
 * brand, and the public experts a script may legitimately cite.
 */
const ALLOWED_NAMES = [
  "pedram", "shojai", "urban monk", "dr. pedram", "dr pedram",
];

/**
 * Population-scale qualifiers. Their presence in a clinical-specific sentence
 * means the number describes a COHORT, not an individual, which is legitimate
 * grounded evidence ("CRP dropped 40% across 200 participants").
 */
const POPULATION_MARKERS = [
  "participant", "participants", "subject", "subjects", "patients in",
  "cohort", "study", "studies", "trial", "trials", "meta-analysis",
  "population", "sample", "group of", "on average", "average of",
  "percent of people", "% of people", "of patients", "across",
  "research", "researchers", "data from", "survey",
];

/** Common first names are not enumerable; detect the STRUCTURE instead. */
const NAME = "[A-Z][a-z]{2,15}";

/**
 * Class 1 — named-patient introductions, including bare appositives.
 * Deliberately structural: `<Name>, a <descriptor>` / `a patient named <Name>` /
 * `<Name> came to me` / `my client <Name>`.
 */
const NAMED_PATIENT_PATTERNS: { re: RegExp; why: string }[] = [
  {
    re: new RegExp(`\\b(?:patient|client|woman|man|guy|gal|lady|person|case)\\s+(?:named|called)\\s+(${NAME})\\b`, "g"),
    why: "explicitly names an individual patient",
  },
  {
    // Bare appositive: "Sarah, a brilliant executive in her late 50s".
    re: new RegExp(`\\b(${NAME}),\\s+(?:a|an)\\s+[a-z][a-z\\s-]{2,40}?(?:,|\\s+(?:in|who|from|with|aged|age))`, "g"),
    why: "introduces a named individual via an appositive descriptor",
  },
  {
    re: new RegExp(`\\b(${NAME})\\s+(?:came\\s+to\\s+me|walked\\s+into\\s+my|showed\\s+up|sat\\s+(?:down\\s+)?across|was\\s+referred)`, "g"),
    why: "narrates a named individual presenting for care",
  },
  {
    // Case-insensitive on the determiner ("My client Jennifer" starts a
    // sentence) but the name must still be genuinely capitalised, so the
    // capture group carries its own explicit case class. Without that, `gi`
    // made NAME match lowercase words and "a patient story" flagged "story".
    re: new RegExp(`\\b(?:[Mm]y|[Aa]|[Oo]ne\\s+of\\s+my)\\s+(?:patient|client)s?\\s*,?\\s+([A-Z][a-z]{2,15})\\b`, "g"),
    why: "attaches a proper name to a patient or client",
  },
  {
    re: new RegExp(`\\bTake\\s+(${NAME})\\s*(?:,|\\.|\\s+for\\s+(?:example|instance))`, "g"),
    why: "presents a named individual as an example case",
  },
];

/**
 * Class 2 — quoted patient dialogue, BOTH word orders. The model produces
 * `she told me, "..."` and `"...," she told me` with equal frequency.
 */
const SPEECH_VERB = "(?:said|told|asked|replied|whispered|admitted|confessed|explained|insisted|complained)";
const QUOTED_DIALOGUE_PATTERNS: { re: RegExp; why: string }[] = [
  {
    re: new RegExp(`\\b(?:${NAME}|he|she|they|the\\s+patient|my\\s+(?:patient|client))\\s+${SPEECH_VERB}\\b[^"“]{0,30}["“][^"”]{8,}["”]`, "gi"),
    why: "attributes quoted speech to a patient (verb-first order)",
  },
  {
    re: new RegExp(`["“][^"”]{8,}["”][,\\s]*\\s*(?:${NAME}|he|she|they|the\\s+patient|my\\s+(?:patient|client))\\s+${SPEECH_VERB}\\b`, "gi"),
    why: "attributes quoted speech to a patient (quote-first order)",
  },
];

/**
 * Class 3 — individual-attributed clinical specifics. Gated by a possessive or
 * named subject AND the absence of a population marker in the same sentence.
 */
const CLINICAL_MARKERS = [
  "crp", "a1c", "hba1c", "tsh", "ferritin", "vitamin d", "b12", "homocysteine",
  "cortisol", "insulin", "glucose", "ldl", "hdl", "triglyceride", "cholesterol",
  "zonulin", "calprotectin", "lps", "esr", "alt", "ast", "creatinine",
  "blood pressure", "white blood cell", "thyroid antibod", "igg", "iga",
  "lab", "labs", "bloodwork", "blood work", "panel", "biopsy", "scan",
  "test result", "test results", "diagnos",
];
const INDIVIDUAL_SUBJECT = /\b(?:her|his|their|the\s+patient's|my\s+(?:patient|client)'s)\b/i;
const NUMERIC = /\b\d+(?:\.\d+)?\s*(?:mg|mcg|ng|pg|mmol|mg\/dl|ng\/ml|iu|%|points?)?\b/i;

/** Class 4 — invented recovery timelines tied to an individual. */
const RECOVERY_TIMELINE = new RegExp(
  `\\b(?:(?:in|within|after|by)\\s+(?:just\\s+)?(?:\\d+|two|three|four|five|six|seven|eight|nine|ten|twelve)\\s+` +
  `(?:days?|weeks?|months?|years?))\\b`,
  "gi"
);
/**
 * Adverb-tolerant. An earlier version required `symptoms were gone` literally and
 * missed "symptoms were completely gone" — one intervening adverb defeated it.
 * Matching a phrase instead of the class is exactly the brittleness this lint
 * is supposed to avoid, so the gap between verb and participle is explicit.
 */
const ADV = "(?:\\s+(?:completely|totally|entirely|fully|finally|basically|essentially|almost|virtually|all))*";
const RECOVERY_VERB = new RegExp(
  `\\b(?:recovered|healed|resolved|reversed|cleared|turned\\s+(?:it\\s+)?around` +
  `|was${ADV}\\s+(?:back|off)|felt${ADV}\\s+(?:better|normal|human|herself|himself)` +
  `|symptoms?${ADV}\\s+(?:were|was|had)${ADV}\\s+(?:gone|resolved|disappeared|lifted)` +
  `|(?:were|was)${ADV}\\s+(?:gone|resolved|disappeared|lifted|pain-free|symptom-free)` +
  `|no\\s+longer\\s+(?:needed|had|required))\\b`,
  "i"
);

/**
 * Split into sentences for the sentence-scoped classes.
 *
 * Decimal-aware. A naive `[.!?]` split severs "Her CRP was 8.2 mg/L" into
 * "Her CRP was 8." + "2 mg/L …", which both mangles the reported match and —
 * worse — can separate an individual-subject marker from its clinical value,
 * letting a real class-3 violation through. Decimal points, common
 * abbreviations and single-letter initials are therefore protected first.
 */
function sentences(body: string): { text: string; index: number }[] {
  const PLACEHOLDER = "\u0000";
  // Protect "8.2", "Dr.", "mg.", "U.S." style periods before splitting.
  const protectedBody = body
    .replace(/(\d)\.(\d)/g, `$1${PLACEHOLDER}$2`)
    .replace(/\b(Dr|Mr|Mrs|Ms|Prof|vs|etc|approx|e\.g|i\.e)\./gi, (m) =>
      m.replace(".", PLACEHOLDER)
    )
    .replace(/\b([A-Z])\./g, `$1${PLACEHOLDER}`);

  const out: { text: string; index: number }[] = [];
  const re = /[^.!?\n]+[.!?]?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(protectedBody))) {
    // Restore the protected periods so downstream matching sees real text.
    const text = m[0].split(PLACEHOLDER).join(".");
    if (text.trim()) out.push({ text, index: m.index });
  }
  return out;
}

/**
 * Remove every story-slot block before linting. The slot's own instructional
 * text talks about cases and anonymization, so linting it would guarantee a
 * false positive on the very template we emit. This is the single most
 * important false-positive guard.
 */
export function stripStorySlots(body: string): string {
  const open = STORY_SLOT_OPEN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const close = STORY_SLOT_CLOSE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return body.replace(new RegExp(`${open}[\\s\\S]*?${close}`, "g"), " ");
}

/**
 * Remove the prompt's own FORBIDDEN-example text before linting.
 *
 * The instruction block must quote the exact shape it forbids ("Sarah, a
 * brilliant executive in her late 50s") so the model recognises it. Linting
 * that quoted example flags the rulebook itself. Any single-quoted or
 * double-quoted span on a line marked FORBIDDEN is therefore excluded.
 */
function stripForbiddenExamples(body: string): string {
  return body
    .split("\n")
    .map((line) =>
      /FORBIDDEN|is\s+not\.|NEVER|forbidden/i.test(line)
        ? line.replace(/["'“][^"'”]*["'”]/g, " ")
        : line
    )
    .join("\n");
}

function isAllowedName(name: string): boolean {
  const lower = name.toLowerCase();
  return ALLOWED_NAMES.some((a) => a.includes(lower) || lower.includes(a));
}

function hasPopulationMarker(sentence: string): boolean {
  const lower = sentence.toLowerCase();
  return POPULATION_MARKERS.some((m) => lower.includes(m));
}

/**
 * Lint a script body for story-integrity violations.
 *
 * `mode` matters: in `composite` a de-identified narrative is legitimate, so
 * class 1 is relaxed for pronoun-only narration but proper names still flag,
 * and the audible composite label becomes mandatory.
 */
export function lintStoryIntegrity(
  rawBody: string,
  mode: StoryMode = "brief"
): { violations: StoryViolation[]; missingCompositeLabel: boolean } {
  const body = stripForbiddenExamples(stripStorySlots(rawBody));
  const violations: StoryViolation[] = [];
  const seen = new Set<string>();

  const push = (v: StoryViolation) => {
    const key = `${v.violationClass}:${v.matchedText.trim().toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    violations.push(v);
  };

  // ── Class 1: named patients ────────────────────────────────────────────────
  for (const { re, why } of NAMED_PATIENT_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body))) {
      const name = m[1] ?? "";
      if (isAllowedName(name)) continue;
      push({
        violationClass: "named_patient",
        matchedText: m[0].trim(),
        index: m.index,
        explanation: `${why} ("${name}")`,
      });
    }
  }

  // ── Class 2: quoted patient dialogue ──────────────────────────────────────
  for (const { re, why } of QUOTED_DIALOGUE_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body))) {
      push({
        violationClass: "quoted_patient_dialogue",
        matchedText: m[0].trim().slice(0, 160),
        index: m.index,
        explanation: why,
      });
    }
  }

  // ── Classes 3 & 4: sentence-scoped ────────────────────────────────────────
  for (const { text, index } of sentences(body)) {
    const lower = text.toLowerCase();

    // Class 3 — individual-attributed clinical specifics.
    const hasClinical = CLINICAL_MARKERS.some((k) => lower.includes(k));
    if (hasClinical && INDIVIDUAL_SUBJECT.test(text) && NUMERIC.test(text) && !hasPopulationMarker(text)) {
      push({
        violationClass: "individual_clinical_specific",
        matchedText: text.trim().slice(0, 160),
        index,
        explanation: "states a specific clinical value for one individual, with no population framing",
      });
    }

    // Class 4 — invented recovery timeline for an individual.
    RECOVERY_TIMELINE.lastIndex = 0;
    if (RECOVERY_TIMELINE.test(text) && RECOVERY_VERB.test(text) && !hasPopulationMarker(text)) {
      if (INDIVIDUAL_SUBJECT.test(text) || new RegExp(`\\b${NAME}\\b`).test(text)) {
        push({
          violationClass: "invented_recovery_timeline",
          matchedText: text.trim().slice(0, 160),
          index,
          explanation: "asserts a specific recovery timeline for an individual as measured fact",
        });
      }
    }
  }

  // Composite mode: the audible label is what separates an honest composite
  // from a fabricated case. Its absence IS a violation, per spec.
  const COMPOSITE_LABEL = /\bcomposite\s+of\s+(?:patients|people|clients|cases)\b|\bcomposite\s+(?:case|patient|picture|sketch)\b|\bpatients?\s+I\s+see\s+all\s+the\s+time\b/i;
  const hasNarrative = /\[STORY\]/.test(rawBody) || /\bpatient\b|\bclient\b/i.test(body);
  const missingCompositeLabel = mode === "composite" && hasNarrative && !COMPOSITE_LABEL.test(rawBody);

  return { violations, missingCompositeLabel };
}

/**
 * Count spoken words, crediting each story slot at STORY_SLOT_WORD_CREDIT and
 * EXCLUDING the slot's instructional text.
 *
 * Why this exists: without it, a compliant script that emits two slots reads as
 * ~400 words short, trips the under-length continuation pass, and the model is
 * then explicitly asked to "deepen the thinnest [STORY] sections" — i.e. the
 * length enforcement would instruct the model to write the very story the
 * integrity rules forbid.
 */
export function countWordsWithStorySlots(body: string): {
  words: number;
  slotCount: number;
  spokenWords: number;
  creditedWords: number;
} {
  const open = STORY_SLOT_OPEN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const close = STORY_SLOT_CLOSE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const slotRe = new RegExp(`${open}[\\s\\S]*?${close}`, "g");
  const slotCount = (body.match(slotRe) ?? []).length;

  const withoutSlots = body.replace(slotRe, " ");
  const cleaned = withoutSlots
    .replace(/\[[A-Z_]+\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const spokenWords = cleaned ? cleaned.split(" ").length : 0;
  const creditedWords = slotCount * STORY_SLOT_WORD_CREDIT;

  return {
    words: spokenWords + creditedWords,
    slotCount,
    spokenWords,
    creditedWords,
  };
}

/** The `=== STORY INTEGRITY (NON-NEGOTIABLE) ===` prompt block. */
export function buildStoryIntegrityBlock(mode: StoryMode): string {
  const shared = [
    "=== STORY INTEGRITY (NON-NEGOTIABLE) ===",
    "You are writing for a licensed practitioner who has real patients. Inventing one is",
    "a fabrication that a listener cannot distinguish from a real case.",
    "",
    "NEVER invent a named individual — no first names, no bare appositives",
    '  (e.g. "Sarah, a brilliant executive in her late 50s" is FORBIDDEN).',
    "NEVER attribute quoted speech to a patient or client, in any word order.",
    "NEVER state an individual's test results, diagnosis, or recovery timeline",
    "  unless that exact material appears verbatim in the provided corpus.",
    "Population-level evidence IS allowed and encouraged when grounded:",
    '  "CRP dropped 40% across 200 participants" is fine; "her CRP was 8.2" is not.',
  ];

  if (mode === "brief") {
    return [
      ...shared,
      "",
      "STORY HANDLING — MODE: BRIEF (no narrative).",
      "Do not write a patient story at all. Where the structure calls for one, emit",
      "EXACTLY this block, filled in from THIS script's own pain points and mechanism:",
      "",
      STORY_SLOT_OPEN,
      "Suggested ~90-second shape:",
      "  1. Symptoms — the specific presentation this script has been describing.",
      "  2. Conventional dead end — what they were told or tried that failed.",
      "  3. What testing revealed — the mechanism this script teaches.",
      "  4. Intervention direction — the category of action, not a protocol.",
      "  5. Outcome arc — the shape of improvement, no invented numbers or dates.",
      "Use a real case; anonymize or say \"a composite of patients I've worked with.\"",
      STORY_SLOT_CLOSE,
      "",
      "The five shape lines must reference THIS script's actual symptoms and mechanism,",
      "not generic placeholders. Write no narrative prose inside the slot.",
      "=== END STORY INTEGRITY ===",
    ].join("\n");
  }

  if (mode === "composite") {
    return [
      ...shared,
      "",
      "STORY HANDLING — MODE: COMPOSITE (labelled narrative allowed).",
      "You MAY write a composite narrative, under these conditions:",
      "- It MUST open with an audible label the listener hears, e.g.",
      '  "Let me give you a composite of patients I see all the time..."',
      "  An UNLABELLED composite is a violation — it is indistinguishable from a real case.",
      "- NO proper names. Use \"this person\", \"they\", \"someone in this situation\".",
      "- NO invented quoted dialogue.",
      "- NO specific lab values, dosages, or timeframes stated as measured facts.",
      "  Describe direction and shape instead: \"inflammation markers came down\".",
      "=== END STORY INTEGRITY ===",
    ].join("\n");
  }

  return [
    ...shared,
    "",
    "STORY HANDLING — MODE: NONE.",
    "Omit story and case-narrative blocks entirely. Do NOT emit a [STORY] section",
    "and do NOT emit a story slot. Redistribute that time into [TEACH] sections:",
    "deeper mechanism, clearer sequencing, more specific practical instruction.",
    "=== END STORY INTEGRITY ===",
  ].join("\n");
}

/** Human-readable violation digest for the correction pass and error messages. */
export function formatViolations(
  violations: StoryViolation[],
  missingCompositeLabel = false
): string {
  const lines = violations.map(
    (v, i) => `${i + 1}. [${v.violationClass}] ${v.explanation}\n   → "${v.matchedText}"`
  );
  if (missingCompositeLabel) {
    lines.push(
      `${lines.length + 1}. [missing_composite_label] a composite narrative must open with an audible label the listener hears`
    );
  }
  return lines.join("\n");
}
