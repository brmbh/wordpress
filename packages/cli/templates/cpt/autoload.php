
/**
 * brmbh post-types autoload — added by `brmbh add cpt`.
 * Loads every inc/post-types/*.php (one file per entity).
 */
foreach ( glob( get_template_directory() . '/inc/post-types/*.php' ) as $brmbh_cpt_file ) {
	require_once $brmbh_cpt_file;
}
