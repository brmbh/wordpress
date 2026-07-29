<?php
/**
 * 404 template — page not found
 *
 * @package brmbh
 */

get_header();
?>

<main id="primary" class="site-main">
	<section class="error-404 container py-5 text-center">
		<h1 class="display-1"><?php esc_html_e( '404', 'brmbh' ); ?></h1>
		<p class="lead"><?php esc_html_e( "This page doesn't exist.", 'brmbh' ); ?></p>
		<a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="btn btn-primary mt-3">
			<?php esc_html_e( 'Back to home', 'brmbh' ); ?>
		</a>
	</section>
</main>

<?php
get_footer();
