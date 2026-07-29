<?php
/**
 * Scaffold — idempotent bootstrap of pages, menus, and menu locations.
 *
 * The scaffold defines what theme-level DB content must exist for the site to function.
 * Re-running is safe: existing items are looked up by slug/location and skipped, not duplicated.
 *
 * Scope:
 * - Pages (by slug)
 * - Menus (by location slug)
 * - Menu items (page references and custom URL links)
 * - Menu location assignments (set_theme_mod)
 *
 * Out of scope (handled elsewhere):
 * - ACF field groups (per-block, via /create-block skill)
 * - Block templates (per-block, via /create-block skill)
 * - DB sync across environments (deferred — see Phase 2)
 *
 * @package brmbh
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Gutenberg markup for the seeded home page: one example-hero block.
 *
 * ACF blocks carry their field values in the block attributes — `data` holds
 * name => value, and each `_name` key points at the field key so ACF can
 * resolve the group. Keep these in sync with
 * my-acf-blocks/example-hero/fields.php.
 *
 * @return string
 */
function brmbh_scaffold_home_content(): string {
	$attrs = array(
		'name' => 'acf/example-hero',
		'data' => array(
			'eyebrow'  => 'Agentic WordPress',
			'_eyebrow' => 'field_example_hero_eyebrow',
			'heading'  => 'Ask for a section. Your agent builds the block.',
			'_heading' => 'field_example_hero_heading',
			'body'     => 'Every block is four files following one convention — so your agent has a pattern to follow instead of improvising, and you review a diff instead of writing boilerplate. Open your editor and ask for a hero built from a Figma frame.',
			'_body'    => 'field_example_hero_body',
		),
		'mode' => 'preview',
	);

	// JSON_UNESCAPED_UNICODE keeps the em dash literal instead of \u2014, which
	// keeps the stored markup readable. The slashing is handled by the caller.
	return '<!-- wp:acf/example-hero ' . wp_json_encode( $attrs, JSON_UNESCAPED_UNICODE ) . ' /-->';
}

/**
 * The scaffold definition for this site.
 * Edit this array to declare what should exist on the site. Then run:
 *   wp brmbh scaffold
 *
 * @return array
 */
function brmbh_scaffold_definition(): array {
	return array(
		'pages' => array(
			array(
				'slug'              => 'home',
				'title'             => 'Home',
				'status'            => 'publish',
				'set_as_front_page' => true,
				// Seeded so a fresh install renders something real instead of an
				// empty page. The theme's nav is fixed and transparent, designed to
				// sit over a hero — with no content the header collapses onto the
				// footer and the site looks broken on first load.
				'content'           => brmbh_scaffold_home_content(),
			),
			array(
				'slug'   => 'sample-page',
				'title'  => 'Sample Page',
				'status' => 'publish',
			),
			array(
				// Deterministic preview harness for in-progress ACF blocks.
				'slug'   => 'dev-sandbox',
				'title'  => 'Dev Sandbox',
				'status' => 'private',
			),
			array( 'slug' => 'privacy-policy', 'title' => 'Privacy Policy' ),
		),

		'menus' => array(
			'menu-primary' => array(
				'name'  => 'Primary',
				'items' => array(
					array( 'type' => 'page',   'slug'  => 'home' ),
					array( 'type' => 'page',   'slug'  => 'sample-page' ),
				),
			),
			'menu-footer-1' => array(
				'name'  => 'Footer',
				'items' => array(
					array( 'type' => 'page', 'slug' => 'privacy-policy' ),
				),
			),
		),
	);
}

/**
 * Run the scaffold. Idempotent.
 *
 * @param bool $dry_run If true, returns the plan without writing.
 * @return array Report of what was created vs skipped.
 */
function brmbh_scaffold_run( bool $dry_run = false ): array {
	$def    = brmbh_scaffold_definition();
	$report = array(
		'pages' => array(),
		'menus' => array(),
		'items' => array(),
	);

	// ── 1. Pages ──────────────────────────────────────────────────────────
	$page_ids = array(); // slug → ID, used by menu-item creation below
	foreach ( $def['pages'] as $page_def ) {
		$existing = get_page_by_path( $page_def['slug'] );
		if ( $existing ) {
			$page_ids[ $page_def['slug'] ] = $existing->ID;
			$report['pages'][] = array( 'slug' => $page_def['slug'], 'action' => 'skip (exists)', 'id' => $existing->ID );
			continue;
		}

		if ( $dry_run ) {
			$report['pages'][] = array( 'slug' => $page_def['slug'], 'action' => 'would-create' );
			continue;
		}

		$post_id = wp_insert_post( array(
			'post_title'   => $page_def['title'],
			'post_name'    => $page_def['slug'],
			'post_type'    => 'page',
			'post_status'  => $page_def['status'] ?? 'publish',
			// wp_insert_post() unslashes what it is given, so block-attribute JSON
			// must be slashed on the way in — otherwise every backslash is eaten
			// and \u2014 lands as 'u2014', escaped quotes break the attributes.
			'post_content' => wp_slash( $page_def['content'] ?? '' ),
		) );

		if ( is_wp_error( $post_id ) ) {
			$report['pages'][] = array( 'slug' => $page_def['slug'], 'action' => 'error', 'error' => $post_id->get_error_message() );
			continue;
		}

		$page_ids[ $page_def['slug'] ] = $post_id;
		$report['pages'][] = array( 'slug' => $page_def['slug'], 'action' => 'created', 'id' => $post_id );

		// Optional: assign as static front page
		if ( ! empty( $page_def['set_as_front_page'] ) ) {
			update_option( 'show_on_front', 'page' );
			update_option( 'page_on_front', $post_id );
		}
	}

	// ── 2. Menus + items + location assignment ────────────────────────────
	$nav_menu_locations = get_theme_mod( 'nav_menu_locations', array() );

	foreach ( $def['menus'] as $location => $menu_def ) {
		// Create/lookup menu by name
		$menu = wp_get_nav_menu_object( $menu_def['name'] );
		if ( ! $menu ) {
			if ( $dry_run ) {
				$report['menus'][] = array( 'location' => $location, 'action' => 'would-create', 'name' => $menu_def['name'] );
				continue;
			}
			$menu_id = wp_create_nav_menu( $menu_def['name'] );
			if ( is_wp_error( $menu_id ) ) {
				$report['menus'][] = array( 'location' => $location, 'action' => 'error', 'error' => $menu_id->get_error_message() );
				continue;
			}
			$menu = wp_get_nav_menu_object( $menu_id );
			$report['menus'][] = array( 'location' => $location, 'action' => 'created', 'id' => $menu_id, 'name' => $menu_def['name'] );
		} else {
			$report['menus'][] = array( 'location' => $location, 'action' => 'skip (exists)', 'id' => $menu->term_id );
		}

		// Add items if missing (look up by title within this menu)
		$existing_items = wp_get_nav_menu_items( $menu->term_id ) ?: array();
		$existing_titles = wp_list_pluck( $existing_items, 'title' );

		foreach ( $menu_def['items'] as $item_def ) {
			$item_title = $item_def['title'] ?? '';
			if ( $item_def['type'] === 'page' ) {
				$page_obj   = get_page_by_path( $item_def['slug'] );
				$item_title = $item_def['title'] ?? ( $page_obj ? $page_obj->post_title : $item_def['slug'] );
			}

			if ( in_array( $item_title, $existing_titles, true ) ) {
				$report['items'][] = array( 'menu' => $menu_def['name'], 'title' => $item_title, 'action' => 'skip (exists)' );
				continue;
			}

			if ( $dry_run ) {
				$report['items'][] = array( 'menu' => $menu_def['name'], 'title' => $item_title, 'action' => 'would-create' );
				continue;
			}

			$item_args = array(
				'menu-item-title'  => $item_title,
				'menu-item-status' => 'publish',
			);

			if ( $item_def['type'] === 'page' ) {
				$page_obj = get_page_by_path( $item_def['slug'] );
				if ( ! $page_obj ) {
					$report['items'][] = array( 'menu' => $menu_def['name'], 'title' => $item_title, 'action' => 'error', 'error' => 'page not found' );
					continue;
				}
				$item_args['menu-item-object-id'] = $page_obj->ID;
				$item_args['menu-item-object']    = 'page';
				$item_args['menu-item-type']      = 'post_type';
			} else {
				$item_args['menu-item-url']  = $item_def['url'];
				$item_args['menu-item-type'] = 'custom';
			}

			$item_id = wp_update_nav_menu_item( $menu->term_id, 0, $item_args );
			$report['items'][] = is_wp_error( $item_id )
				? array( 'menu' => $menu_def['name'], 'title' => $item_title, 'action' => 'error', 'error' => $item_id->get_error_message() )
				: array( 'menu' => $menu_def['name'], 'title' => $item_title, 'action' => 'created', 'id' => $item_id );
		}

		// Assign to theme location
		if ( $menu && empty( $nav_menu_locations[ $location ] ) ) {
			$nav_menu_locations[ $location ] = $menu->term_id;
		}
	}

	if ( ! $dry_run ) {
		set_theme_mod( 'nav_menu_locations', $nav_menu_locations );
	}

	return $report;
}

/**
 * Auto-run scaffold once on theme activation (idempotent — safe re-run).
 */
function brmbh_scaffold_on_activate(): void {
	if ( get_option( 'brmbh_scaffold_initial_run' ) ) {
		return;
	}
	brmbh_scaffold_run( false );
	update_option( 'brmbh_scaffold_initial_run', current_time( 'mysql' ) );
}
add_action( 'after_switch_theme', 'brmbh_scaffold_on_activate' );
