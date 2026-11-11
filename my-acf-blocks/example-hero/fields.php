<?php
/**
 * ACF field group for the Example Hero block.
 *
 * Registered automatically by the block factory (inc/core/blocks.php) on acf/init.
 * The `key` must be unique and the location must match the block name.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

return array(
	'key'    => 'group_example_hero',
	'title'  => 'Example Hero',
	'fields' => array(
		array(
			'key'           => 'field_example_hero_eyebrow',
			'label'         => 'Eyebrow',
			'name'          => 'eyebrow',
			'type'          => 'text',
			'default_value' => 'Agentic WP Suite',
		),
		array(
			'key'           => 'field_example_hero_heading',
			'label'         => 'Heading',
			'name'          => 'heading',
			'type'          => 'text',
			'default_value' => 'Build sections with an ACF block factory.',
		),
		array(
			'key'           => 'field_example_hero_body',
			'label'         => 'Body',
			'name'          => 'body',
			'type'          => 'textarea',
			'rows'          => 3,
			'default_value' => 'Drop a folder with four files into my-acf-blocks/ and it registers itself. No manual wiring.',
		),
		array(
			'key'   => 'field_example_hero_cta',
			'label' => 'Button',
			'name'  => 'cta',
			'type'  => 'link',
		),
	),
	'location' => array(
		array(
			array(
				'param'    => 'block',
				'operator' => '==',
				'value'    => 'acf/example-hero',
			),
		),
	),
);
