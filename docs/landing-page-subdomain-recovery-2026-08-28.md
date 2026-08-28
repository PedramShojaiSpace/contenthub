# Urban Monk Landing-Page and Subdomain Recovery Inventory

## Bottom Line

The project source, database-hosted pages, and core public route handlers are intact. The problem is **domain ownership**, not a missing site build: `content.theurbanmonk.com` and `ch.theurbanmonk.com` still resolve to the old Railway deployment (`1qt4tmqw.up.railway.app`) rather than the restored Manus project. This causes a mixed state in which some legacy pages load while current hosted sales pages return 404.

> **Priority action:** Move only the `content` DNS record from Railway to the Manus custom-domain target shown in the project Domains panel. Do not change `ch`, `get`, `try`, `theacademy`, or `shop` as part of this repair.

## Recovery Result — 2026-08-28

The `content` CNAME was corrected at GoDaddy to `cname.manus.space`, and the hostname was then disconnected and reconnected in the restored project’s Domains panel. The panel subsequently showed a green connected/verified state. A new public test of the restored-only route `/upstream/program` returned **HTTP 200** with the expected `Upstream Program — Direct Sales VSL` page title, replacing its prior custom-domain 404.

The same read-only smoke test returned **HTTP 200** on all 14 current priority routes: the Interconnected landing page, Thank You B, Kajabi offer page, Upstream Program, published Gut and Lights On hosted pages, published Orobiome bridge, and all seven Tantra pages. No page, funnel, offer, checkout, tracking, redirect, or other hostname was changed during recovery verification.

## Subdomain Ownership and Recovery Status

| Hostname | Current DNS/serving owner | Current status | Recovery owner | Priority |
|---|---|---|---|---|
| `content.theurbanmonk.com` | CNAME → `1qt4tmqw.up.railway.app` | **Live but stale/mixed.** Legacy static routes return 200; current database-hosted offer pages return 404. | This restored Content Hub project + DNS owner | **P0** |
| `ch.theurbanmonk.com` | CNAME → `1qt4tmqw.up.railway.app` | **Misconfigured/unused.** Previous verification found a hostname certificate mismatch and Railway fallback response. | Separate alias cleanup | P2 |
| `get.theurbanmonk.com` | CNAME → `cname.manus.space` | **503.** The `/oral` route belongs to a separate Manus project, not this Content Hub. | Separate external project | **P1** |
| `try.theurbanmonk.com` | CNAME → Unbounce | **Live.** Original and native Interconnected pages both return 200. | Unbounce | No current change |
| `theacademy.theurbanmonk.com` | CNAME → Kajabi | **Live.** Meta and event screening pages both return 200. | Kajabi | No current change |
| `shop.theurbanmonk.com` | CNAME → Shopify | **Live.** Shopify-owned Orobiome route is independent of the Content Hub domain. | Shopify | No current change |
| `lightsebook-iugsiz76.manus.space` | Managed Manus domain | **Live/current.** This is the restored project’s confirmed source of truth. | Manus project | Baseline |

## Core Content Hub Pages — Restore via `content`

All of the following have confirmed route handlers in the restored project. They should become current when `content.theurbanmonk.com` is pointed back to this project.

| Page family | Route(s) | Current state on `content` | State on managed project domain |
|---|---|---:|---:|
| Interconnected landing pages | `/interconnected`, `/interconnected-b` | 200, but served by legacy Railway deployment | 200 |
| Interconnected thank-you and sales flow | `/interconnected/thank-you`, `/interconnected/thank-you-a`, `/interconnected/thank-you-b`, `/interconnected/thank-you-klaviyo`, `/interconnected/purchased`, `/interconnected/post-purchase-199-klaviyo` | 200, but served by legacy Railway deployment | 200 |
| Interconnected Day 0 offer pages | `/interconnected/offer`, `/interconnected/offer-ko`, `/interconnected/offer-kajabi` | 200, but served by legacy Railway deployment | 200 |
| Upstream core routes | `/upstream`, `/upstream/program` | `/upstream` 200 legacy; `/upstream/program` **404** | 200 |
| Hosted Upstream VSL | `/upstream/program` | **404** | 200 |
| Hosted Gut page | `/gut/the-hidden-gut-problem-causing-your-brain-fog-fatigue-and-we` | **404** | 200 |
| Hosted Lights On page | `/lo/the-hidden-gut-problem-causing-your-brain-fog-fatigue-and-we` | **404** | 200 |
| Published Orobiome bridge | `/bridge/https---shop-theurbanmonk-com-products-orobiome-testing-package` | **404** | 200 |
| Merchandise QR pages | `/weboflife`, `/elephant` | 200 legacy | 200 |
| Olympus offer pages | `/olympus`, `/olympus-base`, `/olympus-plus`, `/olympus-her`, `/olympus-her-plus`, `/olympus-her-max` | 200 legacy | 200 |

## Tantra Education Pages — Preserve Existing URLs, Then Confirm Current Build

These seven content-first acquisition pages currently return 200 on `content`, but the traffic is receiving the Railway-served version rather than the restored project. The page URLs should remain unchanged during reconnection.

| Route | Page theme |
|---|---|
| `/tantra/considering-divorce` | Considering divorce |
| `/tantra/king-and-queen` | King and queen dynamics |
| `/tantra/sex-is-the-flower` | Sex as the flower |
| `/tantra/why-he-stopped` | Why he stopped |
| `/tantra/love-bank` | Love bank |
| `/tantra/why-she-stopped` | Why she stopped |
| `/tantra/female-orgasm` | Female orgasm |

## Independent Pages That Do Not Need the Content Hub Reconnection

| Asset | Current URL | Status | Reason to leave unchanged |
|---|---|---|---|
| Kajabi Meta screening page | `https://theacademy.theurbanmonk.com/ic-interconnected-free-screening-Meta` | 200 | Kajabi-hosted; current live Meta path. |
| Kajabi event screening page | `https://theacademy.theurbanmonk.com/ic-interconnected-free-screening-event` | 200 | Kajabi-hosted; thank-you routing should be addressed only under a separate approved plan. |
| Unbounce original | `https://try.theurbanmonk.com/interconnected-lp/` | 200 | Unbounce-hosted. |
| Unbounce native test | `https://try.theurbanmonk.com/interconnected-lp-3/` | 200 | Unbounce-hosted; no live traffic should be redirected there without a separate decision. |
| Shopify Natalie Jill page | `https://shop.theurbanmonk.com/pages/oral?bg_ref=109Nl4h0Ds` | 200 | Shopify-hosted with protected BixGrow attribution. |

## Pages Not Ready for Revival

| Route | Status | Reason |
|---|---|---|
| `/lo/the-real-reason-you-re-always-exhausted-it-s-not-what-you-th` | Draft | This is stored as a draft and should remain unpublished until separately approved. |
| `/bridge/draft-upstream-health-cold-traffic-gut-inflammation-upstream-cold-traffic-health-vmrad5788` and related draft bridge pages | Draft | Draft advertorials must not be surfaced in a recovery action. |
| `https://get.theurbanmonk.com/oral` | 503 | Separate Manus project; recovery needs that project’s deployment/domain review. |
| `ch.theurbanmonk.com` | Misconfigured | Keep unused until its certificate/DNS record is evaluated independently. |

## Fastest Safe Revival Sequence

1. In the current project’s **Settings → Domains** panel, retain/add `content.theurbanmonk.com` and copy the exact Manus validation target shown there.
2. In the DNS provider, change **only** the `content` CNAME record currently pointing to `1qt4tmqw.up.railway.app` so it matches the target shown by the project Domains panel.
3. Wait for TLS/domain verification to become active in the Domains panel. Do not redirect traffic during the verification window.
4. I will then run an immediate smoke test across the P0 Interconnected, Upstream, Gut, Lights On, bridge, and Tantra pages.
5. Separately, open the other Manus project that owns `get.theurbanmonk.com/oral`; its current 503 cannot be repaired from this project.

## Remaining Separate Follow-ups

The approved `content` recovery is complete. `get.theurbanmonk.com/oral` remains a 503 on a separate Manus project and needs recovery inside that project. `ch.theurbanmonk.com` remains intentionally untouched pending separate authorization and should not be treated as an alias for the restored Content Hub.
