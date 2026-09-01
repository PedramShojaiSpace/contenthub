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

## Reference

[1]: https://theurbanmonk.com/wp-json/wp/v2/posts?slug=hashimotos-thyroid-and-gut-health&_fields=id,link,slug,title,featured_media,yoast_head_json,meta,date,modified "Public WordPress REST post record inspected September 1, 2026"
