# WordPress Homepage AI-Editing: Minimum Viable Recommendation

**Decision:** Do not build a new Content Hub homepage editor at this stage. Use a small, change-specific AI-assisted workflow first.

## Verified Current State

The Urban Monk homepage is WordPress page **ID 2941** (`Home`) and is configured as the site's static front page. Its public REST record and installed namespaces indicate an Elementor-based page-building stack, including Elementor, Elementor Pro, JetEngine, JetElements, JetBlocks, and related plugins. The existing Content Hub WordPress helper is robust for blog-post creation and post-level SEO/content repair, but it does not yet provide a safe generic homepage/page-builder revision workflow.

This matters because a homepage visual edit is not merely a text update to a WordPress `content` field. Elementor layouts are commonly represented through builder-specific page data and related metadata. A generic REST write to the raw page content could leave the visible layout, responsive settings, dynamic widgets, or style system inconsistent.

## Recommended Lightweight Workflow

| Step | Who | What happens |
|---|---|---|
| 1. Describe the change | Owner | State the specific homepage edit in ordinary language, for example: “Replace the hero headline and button label; keep image, navigation, tracking, and all other sections unchanged.” |
| 2. Produce a change card | Content Hub / AI | Return the exact copy, affected visual region, non-change list, SEO implications, and rollback target. Do not write to WordPress. |
| 3. Preview safely | Operator | Use the existing Elementor/WordPress preview or staging/revision environment to apply the narrow change and inspect desktop/mobile output. |
| 4. Confirm publication | Owner | Give explicit approval for that exact scoped patch. |
| 5. Apply and verify | Operator / controlled workflow | Publish only the approved change, then check the live homepage and preserve a before/after record. |

## Why This Is the Right First Move

For occasional homepage edits, this approach removes the burden of deciding what to change, writing the copy, checking affected elements, and remembering the rollback path. It avoids the cost and risk of building a generic editor for a complex Elementor page.

If the workflow becomes repetitive, the next narrowly scoped build should be a **Homepage Change Request panel** in the Content Hub. It should create an AI-generated change card and approval record, but still should not directly alter Elementor data until a separately tested, page-specific revision mechanism is available.

## Explicit Non-Changes

This assessment did not alter the homepage, WordPress, Elementor, page metadata, Yoast fields, images, media library, tracking, navigation, checkout links, redirects, DNS, or external systems.
