# Agora-to-Shopify Qualifying Buyer Attribution

**Analysis date:** September 4, 2026  
**Order window:** August 1, 2026 through the owner-provided export cutoff  
**Authority for order values:** Owner-provided paid Shopify Orders export  
**Lead-source scope:** First-party `interconnected_leads`, prior Kajabi purchases, and a read-only in-memory Kajabi contact-created-at scan  
**Privacy boundary:** Customer emails were normalized and matched only in memory with a one-time random salt. This report contains aggregate results only.

## Qualifying-order definition

The analysis did **not** use price alone because unrelated products in the export also use $299 and $399 price points. An order qualified only when a paid, non-cancelled line item matched both a relevant test-kit / testing / microbiome / Explore Tier / Supported Package title and one of the requested price levels: $299, $399, $499, $1,450, $1,608, or $1,680.

The owner-referenced Explore Tier appears in this export as **“Explore Tier - FIT22 Upgrade Path” at a $1,450 line-item price**. It was included based on the qualifying product title. No $1,608 or $1,680 current-window qualifying line item was returned under the applied title-and-price rule.

| Qualifying product grouping | Paid orders | Gross Shopify order value |
|---|---:|---:|
| KBMO Fit 22 / Gut Permeability Test Kit with consultation | 29 | $10,708.00 |
| Orobiome Testing Package | 26 | $9,732.60 |
| Upstream Bundle: The Complete Microbiome Solution with Testing | 13 | $6,387.00 |
| Orobiome Retest | 8 | $2,793.00 |
| Full Gut Testing Upgrade | 3 | $1,077.00 |
| Explore Tier – FIT22 Upgrade Path | 3 | $4,350.00 |
| Upstream: The Complete Microbiome Solution | 2 | $598.00 |
| **Total qualifying cohort** | **84** | **$35,645.60** |

There were **76 unique qualifying buyers**. Eight orders were repeat qualifying purchases by buyers already present in the cohort.

## Lead-origin reconciliation

| Cohort classification | Qualifying orders | Unique buyers | Gross order value | Meaning |
|---|---:|---:|---:|---|
| **Verified new Agora lead** | 11 | 11 | $5,188.00 | Matched a post-August 1 first-party Interconnected record with confirmed Meta/Facebook/Agora source signals. |
| **Pre-August record only** | 3 | 2 | $1,197.00 | Confirmed existing Kajabi/contact history before August 1, with no later verified Agora record in the available first-party sources. |
| **Pre-August record and later verified Agora lead** | 0 | 0 | $0.00 | No qualifying buyer had both confirmed records in the available sources. |
| **Post-August non-Agora first-party record** | 1 | 1 | $499.00 | Matched a later Interconnected record, but the recorded source is not classified as Meta/Facebook/Agora. |
| **No first-party match** | 69 | 62 | $28,761.60 | Not matched to the available Interconnected or Kajabi-purchase records. This is not evidence that the buyer was never on a list. |

## What this establishes

Within the available first-party source records, the corrected $499-inclusive match identifies **11 qualifying Shopify orders / $5,188.00 from 11 verified new Agora leads**. Their observed lead-to-purchase timing averages **8.36 days**, with a median of **9 days** and a range of **1–13 days**. This is cohort association based on first-party identity and tracked source fields, not causal proof that an individual Meta impression caused the purchase.

The match also establishes a minimum of **three orders / $1,197.00** from two buyers with confirmed pre–August 1 Kajabi/contact history, plus **one order / $499.00** from a later Interconnected record whose tracked source is not Agora.

The finding does **not** prove that a Meta ad did not influence a purchase. It shows that the required first-party identity-and-source connection was not present for these orders in the records that were available to this analysis. Cohort association is not causal attribution.

## Important coverage limitation

The read-only Kajabi contact-history scan completed **177 pages**, but requests for pages **1, 5, and 6** timed out. Consequently, the pre-August classification is a **confirmed minimum**, not a complete historical-list census. The `no first-party match` group must not be called “new” or “non-Agora” without a complete contact-history source.

## Recommended measurement control

For future Agora economics, preserve a normalized first-party lead identifier and original Meta acquisition fields at the opt-in, carry a non-sensitive source tag through Kajabi and Shopify, and record the Shopify order ID / paid timestamp in an attribution ledger. This would allow new Shopify purchases to be classified as confirmed Agora, pre-existing, later non-Agora, or unresolved without exporting customer-level reports for each review.

No order, customer, Shopify product, Kajabi contact, list, campaign, audience, tracking setting, or funnel configuration was modified.
