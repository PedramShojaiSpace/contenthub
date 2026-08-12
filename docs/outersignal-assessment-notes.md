# OuterSignal Assessment Notes

## Initial First-Party Review

The OuterSignal product site describes a Shopify-connected customer-intelligence product centered on customer enrichment, VIP detection, segmentation, and e-commerce personalization. Its advertised outputs include matched professional or public-facing customer profiles, business and retail opportunity signals, purchase-behavior analysis, persona clusters, geographic and demographic patterns, and audience exports to Meta and Klaviyo.

The initial feature review identifies four relevant capability groups for The Urban Monk: VIP and partnership detection; B2B or employer/retail opportunity detection among existing customers; persona and lifecycle segmentation for Klaviyo; and enriched audience creation for Meta. These are vendor-stated capabilities and should be validated with an actual store data sample before being treated as reliable operating inputs.

## Initial Content Hub Positioning

OuterSignal should be considered an enrichment layer, not a replacement for the Content Hub’s first-party lead, order, funnel, or attribution data. The Content Hub should retain source-of-truth ownership of consent, UTM acquisition, purchase, cohort, and message-click records. Enrichment records should be stamped with provider, match confidence, retrieval time, and a clear permissible-use flag before they are used for sales outreach, marketing audiences, or personalization.

## Integration, Scope, and Governance Findings

OuterSignal’s Shopify App Store listing states that it works with Shopify Admin, Attentive, Gorgias, Klaviyo, Postscript, Recharge, and Yotpo, and describes integrations with Klaviyo, Meta, Slack, and other tools. Its public pricing description distinguishes a limited free tier from paid plans that include historical search, persona analytics, full demographic data, and integrations. The same listing reports that the app requests access to sensitive customer data (name, email, phone, physical address), device/activity information, customer records, products, and all order history. This makes vendor diligence and a minimum-data pilot mandatory before broad use.

The vendor’s product materials describe the following possible enrichment outputs: consumer demographics; professional or occupational context; public social profiles and follower/influence signals; interests and household/lifestyle context; VIP/influencer/executive/retail-opportunity flags; AI-generated personas; and automation or audience activation through Klaviyo, Meta, Slack, PostPilot, Braze, Attentive, Customer.io, Segment, BigQuery, or API/webhooks. Its public materials also state US-only coverage and note Shopify as the deepest native experience. These are vendor statements, not independently verified performance claims.

## Initial Integration Recommendation

1. Use OuterSignal only on Shopify customer and order records in a 30-day pilot. Do not send Manus/Content Hub opt-in-only leads until consent, data minimization, and identity-match policy are reviewed.
2. Keep the Content Hub as the system of record for source UTM, opt-in date, consent, funnel cohort, purchase, and email/SMS click attribution. Treat OuterSignal as a non-authoritative enrichment overlay.
3. Ingest only a reduced enrichment schema into the Content Hub: `provider`, `provider_customer_id`, `matched_at`, `match_confidence`, `persona`, `vip_flag`, `influencer_flag`, `b2b_opportunity_flag`, `occupation_category`, `interest_tags`, `social_reach_band`, and `permissible_use`. Do not replicate raw home value, detailed location, or full social-profile URLs unless a specific approved workflow requires them.
4. Pilot three measurable plays: (a) Slack/manual review for possible VIP, partnership, and wholesale/retail signals; (b) Klaviyo persona tags for editorial and offer personalization, excluding health-condition targeting; and (c) Meta lookalike seed exports from high-LTV personas. Use a holdout/control and measure incremental revenue, not vendor-reported lift.

## Sources

- https://www.outersignal.com/ — product positioning and feature descriptions, accessed 2026-08-12.
- https://apps.shopify.com/outersignal — app capabilities, integrations, pricing, and requested Shopify permissions, accessed 2026-08-12.
- https://www.outersignal.com/blog/clearbit-alternatives-ecommerce.html — vendor description of enrichment outputs, integrations, US coverage, and stated limitations, accessed 2026-08-12.

## Verified Access Requirement for the Content Hub Pilot

OuterSignal’s current pricing page lists **Custom API Access** on both the Starter ($49/month) and Pro ($199/month) plans. Therefore, an API-level plan is required only if the Content Hub is to receive enrichment data directly through OuterSignal’s API or webhooks; it is not required for the narrower proof-of-value path that uses Shopify installation, native Klaviyo sync, native alerts, and manual dashboard review. The public pricing page describes Starter as including one integration and one automated playbook, while Pro includes unlimited integrations and playbooks, persona analytics access, white-glove onboarding, and a dedicated success manager.

For the requested implementation, the relevant distinction is operational rather than simply technical. The native path needs Shopify plus Klaviyo as one activation channel and can be piloted without a custom Content Hub connection. A direct Content Hub intelligence panel needs the Custom API/webhook channel, a vetted API key, a documented event/payload contract, and a minimum-data ingestion service. Because the public plan page indicates Custom API Access is included in Starter as well as Pro, the $199 Pro tier is **not demonstrably required for API access alone**. It may still be justified if the pilot needs more than one integration or playbook, richer persona analytics, vendor-led onboarding, or an operationally simpler setup.

OuterSignal’s product material also describes open API and webhooks, two-way Klaviyo/Shopify sync, Klaviyo attribute/persona/VIP-tag delivery, real-time order enrichment, and historical backfill. The exact endpoints, authentication method, webhook signature, rate limits, available attributes, and trial restrictions are not publicly documented in the sources reviewed. Those details must be confirmed in the account dashboard or with OuterSignal support before implementation.

### Updated Sources

- https://www.outersignal.com/pricing — current Starter and Pro entitlement comparison, accessed 2026-08-12.
- https://www.outersignal.com/compare/mercana — vendor description of open API, webhooks, two-way sync, and activation, accessed 2026-08-12.
- https://www.outersignal.com/blog/why-outersignal.html — vendor description of Klaviyo attributes/tags, real-time enrichment, and custom API/webhook integration, accessed 2026-08-12.

## Proposed Minimum-Data Pilot Design

### Scope

The initial pilot should enrich **Shopify purchasers only** and separate results by `funnel_id` (`interconnected_agora` or `tantra`). It should not enrich quiz or opt-in-only leads in the first phase. This means the initial operational benefit is post-purchase segmentation, relationship/VIP discovery, replenishment and cross-sell personalization, and purchaser-derived Meta seed audiences — not a change to cold-lead acquisition messaging.

### Data Flow

1. Shopify `orders/paid` continues to supply the Content Hub's source-of-truth order, UTM, click-token, and Meta CAPI attribution record.
2. OuterSignal enriches the same Shopify buyer and sends persona/VIP information to Klaviyo using its native integration.
3. If Custom API/webhooks are enabled, OuterSignal sends an enrichment event to a signed Content Hub endpoint. The endpoint uses an idempotency key and writes a minimized enrichment record linked by Shopify customer/order ID and normalized email.
4. The Content Hub dashboard joins first-party funnel and revenue data to the enrichment overlay but never uses enrichment attributes to overwrite acquisition source, consent, order value, or attribution.

### Content Hub Fields

Store only: provider identifier, provider customer/order identifier, match status/confidence, enrichment timestamp/version, funnel ID, persona, VIP/influencer/B2B-opportunity flags, occupation category, broad interest tags, social-reach band, an approved-use flag, and import/delete timestamps. Do not retain precise address, raw property value, detailed household data, social-profile URLs, or medical/health inference fields.

### Klaviyo Field Namespace and Activation

OuterSignal-fed properties should be namespaced to avoid collision with the Content Hub's existing Shopify purchase and quiz properties: `um_os_status`, `um_os_persona`, `um_os_vip`, `um_os_influencer`, `um_os_b2b_opportunity`, `um_os_occupation_category`, `um_os_social_reach_band`, `um_os_enriched_at`, and `um_os_activation_eligible`.

The first automated playbooks should be narrow and reversible: (1) alert the team for VIP/B2B signals; (2) set persona properties on already-consented Klaviyo purchaser profiles; and (3) branch a post-purchase/re-engagement flow only when `um_os_activation_eligible=true`. Do not branch a flow on sensitive consumer attributes, and do not use an enrichment tag to create or infer a health condition.

### Controlled Test

For each funnel, limit the first test to enriched, marketing-eligible purchasers. Randomly split them between the current generic post-purchase/re-engagement content and one persona-tailored variant, while keeping offer, cadence, sending domain, and audience eligibility constant. Evaluate delivered rate, click rate, conversion rate, revenue per recipient, and unsubscribes. Keep the generic branch as the control and stop the test if complaint/unsubscribe measures materially worsen or if data quality is not acceptable.

### Vendor Confirmation Required Before Build

Confirm whether a free trial grants Custom API/webhook access; whether Starter's one integration can simultaneously support Klaviyo and a separate Content Hub API/webhook channel; API authentication and scopes; webhook event schema, signing, retry policy, and deletion/opt-out handling; and whether trial/historical enrichment includes the intended Shopify customer population. If Klaviyo plus custom API are counted as two integrations, Pro is the practical plan for the requested architecture.
