<?php
/**
 * Gutenberg / block editor customizations
 * Derives color palette and spacing from theme brand tokens.
 *
 * @package brmbh
 */

/**
 * Load the compiled theme CSS into the block editor canvas.
 *
 * Two flags are required for Gutenberg to pick this up in the iframed editor:
 *   1. add_theme_support( 'editor-styles' ) — tells WP that the theme provides
 *      its own editor styles. Without this, add_editor_style() is ignored in
 *      the block editor (the classic editor still works without it).
 *   2. add_editor_style( <path> ) — registers the file. Path is relative to
 *      the theme root.
 *
 * Hooked at priority 5 to run before any add_editor_style() calls from blocks
 * (e.g. acf_register_block_type 'enqueue_style' filters), so the base styles
 * load first and block styles can override.
 */
function brmbh_editor_styles() {
	add_theme_support( 'editor-styles' );
	add_editor_style( 'assets/dist/css/style.css' );
}
add_action( 'after_setup_theme', 'brmbh_editor_styles', 5 );

// Expose brand colors to the block editor color picker.
// Keep these slugs in sync with $theme-colors in assets/src/scss/_variables.scss
// and the tokens in _tokens.scss. Re-value for your brand.
function brmbh_editor_color_palette() {
	add_theme_support( 'editor-color-palette', array(
		array( 'name' => 'Primary',         'slug' => 'primary',          'color' => '#2563eb' ),
		array( 'name' => 'Primary Darker',  'slug' => 'primary-darker',   'color' => '#1e3a8a' ),
		array( 'name' => 'Secondary',       'slug' => 'secondary',        'color' => '#64748b' ),
		array( 'name' => 'Secondary Light', 'slug' => 'secondary-light',  'color' => '#f1f5f9' ),
		array( 'name' => 'Ochre',           'slug' => 'ochre',            'color' => '#d97706' ),
		array( 'name' => 'Black',           'slug' => 'black',            'color' => '#0f172a' ),
		array( 'name' => 'White',           'slug' => 'white',            'color' => '#ffffff' ),
	) );

	// Disable the custom color picker — enforce brand palette
	add_theme_support( 'disable-custom-colors' );
}
add_action( 'after_setup_theme', 'brmbh_editor_color_palette' );

// Register custom block styles
add_action( 'init', function() {
	// Eyebrow paragraph — red bold label above headlines (same as .eyebrow global)
	register_block_style( 'core/paragraph', array(
		'name'  => 'eyebrow',
		'label' => 'Eyebrow',
	) );

	// Ochre button — secondary CTA style (ochre bg, pill shape; no underline)
	register_block_style( 'core/button', array(
		'name'  => 'ochre',
		'label' => 'Ochre',
	) );
} );

// Expose spacing scale to the block editor
function brmbh_editor_spacing() {
	add_theme_support( 'editor-spacing-sizes', array(
		array( 'name' => 'XXS',  'slug' => 'xxs',  'size' => '4px'   ),
		array( 'name' => 'XS',   'slug' => 'xs',   'size' => '12px'  ),
		array( 'name' => 'S',    'slug' => 's',    'size' => '16px'  ),
		array( 'name' => 'M',    'slug' => 'm',    'size' => '24px'  ),
		array( 'name' => 'L',    'slug' => 'l',    'size' => '32px'  ),
		array( 'name' => 'XL',   'slug' => 'xl',   'size' => '64px'  ),
		array( 'name' => 'XXL',  'slug' => 'xxl',  'size' => '128px' ),
	) );
}
add_action( 'after_setup_theme', 'brmbh_editor_spacing' );
