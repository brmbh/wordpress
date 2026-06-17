<?php
/**
 * {{ TITLE }} — block render template.
 *
 * Referenced by block.json via acf.renderTemplate. Receives $block, $is_preview.
 * Use Bootstrap utilities + design tokens — never hardcode colors or px sizes.
 * See AGENTS/create-block.md for the token mapping rules.
 *
 * @var array $block
 */

$id = '{{ SLUG }}-' . ( $block['id'] ?? uniqid() );
if ( ! empty( $block['anchor'] ) ) {
	$id = $block['anchor'];
}

$class = '{{ SLUG }} section';
if ( ! empty( $block['className'] ) ) {
	$class .= ' ' . $block['className'];
}

$heading = get_field( 'heading' );
?>
<section id="<?php echo esc_attr( $id ); ?>" class="<?php echo esc_attr( $class ); ?>">
	<div class="container">
		<?php if ( $heading ) : ?>
			<h2 class="display-5"><?php echo esc_html( $heading ); ?></h2>
		<?php endif; ?>
	</div>
</section>
