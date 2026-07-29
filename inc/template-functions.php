<?php
/**
 * Template helper functions — logo, body classes, FOUC guard.
 *
 * @package brmbh
 */

/**
 * Filename of the bundled theme logo SVG (used when no Customizer logo is set).
 * Drop your logo at assets/img/logo.svg (and optionally assets/img/logo-on-light.svg).
 */
function brmbh_theme_logo_filename( string $variant = 'default' ): string {
	return 'on-light' === $variant ? 'logo-on-light.svg' : 'logo.svg';
}

function brmbh_theme_logo_path( string $variant = 'default' ): string {
	return BRMBH_DIR . '/assets/img/' . brmbh_theme_logo_filename( $variant );
}

function brmbh_theme_logo_uri( string $variant = 'default' ): string {
	return BRMBH_URI . '/assets/img/' . brmbh_theme_logo_filename( $variant );
}

function brmbh_theme_logo_exists( string $variant = 'default' ): bool {
	return is_readable( brmbh_theme_logo_path( $variant ) );
}

function brmbh_has_site_logo(): bool {
	return (bool) get_theme_mod( 'custom_logo' ) || brmbh_theme_logo_exists();
}

/**
 * Output the site logo markup.
 *
 * Customizer → Site Identity → Logo overrides the theme SVG when set.
 *
 * @param array $args {
 *     @type string $class            CSS class on the <img> or fallback text.
 *     @type bool   $link             Wrap in home link. Default true.
 *     @type string $link_class       CSS class on the optional <a>.
 *     @type bool   $mobile_on_light  Use the on-light SVG variant below lg.
 * }
 */
function brmbh_the_site_logo( array $args = array() ): void {
	$defaults = array(
		'class'           => 'site-logo',
		'link'            => true,
		'link_class'      => '',
		'mobile_on_light' => false,
	);

	get_template_part(
		'template-parts/branding/site-logo',
		null,
		wp_parse_args( $args, $defaults )
	);
}

/**
 * Add useful body classes for styling targets.
 */
function brmbh_body_classes( array $classes ): array {
	if ( is_front_page() ) {
		$classes[] = 'is-front-page';
	}
	return $classes;
}
add_filter( 'body_class', 'brmbh_body_classes' );

/**
 * FOUC guard for scroll-entrance animations.
 *
 * Elements marked [data-fade-up] / [data-stagger-item] are hidden until
 * scroll-entrance.js runs gsap.set() and adds html.gsap-ready. Respects
 * prefers-reduced-motion (no hiding when motion is reduced).
 *
 * @see assets/src/js/scroll-entrance.js
 */
function brmbh_gsap_fouc_head(): void {
	?>
	<script>document.documentElement.classList.add('js');</script>
	<style id="brmbh-gsap-fouc">
	@media (prefers-reduced-motion: no-preference) {
		html.js:not(.gsap-ready) [data-fade-up],
		html.js:not(.gsap-ready) [data-stagger-item] {
			visibility: hidden;
		}
	}
	</style>
	<?php
}
add_action( 'wp_head', 'brmbh_gsap_fouc_head', 0 );
