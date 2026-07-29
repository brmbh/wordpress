<?php
/**
 * Page template — renders Gutenberg/ACF block content for any page
 *
 * @package brmbh
 */

get_header();
?>

<main id="primary" class="site-main is-layout-constrained">
	<?php
	while ( have_posts() ) :
		the_post();
		the_content();
	endwhile;
	?>
</main>

<?php
get_footer();
