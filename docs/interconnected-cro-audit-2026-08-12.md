# Interconnected CRO Audit — 2026-08-12

## Sources observed

| Asset | URL | Observation |
|---|---|---|
| $67 Shopify offer | https://shop.theurbanmonk.com/products/interconnected-the-complete-healing-protocol | The live page renders as a standard product-detail page. Above the fold it contains the store-wide navigation/search, product image, price, quantity control, generic “ADD TO CART” CTA, Shop Pay button, and a concise benefit list. The specific $67 post-series context, offer deadline, and reason to act now are not visible in the observed above-fold content. |
| $199 Kajabi OCU URL | https://theurbanmonk.mykajabi.com/upsells/NHCArjLDhTMbteTJAeSQmHgt/checkout | Public browser retrieval returned a Kajabi 404 on 2026-08-12. It may be a session-bound one-click URL, unpublished/changed path, or a route requiring the preceding Kajabi checkout session. Do not treat the public 404 alone as proof the in-flow OCU fails. |

## Data caveat

Meta campaign-level purchase counts are not a source of truth for offer-level conversion or revenue in this analysis. Use confirmed Kajabi/Shopify orders and the lead-cohort ledger for business metrics.

## Live Content Hub dashboard observation

On 2026-08-12, the live reconciliation dashboard defaulted to **Today** (2026-08-12), not the Aug. 2–11 launch window. Its displayed $100.87 spend, $67 revenue, and 0.66x ROAS were therefore **today-only** figures. The dashboard explicitly shows that Shopify pulling is disabled for the Interconnected funnel registry, so it cannot currently include Shopify $67 or $199 orders in that view.

The live dashboard does provide custom date controls and shows the exact campaign list used for Meta spend. Future audits must set the intended launch window before reading the top-line cards and must reconcile Shopify separately until the Interconnected funnel registry is enabled for Shopify order pulling.

The dashboard custom controls were then set to **2026-08-02 through 2026-08-11** for the source-verification audit.

For that custom window, the live dashboard displayed **$6,688.54 Meta spend**, **3,319 Meta-reported leads**, **$0 top-line revenue**, and **0.00x ROAS**. Its cohort section simultaneously showed 1,165 unique acquired leads and $732 day-zero cohort revenue, while its ledger showed three linked purchases totaling $665 ($598 Meta-paid acquisition credit and $67 Other acquisition credit). The top-line $0 is explained by the dashboard’s Kajabi sales tier scan returning no sales and Shopify being explicitly disabled. The conflicting dashboard sections must be reconciled before treating any ROAS value as decision-ready.

Selecting **All Sales** did not change the $0 top-line result. Direct read-only Kajabi transaction verification for the same Aug. 2–11 window returned 47 succeeded, non-refunded transactions totaling **$7,156.00**: 39 × $67 ($2,613), 3 × $499 ($1,497), 4 × $399 ($1,596), and 1 × $1,450 ($1,450). Direct Meta source verification for the dashboard’s current broad `agora` campaign/ad-set-name rule returned 56 ad-set rows, $6,688.54 spend, and 3,319 reported lead/registration actions. The dashboard currently fails to surface the Kajabi source result despite querying the same timeframe; this is a product bug, not an absence of sales.
