# WordPress SEO Metadata Path Audit

**Audit date:** August 16, 2026  
**Scope:** Read-only comparison of a recent Content Hub-generated WordPress post and the Content Hub’s SEO metadata-writing path.  
**Changes made:** None.

## Live Evidence

The public REST representation of WordPress post `11154` exposes a complete Yoast-rendered SEO surface: meta description, canonical URL, Open Graph title and description, social image, Twitter card metadata, and a `yoast-schema-graph` JSON-LD block. The post carries an SEO title, a 1275-word Article schema, article publication and modification timestamps, author, category, and primary image.

| Public SEO element | Observed on post 11154 | Interpretation |
|---|---|---|
| Meta description | Present | Search snippet field is rendering. |
| Canonical link | Present | Canonical URL is rendering. |
| Open Graph title, description, image | Present | Social metadata is rendering. |
| Yoast JSON-LD graph | Present | The live public rendering is currently Yoast-powered. |
| Article schema | Present | Structured article metadata is rendering. |

## Content Hub Write Path

The WordPress publisher writes both the standard Yoast REST-safe field names and their underscore-prefixed Yoast counterparts: `yoast_wpseo_title` / `_yoast_wpseo_title`, `yoast_wpseo_metadesc` / `_yoast_wpseo_metadesc`, `yoast_wpseo_focuskw` / `_yoast_wpseo_focuskw`, and `yoast_wpseo_canonical` / `_yoast_wpseo_canonical`. The readback, score, and remediation code uses the same Yoast field family.

This matches the live page evidence. The separate SmartCrawl controls observed in WordPress administration are not evidence that SmartCrawl is the active public renderer for this post, because the rendered page clearly exposes Yoast metadata and schema. No change to the published metadata path is warranted from this audit.

## Narrow Follow-Up

Before writing SmartCrawl-specific metadata, first inspect one administrative post with both the SmartCrawl panel and Yoast data available to determine whether SmartCrawl is an additional editor interface, a migration remnant, or a coexisting output path. Do not add undocumented SmartCrawl meta keys or alter current Yoast writes until that read-only comparison is complete.
