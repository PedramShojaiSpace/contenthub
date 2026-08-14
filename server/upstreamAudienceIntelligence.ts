/**
 * Evidence-based audience layer distilled from the Upstream Health Audience
 * Persona (11 Aug 2026). This is deliberately scoped to health, sleep, gut,
 * inflammation, and recovery content; it must not be generalized to Tantra or
 * unrelated relationship campaigns without supporting research.
 */

const UPSTREAM_TOPIC_TERMS = [
  "upstream",
  "gut",
  "microbiome",
  "sleep",
  "fatigue",
  "brain fog",
  "pain",
  "inflammation",
  "detox",
  "health",
  "wellness",
  "root cause",
  "oral health",
  "bloating",
  "energy",
];

export function getUpstreamAudienceIntelligenceBlock(topic: string): string {
  const normalizedTopic = topic.toLowerCase();
  const isRelevant = UPSTREAM_TOPIC_TERMS.some((term) => normalizedTopic.includes(term));
  if (!isRelevant) return "";

  return [
    "=== UPSTREAM HEALTH EVIDENCE LAYER (use only for health/recovery content) ===",
    "AUDIENCE: The Exhausted Expert — a person who has become a reluctant expert in a long-running health struggle after trying supplements, clinicians, self-research, and diets.",
    "MESSAGE ORDER: Lead with the relief they want; then offer a clearer next step and the confidence of knowing they are doing all they can. Frame the outcome as restoration — getting back to themselves — not becoming a new person.",
    "SPECIFIC HUMAN TEXTURE: When relevant, respectfully acknowledge the 2–4 AM wake-up, compromised energy, bloating, brain fog, pain, or the burden of constantly managing the next relief route. Never diagnose or imply the reader has any symptom.",
    "DEEPER DESIRE: Connect restored capacity to presence with family, purposeful work, contribution, and service — not only to symptom reduction.",
    "TONE GUARDRAILS: Self-blame is already high. Validate effort and avoid shaming phrases such as ‘you wasted money,’ ‘you failed,’ or ‘supplement graveyard.’ Treat an anti-quick-fix, honest time horizon as a trust signal; do not promise a cure, speed, or certainty.",
    "HEADLINES: Prefer restoration and relief over makeover language. Examples: ‘A clearer next step when your body has become a full-time job,’ ‘Getting back to the life you recognize,’ or ‘A steadier way forward after trying everything.’",
    "CTAS: Use low-pressure invitations that restore agency, such as ‘See the framework,’ ‘Understand the next step,’ or ‘Explore the full conversation.’ Do not pressure a sick or exhausted reader with fear, urgency, or assumed failure.",
    "PROOF DISCIPLINE: Their central fear is that this will fail like everything else. Use only verifiable credentials, studies, case material with consent, and named program details. Never fabricate a testimonial, customer outcome, guarantee, or statistic.",
    "=== END UPSTREAM HEALTH EVIDENCE LAYER ===",
  ].join("\n");
}
