# WordPress–Framer Architecture Assessment

**Prepared for:** The Urban Monk  
**Decision:** How Framer can coexist with the existing WordPress installation without weakening SEO, content ownership, or campaign operations.  
**Scope:** Assessment only. No WordPress, DNS, Framer, domain, redirect, canonical, analytics, checkout, or traffic setting was changed.

## Recommendation

Use a **subdomain-first split**:

| Layer | Recommended platform | Ownership |
|---|---|---|
| Core site, blog, evergreen medical education, existing indexed URLs | WordPress at `theurbanmonk.com` and `www.theurbanmonk.com` | WordPress remains the source of truth. |
| New paid-campaign and rapid-launch landing pages | Framer at a dedicated subdomain such as `go.theurbanmonk.com` or `campaigns.theurbanmonk.com` | Framer hosts the campaign surface. |
| Brief, asset/claim governance, CTA/UTM contract, QA, experiment registry, and revenue reconciliation | Content Hub | Content Hub remains the internal operating layer. |
| Purchase completion | Kajabi or Shopify, based on the approved offer | The checkout ledger remains authoritative for revenue. |

This is the lowest-risk arrangement because it avoids asking one apex domain and the same URL path to resolve simultaneously to two different hosts. Framer supports a third-party custom subdomain through a CNAME to the value it provides, while WordPress can continue serving the existing root-domain site. [1]

## What “connect Framer to WordPress” can mean

| Pattern | Supported use | Recommendation |
|---|---|---|
| **Framer-hosted subdomain beside WordPress** | WordPress continues to serve the root site and blog; Framer serves campaign pages on a distinct subdomain. | **Recommended.** It preserves operational separation and allows rapid campaign-page deployment. |
| **WordPress content imported into Framer CMS** | A third-party Framer Marketplace plugin can import WordPress posts, custom post types, and WooCommerce products into Framer CMS; it states that WordPress pages are not imported. [2] | Consider only for a planned content migration or read-only campaign-content copy. Do not make it the live source of truth for the WordPress blog. |
| **Framer design rendered “inside” WordPress on the same page URL** | This is not the normal Framer hosting model. A page URL must resolve to one serving platform; embedding can create duplicate semantics, tracking complexity, and weak SEO ownership. | **Not recommended** for production campaign pages. |
| **Path-level split under the same host** | Possible only through an edge/reverse-proxy architecture that intentionally routes defined paths to Framer while all other paths go to WordPress. | Defer. It adds cache, canonical, redirect, observability, and rollout risk. Use only after the subdomain system is stable. |

## SEO and domain controls

Framer provides page and CMS metadata, indexing controls, canonical URLs, redirects, sitemap, robots, semantic markup, and JSON-LD support. [3] These capabilities are sufficient for new campaign pages, but they should be governed from the Content Hub’s page record rather than selected ad hoc in Framer.

| Page type | Default policy | SEO rationale |
|---|---|---|
| Paid-social landing page or price-test page | `noindex`; canonical to the approved stable control when applicable | Prevents duplicate paid variants from competing in organic search. |
| New evergreen resource page | Indexable only after SEO and claims review; self-canonical | Gives Framer a deliberate content role without duplicating an existing WordPress article. |
| Rebuilt WordPress URL | 301 only after a route inventory and verified replacement page | Protects existing equity and avoids broken links. |
| WordPress blog archive | Remains on WordPress | Keeps the historical content archive and editorial workflow stable. |

## Operational flow

1. A marketer creates the Campaign Page record in the Content Hub.
2. The Hub holds the approved copy, claims, assets, SEO policy, destination key, UTM contract, and page type.
3. Framer receives only a staging/draft package after review. The public campaign page lives on the Framer subdomain once separately approved.
4. The CTA hands off to the approved Kajabi or Shopify checkout without changing the revenue ledger.
5. The Hub records the Framer URL, campaign/experiment ID, and first-party transaction outcome.

## Implementation boundary

The next safe external step is a **Framer staging project on a non-production Framer URL**, followed by one dedicated campaign subdomain after the page template and governance workflow are approved. Do not point `theurbanmonk.com`, move WordPress pages, duplicate the blog, or add any redirect until there is an approved route inventory and SEO migration plan.

## References

[1]: https://www.framer.com/help/articles/how-to-connect-a-custom-domain/ "Framer: How to connect a custom domain"  
[2]: https://www.framer.com/marketplace/plugins/wp-sync/ "WP Sync: WordPress Import — Framer Marketplace"  
[3]: https://www.framer.com/help/articles/guide-to-seo-features-and-tools/ "Framer: Guide to SEO features and tools"
