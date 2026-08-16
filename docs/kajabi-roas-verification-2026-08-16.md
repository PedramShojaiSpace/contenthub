# Kajabi Interconnected ROAS Verification — 2026-08-16

## Current Direct Dashboard Read

At the same-day 2026-08-16 view, the authenticated Interconnected Command Center showed **$627.48** of Agora-only Meta spend, **334 leads**, and **45 checkout starts**. Its Kajabi transaction section showed **0 purchases** and **$0.00 revenue**, producing a same-day ledger ROAS of **0.00x** (`$0.00 / $627.48`).

The local `kajabi_purchases` ledger is not a contradiction to that same-day view: its latest stored Interconnected purchases are dated 2026-08-13, with no row dated 2026-08-16. However, this conflicts with the owner’s observation of sales coming in. The current $0.00 / 0.00 read must therefore be treated as a **provisional zero from the presently available sources**, not a final assertion that Kajabi has taken no sales.

## Required Cross-Check

Before reporting a final daily ROAS, refresh the Command Center’s direct Kajabi transaction source and compare its offer-level transaction count with the current Kajabi admin order view. If either source shows current paid transactions, recompute ROAS as paid Kajabi revenue ÷ the same $627.48 Agora-only spend. KO/Klaviyo/Shopify revenue remains excluded.

## Direct Kajabi Admin Reconciliation

The authenticated Kajabi **Offer purchases over time** report for August 16, 2026 corrects the Content Hub same-day display. With the `Interconnected $67 Bundle OTO` offer selected, Kajabi reports **15 paid purchases and $1,005.00 gross revenue** for August 16. The all-offer report shows 19 purchases and $1,971.00, so the remaining four purchases must be filtered by current and historical OCUS offer names before they can be included in the Kajabi Interconnected funnel numerator.

The current confirmed entry-only ROAS floor is therefore **1.6017x** (`$1,005.00 / $627.48`). This is a floor, not the final Kajabi funnel ROAS, because it excludes the current-period $199 OCUS offer until that distinct offer is isolated. The Command Center’s $0 revenue display is stale or disconnected from the Kajabi admin transaction report and must not be used for spend decisions.

## Final Same-Day Calculation

**Verification timestamp:** 2026-08-16T21:09:27Z. The spend/lead/checkout read was taken from the authenticated Interconnected Command Center after an explicit manual refresh. The offer and revenue reads were taken from the authenticated Kajabi `Offer purchases over time` report in the same verification session, filtered first to the $67 offer and then to the $67 offer plus the current $199 OCUS offer.

Kajabi’s two-offer report (`Interconnected $67 Bundle OTO` plus `Gut Permeability and Food Sensitivity Testing w/ Coach Consultation [OCUS DISCOUNT] New`) shows **18 purchases and $1,602.00 gross revenue** for August 16. Against the entry-only report, this identifies **three current $199 OCUS purchases, contributing $597.00**.

| Metric | Verified amount | Calculation |
|---|---:|---|
| Agora-only Meta spend | $627.48 | Command Center, explicitly refreshed |
| $67 entry sales | 15 purchases / $1,005.00 | Kajabi selected-offer report |
| Entry-only ROAS | **1.60x** | $1,005.00 ÷ $627.48 |
| Current $199 OCUS sales | 3 purchases / $597.00 | Two-offer report less $67-only report |
| Total Kajabi Interconnected revenue | $1,602.00 | $1,005.00 + $597.00 |
| Full-funnel ROAS | **2.55x** | $1,602.00 ÷ $627.48 |
| Current $199 attachment rate | **20.0%** | 3 ÷ 15 paid $67 entries |

This is the final current-day Kajabi-funnel read. It intentionally excludes KO/Klaviyo/Shopify revenue and unrelated Kajabi offers. The Content Hub Command Center remains inaccurate at $0.00 revenue / ROAS N/A for this date and is not the source of truth until its Kajabi transaction sync is repaired.

## Reporting Repair Implemented

The Command Center previously read only the local `kajabi_purchases` webhook ledger. A 2026-08-16 database check found **zero same-day rows**, with the latest non-email-list Interconnected ledger row at **2026-08-13T18:28:14Z**, explaining its stale $0.00 revenue display.

The Command Center now reads the direct Kajabi site-transaction feed and accepts only the two active offer IDs: `2151314475` for the $67 entry offer and `2151333044` for the current $199 OCUS. It validates each transaction’s offer relationship, amount, date, and non-refunded status before calculating revenue. This excludes KO/Klaviyo/Shopify revenue, unrelated Kajabi offers, and the historical $299 OCUS offer. Focused regression coverage passes, including exclusions for historical, unrelated, refunded, prior-day, and incorrect-price transactions; the complete suite also passes at **157 files / 1,544 tests / 2 intentional skips**.

## Live Publication Validation — Blocked

After the `ebac1ff3` checkpoint, the live Command Center at `https://content.theurbanmonk.com/hub/analytics/interconnected-command` still rendered the pre-repair bundle. Its rendered evidence included the old **“Webhook-confirmed”** badge, automatic Meta spend of **$639.27**, and **$0.00 / 0 purchases** for Kajabi revenue. The repaired source would instead show the direct-source badge, $67/$199 current-offer revenue, the separately preserved $299 historical benchmark, and no Meta snapshot before an explicit Refresh.

This is a deployment artifact mismatch rather than a calculation or test failure. It must be resolved before the live Refresh button can be relied upon to reconcile current ROAS.

A targeted local Hub Analytics build then completed successfully, with the repaired code emitted in `InterconnectedCommandCenter-BwABdrR_.js`; its entry bundle referenced that repaired chunk. Production continued to reference the older `InterconnectedCommandCenter-CeECWzMg.js` after the `053f624f` publication retry, even with a cache-busting query string. The live page therefore continued to show auto-loaded Meta figures and $0.00 Kajabi revenue. This confirms a platform publication mismatch, not browser cache, source code, local analytics build, or a Meta API-read issue.

The staged build script is now hardened to clear each Hub output directory before its build and to fail the build if the Analytics entry lacks its expected `/hub/analytics/assets/` base or the repaired Command Center chunk lacks the direct-Kajabi markers. A clean local Analytics rebuild passed with the fresh `InterconnectedCommandCenter-BwABdrR_.js` asset, and the complete regression suite passed at **159 files / 1,549 tests / 2 intentional skips**. Live artifact publication remains the sole open blocker.

## Live Command Center Validation — Resolved

The post-hardening deployment now serves the repaired bundle at the live Command Center. Without pressing Refresh, the page rendered the **Direct Kajabi source** badge, **16** current $67 entries, **3** current $199 OCUS purchases, and **$1,669.00** direct Kajabi revenue. It also rendered the separately preserved historical $299 benchmark as **4 purchases**, **$1,196.00**, and **25.0% of 16 audited historical entry buyers**.

The Meta cards rendered dashes with the explicit instruction **“Press Refresh for one Meta snapshot”** and the ROAS card displayed **“Refresh Meta to calculate.”** This verifies that no Meta request is made on page load. The operator-controlled Refresh button is now the only intended path to make the one Meta snapshot call and calculate the current ROAS against the independently loaded Kajabi revenue. No extra Meta call was made during this validation.

## Kajabi Webhook-Ledger Follow-Up — Initial Evidence

The legacy `kajabi_purchases` webhook ledger remains stale despite the direct-reporting repair. Its latest Interconnected capture is **2026-08-13T18:28:14Z**, with thirteen generic `Kajabi Purchase` rows recorded at $67.00 that day; no later Interconnected rows exist. In contrast, the live Kajabi dashboard reports **28 offers sold** and **$2,574.00 gross revenue** in the most recent 24-hour window. The discrepancy confirms that new Kajabi activity is occurring but is not arriving in the legacy ledger. The webhook configuration and delivery state remain under read-only inspection; no webhook, purchase, CAPI, Kajabi, Meta, or checkout setting has been changed.

Kajabi’s Site Settings page exposes an **Integrations & Webhooks** section, confirming that the expected configuration surface is available to the logged-in owner. The read-only navigation inspection did not alter any Kajabi setting or open an editing flow.

The Kajabi Webhooks tab confirms that `payment.succeeded` remains configured to `https://content.theurbanmonk.com/api/kajabi/purchase`. Two other `payment.succeeded` endpoints are also configured for separate destinations. This proves the Content Hub purchase endpoint remains registered, but it does not establish successful delivery after August 13; delivery-history inspection is still required. No webhook option, endpoint URL, event type, or integration was changed.

Kajabi’s current official webhook guidance confirms that **Payment Succeeded** fires on each received payment, including Cart orders, and that newer multi-order-bump transactions use nested `offer`, `member`, and `payment_transaction` objects. The transaction ID is supplied as `payment_transaction.id`; dollar amounts are supplied as `payment_transaction.amount_paid_decimal` (with an integer-cent counterpart), while offer identifiers are supplied under `offer.id`. The receiver had previously depended mainly on flat legacy fields, so it is now hardened to accept the current payload form, preserve raw bytes for any HMAC header, and avoid duplicating a locally captured order or CAPI event on a delivery retry. Source: Kajabi, [Use webhooks with Kajabi](https://help.kajabi.com/articles/api-integrations/webhooks/webhooks-explained) and [Webhook and API changes with Multiple Order Bumps](https://help.kajabi.com/articles/api-integrations/webhooks/webhook-changes).
