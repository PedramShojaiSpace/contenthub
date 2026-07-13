/**
 * Claims-Review Rubric
 * ─────────────────────────────────────────────────────────────────────────────
 * Editable config file. Each rule defines a category of health claim that
 * requires human review before publication. Rules are evaluated by the AI
 * rubric engine in claimsReviewRouter.ts.
 *
 * To add a rule: append to RUBRIC_RULES with a unique ruleId.
 * To disable a rule: set enabled: false.
 *
 * Meta-specific rules (meta_*) are evaluated by the metaComplianceCheck
 * procedure in claimsReviewRouter.ts before any ad is pushed to Meta.
 */

export interface RubricRule {
  ruleId: string;
  ruleName: string;
  description: string;
  enabled: boolean;
  severity: "block" | "warn"; // block = must be approved; warn = flagged but can auto-approve
  examples: string[]; // examples of violating language for the AI prompt
  metaOnly?: boolean; // true = only evaluated for Meta ad pre-flight checks
}

export const RUBRIC_RULES: RubricRule[] = [
  {
    ruleId: "disease_treatment_claim",
    ruleName: "Disease Treatment Claim",
    description:
      "Content claims a product or program treats, cures, prevents, or reverses a named disease or medical condition.",
    enabled: true,
    severity: "block",
    examples: [
      "cures leaky gut",
      "reverses autoimmune disease",
      "treats IBS",
      "eliminates candida",
      "heals your gut",
      "cures inflammation",
      "reverses diabetes",
    ],
  },
  {
    ruleId: "guaranteed_outcome",
    ruleName: "Guaranteed Outcome",
    description:
      "Content guarantees a specific health result or uses absolute language about outcomes (e.g., 'will', 'guaranteed', 'proven to').",
    enabled: true,
    severity: "block",
    examples: [
      "guaranteed to work",
      "will lose 20 pounds",
      "proven to eliminate",
      "100% effective",
      "you will feel better in 7 days",
      "scientifically proven to cure",
    ],
  },
  {
    ruleId: "undisclosed_testimonial",
    ruleName: "Undisclosed Testimonial",
    description:
      "Content includes a testimonial or success story without the required individual-results disclaimer.",
    enabled: true,
    severity: "block",
    examples: [
      "John lost 30 pounds",
      "Sarah reversed her condition",
      "I cured my gut issues",
      "client testimonial without disclaimer",
    ],
  },
  {
    ruleId: "diagnostic_as_treatment",
    ruleName: "Diagnostic Presented as Treatment",
    description:
      "A diagnostic test (e.g., Orobiome, GI Map, KBMO FIT 176) is described as a treatment rather than an informational screening tool.",
    enabled: true,
    severity: "block",
    examples: [
      "the test will fix your gut",
      "testing cures your microbiome",
      "the Orobiome test treats oral disease",
      "GI Map heals your gut",
    ],
  },
  {
    ruleId: "missing_disclaimer",
    ruleName: "Missing Required Disclaimer",
    description:
      "Health-related content is missing the required disclaimer: 'This information is for educational purposes only and is not intended to diagnose, treat, cure, or prevent any disease.'",
    enabled: true,
    severity: "warn",
    examples: [
      "no disclaimer present on health advice content",
      "medical advice without FDA disclaimer",
    ],
  },
  {
    ruleId: "physician_endorsement_implied",
    ruleName: "Implied Physician Endorsement",
    description:
      "Content implies that Dr. Shojai's medical credentials constitute a clinical endorsement of a specific health outcome for the reader.",
    enabled: true,
    severity: "block",
    examples: [
      "as a doctor, I guarantee this will work for you",
      "my medical training proves this cures",
      "clinically proven by Dr. Shojai",
    ],
  },
  {
    ruleId: "fda_unapproved_claim",
    ruleName: "FDA-Unapproved Structure/Function Claim",
    description:
      "Supplement content makes a structure/function claim that has not been reviewed or that implies disease treatment (e.g., 'repairs your gut lining' vs. 'supports gut lining integrity').",
    enabled: true,
    severity: "warn",
    examples: [
      "repairs leaky gut",
      "fixes your microbiome",
      "cures oral disease",
      "heals the gut barrier",
    ],
  },

  // ─── Meta-Specific Ad Policy Rules ─────────────────────────────────────────
  // These rules enforce Meta's Advertising Policies for health/wellness ads.
  // They are evaluated by the metaComplianceCheck procedure before any ad push.
  // Meta's Personal Attributes Policy, Cosmetic Procedures and Wellness Policy,
  // and Health & Wellness categorization rules (2025-2026) apply.

  {
    ruleId: "meta_personal_attributes",
    ruleName: "Meta: Personal Attributes Violation",
    description:
      "Ad copy uses second-person language that asserts or implies knowledge of the viewer's personal health status, medical condition, or physical attributes. Meta's Personal Attributes Policy prohibits asserting or implying that you know a user's personal characteristics. This includes framing like 'You\'re exhausted', 'Your anxiety', 'You\'re not depressed', or 'You\'re struggling with'. Reframe as third-person educational statements or general population observations.",
    enabled: true,
    severity: "block",
    metaOnly: true,
    examples: [
      "You're exhausted in a way that sleep doesn't fix",
      "The anxiety is still there",
      "You're not lazy. You're not depressed.",
      "You're not distracted. You're not unmotivated.",
      "You're exhausted at a cellular level",
      "You're waking up at 3am completely wired",
      "The fog is real",
      "Your immune system is attacking your own tissue",
      "Tired of your chronic insomnia?",
      "Sick of your anxiety attacks?",
      "If you suffer from chronic fatigue",
      "Do you have brain fog?",
    ],
  },
  {
    ruleId: "meta_disease_treatment_language",
    ruleName: "Meta: Disease/Treatment Framing",
    description:
      "Ad copy uses language that implies the product or program will treat, fix, repair, or resolve a medical condition or its root cause. Meta rejects ads that frame health products as solutions to diseases or medical problems. 'Repairing', 'fixing', 'healing', 'addressing the root cause', 'has a solution', and 'changes everything' in a health context are high-risk. Replace with structure-function language: 'supports', 'promotes', 'may help maintain', 'is associated with'.",
    enabled: true,
    severity: "block",
    metaOnly: true,
    examples: [
      "repairing the root cause",
      "begin repairing the gut barrier",
      "repair the barrier",
      "This is a biology problem. And it has a solution.",
      "This is a biology problem. And it has a measurable solution.",
      "address the root cause",
      "addressing the biological root",
      "fix the underlying cause",
      "heals the gut barrier",
      "restore the anti-inflammatory signaling",
      "reduce the inflammatory load",
      "linked to chronic fatigue, brain fog, and systemic inflammation in tens of thousands of patients",
      "triggers a cascade of symptoms",
    ],
  },
  {
    ruleId: "meta_physician_endorsement_risk",
    ruleName: "Meta: Physician Credential + Outcome Claim Risk",
    description:
      "Ad copy combines Dr. Shojai's physician credentials (OMD, doctor, medical training) with specific health outcome claims in a way that implies clinical endorsement. Meta's policies flag expert endorsements that assert specific health results. The risk is especially high when credentials appear in the same sentence or paragraph as outcome language. Keep credential mentions purely in brand context (e.g., 'founded by Dr. Pedram Shojai, OMD') and separate from any health outcome statements.",
    enabled: true,
    severity: "warn",
    metaOnly: true,
    examples: [
      "Dr. Shojai recommends this for patients with anxiety",
      "As an OMD, I've seen this work for hundreds of patients",
      "Dr. Pedram Shojai, OMD, created this protocol to treat",
      "my medical background confirms this will fix",
      "clinically designed by Dr. Shojai to address your condition",
    ],
  },
];

// ─── Rubric prompt builder ────────────────────────────────────────────────────

export function buildRubricSystemPrompt(includeMetaRules = false): string {
  const activeRules = RUBRIC_RULES.filter(
    (r) => r.enabled && (includeMetaRules || !r.metaOnly)
  );

  const ruleDescriptions = activeRules
    .map(
      (r) =>
        `Rule "${r.ruleId}" (${r.ruleName}, severity: ${r.severity}): ${r.description}\n  Violating examples: ${r.examples.join("; ")}`
    )
    .join("\n\n");

  const metaContext = includeMetaRules
    ? `
META AD POLICY CONTEXT (applies when reviewing ad copy for Meta/Facebook/Instagram):
- Meta's Personal Attributes Policy forbids asserting or implying knowledge of a user's personal characteristics, including health conditions.
- Second-person health-status language ("You're exhausted", "Your anxiety") is a primary rejection trigger.
- Structure-function language is required: "supports", "promotes", "may help maintain" are safe. "Treats", "repairs", "fixes", "has a solution" are not.
- Expert/physician endorsements combined with specific health outcomes are high-risk.
- The FDA disclaimer must be clearly visible on the landing page.
`
    : "";

  return `You are a health-claims compliance reviewer for The Urban Monk brand, operated by Dr. Pedram Shojai, OMD.

Your task is to review marketing content and flag any violations of the following compliance rules. Dr. Shojai's brand operates in the health and wellness space. The FTC, FDA, and medical board standards apply.
${metaContext}
COMPLIANCE RULES:
${ruleDescriptions}

IMPORTANT CONTEXT:
- "Supports", "promotes", "may help", "can contribute to" are acceptable language.
- "Treats", "cures", "reverses", "heals", "eliminates" (applied to diseases) are NOT acceptable.
- Diagnostic tests (Orobiome, GI Map, KBMO FIT 176) must be described as informational screening tools, not treatments.
- Testimonials must include: "Results are not typical. Individual results may vary."
- All health content must include the standard educational disclaimer.
- Dr. Shojai's credentials (OMD) may be mentioned but must not be used to imply clinical guarantees.

OUTPUT FORMAT:
Return a JSON object with this exact structure:
{
  "verdicts": [
    {
      "ruleId": "<ruleId from above>",
      "ruleName": "<ruleName>",
      "passed": true | false,
      "flaggedText": "<exact quote from content that triggered this rule, or null if passed>",
      "explanation": "<brief explanation of why this passed or failed>"
    }
  ],
  "overallFlag": true | false,
  "summary": "<1-2 sentence summary of the review>"
}

Review ALL rules, even if the content is clean. Set "passed": true for rules with no violations.`;
}

export function getActiveRules(includeMetaRules = false): RubricRule[] {
  return RUBRIC_RULES.filter(
    (r) => r.enabled && (includeMetaRules || !r.metaOnly)
  );
}

export function getBlockingRules(includeMetaRules = false): RubricRule[] {
  return RUBRIC_RULES.filter(
    (r) => r.enabled && r.severity === "block" && (includeMetaRules || !r.metaOnly)
  );
}

export function getMetaOnlyRules(): RubricRule[] {
  return RUBRIC_RULES.filter((r) => r.enabled && r.metaOnly === true);
}
