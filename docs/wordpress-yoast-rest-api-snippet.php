<?php
/**
 * The Urban Monk — Yoast SEO REST API Field Exposure
 *
 * Paste this snippet into your WordPress theme's functions.php file
 * (or into a custom plugin / Code Snippets plugin).
 *
 * PURPOSE: Yoast SEO (free) does not expose its meta fields to the WordPress
 * REST API by default because they are "protected" (underscore-prefixed) keys.
 * This snippet registers them as REST-readable and REST-writable, allowing
 * the content.theurbanmonk.com platform to automatically populate all Yoast
 * SEO fields when publishing blog posts — no manual entry required.
 *
 * FIELDS EXPOSED:
 *   _yoast_wpseo_focuskw    → Focus Keyphrase
 *   _yoast_wpseo_metadesc   → Meta Description (150-160 chars)
 *   _yoast_wpseo_title      → SEO Title (shown in Google SERPs)
 *   _yoast_wpseo_canonical  → Canonical URL
 *
 * INSTALLATION:
 *   1. Go to Appearance → Theme File Editor → functions.php
 *      OR use the "Code Snippets" plugin (recommended — safer than editing theme files)
 *   2. Paste this entire block at the bottom of the file
 *   3. Save — no restart required
 *
 * SECURITY: These fields are only writable by authenticated users with
 * edit_posts capability (i.e., your application password). Public REST
 * requests cannot write to these fields.
 */
add_action( 'rest_api_init', function () {
    $yoast_fields = [
        '_yoast_wpseo_focuskw'   => 'Focus Keyphrase for Yoast SEO',
        '_yoast_wpseo_metadesc'  => 'Meta Description for Yoast SEO',
        '_yoast_wpseo_title'     => 'SEO Title for Yoast SEO',
        '_yoast_wpseo_canonical' => 'Canonical URL for Yoast SEO',
    ];

    foreach ( $yoast_fields as $meta_key => $description ) {
        register_post_meta( 'post', $meta_key, [
            'show_in_rest'  => true,
            'single'        => true,
            'type'          => 'string',
            'description'   => $description,
            'auth_callback' => function () {
                return current_user_can( 'edit_posts' );
            },
        ] );
    }
} );
