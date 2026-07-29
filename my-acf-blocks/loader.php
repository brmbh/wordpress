<?php
/**
 * ACF Block Factory — auto-registration loader
 *
 * Scans my-acf-blocks/ for subdirectories. Each block folder must contain:
 *   - block.json       block registration metadata (WordPress standard)
 *   - fields.php       ACF field group definition (returned as array)
 *   - template.php     block render output (referenced via block.json renderTemplate)
 *   - _style.scss      block styles (imported via _loader.scss)
 *
 * Drop a new folder with these four files and it works — no manual registration.
 * fields.php alone is valid for ACF groups without a custom block.
 *
 * @package brmbh
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register blocks on init — WordPress reads block.json from each folder.
 * ACF hooks into register_block_type() and handles rendering via renderTemplate.
 */
function brmbh_register_acf_blocks(): void {
	$blocks_dir = get_template_directory() . '/my-acf-blocks';
	if ( ! is_dir( $blocks_dir ) ) {
		return;
	}

	foreach ( array_filter( glob( $blocks_dir . '/*' ), 'is_dir' ) as $folder ) {
		if ( file_exists( $folder . '/block.json' ) ) {
			register_block_type( $folder );
		}
	}
}
add_action( 'init', 'brmbh_register_acf_blocks' );

/**
 * Register ACF field groups on acf/init — guarantees ACF is loaded.
 */
function brmbh_register_acf_field_groups(): void {
	if ( ! function_exists( 'acf_add_local_field_group' ) ) {
		return;
	}

	$blocks_dir = get_template_directory() . '/my-acf-blocks';
	if ( ! is_dir( $blocks_dir ) ) {
		return;
	}

	foreach ( array_filter( glob( $blocks_dir . '/*' ), 'is_dir' ) as $folder ) {
		$fields_file = $folder . '/fields.php';
		if ( ! file_exists( $fields_file ) ) {
			continue;
		}
		$field_group = include $fields_file;
		if ( is_array( $field_group ) && ! empty( $field_group['key'] ) ) {
			acf_add_local_field_group( $field_group );
		}
	}
}
add_action( 'acf/init', 'brmbh_register_acf_field_groups' );
