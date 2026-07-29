<?php
/**
 * Footer menu registration and render helpers
 *
 * @package brmbh
 */

/**
 * Render a nav menu by location slug with Bootstrap-friendly markup.
 * Usage in templates: brmbh_footer_nav( 'menu-footer-1' );
 */
function brmbh_footer_nav( string $location ): void {
	wp_nav_menu( array(
		'theme_location' => $location,
		'container'      => false,
		'menu_class'     => 'footer-nav d-flex gap-3 list-unstyled mb-0',
		'fallback_cb'    => false,
	) );
}
