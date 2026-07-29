<?php
/**
 * Block patterns and pattern categories.
 *
 * Philosophy: editors never type a Bootstrap class. Every native-Gutenberg
 * section is built from these patterns — alignfull group + WP constrained
 * layout, with the .section padding class for vertical rhythm.
 *
 * Sections:
 *   1. Register block category "brmbh-sections" for ACF blocks
 *   2. Register pattern category "Sections"
 *   3. Patterns: White, Highlighted (beige), Dark, Image + Text
 *
 * @package brmbh
 */

// ── Block category for ACF custom blocks ─────────────────────────────────────

add_filter( 'block_categories_all', function ( $categories ) {
	return array_merge(
		array(
			array(
				'slug'  => 'brmbh-sections',
				'title' => __( 'Sections', 'brmbh' ),
				'icon'  => 'layout',
			),
		),
		$categories
	);
} );

// ── Pattern category ──────────────────────────────────────────────────────────

add_action( 'init', function () {

	register_block_pattern_category( 'brmbh-sections', array(
		'label'       => __( 'Sections', 'brmbh' ),
		'description' => __( 'Full-width section templates. Background extends edge-to-edge; content constrained to 1272px.', 'brmbh' ),
	) );

	// ── Pattern: Section — White ──────────────────────────────────────────────
	// Plain white full-width section with constrained content. Starting point
	// for any new section. Add blocks inside, optionally add a background color
	// via the block toolbar.

	register_block_pattern( 'brmbh/section-white', array(
		'title'       => __( 'Section — White', 'brmbh' ),
		'description' => __( 'Full-width section, white bg, content constrained to 1272px.', 'brmbh' ),
		'categories'  => array( 'brmbh-sections' ),
		'content'     => '<!-- wp:group {"align":"full","className":"section","layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull section">

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">Section Headline</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Section content goes here. Replace with your blocks.</p>
<!-- /wp:paragraph -->

</div>
<!-- /wp:group -->',
	) );

	// ── Pattern: Section — Highlighted (beige) ────────────────────────────────
	// Full-width section with secondary-light (#e5e1da) background. Used for
	// USP grids, alternating content rows, "featured" feel without dark bg.

	register_block_pattern( 'brmbh/section-highlighted', array(
		'title'       => __( 'Section — Highlighted', 'brmbh' ),
		'description' => __( 'Full-width section, beige bg (secondary-light), content constrained to 1272px.', 'brmbh' ),
		'categories'  => array( 'brmbh-sections' ),
		'content'     => '<!-- wp:group {"align":"full","backgroundColor":"secondary-light","className":"section","layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull section has-secondary-light-background-color has-background">

<!-- wp:paragraph {"className":"is-style-eyebrow"} -->
<p class="is-style-eyebrow">Eyebrow Label</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2,"textAlign":"center"} -->
<h2 class="wp-block-heading has-text-align-center">Section Headline</h2>
<!-- /wp:heading -->

<!-- wp:paragraph {"align":"center"} -->
<p class="has-text-align-center">Optional intro text. Remove if not needed.</p>
<!-- /wp:paragraph -->

</div>
<!-- /wp:group -->',
	) );

	// ── Pattern: Section — Dark (mesh gradient) ───────────────────────────────
	// Full-width section with dark brand background. White text. Used for
	// high-contrast CTA sections or event backgrounds.

	register_block_pattern( 'brmbh/section-dark', array(
		'title'       => __( 'Section — Dark', 'brmbh' ),
		'description' => __( 'Full-width section, dark brand bg (primary-darker), white text, content constrained to 1272px.', 'brmbh' ),
		'categories'  => array( 'brmbh-sections' ),
		'content'     => '<!-- wp:group {"align":"full","backgroundColor":"primary-darker","textColor":"white","className":"section","layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull section has-primary-darker-background-color has-white-color has-text-color has-background">

<!-- wp:heading {"level":2,"textColor":"white"} -->
<h2 class="wp-block-heading has-white-color has-text-color">Section Headline</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Section content on dark background. Add blocks inside.</p>
<!-- /wp:paragraph -->

</div>
<!-- /wp:group -->',
	) );

	// ── Pattern: Image + Text ─────────────────────────────────────────────────
	// 50/50 two-column layout: image left, eyebrow + heading + body + CTA right.
	// Image position (left/right) can be changed by reordering the columns in
	// the editor. Add .imagetext-content class to the text column for gap spacing.

	register_block_pattern( 'brmbh/image-text', array(
		'title'       => __( 'Image + Text', 'brmbh' ),
		'description' => __( '50/50 image-left + text-right section. Stacks on mobile. Flip columns to move image right.', 'brmbh' ),
		'categories'  => array( 'brmbh-sections' ),
		'content'     => '<!-- wp:group {"align":"full","className":"section bg-white","layout":{"type":"default"}} -->
<div class="wp-block-group alignfull section bg-white">

<!-- wp:columns {"isStackedOnMobile":true,"className":"container"} -->
<div class="wp-block-columns container is-layout-flex">

<!-- wp:column {"verticalAlignment":"center","width":"50%"} -->
<div class="wp-block-column is-vertically-aligned-center" style="flex-basis:50%">
<!-- wp:image {"sizeSlug":"full","className":"imagetext-img"} -->
<figure class="wp-block-image size-full imagetext-img"><img src="" alt=""/></figure>
<!-- /wp:image -->
</div>
<!-- /wp:column -->

<!-- wp:column {"verticalAlignment":"center","width":"50%","className":"imagetext-content"} -->
<div class="wp-block-column is-vertically-aligned-center imagetext-content" style="flex-basis:50%">

<!-- wp:paragraph {"className":"is-style-eyebrow"} -->
<p class="is-style-eyebrow">Eyebrow Label</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">Headline</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Body text goes here. Replace with your content.</p>
<!-- /wp:paragraph -->

<!-- wp:buttons {"layout":{"type":"flex","flexWrap":"wrap"}} -->
<div class="wp-block-buttons">
<!-- wp:button -->
<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="#">Primary CTA</a></div>
<!-- /wp:button -->
<!-- wp:button {"className":"is-style-ochre"} -->
<div class="wp-block-button is-style-ochre"><a class="wp-block-button__link wp-element-button" href="#">Secondary CTA</a></div>
<!-- /wp:button -->
</div>
<!-- /wp:buttons -->

</div>
<!-- /wp:column -->

</div>
<!-- /wp:columns -->

</div>
<!-- /wp:group -->',
	) );

} );
