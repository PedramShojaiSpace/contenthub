/**
 * Claims-Review Rubric
 * ─────────────────────────────────────────────────────────────────────────────
 * Editable config file. Each rule defines a category of health claim that
 * requires human review before publication. Rules are evaluated by the AI
 * rubric engine in claimsReviewRouter.ts.
 *
 * To add a rule: append to RUBRIC_RULES with a unique ruleId.
 * To disable a rule: set enabled: false.
 */

export interface RubricRule {
  ruleId: string;
  ruleName: string;
  description: string;
  enabled: boolean;
  severity: "block" | "warn"; // block = must be approved; warn = flagged but can auto-approve
  examples: string[]; // examples of violating language for the AI prompt
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
];

// ─── Rubric prompt builder ────────────────────────────────────────────────────

export function buildRubricSystemPrompt(): string {
  const activeRules = RUBRIC_RULES.filter((r) => r.enabled);

  const ruleDescriptions = activeRules
    .map(
      (r) =>
        `Rule "${r.ruleId}" (${r.ruleName}, severity: ${r.severity}): ${r.description}\n  Violating examples: ${r.examples.join("; ")}`
    )
    .join("\n\n");

  return `You are a health-claims compliance reviewer for The Urban Monk brand, operated by Dr. Pedram Shojai, OMD.

Your task is to review marketing content and flag any violations of the following compliance rules. Dr. Shojai's brand operates in the health and wellness space. The FTC, FDA, and medical board standards apply.

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

export function getActiveRules(): RubricRule[] {
  return RUBRIC_RULES.filter((r) => r.enabled);
}

export function getBlockingRules(): RubricRule[] {
  return RUBRIC_RULES.filter((r) => r.enabled && r.severity === "block");
}
