<?php
/**
 * WP-CLI namespace: `wp brmbh ...`
 *
 * Thin wrappers around scaffold + shell scripts. Same code surface, two faces:
 * humans call `wp brmbh ...` directly; agents call the same via SSH or skills.
 *
 * @package brmbh
 */

if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	return;
}

class BRMBH_CLI {

	/**
	 * Run the scaffold: ensure pages, menus, and menu locations exist.
	 *
	 * ## OPTIONS
	 *
	 * [--dry-run]
	 * : Show what would change without writing.
	 *
	 * ## EXAMPLES
	 *
	 *     wp brmbh scaffold
	 *     wp brmbh scaffold --dry-run
	 *
	 * @when after_wp_load
	 */
	public function scaffold( $args, $assoc_args ): void {
		brmbh_acf_dependency_cli_guard();
		$dry_run = isset( $assoc_args['dry-run'] );
		$report  = brmbh_scaffold_run( $dry_run );

		WP_CLI::log( $dry_run ? '🔍 Dry run — no writes performed.' : '✅ Scaffold complete.' );

		foreach ( array( 'pages', 'menus', 'items' ) as $section ) {
			if ( empty( $report[ $section ] ) ) {
				continue;
			}
			WP_CLI::log( "\n" . ucfirst( $section ) . ':' );
			foreach ( $report[ $section ] as $entry ) {
				$label = $entry['title'] ?? ( $entry['slug'] ?? ( $entry['name'] ?? '' ) );
				$loc   = isset( $entry['location'] ) ? " [$entry[location]]" : '';
				WP_CLI::log( sprintf( '  %-22s %s%s', $entry['action'], $label, $loc ) );
				if ( isset( $entry['error'] ) ) {
					WP_CLI::warning( '    → ' . $entry['error'] );
				}
			}
		}
	}

	/**
	 * Re-run Figma MCP → _tokens.scss.
	 * (Stub — implementation comes with the token sync script.)
	 *
	 * @when after_wp_load
	 */
	/**
	 * Sync design tokens from Figma → assets/src/scss/_tokens.scss.
	 *
	 * Reads local Figma variables via the Figma REST API and regenerates
	 * _tokens.scss with CSS custom properties. Requires .brmbh-config.json
	 * at the theme root with figmaFileKey + figmaToken.
	 *
	 * After running, re-compile CSS: npm run build:css
	 *
	 * ## OPTIONS
	 *
	 * [--dry-run]
	 * : Print the generated _tokens.scss to stdout without writing.
	 *
	 * ## EXAMPLES
	 *
	 *     wp brmbh tokens
	 *     wp brmbh tokens --dry-run
	 *
	 * @when after_wp_load
	 */
	public function tokens( array $args, array $assoc_args ): void {
		$theme_dir = get_template_directory();

		// sync-tokens.mjs ships in @brmbh/cli, installed as a devDependency.
		// A project-local tools/ copy still wins, so a theme can override it.
		$candidates = array(
			$theme_dir . '/tools/sync-tokens.mjs',
			$theme_dir . '/node_modules/@brmbh/cli/tools/sync-tokens.mjs',
		);

		$script = '';
		foreach ( $candidates as $candidate ) {
			if ( file_exists( $candidate ) ) {
				$script = $candidate;
				break;
			}
		}

		if ( '' === $script ) {
			WP_CLI::error(
				"sync-tokens.mjs not found.\n" .
				'Run `npm install` in the theme directory to install @brmbh/cli.'
			);
		}

		$config = $theme_dir . '/.brmbh-config.json';
		if ( ! file_exists( $config ) ) {
			WP_CLI::error(
				".brmbh-config.json not found.\n" .
				'Copy .brmbh-config.example.json → .brmbh-config.json and add your Figma token.'
			);
		}

		$dry_run = isset( $assoc_args['dry-run'] ) ? ' --dry-run' : '';
		$cmd     = 'node ' . escapeshellarg( $script ) . $dry_run;

		WP_CLI::log( "→ Running: $cmd" );
		passthru( $cmd, $exit_code );

		if ( $exit_code !== 0 ) {
			WP_CLI::error( "sync-tokens.mjs exited with code $exit_code." );
		}

		if ( ! isset( $assoc_args['dry-run'] ) ) {
			WP_CLI::success( 'Tokens synced. Run `npm run build:css` to recompile.' );
		}
	}

	/**
	 * Refresh the /dev-sandbox page (insert/update all current blocks).
	 * (Stub — implementation comes with the first block build.)
	 *
	 * @when after_wp_load
	 */
	public function sandbox( $args, $assoc_args ): void {
		brmbh_acf_dependency_cli_guard();
		WP_CLI::warning( 'Not implemented yet. Will repopulate /dev-sandbox with all blocks.' );
	}
}

WP_CLI::add_command( 'brmbh', 'BRMBH_CLI' );
