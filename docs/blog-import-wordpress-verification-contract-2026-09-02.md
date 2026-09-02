# Blog Import Studio → WordPress Verification Contract

**Status:** Active as of September 2, 2026  
**Purpose:** Ensure a Blog Import handoff is reported as complete only when WordPress has retained every approved publishing field. This is a systemic workflow control for new imports; it does not retrofit or modify older posts.

## Operating sequence

Every WordPress handoff now follows a **draft-first, verify-first** sequence. The author first saves an internal Content Hub review draft, selects an existing WordPress category, and generates/reviews one article-specific featured image. The handoff uploads only that selected image, creates the WordPress post as a draft, and reads the post back from WordPress before determining whether it is ready.

| Step | Required condition | Failure behavior |
|---|---|---|
| 1. Internal review | Content Hub review draft saved | WordPress and Substack actions remain unavailable. |
| 2. Taxonomy selection | One existing WordPress category selected | The system refuses the handoff; it never creates a category. |
| 3. Media selection | One reviewed article-specific image plus alt text | The system refuses the handoff; a candidate is never silently uploaded. |
| 4. WordPress draft | WordPress accepts title, slug, body, excerpt, selected category, reviewed media, and Yoast inputs | The workflow returns an actionable error. If media already uploaded, the draft is not reported as complete. |
| 5. Post-write verification | All required checks pass | The draft is retained for manual review; live publication is blocked. |
| 6. Optional live publication | Author checks intent and confirms in the browser | Only a verified draft is published. A final post-write verification result is displayed. |

## Required post-write checks

The screen displays each item’s expected and returned state. **Passed** means WordPress retained the expected value. **Failed** means WordPress returned a different value. **Unavailable** means WordPress did not expose a required value, and the handoff is not treated as verified.

| Check | Expected value |
|---|---|
| WordPress status | `draft` before any live action; `publish` after separately confirmed publication |
| Post title | Approved editable SEO title |
| Slug | Approved normalized slug |
| Featured image | WordPress attachment ID created from the reviewed image |
| Category | Selected existing WordPress category ID |
| Yoast SEO title | Approved editable SEO title |
| Yoast meta description | Approved editable meta description |
| Yoast focus keyphrase | Approved editable focus keyword |
| Canonical URL | `https://theurbanmonk.com/{approved-slug}/` |

## Boundaries intentionally preserved

The workflow does not create categories, generate a generic image silently, publish a WordPress post merely because a draft was created, or treat a missing Yoast field as success. It also remains separate from Substack: the optional Substack control creates a private review draft only after separate confirmation, and it never publishes, emails subscribers, schedules, or auto-shares content.

The verified Gut Microbiome repair was used only to confirm that the WordPress installation currently exposes the needed private Yoast fields and public canonical/title/description fields. It is not a template for editing unrelated existing articles.
