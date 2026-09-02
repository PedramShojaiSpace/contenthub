# Hashimoto’s Thyroid and Gut Health — Media and Yoast SEO Audit

**Post:** [Hashimoto's Thyroid and Gut Health: Which to Treat First?](https://theurbanmonk.com/hashimotos-thyroid-and-gut-health/)  
**WordPress ID:** `11442`  
**Audit date:** September 1, 2026  
**Scope:** Read-only public-page and WordPress REST inspection. No post, media item, metadata field, URL, CTA, or publication status changed during this audit.

## Verified current state

| Item | Observed state | Quality implication |
|---|---|---|
| Featured media | `featured_media: 0` | The post has **no WordPress featured image**. Its social/SEO image surface will rely on a generic site/default image rather than article-specific media. |
| Title | `Hashimoto's Thyroid and Gut Health: Which to Treat First?` | Clear topic-first title, includes the primary query terms, and is approximately 55 characters. No urgent title rewrite needed. |
| Meta description | `Explore the bidirectional gut-thyroid axis in Hashimoto's. Learn why simultaneous care for both systems offers a more effective path forward.` | Present and concise, but it makes a comparative “more effective” care claim that should be softened for editorial/medical-claim review. |
| Canonical | Self-referencing canonical to the live post URL | Correct. |
| Indexing directives | `index, follow`, unrestricted snippet/image/video previews | Correct. |
| Social metadata | Open Graph title, description, URL, site name, article publication/modified time, and `summary_large_image` Twitter card present | Technically present, but no article-specific image object is exposed because featured media is missing. |
| Structured data | Yoast `Article`, `WebPage`, `BreadcrumbList`, `WebSite`, `Organization`, and `Person` graph objects present | Good baseline technical schema. The Article graph lacks an article image because featured media is absent. |
| On-page structure | One clear H1 followed by descriptive H2 sections; primary topic appears in title and opening copy | Good baseline semantic structure. |
| Internal linking | The visible CTA links externally to the Upstream subdomain; no verified contextual internal links to related Urban Monk articles were found in the inspected page content | An opportunity, but should be handled as an editorial change after URL/relevance review. |

## Yoast-score interpretation

The public WordPress REST response exposes Yoast’s rendered metadata and schema but not the private editor’s colored readability/SEO score. The checklist above therefore verifies the **publicly observable technical implementation**, not a claim about a private numerical Yoast score. The absence of a featured image is the only clearly confirmed high-priority technical gap.

## Proposed corrections pending live-change confirmation

1. Generate and assign one article-specific 16:9 featured image with descriptive alt text. This should produce article-specific Open Graph/Twitter/schema image metadata rather than a generic/default image after WordPress/Yoast refreshes.
2. Preserve the current title, slug, canonical, article body, citations, CTA, and publication status.
3. Update the meta description only if the owner approves a wording refinement that reduces the “more effective” comparative-care implication. Proposed safe replacement: **`Explore the bidirectional gut-thyroid axis in Hashimoto's and the factors clinicians may consider when evaluating both systems.`**
4. Review potential contextual internal links separately; do not insert generic links simply to increase a plugin score.

## Completed owner-requested repair

With the owner’s explicit request to correct the live article, one post-specific, text-free 16:9 editorial image was generated and assigned as WordPress media attachment **11443**. The public article now renders the image under the title. Its accessible alt text is: **“Conceptual illustration of the gut-thyroid axis for Hashimoto's thyroid and gut health.”** The article body, title, slug, canonical URL, CTA, and publication status were not changed.

The focused Yoast update was also applied to post 11442: the focus keyphrase, SEO title, meta description, and canonical are present in WordPress’s authenticated edit metadata. The live meta description is now: **“Explore the bidirectional gut-thyroid axis in Hashimoto's and factors clinicians may consider when evaluating both systems.”** This keeps the useful topic framing while avoiding the prior comparative claim that simultaneous care is “more effective.”

The private Yoast fields `_yoast_wpseo_linkdex` and `_yoast_wpseo_content_score` currently return empty values. That means the editor’s colored Yoast numerical/letter score has not been calculated or is not exposed by this installation’s current REST/meta configuration; it is not evidence that the public title, canonical, description, schema, or focus-keyphrase fields failed to save. The public technical SEO elements are now configured; a future editor-side Yoast check can calculate/confirm the plugin’s own on-page score without making a content change.

## Blog Import Studio safeguard repair

The Blog Import Studio’s review-only image workflow now sends the reviewed article title, focus keyword, and bounded opening excerpt into the generation brief. Its prompt explicitly requires a visual expression of the article’s named relationship or mechanism and rejects generic wellness/spa/meditation/supplement/nature stock imagery. Image candidates remain text-free, editorial, and separate from WordPress until a separate owner-approved upload/assignment action.

## Deeper public SEO readiness audit

| Area | Verified state | Assessment |
|---|---|---|
| HTTP, crawlability, and sitemap | The public URL returns HTTP 200, has `index, follow`, and is present in the public post sitemap. `robots.txt` is reachable and permits crawling. | Healthy. |
| Canonical and social image | The public page now exposes the correct self-canonical URL plus the new 16:9 featured image in Open Graph, Twitter, and Yoast image/schema output. | Healthy. |
| Article structure | The article body contains 1,021 words, one H1, and eight H2 sections. | Solid scannable article structure. |
| Focus keyphrase signal | The WordPress focus keyphrase is saved, but its exact full phrase does not appear verbatim in the body. | Not a technical failure; its constituent concepts occur naturally. A forced exact-match rewrite is not recommended without an editorial review. |
| Contextual links | The article body has no same-domain contextual link and one external CTA link to the verified Upstream subdomain. | A genuine internal-linking opportunity, but it needs relevance-led editorial selection—not a generic score-chasing link. |
| Yoast score fields | `_yoast_wpseo_linkdex` and `_yoast_wpseo_content_score` remain unavailable/empty through the authenticated REST metadata response. | The numeric editor score cannot be verified from the current API; a WordPress-editor review is required to calculate or inspect it. |
| Metadata emitters | The public source contains both a Yoast SEO block and a SmartCrawl SEO block. It emits 3 meta descriptions, 2 canonicals, 2 Open Graph titles, and 2 Open Graph descriptions. The values conflict. | **Priority defect.** Search and social crawlers receive duplicate/conflicting instructions. |

The duplicate output is caused by two active SEO emitters, not by the repaired article itself. SmartCrawl’s documented per-post fields include `_wds_title`, `_wds_metadesc`, `_wds_canonical`, `_wds_opengraph`, and `_wds_twitter`; none is currently registered in this site’s REST post-metadata schema. That means the Content Hub cannot safely harmonize SmartCrawl’s output through the existing WordPress REST workflow. A site administrator must choose one of the following controlled remedies:

1. **Preferred:** Disable SmartCrawl’s Titles & Meta/Social output modules while retaining Yoast as the single authoritative metadata/schema source, after a sitewide backup and smoke test.
2. **Alternative:** Keep SmartCrawl active but configure it at the WordPress-admin level to avoid emitting conflicting post title, description, canonical, Open Graph, Twitter, and schema output.

Neither option has been applied. Both affect sitewide SEO output and require explicit owner approval plus authenticated WordPress-admin access.

## SmartCrawl cleanup verification and remaining emitter

The owner completed the approved SmartCrawl module changes: **Title & Meta**, **Schema**, and **Social Network** are now disabled; SEO Analysis, Readability Analysis, Sitemaps, URL Redirection, and Robots.txt Editor remain enabled. A public origin response after the change verifies the intended improvement: the article now has **one canonical**, **one Open Graph title**, **one Open Graph description**, and **one JSON-LD graph**. SmartCrawl now emits only its empty HTML marker; it is no longer emitting the duplicate canonical, social metadata, or schema objects.

One older meta-description tag remains. It appears immediately before the Elementor generator tag and contains the post’s historical excerpt, while Yoast emits the current approved description. The response had cache-miss headers, so this is not a simple browser/CDN-cache propagation delay. This remaining tag must be treated as a **separate generic page-level emitter**. Active candidate sources include Elementor-level document/theme configuration and the site’s code/header injection plugins (`WPCode Lite` and `WP Headers and Footers`); the active Soro plugin documents that it writes descriptions into supported SEO-plugin fields, but the available evidence does not establish it as the direct HTML emitter.[5]

No additional module, plugin, template, or code snippet has been modified. The next safe step is to inspect the exact page-level code/header setting and remove only the snippet or setting that generates the stale `post_excerpt` description, then recheck the live source. It would be unsafe to disable Elementor, WPCode, WP Headers and Footers, or Soro SEO by guesswork.

## References

[1]: https://theurbanmonk.com/wp-json/wp/v2/posts?slug=hashimotos-thyroid-and-gut-health&_fields=id,link,slug,title,featured_media,yoast_head_json,meta,date,modified "Public WordPress REST post record inspected September 1, 2026"
[2]: https://theurbanmonk.com/hashimotos-thyroid-and-gut-health/ "Live post and public metadata inspected September 1, 2026"
[3]: https://wpmudev.com/docs/wpmu-dev-plugins/smartcrawl/ "SmartCrawl SEO Plugin Usage Documentation"
[4]: https://gist.github.com/wpmudev-sls/02a03fb6ef57b7a09c0fac7ddcbde393 "WPMU DEV SmartCrawl post-meta import example"
[5]: https://wordpress.org/plugins/soro-seo/ "Soro WordPress Plugin — official description and supported SEO-plugin integration"
