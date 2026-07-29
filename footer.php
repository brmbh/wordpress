<?php
/**
 * Footer template — site footer.
 *
 * Logo: Customizer Site Identity, or assets/img/logo.svg fallback (see
 * inc/template-functions.php). Copyright + footer nav are filterable.
 *
 * @package brmbh
 */
?>
	<footer id="colophon" class="site-footer">

		<div class="site-footer__top position-relative">
			<div class="container position-relative site-footer__top-inner">
				<div class="d-flex flex-column flex-lg-row align-items-start align-items-lg-center justify-content-lg-between gap-4">

					<?php
					brmbh_the_site_logo(
						array(
							'class'      => 'site-logo',
							'link'       => true,
							'link_class' => 'site-footer__logo d-block',
						)
					);
					?>

					<?php
					if ( has_nav_menu( 'menu-footer-1' ) ) {
						wp_nav_menu( array(
							'theme_location' => 'menu-footer-1',
							'container'      => false,
							'menu_class'     => 'site-footer__nav nav mb-0 list-unstyled flex-wrap',
							'walker'         => new Brmbh_Footer_Nav_Walker(),
						) );
					}
					?>

				</div>
			</div>
		</div>

		<div class="site-footer__bottom">
			<span><?php echo esc_html( apply_filters( 'brmbh_footer_copyright', '© ' . gmdate( 'Y' ) . ' ' . get_bloginfo( 'name' ) . '. ' . __( 'All rights reserved.', 'brmbh' ) ) ); ?></span>
		</div>

	</footer>

</div><!-- #page -->

<?php wp_footer(); ?>
</body>
</html>
