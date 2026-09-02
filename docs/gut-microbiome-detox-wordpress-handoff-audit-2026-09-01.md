# Gut Microbiome Detox Article — WordPress Handoff Audit

**Post:** [Why Gut Microbiome Health Must Come Before Any Aggressive Detox Protocol](https://theurbanmonk.com/gut-microbiome-health-before-aggressive-detox/)  
**WordPress ID:** `11446`  
**Audit date:** September 1, 2026  
**Scope:** Read-only public-page and WordPress REST inspection. No article, media, category, metadata, CTA, or publication setting changed during this audit.

## Verified findings

| Item | Current state | Result |
|---|---|---|
| Featured media | `featured_media: 0` | The post has no assigned WordPress featured image; the public page renders a “No Image Available” placeholder. |
| Category assignment | `categories: [1]` / visible category `uncategorized` | No substantive category was assigned during the Blog Import → WordPress handoff. |
| Yoast title/canonical/description | Present | Public title, self-referencing canonical, index/follow directives, and a description are present. |
| Social image/schema image | Absent | The Yoast Article graph has no article image because featured media was never assigned. |
| Source-post timing | Published and modified September 2, 2026 (UTC) | The post was created through a recent automated/imported workflow and is the correct direct repair target. |

## Initial conclusion

The reported issue is confirmed: the Blog Import workflow published the article without passing a featured-image assignment or category value into WordPress. The existing review-only image candidate must remain separate from WordPress until the author selects it and explicitly approves upload/assignment; the same review draft must carry a selected WordPress category into its handoff payload. The public post’s title, slug, body, CTA, canonical, and published status should remain unchanged during the narrowly scoped repair.

## Existing category candidates

The WordPress category endpoint confirms three existing candidates matching “gut.” No category needs to be created. The preferred category for this article is the top-level **Gut Health** category (`721`), because the post’s primary subject is gut microbiome health rather than a general wellness subsection. The article should not retain the default `Uncategorized` category once the owner approves the specific repair.

| WordPress category ID | Existing name | Existing path | Recommendation |
|---:|---|---|---|
| `721` | Gut Health | `/category/gut-health/` | **Preferred** for this post. |
| `943` | Gut Health | `/category/health-wellness/gut-health-health-wellness/` | Avoid unless the legacy Health & Wellness taxonomy is intentionally being used. |
| `1782` | Gut Health & Digestion | `/category/wellness/gut-health-digestion/` | Possible alternate; less exact than `Gut Health` for this article. |

## Reference

[1]: https://theurbanmonk.com/wp-json/wp/v2/posts?slug=gut-microbiome-health-before-aggressive-detox&_fields=id,link,slug,title,featured_media,categories,yoast_head_json,meta,date,modified "Public WordPress REST post record inspected September 1, 2026"

[2]: https://theurbanmonk.com/wp-json/wp/v2/categories?per_page=100&hide_empty=false&search=gut "Public WordPress category endpoint inspected September 1, 2026"
