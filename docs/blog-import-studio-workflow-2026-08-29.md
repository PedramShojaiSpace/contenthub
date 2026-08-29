# Blog Import Studio — Team Workflow

## Team Access

Use the verified canonical team route:

`https://content.theurbanmonk.com/hub/content/blog-importer`

The shorter direct path is also registered and normalizes to the canonical Content Hub URL:

`https://content.theurbanmonk.com/blog-importer`

## Review-First Article Workflow

| Step | Action |
|---|---|
| 1 | Paste the complete external article, including citations and references. Add a source label and, if useful, a working title and focus keyword. |
| 2 | Select **Refine with Urban Monk voice + SEO**. The tool produces a full editable article, SEO title, slug, focus keyword, meta description, semantic keywords, editorial review notes, and an approved CTA. |
| 3 | Review and edit the complete article. The process preserves the central argument, citations, reference material, and stated uncertainty. It does not invent research, testimonials, clinical claims, or health outcomes. |
| 4 | Select **Save review draft**. This creates an internal Content Hub record only. |
| 5 | Select **Create WordPress draft** for normal editorial review. The post is created in WordPress as a draft and linked to the internal review item. |
| 6 | To publish live, explicitly check the final-review box and complete the browser confirmation. Imported content is never published automatically. |

## Safeguards

The CTA comes from the existing approved Urban Monk CTA library and receives the established blog UTM parameters. WordPress defaults to `draft`. No content was published during source reconstruction or automated testing.

## Validation

The rebuilt Studio renders successfully in the active preview and at the canonical live Content Hub route after the `content` custom-domain mapping was reconnected. The live custom domain now serves a new main asset that includes the Blog Import route, rather than the older stale asset that caused the loading loop. Focused Blog Import, Hub routing, and WordPress safeguard tests passed **26/26**. The complete staged production build passed for public, Hub core, Hub content, Hub growth, Hub analytics, and server bundles.
