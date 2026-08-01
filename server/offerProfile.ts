/**
 * PART 3B — OFFER BINDING.
 *
 * The failure this fixes: a 15-minute script built a careful case for functional
 * testing, then closed on a generic brand CTA. The system had no concept of
 * "the offer", so the close could not name it.
 *
 * Design rule that drives everything below: PARTIAL IS WORSE THAN ABSENT.
 * A saved profile with an empty offerName would instruct the model to "name the
 * offer: ''" — and the model would fill that blank by inventing one. So
 * validation is all-or-nothing: extraction either returns a usable profile or
 * null, and a null profile omits the offer block entirely and generates unbound.
 */

export const OFFER_TYPES = ["product", "service", "program", "lead_magnet", "other"] as const;
export type OfferType = (typeof OFFER_TYPES)[number];

export interface OfferProfile {
  offerName: string;
  offerType: OfferType;
  deliverables: string[];
  guarantee: string | null;
  timeline: string | null;
  pricePoint: string | null;
  primaryCtaUrl: string | null;
  targetAction: string;
}

/**
 * MULTI-TIER (offer ladder).
 *
 * Discovered against the real corpus: "Beyond Normal Labs" ladders a course, a
 * $499 bundle, and a $299 app tier. A single-offer shape could not represent
 * that, so all-or-nothing validation rejected the whole page and bound nothing.
 *
 * The fix keeps all-or-nothing PER TIER (a partial tier is still discarded) and
 * surfaces every complete tier so the operator picks one at generation time.
 * We deliberately do NOT auto-pick a "primary" tier: which tier a given script
 * should close on is a commercial decision, not something to infer from copy.
 */
export interface OfferLadder {
  tiers: OfferProfile[];
}

/** Storage shape. `{ tiers: [...] }` going forward; a bare object still reads. */
export type StoredOffer = OfferLadder;

/** Max practical tips before the script gives away the reason to act. */
export const MAX_FREE_TIPS = 3;

/**
 * The extraction prompt. Explicitly instructs null over invention, because an
 * LLM asked for a "timeline" on a page that states none will happily produce
 * "12 weeks" — which then appears in a script as a commitment to a customer.
 */
export const OFFER_EXTRACTION_PROMPT = [
  "You are extracting the commercial offer(s) from marketing copy. Return ONLY JSON.",
  "",
  "Marketing pages often LADDER several purchasable tiers (e.g. a course, a",
  "higher-priced bundle, a cheaper app-only tier). Return EVERY distinct tier a",
  "buyer could purchase, as separate entries in `tiers`, richest description",
  "first. If the page sells exactly one thing, return a single entry.",
  "",
  "Schema:",
  "{ \"tiers\": [",
  "  {",
  '  "offerName": string,            // the offer as the buyer sees it named',
  '  "offerType": "product" | "service" | "program" | "lead_magnet" | "other",',
  '  "deliverables": string[],       // concrete things the buyer receives',
  '  "guarantee": string | null,     // refund/results promise, VERBATIM in substance',
  '  "timeline": string | null,      // stated duration or schedule',
  '  "pricePoint": string | null,    // stated price or price framing',
  '  "primaryCtaUrl": string | null, // the action URL if one appears',
  '  "targetAction": string          // the single action this copy drives',
  "  }",
  "] }",
  "",
  "RULES — these matter more than completeness:",
  "- NEVER invent a fact that is not in the copy. If the page states no guarantee,",
  "  return null. If it states no duration, return null. An invented refund term or",
  "  timeline becomes a promise to a real customer.",
  "- deliverables must be things the copy actually lists, not benefits you infer.",
  "- offerName must be the name used in the copy, not a description you compose.",
  "- A guarantee stated once for the whole page (e.g. a site-wide refund promise)",
  "  applies to the tiers it actually covers. Do not copy it onto a tier the copy",
  "  excludes from it.",
  "- Tiers must be genuinely purchasable options, NOT features, bonuses, or",
  "  chapters. If two names describe the same purchase, return one tier.",
  "- targetAction is the concrete next step (e.g. \"book a discovery call\",",
  "  \"purchase the 90-day program\"), phrased as an action.",
  "- If the copy contains no identifiable offer at all, return: { \"tiers\": [] }",
].join("\n");

/**
 * Validate an LLM extraction result into a profile or null.
 *
 * Rejects on: missing/blank offerName, missing/blank targetAction, empty
 * deliverables. Each of those, if allowed through, becomes a prompt instruction
 * with a hole in it that the model fills by fabricating.
 *
 * Unstated optional fields are normalised to null, never to "" — an empty string
 * reads to the model as "there is a guarantee, it is blank".
 */
export function validateOfferProfile(raw: unknown): OfferProfile | null {
  if (raw === null || raw === undefined) return null;

  let obj: any = raw;
  if (typeof obj === "string") {
    const trimmed = obj.trim();
    if (!trimmed || trimmed === "null") return null;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return null;

  const offerName = typeof obj.offerName === "string" ? obj.offerName.trim() : "";
  const targetAction = typeof obj.targetAction === "string" ? obj.targetAction.trim() : "";
  const deliverables = Array.isArray(obj.deliverables)
    ? obj.deliverables.filter((d: unknown) => typeof d === "string" && d.trim()).map((d: string) => d.trim())
    : [];

  // All-or-nothing: a partial profile is more dangerous than no profile.
  if (!offerName || !targetAction || deliverables.length === 0) return null;

  const offerType: OfferType = OFFER_TYPES.includes(obj.offerType) ? obj.offerType : "other";

  const optional = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    if (!t || t.toLowerCase() === "null" || t.toLowerCase() === "none") return null;
    return t;
  };

  return {
    offerName,
    offerType,
    deliverables,
    guarantee: optional(obj.guarantee),
    timeline: optional(obj.timeline),
    pricePoint: optional(obj.pricePoint),
    primaryCtaUrl: optional(obj.primaryCtaUrl),
    targetAction,
  };
}

/**
 * Validate an extraction into a ladder, accepting every shape we might see:
 * `{ tiers: [...] }` (current), a bare array, or a single object (legacy rows
 * written before multi-tier, and single-offer LLM replies that ignore the
 * wrapper). Invalid tiers are dropped individually — one malformed tier must not
 * discard the valid ones, which is what made the real page bind nothing.
 *
 * Duplicate offerNames are collapsed, keeping the first (richest) occurrence,
 * because a ladder listing the same purchase twice would show the operator two
 * identical choices.
 */
export function validateOfferLadder(raw: unknown): OfferLadder {
  let obj: any = raw;
  if (typeof obj === "string") {
    const trimmed = obj.trim();
    if (!trimmed || trimmed === "null") return { tiers: [] };
    try {
      obj = JSON.parse(trimmed);
    } catch {
      return { tiers: [] };
    }
  }
  if (obj === null || obj === undefined) return { tiers: [] };

  const candidates: unknown[] = Array.isArray(obj)
    ? obj
    : Array.isArray(obj?.tiers)
      ? obj.tiers
      : [obj];

  const tiers: OfferProfile[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    const v = validateOfferProfile(c);
    if (!v) continue;
    const key = v.offerName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tiers.push(v);
  }
  return { tiers };
}

/**
 * Resolve which tier a generation should bind to.
 *
 * No tier is auto-selected when several exist: binding silently to the first
 * tier would make the script sell a price point the operator never chose. With
 * exactly one tier there is no ambiguity to resolve, so it binds directly.
 */
export function selectOfferTier(
  ladder: OfferLadder,
  requestedOfferName?: string | null
): { profile: OfferProfile | null; reason: string } {
  const { tiers } = ladder;
  if (tiers.length === 0) {
    return { profile: null, reason: "no_offer" };
  }
  if (requestedOfferName) {
    const want = requestedOfferName.trim().toLowerCase();
    const hit = tiers.find((t) => t.offerName.toLowerCase() === want);
    if (hit) return { profile: hit, reason: "explicit_tier" };
    return { profile: null, reason: "requested_tier_not_found" };
  }
  if (tiers.length === 1) {
    return { profile: tiers[0], reason: "single_tier" };
  }
  return { profile: null, reason: "tier_not_chosen" };
}

/**
 * The `=== THE OFFER ===` prompt block.
 *
 * The guarantee line is emitted ONLY when a guarantee exists. Instructing the
 * model to "state the guarantee" when there is none is a direct invitation to
 * invent refund terms.
 */
export function buildOfferBlock(profile: OfferProfile): string {
  const lines = [
    "=== THE OFFER (what this script ultimately sells) ===",
    `Offer name: ${profile.offerName}`,
    `Offer type: ${profile.offerType}`,
    "Deliverables the buyer receives:",
    ...profile.deliverables.map((d) => `  - ${d}`),
  ];

  if (profile.timeline) lines.push(`Timeline: ${profile.timeline}`);
  if (profile.pricePoint) lines.push(`Price framing: ${profile.pricePoint}`);
  if (profile.primaryCtaUrl) lines.push(`Action URL: ${profile.primaryCtaUrl}`);
  lines.push(`TARGET ACTION: ${profile.targetAction}`);

  lines.push(
    "",
    "CTA REQUIREMENTS (the [CTA] section must satisfy all of these):",
    `- Name the offer explicitly: "${profile.offerName}".`,
    "- Cite at least TWO of the concrete deliverables listed above.",
    `- Drive the specific target action: ${profile.targetAction}.`
  );

  if (profile.guarantee) {
    lines.push(`- State the guarantee as written: ${profile.guarantee}`);
  } else {
    lines.push(
      "- This offer has NO stated guarantee. Do NOT mention, imply, or invent any",
      "  refund, results guarantee, or risk-free framing."
    );
  }

  lines.push(
    "",
    "TEACHING SECTIONS must build toward the target action: every mechanism you",
    "explain should make the next step feel necessary rather than optional.",
    "",
    `FREE-VALUE LIMIT: at most ${MAX_FREE_TIPS} practical tips in the entire script.`,
    "Each tip must connect back to why the target action is still the necessary",
    "next step. NEVER frame a tip as sufficient to resolve the core problem —",
    "a script that fully solves the problem for free removes the reason to act.",
    "=== END THE OFFER ==="
  );

  return lines.join("\n");
}

/**
 * A `ctaOverride` REPLACES offer binding rather than coexisting with it.
 * Two competing closes make the script argue with itself for fifteen minutes.
 */
export function buildCtaOverrideBlock(ctaOverride: string): string {
  return [
    "=== CTA OVERRIDE (authoritative) ===",
    "The [CTA] section must drive exactly this action, in the operator's words:",
    ctaOverride.trim(),
    "",
    "This REPLACES any other offer or call to action. Do not introduce a second",
    "offer, a competing next step, or a different program alongside it.",
    "=== END CTA OVERRIDE ===",
  ].join("\n");
}

/**
 * Parse a stored column value into a ladder. Handles legacy single-object rows.
 */
export function parseStoredOfferLadder(value: unknown): OfferLadder {
  if (value === null || value === undefined) return { tiers: [] };
  return validateOfferLadder(value);
}

/**
 * Back-compat helper for callers that only need "is there a bindable offer".
 * Returns a profile only when the stored ladder is unambiguous.
 */
export function parseStoredOfferProfile(value: unknown): OfferProfile | null {
  const ladder = parseStoredOfferLadder(value);
  return ladder.tiers.length === 1 ? ladder.tiers[0] : null;
}
