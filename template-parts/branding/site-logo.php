<?php
/**
 * Site logo — Custom Logo (Customizer) or theme SVG fallback.
 *
 * @package brmbh
 *
 * @var array $args {
 *     @type string $class      CSS class on the <img>.
 *     @type bool   $link       Wrap in home link. Default true.
 *     @type string $link_class       CSS class on the optional <a>.
 *     @type bool   $mobile_on_light  Alternate logo variant in header below lg.
 * }
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$class           = $args['class'] ?? 'site-logo';
$link            = $args['link'] ?? true;
$link_class      = $args['link_class'] ?? '';
$mobile_on_light = ! empty( $args['mobile_on_light'] );

$logo_id = (int) get_theme_mod( 'custom_logo' );
$markup  = '';

if ( $logo_id ) {
	$markup = wp_get_attachment_image(
		$logo_id,
		'full',
		false,
		array(
			'class' => $class,
			'alt'   => get_bloginfo( 'name', 'display' ),
		)
	);
} elseif ( brmbh_theme_logo_exists() ) {
	$alt         = get_bloginfo( 'name', 'display' );
	$default_src = brmbh_theme_logo_uri();
	$img_attrs    = sprintf(
		'alt="%1$s" class="%2$s" width="517" height="234" loading="eager" decoding="async"',
		esc_attr( $alt ),
		esc_attr( $class )
	);

	if ( $mobile_on_light && brmbh_theme_logo_exists( 'on-light' ) ) {
		$markup = sprintf(
			'<picture><source media="(max-width: 991.98px)" srcset="%1$s"><img src="%2$s" %3$s></picture>',
			esc_url( brmbh_theme_logo_uri( 'on-light' ) ),
			esc_url( $default_src ),
			$img_attrs // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped above.
		);
	} else {
		$markup = sprintf(
			'<img src="%1$s" %2$s>',
			esc_url( $default_src ),
			$img_attrs // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped above.
		);
	}
}

if ( ! $markup ) {
	$fallback = sprintf(
		'<span class="%s">%s</span>',
		esc_attr( trim( $class . ' site-logo__fallback' ) ),
		esc_html( get_bloginfo( 'name', 'display' ) )
	);

	if ( $link ) {
		printf(
			'<a href="%1$s" class="%2$s" rel="home">%3$s</a>',
			esc_url( home_url( '/' ) ),
			esc_attr( trim( $link_class ) ),
			$fallback // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped above.
		);
	} else {
		echo $fallback; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}
	return;
}

if ( $link ) {
	printf(
		'<a href="%1$s" class="%2$s" rel="home">%3$s</a>',
		esc_url( home_url( '/' ) ),
		esc_attr( trim( $link_class ) ),
		$markup // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped above.
	);
} else {
	echo $markup; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
}
