<?php
/**
 * Bootstrap 5 nav walkers — flat, no sub-menu support.
 *
 * Brmbh_Bootstrap_Nav_Walker : primary nav  → .site-nav__menu .nav-item .site-nav__link
 * Brmbh_Footer_Nav_Walker    : footer nav   → .site-footer__nav li a
 *
 * @package brmbh
 */

if ( ! class_exists( 'Brmbh_Bootstrap_Nav_Walker' ) ) :

class Brmbh_Bootstrap_Nav_Walker extends Walker_Nav_Menu {

	public function start_el( &$output, $item, $depth = 0, $args = null, $id = 0 ) {
		$classes   = empty( $item->classes ) ? array() : (array) $item->classes;
		$classes[] = 'nav-item';

		$output .= '<li class="' . esc_attr( implode( ' ', array_filter( $classes ) ) ) . '">';

		$link_class = 'site-nav__link';
		if ( in_array( 'current-menu-item', $classes, true ) ) {
			$link_class .= ' is-active';
		}

		$atts  = '';
		$atts .= ' href="' . esc_url( $item->url ) . '"';
		$atts .= ' class="' . esc_attr( $link_class ) . '"';
		if ( ! empty( $item->target ) )    { $atts .= ' target="' . esc_attr( $item->target ) . '"'; }
		if ( ! empty( $item->xfn ) )       { $atts .= ' rel="' . esc_attr( $item->xfn ) . '"'; }
		if ( ! empty( $item->attr_title ) ){ $atts .= ' title="' . esc_attr( $item->attr_title ) . '"'; }
		if ( in_array( 'current-menu-item', $classes, true ) ) {
			$atts .= ' aria-current="page"';
		}

		$output .= '<a' . $atts . '>' . esc_html( $item->title ) . '</a>';
	}

	public function end_el( &$output, $item, $depth = 0, $args = null ) {
		$output .= '</li>';
	}

	public function start_lvl( &$output, $depth = 0, $args = null ) {}
	public function end_lvl( &$output, $depth = 0, $args = null ) {}
}

endif;

if ( ! class_exists( 'Brmbh_Footer_Nav_Walker' ) ) :

class Brmbh_Footer_Nav_Walker extends Walker_Nav_Menu {

	public function start_el( &$output, $item, $depth = 0, $args = null, $id = 0 ) {
		$output .= '<li>';

		$atts  = '';
		$atts .= ' href="' . esc_url( $item->url ) . '"';
		$atts .= ' class="nav-link px-0 fw-semibold text-white"';
		if ( ! empty( $item->target ) ) { $atts .= ' target="' . esc_attr( $item->target ) . '"'; }
		if ( ! empty( $item->xfn ) )    { $atts .= ' rel="' . esc_attr( $item->xfn ) . '"'; }

		$output .= '<a' . $atts . '>' . esc_html( $item->title ) . '</a>';
	}

	public function end_el( &$output, $item, $depth = 0, $args = null ) {
		$output .= '</li>';
	}

	public function start_lvl( &$output, $depth = 0, $args = null ) {}
	public function end_lvl( &$output, $depth = 0, $args = null ) {}
}

endif;
