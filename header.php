<?php
/**
 * Header template — site head + sticky nav.
 *
 * @package brmbh
 */
?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<?php wp_head(); ?>
</head>

<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

<nav id="masthead" class="site-nav navbar navbar-expand-lg"
     role="navigation"
     aria-label="<?php esc_attr_e( 'Primary navigation', 'brmbh' ); ?>">
	<div class="container">

		<?php
		brmbh_the_site_logo(
			array(
				'class'           => 'site-logo',
				'link'            => true,
				'link_class'      => 'site-nav__brand',
				'mobile_on_light' => true,
			)
		);
		?>

		<button class="navbar-toggler site-nav__toggler" type="button"
		        data-bs-toggle="collapse" data-bs-target="#mainNavMenu"
		        data-label-open="<?php esc_attr_e( 'Open menu', 'brmbh' ); ?>"
		        data-label-close="<?php esc_attr_e( 'Close menu', 'brmbh' ); ?>"
		        aria-controls="mainNavMenu" aria-expanded="false"
		        aria-label="<?php esc_attr_e( 'Open menu', 'brmbh' ); ?>">
			<span class="site-nav__toggler-lines" aria-hidden="true">
				<span></span>
				<span></span>
				<span></span>
			</span>
			<span class="site-nav__toggler-label"><?php esc_html_e( 'Menu', 'brmbh' ); ?></span>
		</button>

		<div class="collapse navbar-collapse site-nav__collapse" id="mainNavMenu">
			<?php
			if ( has_nav_menu( 'menu-primary' ) ) {
				wp_nav_menu( array(
					'theme_location' => 'menu-primary',
					'container'      => false,
					'menu_class'     => 'navbar-nav site-nav__menu ms-lg-auto mb-0',
					'walker'         => new Brmbh_Bootstrap_Nav_Walker(),
				) );
			}
			?>
		</div>

	</div>
</nav>

<div id="page" class="site">
