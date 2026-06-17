<?php
/**
 * {{ TITLE }} — custom post type.
 *
 * One file per entity: CPT registration + (optional) ACF fields + helpers.
 * Auto-loaded by the inc/post-types autoloader (see functions.php).
 *
 * @package brmbh-agentic-wp-suite
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'init', function () {
	register_post_type( '{{ KEY }}', array(
		'labels'       => array(
			'name'          => '{{ TITLE_PLURAL }}',
			'singular_name' => '{{ TITLE }}',
		),
		'public'       => false,
		'show_ui'      => true,
		'show_in_rest' => true,
		'has_archive'  => false,
		'rewrite'      => false,
		'menu_icon'    => 'dashicons-portfolio',
		'supports'     => array( 'title', 'thumbnail', 'revisions' ),
	) );
} );

/**
 * ACF fields for {{ TITLE }} — uncomment and extend as needed.
 */
add_action( 'acf/init', function () {
	if ( ! function_exists( 'acf_add_local_field_group' ) ) {
		return;
	}
	// acf_add_local_field_group( array(
	// 	'key'      => 'group_{{ KEY }}',
	// 	'title'    => '{{ TITLE }} Details',
	// 	'fields'   => array(),
	// 	'location' => array(
	// 		array(
	// 			array( 'param' => 'post_type', 'operator' => '==', 'value' => '{{ KEY }}' ),
	// 		),
	// 	),
	// ) );
} );
