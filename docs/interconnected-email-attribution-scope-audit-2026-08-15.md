# Interconnected Email Attribution Scope Audit

**Reference date:** 2026-08-15 Central Time

## Objective

Build a decision-grade view of the Interconnected 14-day funnel that connects each email’s delivery and engagement to checkout starts, purchases, cumulative revenue, lead-to-purchase lag, and the originating acquisition campaign. The report must keep the Kajabi payment path and the KO/Klaviyo-to-Shopify payment path distinct.

## Verified source capabilities

Klaviyo’s **Reporting API** is the appropriate source for send-date-based message performance that matches the Klaviyo interface. A flow-values report can return statistics by `flow_message_id`, `flow_id`, and email channel, including opens, clicks, click rates, delivery rates, and conversion measures when supplied with a conversion metric. This can support a per-email Klaviyo scorecard rather than a flow-wide aggregate.[1]

Klaviyo’s **Metric Aggregates API** can supplement the scorecard with event-time analysis such as unique opens, unique clicks, started-checkout activity, and revenue grouped by `$message` or `$attributed_message`. Its dates are based on the time of the event rather than the message-send date, so it must not be substituted for send-cohort reporting when comparing results to the Klaviyo UI.[2] [3]

| Data domain | Current evidence | Intended reporting use | Confidence |
|---|---|---|---|
| Interconnected lead cohort | 2,194 first-party lead records, with original UTM fields | Acquisition cohort, original campaign, lead date, 14-day clock | High |
| KO/Klaviyo click and Shopify path | 13 first-party tracked clicks; `/r/checkout` persists source, medium, campaign, content, click token, and order attributes | Direct email-touch checkout and Shopify revenue credit | High for tracked future clicks; limited historical coverage |
| Shopify attributed sales | 3 captured rows, last received 2026-07-15 | Order-level source, UTM, direct/probabilistic attribution, and revenue | Limited historical coverage |
| Kajabi purchase webhook | 101 captured purchases; Interconnected-related records include $67 and downstream offers | Kajabi payment-stack revenue and lead-cohort LTV | High for captured purchase revenue; message click identity not currently present |
| Klaviyo flow reporting | Official API supports message-level values/series reports | Delivered/opened/clicked and platform-attributed conversion performance per Klaviyo flow email | Feasible pending read scope verification |
| Kajabi email engagement reporting | Active Day 0 sequence and email are identified in Kajabi; the authenticated analytics view shows offer-level revenue | Per-sequence and per-email sent, delivered, opened, clicked, customer, and net-revenue reporting | Feasible through Kajabi reports; direct automated collection path still needs confirmation |

### Klaviyo access test

A read-only flow-values request against live Interconnected flow `VMpbLV` completed successfully for the 14-day period ending 2026-08-15T21:23:28Z. The current private key exposes the Shopify `Placed Order` conversion metric (`VkbnD6`) plus Klaviyo `Received Email`, `Opened Email`, and `Clicked Email` metrics.

The report returned one row per flow message and channel, including recipients, delivered, delivery rate, opens, open rate, clicks, click rate, conversion uniques, and conversion value. For example, the live Day 0 email message (`XzP5hq`) returned six recipients, six deliveries, thirteen total opens, eleven total clicks, a 33.333% click rate, and no Shopify-attributed conversion in the tested window. The limited recipient count means this is **capability proof, not a performance conclusion**.

## Attribution contract

The report will use two labels, never silently interchange them:

1. **Closing-touch credit** identifies the specific email that created a first-party tracked checkout click or platform-attributed conversion.
2. **Acquisition-cohort credit** assigns all qualifying revenue within 14 days of opt-in back to the original lead’s acquisition UTM campaign, even if the ultimate purchase followed a later email touch.

For every report row, revenue will be classified as **direct-email-click**, **platform-attributed**, **cohort-matched without email-click proof**, or **unattributed**. The report should show all four rather than over-claiming email causation.

## Known build requirements

The KO/Klaviyo path can achieve direct email-to-Shopify order matching because the first-party checkout bridge stores a click token and preserves `utm_source`, `utm_medium`, `utm_campaign`, and `utm_content` in the Shopify order path. The new KO email routes use a message-identifying `utm_content` value and should be extended so every individual Day 1–14 email has a stable, unique message key.

The Kajabi path already captures purchase revenue and associated lead cohorts, but the Kajabi purchase webhook does not supply an email-message click token. Kajabi email-level click-to-purchase attribution will therefore require either Kajabi’s per-email click report/export, a Kajabi API/webhook that contains link-click identity, or a first-party redirect bridge for each Kajabi CTA. Until then, Kajabi revenue can be shown as cohort-matched and platform-attributed—not proven message-click revenue.

Kajabi’s current product documentation confirms that active email sequences have reports for the sequence and its individual messages, including sent, delivered, opened, clicked, customers, and net revenue. Kajabi defines customer and net-revenue credit as the **last Kajabi-site link clicked** before a purchase within thirty days; it excludes external-domain and shortened links from this credit.[4] This is useful for the Kajabi checkout path but is not interchangeable with the first-party click-token attribution used for the KO/Shopify path.

Kajabi also exposes a click report and a recipient-level link report for emails in sequences. The link report identifies the contact, click date, and number of clicks, which provides the necessary manual audit trail while an API or export path is validated.[5]

## Scope assessment

The first usable reporting view is **moderate complexity**, not a rebuild. It requires an email-attribution fact table, a Klaviyo reporting collector, Kajabi source confirmation, standardized per-message UTM values, and a reporting UI added to the existing funnel/reconciliation area. The first-party data model and Shopify/Kajabi purchase ingestion already cover meaningful portions of the path.

## Proposed reporting model

The view should be called **Interconnected: Email → Revenue** and should default to a chosen opt-in date range, not merely a purchase-date range. That makes it possible to answer the economic question: “What did the leads acquired in this window produce by Day 0, Day 7, and Day 14?”

| Report surface | Primary grain | Measures | Decision use |
|---|---|---|---|
| Email scorecard | Platform × sequence/flow × individual message | Sent, delivered, unique opens, open rate, unique clicks, click rate, checkout starts, purchases, revenue | Identify the emails that move the funnel forward |
| Closing-touch ledger | Purchase × recorded closing email touch | Direct first-party email-click purchases, platform-attributed purchases, checkout-starts, revenue | Know which email closed the sale and the confidence of that claim |
| Acquisition-cohort LTV | Original lead UTM campaign × opt-in date cohort | Unique leads, Day 0 / Day 7 / Day 14 revenue, LTV per lead, purchase rate, blended ROAS | Decide what media can be scaled based on mature downstream economics |
| Payment-stack reconciliation | Kajabi vs. Shopify/KO | Purchases, gross revenue, refund-adjusted revenue where available, unmatched revenue | Prevent data from crossing or being silently omitted between the two payment stacks |

### Attribution labels

Every monetary result will include an explicit label rather than a generic “email revenue” claim.

| Label | Definition | Use in ROAS and LTV |
|---|---|---|
| Direct email-click | A first-party checkout bridge token tied the email’s UTM/message key to the completed Shopify order | Include as highest-confidence closing-touch revenue |
| Platform-attributed | Klaviyo or Kajabi attributes a purchase/revenue result to the flow or individual email under its own attribution rules | Show separately and reconcile; do not add on top of direct credit |
| Cohort-matched | Purchase is matched to the original Interconnected lead and occurred inside the Day 0–14 window, but no message click was captured | Include in cohort LTV and ROAS, not in “proven email close” totals |
| Unattributed | Revenue cannot be connected to a qualifying lead or email touch | Exclude from Interconnected cohort ROAS until reconciled |

### Collection design

1. Add an internal daily snapshot table for Klaviyo message performance keyed by `platform`, `flow_id`, `message_id`, `message_name`, and reporting window. The collector will call Klaviyo’s flow-values reports for the live flow and retain raw delivered/open/click/conversion values for reproducibility.
2. Adopt a canonical `utm_content` convention for every Interconnected email CTA, such as `ko_d03_ep01` or `kajabi_d00_offer`. The first-party offer and checkout bridge will retain this identifier through checkout rather than treating every email as the same campaign.
3. Extend the existing first-party click/checkout ledger with a `message_key` derived from the UTM so the Shopify order webhook can join a completed order to the initiating email with direct confidence.
4. Retain Kajabi’s native per-email report values as a separate platform-attributed source and write a secure, repeatable import/sync adapter only after the authenticated report/export mechanism is verified. The current Kajabi purchase webhook remains the source of truth for captured Kajabi payment revenue and cohort LTV.
5. Join every qualifying Kajabi and Shopify purchase back to its original Interconnected lead email and opt-in timestamp. The dashboard will calculate **Day 0, Day 7, and Day 14 cumulative revenue** from that cohort date, then divide by lead count for LTV per lead. Campaign ROAS will divide the same cohort revenue by the matching Meta spend after the campaign-to-lead mapping is verified.

### Implemented KO/Klaviyo collection operation

The first release now persists KO/Klaviyo message snapshots in an isolated reporting table and refreshes them daily at **15:15 UTC** from the trailing fourteen completed UTC days. The managed callback accepts only its persisted task identity (`dUCiBTafiaMuNGZqkR76AJ`) and returns a harmless skip for any other scheduled caller. This makes the collection idempotent and prevents an unrelated scheduled task from updating the experiment’s reporting data.

The automated collection deliberately updates the **KO/Klaviyo** path only. Kajabi remains a separate payment and analytics path; it is not populated from Klaviyo or Shopify activity. Until a verified Kajabi report export or API synchronizer is added, its per-email engagement remains a native-report input and its captured purchase revenue remains a cohort-level record rather than direct email-click proof.

### Boundaries that keep the report honest

Open rates will be displayed for operational context, but click rate and revenue are the primary decision metrics because email-open signals can be affected by recipient privacy protections. Kajabi’s own reported revenue only applies after a Kajabi-site link click and uses last-click attribution inside its stated window; it cannot be added to first-party direct-credit revenue without deduplication.[4]

The current Kajabi purchase webhook has the buyer email, offer, value, and cohort relationship but not a message-click token. Therefore, the initial dashboard can show per-email Kajabi engagement and per-cohort Kajabi revenue; it cannot present Kajabi email-to-purchase as direct first-party proof until a report/export or a suitable Kajabi click identity is synchronized. This is a data-integration requirement, not a reason to manufacture certainty.

### Build scope

The **foundation already exists**: the lead cohort, UTM store, first-party Shopify click bridge, Shopify order webhook, Kajabi purchase webhook, Meta spend snapshots, and a live Klaviyo Reporting API capability test. The incremental build is moderate: one snapshot/normalization layer, one reporting screen, standard UTM/message-key coverage in the Interconnected emails, and source-level reconciliation tests.

The only material dependency is automated Kajabi email-report ingestion. If Kajabi exposes a usable report export or API in the authenticated account, it can be synchronized into the same view. If not, the first release can show live Kajabi purchase/cohort revenue automatically and accept periodic Kajabi per-email report imports while the account-level analytics export path is resolved.

## References

[1] [Klaviyo Reporting API overview](https://developers.klaviyo.com/en/reference/reporting_api_overview)

[2] [Klaviyo Query Metric Aggregates](https://developers.klaviyo.com/en/reference/query_metric_aggregates)

[3] [Klaviyo guide: Using the Query Metric Aggregates endpoint](https://developers.klaviyo.com/en/docs/using_the_query_metric_aggregates_endpoint)

[4] [Kajabi Email Metrics overview](https://help.kajabi.com/articles/marketing/email-campaigns/email-metrics-overview)

[5] [Kajabi: View the Email Click Report](https://help.kajabi.com/articles/analytics/how-to-view-your-email-click-report)
