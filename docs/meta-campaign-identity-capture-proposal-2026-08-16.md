# First-Party Meta Campaign Identity Capture Proposal

**Purpose:** Make future Agora-only lead, phone, and SMS reporting exact from first-party records without a recurring Meta reporting call.  
**Status:** Implemented August 16, 2026. The Content Hub Interconnected static opt-in now persists the approved first-party fields from invisible URL parameters; no visual form, offer, checkout, pixel, CRM, automatic Meta-refresh, or historic-lead change was made. The operating handoff is in `docs/meta-campaign-identity-url-params-for-curt-2026-08-16.md`.

## Current Gap

The Interconnected landing pages already preserve `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `fbclid`, `fbp`, and `fbc` from the URL into the lead record. The registration contract does not retain a Meta campaign ID, ad-set ID, ad ID, or immutable first-party campaign key. Historic UTM labels cannot be joined exactly to a Meta campaign inventory after the fact.

## Minimal Future Contract

| Field | Source at ad click | Stored on lead | Purpose |
|---|---|---|---|
| `meta_campaign_id` | Meta URL macro `{{campaign.id}}` | Nullable string | Exact campaign identity. |
| `meta_adset_id` | Meta URL macro `{{adset.id}}` | Nullable string | Audience and ad-set audit. |
| `meta_ad_id` | Meta URL macro `{{ad.id}}` | Nullable string | Creative-level audit. |
| `meta_campaign_key` | Human-controlled canonical label | Nullable string | Stable reporting family, e.g. `interconnected_agora_2026_08`. |
| Existing UTM and click fields | Current URL/cookies | Unchanged | Continuity and CAPI matching. |

The Meta ad destination URL would include the existing UTM convention plus the three dynamic identifiers and a fixed campaign key. Example structure only:

```text
https://content.theurbanmonk.com/interconnected?utm_source=meta&utm_medium=paid_social&utm_campaign=interconnected_agora_2026_08&utm_content={{ad.name}}&meta_campaign_id={{campaign.id}}&meta_adset_id={{adset.id}}&meta_ad_id={{ad.id}}&meta_campaign_key=interconnected_agora_2026_08
```

## Implementation Boundary

The technical change is intentionally non-visual: extend the existing `interconnectedLeads` schema, registration input validation, and hidden URL-parameter forwarding in the current static landing-page code. It does not alter headline, form fields, form validation, offer, checkout, CTA, load behavior, pixels, or automatic Meta refresh behavior. It also does not retroactively write historic leads.

## Exact Reporting Rule

Future “Agora-only” reporting should accept only leads whose captured `meta_campaign_id` maps to an approved campaign registry entry or whose immutable `campaign_key` equals the approved Agora key. The report should continue to present a separate quality flag for missing identifiers rather than inferring campaign membership from partial UTM text.

## Validation Plan

After approval and one coordinated new ad-link launch, inspect the **first genuine opt-in** read-only. Confirm all four campaign fields, existing UTM values, and click identifiers are persisted; confirm no landing-page visual change; and verify that the campaign registry produces one exact Agora-only numerator and denominator without making an automatic Meta API request.

> **Next operational step:** Curt applies the final destination URL template in Meta. After the first genuine submission, perform the read-only first-lead validation described above.
