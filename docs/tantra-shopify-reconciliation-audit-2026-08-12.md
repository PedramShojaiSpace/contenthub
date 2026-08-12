# Tantra Shopify Reconciliation Audit — 2026-08-12

## Verified Shopify Results

The paid-order history in Shopify Admin was searched directly by the exact product IDs registered in the Tantra funnel:

| Product | Shopify product ID | Paid-order result | Dashboard result |
|---|---:|---|---|
| Tantra Him | `9068203376794` | One paid Online Store order, #3429, on 2026-07-31 at 6:03 PM, total $191.90 | Incorrectly reported as zero |
| Tantra Her | `9068203442330` | No paid orders found | Reported as zero |
| Tantra Bundle — Him & Her | `9068203540634` | No paid orders found | Reported as zero |

The $191.90 order total includes more than the $185 product line price, so future dashboard revenue must use the line-item amount for the mapped SKU rather than order total to avoid attributing shipping or unrelated items to Tantra revenue.

## Root Cause

The live Tantra dashboard is currently not a verified Shopify-order feed. Its server path calls Shopify Admin order endpoints but falls back to a Storefront token when no `SHOPIFY_ADMIN_API_ACCESS_TOKEN` is configured. Storefront credentials cannot reliably read Shopify Admin paid-order history. The dashboard silently returns zero revenue and zero units if that request fails, producing a false “no sales” result.

## Required Repair

Create or connect a Shopify custom app with the minimum `read_orders` scope, store the resulting Admin API access token securely as `SHOPIFY_ADMIN_API_ACCESS_TOKEN`, update the reconciliation fetcher to treat missing or unauthorized Admin access as an explicit unavailable-data state rather than `$0`, and validate the dashboard against the confirmed Tantra Him order.
