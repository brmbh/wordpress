<?php
/**
 * Hard dependency check — Secure Custom Fields (SCF) is MANDATORY.
 *
 * SCF is a free WordPress.org plugin (wordpress.org/plugins/secure-custom-fields).
 * ACF Pro also works — both define ACF_PRO=true and share the identical API.
 *
 * This theme is built around the ACF block factory. Without SCF (or ACF Pro), the
 * entire block layer fails to register, the scaffold can't be inserted, and the site
 * renders empty. There is no "graceful degradation" path — if SCF is not active, we
 * surface that loudly everywhere the user might look.
 *
 * Surfaces:
 *   1. Admin notice (sticky, error-level, every wp-admin page)
 *   2. WP-CLI: brmbh commands abort with a clear error
 *   3. Activation hook: theme is permitted to activate (to allow installing
 *      ACF afterwards), but the admin notice is unmissable
 *   4. Frontend: a `wp_die()` is NOT used — site renders bare but functional
 *      so a logged-in admin can still reach the dashboard to fix it
 *
 * @package brmbh-agentic-wp-suite
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Required SCF/ACF minimum version.
 */
const BRMBH_REQUIRED_ACF_VERSION = '6.0.0';

/**
 * Single source of truth: is SCF (or ACF Pro) present and meeting version requirement?
 * Both plugins define ACF_PRO=true — this check works for either.
 *
 * @return bool
 */
function brmbh_has_acf_pro(): bool {
	// Both SCF and ACF Pro define this constant; free ACF does not.
	if ( ! defined( 'ACF_PRO' ) || ! ACF_PRO ) {
		return false;
	}
	if ( ! function_exists( 'acf_get_setting' ) ) {
		return false;
	}
	$version = acf_get_setting( 'version' );
	return $version && version_compare( $version, BRMBH_REQUIRED_ACF_VERSION, '>=' );
}

/**
 * Human-readable reason ACF check failed — used by all surfaces.
 */
function brmbh_acf_dependency_message(): string {
	if ( ! defined( 'ACF_PRO' ) ) {
		return sprintf(
			/* translators: %s: required SCF version */
			__( '<strong>brmbh-agentic-wp-suite</strong> requires <strong>Secure Custom Fields (SCF) %s or higher</strong>. SCF is not installed or not active. Install it free at <a href="https://wordpress.org/plugins/secure-custom-fields/" target="_blank" rel="noopener">wordpress.org/plugins/secure-custom-fields</a>. ACF Pro also works.', 'brmbh-agentic-wp-suite' ),
			BRMBH_REQUIRED_ACF_VERSION
		);
	}
	if ( function_exists( 'acf_get_setting' ) ) {
		$version = acf_get_setting( 'version' );
		return sprintf(
			/* translators: 1: installed SCF/ACF version, 2: required version */
			__( '<strong>brmbh-agentic-wp-suite</strong> requires Secure Custom Fields (SCF) <strong>%2$s</strong> or higher. Installed version: <strong>%1$s</strong>. Please update SCF.', 'brmbh-agentic-wp-suite' ),
			esc_html( $version ),
			BRMBH_REQUIRED_ACF_VERSION
		);
	}
	return __( '<strong>brmbh-agentic-wp-suite</strong> requires Secure Custom Fields (SCF). SCF is installed but not loaded — check the plugin is active.', 'brmbh-agentic-wp-suite' );
}

/**
 * Surface 1 — Admin notice. Sticky, error-level, on every admin screen.
 */
function brmbh_acf_dependency_admin_notice(): void {
	if ( brmbh_has_acf_pro() ) {
		return;
	}
	echo '<div class="notice notice-error" style="border-left-color:#e52e2e;">';
	echo '<p>' . wp_kses_post( brmbh_acf_dependency_message() ) . '</p>';
	echo '</div>';
}
add_action( 'admin_notices', 'brmbh_acf_dependency_admin_notice' );
add_action( 'network_admin_notices', 'brmbh_acf_dependency_admin_notice' );

/**
 * Surface 2 — Block the theme from being silently "active but useless."
 * On theme activation, the message is shown immediately. Theme stays active
 * (so admin can install ACF without theme-switching), but the notice is loud.
 */
function brmbh_acf_dependency_after_switch_theme(): void {
	if ( brmbh_has_acf_pro() ) {
		return;
	}
	set_transient( 'brmbh_acf_missing_on_activate', 1, 60 );
}
add_action( 'after_switch_theme', 'brmbh_acf_dependency_after_switch_theme' );

function brmbh_acf_dependency_post_activate_notice(): void {
	if ( ! get_transient( 'brmbh_acf_missing_on_activate' ) ) {
		return;
	}
	delete_transient( 'brmbh_acf_missing_on_activate' );
	echo '<div class="notice notice-error is-dismissible">';
	echo '<p><strong>⚠️ ' . esc_html__( 'Theme activated, but Secure Custom Fields (SCF) is missing.', 'brmbh-agentic-wp-suite' ) . '</strong></p>';
	echo '<p>' . wp_kses_post( brmbh_acf_dependency_message() ) . '</p>';
	echo '</div>';
}
add_action( 'admin_notices', 'brmbh_acf_dependency_post_activate_notice' );

/**
 * Surface 3 — Hard error in WP-CLI.
 *
 * Any `wp brmbh` subcommand aborts with a clear message if SCF/ACF is missing.
 * Called by inc/cli.php at the top of each subcommand.
 */
function brmbh_acf_dependency_cli_guard(): void {
	if ( brmbh_has_acf_pro() ) {
		return;
	}
	if ( defined( 'WP_CLI' ) && WP_CLI ) {
		// Strip HTML tags for terminal output.
		WP_CLI::error( wp_strip_all_tags( brmbh_acf_dependency_message() ) );
	}
}
