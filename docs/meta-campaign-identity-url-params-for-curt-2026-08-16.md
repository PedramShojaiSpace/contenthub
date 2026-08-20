# Curt Handoff: Agora Meta Campaign Identity URL Parameters

**Status:** Implemented in the Content Hub’s `/interconnected` opt-in capture on August 16, 2026. The four values below are stored invisibly with each future Interconnected lead. The page layout, form fields, offer, checkout, pixels, and manual-only Meta refresh behavior are unchanged.

Use this parameter set on every future **Agora → Interconnected** Meta ad whose final destination resolves to the Content Hub Interconnected opt-in page. Keep the existing UTM parameters intact; append the four first-party identity parameters below. The fields make future campaign membership auditable from the lead record rather than inferred from campaign-name text.[1]

| URL parameter | Populate with | Example purpose |
|---|---|---|
| `meta_campaign_id` | `{{campaign.id}}` | Exact Meta campaign identity. |
| `meta_adset_id` | `{{adset.id}}` | Exact audience/ad-set identity. |
| `meta_ad_id` | `{{ad.id}}` | Exact creative/ad identity. |
| `meta_campaign_key` | A human-controlled, lower-case stable family key | Lets reporting group a deliberate Agora campaign family even if Meta names later change. |

## Destination URL Template

Replace the bracketed campaign key with the actual approved value for the campaign. Do not use spaces; use lower-case letters, numbers, and underscores. The example below uses `agora_interconnected_us_2026_08`.

```text
https://content.theurbanmonk.com/interconnected?utm_source=meta&utm_medium=paid_social&utm_campaign=agora_interconnected_us_2026_08&utm_content={{ad.name}}&meta_campaign_id={{campaign.id}}&meta_adset_id={{adset.id}}&meta_ad_id={{ad.id}}&meta_campaign_key=agora_interconnected_us_2026_08
```

If a destination already has the established UTM structure, do not replace it. Append only the four `meta_*` parameters, ensuring the actual final URL points to the Content Hub Interconnected registration flow.

## Operating Rules

The campaign key should identify a lasting reporting family, not a transient creative. For example, all August 2026 US Agora Interconnected variants can use `agora_interconnected_us_2026_08`, while a new country, funnel, or dated test should receive a different key. The three Meta macros should remain exactly as shown so Meta supplies the numeric object IDs at click time.

After the first genuine opt-in from a newly tagged ad, notify the Content Hub operator for a read-only validation. The expected result is one lead record containing the existing UTM/click information and all four `meta_*` fields. There is no historic backfill, no additional Meta reporting call, and no change to campaign delivery settings in this implementation.[1]

## References

[1]: ./meta-campaign-identity-capture-proposal-2026-08-16.md "First-Party Meta Campaign Identity Capture Proposal"
