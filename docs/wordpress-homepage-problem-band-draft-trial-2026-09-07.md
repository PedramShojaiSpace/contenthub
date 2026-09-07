# WordPress Homepage Copy Overhaul Draft Trial

## Scope

This was a contained test of whether a small block from the uploaded **Urban Monk Website Copy Overhaul — The Refuge Rewrite** can move through the current WordPress connection as a reviewable draft.

## Selected Section

**Home Page §1.2 — “The Problem band.”** This was chosen because it is a short, self-contained copy block that can sit below the hero without changing the existing header, navigation, offer routing, tracking, footer, or homepage layout.

## Draft Created

| Field | Value |
|---|---|
| WordPress page ID | `11496` |
| Title | `[DRAFT TRIAL] Homepage Problem Band` |
| Status | `draft` |
| Slug | `draft-trial-homepage-problem-band` |
| Edit URL | `https://theurbanmonk.com/wp-admin/post.php?post=11496&action=edit` |

The draft contains the selected three-beat Problem-band copy and an intentionally inactive Seven-Day Reboot CTA label. It does not contain a public route, checkout link, tracking configuration, SEO change, hero replacement, or homepage replacement.

## Verification

The authenticated WordPress read-back verified the exact title, slug, copy marker, and `draft` status. A public request to the draft slug returns the existing WordPress 404 page, confirming that the trial is not public.

## Explicit Non-Changes

The live homepage (page ID `2941`), Elementor layout, navigation, site-wide CTA destination, SEO/canonical metadata, images, media library, analytics/pixels, checkout/funnel links, and all other WordPress pages were not modified. The one-time draft-creation script was removed immediately after verification.
