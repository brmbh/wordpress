<?php
/**
 * brmbh core — entry point. functions.php requires this file and nothing else from inc/core/.
 *
 * The core is the part of the theme no site edits: the SCF/ACF guard, the ACF block
 * factory loader and the `wp brmbh` WP-CLI commands. It ships inside @brmbh/cli and
 * `brmbh update` replaces this whole folder with the installed version, so local
 * edits here are lost on the next update (`brmbh doctor` reports them).
 * Extend it through hooks instead; see inc/core/README.md.
 *
 * @package brmbh
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'BRMBH_CORE_DIR', __DIR__ );

// Hard dependency check first — must load before anything that touches ACF.
// Defines brmbh_has_acf_pro() and surfaces admin notices everywhere.
require __DIR__ . '/dependencies.php';

// ACF block factory — hooks itself onto init + acf/init and bails safely if ACF isn't loaded.
require __DIR__ . '/blocks.php';

// `wp brmbh …` — only when running under WP-CLI.
if ( defined( 'WP_CLI' ) && WP_CLI ) {
	require __DIR__ . '/cli.php';
}
