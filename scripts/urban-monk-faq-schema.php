<?php
/**
 * Urban Monk — FAQ Schema Injector
 * =================================
 * Paste this into your child theme's functions.php (or a site-specific plugin).
 *
 * What it does:
 *   The Content Hub stores FAQPage JSON-LD inside a hidden <div class="schema-faq-data">
 *   element in each post's content. Classic Editor preserves that div without rendering it,
 *   but Google's crawler cannot see it as structured data unless it is output in <head>.
 *   This snippet reads the div on every single post, extracts the raw JSON, validates it,
 *   and outputs a proper <script type="application/ld+json"> tag in wp_head so Google,
 *   Bing, and AI engines (ChatGPT, Perplexity) can index the FAQ schema correctly.
 *
 * Requirements:
 *   - WordPress 5.0+
 *   - DOMDocument (standard PHP extension, always available on WP hosts)
 *   - No plugin dependencies — works alongside Yoast SEO without conflict
 *
 * Installation:
 *   1. Open Appearance → Theme File Editor → functions.php (child theme)
 *      OR upload this file as a must-use plugin to /wp-content/mu-plugins/
 *   2. Paste the entire contents below the opening <?php tag
 *   3. Save. No further configuration needed.
 *
 * Verification:
 *   - Open any blog post URL and view source (Ctrl+U)
 *   - Search for '"@type": "FAQPage"' — it should appear inside a <script> tag in <head>
 *   - Paste the post URL into https://search.google.com/test/rich-results to confirm
 */

add_action( 'wp_head', 'urban_monk_inject_faq_schema', 5 );

function urban_monk_inject_faq_schema() {
    // Only run on single posts (not archives, home, pages, etc.)
    if ( ! is_singular( 'post' ) ) {
        return;
    }

    $post = get_post();
    if ( ! $post || empty( $post->post_content ) ) {
        return;
    }

    // Use DOMDocument to reliably extract the hidden div by class name.
    // We suppress warnings because WP post content often has minor HTML quirks.
    $dom = new DOMDocument( '1.0', 'UTF-8' );
    libxml_use_internal_errors( true );

    // Wrap in a UTF-8 meta tag so DOMDocument handles special characters correctly.
    $dom->loadHTML(
        '<?xml encoding="UTF-8"><html><body>' . $post->post_content . '</body></html>',
        LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD
    );
    libxml_clear_errors();

    $xpath = new DOMXPath( $dom );

    // Find the first div with class "schema-faq-data"
    $nodes = $xpath->query( '//div[contains(concat(" ", normalize-space(@class), " "), " schema-faq-data ")]' );

    if ( ! $nodes || $nodes->length === 0 ) {
        return; // No FAQ schema on this post — nothing to do
    }

    $raw_json = trim( $nodes->item(0)->textContent );

    if ( empty( $raw_json ) ) {
        return;
    }

    // Validate: must be parseable JSON with @type FAQPage
    $decoded = json_decode( $raw_json, true );
    if (
        ! is_array( $decoded )
        || empty( $decoded['@type'] )
        || $decoded['@type'] !== 'FAQPage'
        || empty( $decoded['mainEntity'] )
    ) {
        // Malformed schema — skip silently rather than outputting bad markup
        return;
    }

    // Re-encode cleanly (removes any whitespace artifacts from the div extraction)
    $clean_json = wp_json_encode( $decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT );

    if ( ! $clean_json ) {
        return;
    }

    // Output the structured data block in <head>
    echo "\n<!-- Urban Monk FAQ Schema (injected by child theme) -->\n";
    echo '<script type="application/ld+json">' . "\n";
    echo $clean_json . "\n";
    echo '</script>' . "\n";
}
