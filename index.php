<?php
/**
 * Main template — generic fallback. This theme is page/block-driven, not blog-driven.
 *
 * @package brmbh
 */

get_header();
?>

<main id="primary" class="site-main is-layout-constrained">
	<?php
	if ( have_posts() ) :
		while ( have_posts() ) :
			the_post();
			the_content();
		endwhile;
	endif;
	?>
</main>

<?php
get_footer();
