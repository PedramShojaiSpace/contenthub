# Interconnected LP-3 and Shopify Meta Pixel Verification

**Verification date:** September 18, 2026  
**Scope:** Interconnected acquisition path: Unbounce LP-3 → Klaviyo → Content Hub thank-you → Shopify product/checkout  
**Pixel:** Urban Monk Pixel `1498608757116877`

## Result

The controlled email-only test and public-source audit confirm that the Interconnected LP-3 acquisition path is correctly configured for a single Meta Lead event, server-side CAPI deduplication, Klaviyo email enrollment, and a Shopify handoff. No SMS enrollment was created.

| Funnel stage | Verification result | Evidence |
|---|---|---|
| Unbounce LP-3 page load | Passed | One Pixel initialization and one browser `PageView` are present for the Urban Monk Pixel. |
| LP-3 form submission | Passed | The obsolete `klaviyoForms` listener was removed. Exactly one form-submit `Lead` call remains. |
| Browser/server deduplication | Passed | The live script creates one `um_event_id`, sends it with the browser `Lead`, and persists it for server-side CAPI use. |
| First-party lead record | Passed | The approved test created one privacy-minimized lead record attributed to `ko_klaviyo`. |
| Klaviyo enrollment | Passed | The test record shows a successful Klaviyo sync. |
| SMS consent | Passed | The approved test used no phone number and an unchecked SMS box; no SMS consent was recorded. |
| Meta CAPI Lead | Passed | The same test record shows a successful CAPI Lead delivery. |
| Thank-you page | Passed | The page loads a Pixel `PageView` only and does not emit a second `Lead`. |
| Shopify product page | Passed | Shopify initializes the same Urban Monk Pixel through its Shopify web-pixel sandbox and product analytics runtime. |
| Shopify event health | Passed | Meta Events Manager shows active `ViewContent`, `AddToCart`, `InitiateCheckout`, and `Purchase` events for the same data source, with both Meta Pixel and Conversions API integrations present. |

## Final live contract

> **LP-3 owns the Lead event.** The Unbounce page sends one browser Lead and shares its event ID with the first-party server receiver, which sends the matched CAPI Lead. The Content Hub thank-you page must not send another Lead.

The tracked Shopify handoff continues to preserve the first-party click token and UTM parameters through cart attributes. Shopify is the paid-order and revenue authority for this funnel.

## Remaining observation, not a launch blocker

Meta Events Manager reports that some event match-quality scores have improvement recommendations. This is a platform optimization opportunity, not a pixel installation failure: all core events are active and recent. Any event-match improvement should be treated as a separate, measured optimization rather than changing the current launch path immediately.

## Safe launch status

**Ready for controlled paid traffic.** Keep the existing naming contract: campaign or ad set name must include `Interconnected KO` for the dedicated reconciliation ledger. Do not activate SMS without explicit consent. The next genuine Shopify purchase is the remaining passive validation point for paid-order attribution; no test purchase was created.
