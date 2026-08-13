# System Health Live Check Notes — 2026-08-13

The expanded protected System Health dashboard was opened in the authenticated development preview after the non-core checks were added.

| Service | Live result | Interpretation |
|---|---|---|
| WordPress | OK — connected as Pedram Shojai | Live REST credential validation passed. |
| Meta | OK — connected to Urban Monk - Facebook | Live ad-account validation passed. |
| Shopify Storefront | OK — connected to Urban Monk Productions | Live Storefront API validation passed. |
| Gmail | OK — connected as alyzza@theurbanmonk.com | Live OAuth profile validation passed. |
| YouTube | OK — Data API and upload OAuth configured | Read-only API-key validation and runtime token check passed. |
| Buffer | OK — 11 social channels | Live profile retrieval passed. |
| Shopify paid-order webhook | Degraded — last attributed webhook 38 days ago | Correct freshness warning; not an authentication failure. |
| Apollo | Degraded — key configured, no quota-safe ping | Intentional transparent unavailable state. |
| Kajabi | Error — HTML returned where token JSON expected | Needs health-check endpoint/parsing investigation; do not change Kajabi credentials yet. |
| Klaviyo | Error — HTML returned where JSON expected | Needs health-check endpoint/parsing investigation; live Klaviyo workflows must not be changed based on this health card alone. |

The two error states are new observability findings. They are not treated as confirmed integration outages because existing live workflows and prior authenticated scripts have worked; the next engineering action is to inspect the two read-only check implementations and correct any health-check-specific issue.
