<?php
/**
 * ACF field group for the {{ TITLE }} block.
 *
 * Registered automatically by my-acf-blocks/loader.php on acf/init.
 * Add fields below; keep `key` values unique and prefixed.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

return array(
	'key'    => 'group_{{ KEY }}',
	'title'  => '{{ TITLE }}',
	'fields' => array(
		array(
			'key'           => 'field_{{ KEY }}_heading',
			'label'         => 'Heading',
			'name'          => 'heading',
			'type'          => 'text',
			'default_value' => '{{ TITLE }}',
		),
	),
	'location' => array(
		array(
			array(
				'param'    => 'block',
				'operator' => '==',
				'value'    => 'acf/{{ SLUG }}',
			),
		),
	),
);
