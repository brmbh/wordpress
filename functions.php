<?php
/**
 * brmbh — theme functions
 *
 * Agentic WordPress starter: Bootstrap 5 + Gutenberg + ACF block factory.
 *
 * @package brmbh
 */

define( 'BRMBH_VERSION', '0.1.0' );
define( 'BRMBH_DIR', get_template_directory() );
define( 'BRMBH_URI', get_template_directory_uri() );

// ---------------------------------------------------------------------------
// Theme setup
// ---------------------------------------------------------------------------
function brmbh_setup() {
	load_theme_textdomain( 'brmbh', BRMBH_DIR . '/languages' );

	add_theme_support( 'automatic-feed-links' );
	add_theme_support( 'title-tag' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'html5', array( 'search-form', 'comment-form', 'comment-list', 'gallery', 'caption', 'style', 'script' ) );
	add_theme_support( 'custom-logo', array( 'flex-width' => true, 'flex-height' => true ) );
	add_theme_support( 'align-wide' );

	register_nav_menus( array(
		'menu-primary'  => __( 'Primary Navigation', 'brmbh' ),
		'menu-footer-1' => __( 'Footer Navigation', 'brmbh' ),
	) );
}
add_action( 'after_setup_theme', 'brmbh_setup' );

// ---------------------------------------------------------------------------
// Enqueue assets
// ---------------------------------------------------------------------------
function brmbh_enqueue_assets() {
	// Bootstrap utilities first; theme styles after so component styles win.
	wp_enqueue_style(
		'brmbh-bootstrap',
		BRMBH_URI . '/assets/dist/css/custom-bootstrap.css',
		array(),
		file_exists( BRMBH_DIR . '/assets/dist/css/custom-bootstrap.css' ) ? filemtime( BRMBH_DIR . '/assets/dist/css/custom-bootstrap.css' ) : BRMBH_VERSION
	);

	wp_enqueue_style(
		'brmbh-style',
		BRMBH_URI . '/assets/dist/css/style.css',
		array( 'brmbh-bootstrap' ),
		file_exists( BRMBH_DIR . '/assets/dist/css/style.css' ) ? filemtime( BRMBH_DIR . '/assets/dist/css/style.css' ) : BRMBH_VERSION
	);

	// JS bundle — depends on jquery (WP's bundled copy, set as a webpack external).
	if ( file_exists( BRMBH_DIR . '/assets/dist/js/main.bundle.js' ) ) {
		wp_enqueue_script(
			'brmbh-bundle',
			BRMBH_URI . '/assets/dist/js/main.bundle.js',
			array( 'jquery' ),
			filemtime( BRMBH_DIR . '/assets/dist/js/main.bundle.js' ),
			true
		);
	}

	// Font preloads
	foreach ( array( 'InterVariable.woff2', 'InterDisplay-SemiBold.woff2' ) as $font ) {
		add_action( 'wp_head', function () use ( $font ) {
			echo '<link rel="preload" href="' . esc_url( BRMBH_URI . '/fonts/' . $font ) . '" as="font" type="font/woff2" crossorigin>' . "\n";
		}, 1 );
	}
}
add_action( 'wp_enqueue_scripts', 'brmbh_enqueue_assets' );

// ---------------------------------------------------------------------------
// Includes
// ---------------------------------------------------------------------------

// Hard dependency check FIRST — must load before anything that touches ACF.
// Defines brmbh_has_acf_pro() and surfaces admin notices everywhere.
require BRMBH_DIR . '/inc/dependencies.php';

require BRMBH_DIR . '/inc/template-functions.php';
require BRMBH_DIR . '/inc/block-patterns.php';
require BRMBH_DIR . '/inc/gutenberg.php';
require BRMBH_DIR . '/inc/footer-menus.php';
require BRMBH_DIR . '/inc/bootstrap-nav-walker.php';

// ACF block factory — loader hooks itself onto init + acf/init and bails safely
// if ACF isn't loaded. Drop a four-file folder into my-acf-blocks/ and it registers.
require BRMBH_DIR . '/my-acf-blocks/loader.php';

// Scaffold (pages + menus) + WP-CLI namespace.
require BRMBH_DIR . '/inc/scaffold.php';
if ( defined( 'WP_CLI' ) && WP_CLI ) {
	require BRMBH_DIR . '/inc/cli.php';
}
