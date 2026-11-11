<?php
/**
 * brmbh core — ACF block factory loader.
 *
 * Scans the block folders (default: my-acf-blocks/ in the theme) for subdirectories.
 * Each block folder holds:
 *   - block.json       block registration metadata (WordPress standard)
 *   - fields.php       ACF field group definition (returned as array)
 *   - template.php     block render output (referenced via block.json renderTemplate)
 *   - _style.scss      block styles (imported via my-acf-blocks/_loader.scss)
 *
 * Drop a new folder with these four files and it works — no manual registration.
 * fields.php alone is valid for ACF groups without a custom block.
 *
 * Part of the brmbh core: replaced by `brmbh update`, never edited in a site.
 * Change where blocks are found with the `brmbh/block_dirs` filter.
 *
 * @package brmbh
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The folders the factory scans, each holding one subfolder per block.
 *
 * Filter `brmbh/block_dirs` to add a folder (e.g. blocks from a plugin) or
 * replace the default.
 *
 * @return string[] absolute paths that exist
 */
function brmbh_block_dirs(): array {
	$dirs = apply_filters( 'brmbh/block_dirs', array( get_template_directory() . '/my-acf-blocks' ) );
	return array_values( array_filter( (array) $dirs, 'is_dir' ) );
}

/**
 * Every block folder across all block dirs.
 *
 * @return string[]
 */
function brmbh_block_folders(): array {
	$folders = array();
	foreach ( brmbh_block_dirs() as $dir ) {
		foreach ( array_filter( glob( $dir . '/*' ), 'is_dir' ) as $folder ) {
			$folders[] = $folder;
		}
	}
	return $folders;
}

/**
 * Register blocks on init — WordPress reads block.json from each folder.
 * ACF hooks into register_block_type() and handles rendering via renderTemplate.
 */
function brmbh_register_acf_blocks(): void {
	foreach ( brmbh_block_folders() as $folder ) {
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

	foreach ( brmbh_block_folders() as $folder ) {
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
