# /create-block

Create a new ACF block in `my-acf-blocks/{block-name}/` with the four-file convention used by `brmbh`. **Ask all questions first, write files last.**

## Workflow

### Step 1 — Ask all questions before writing any files

1. **ACF Group name** (required)
   - "What's the ACF Group name?"
   - Used for: folder name (kebab-case), ACF field group title, default block name
   - Example: `Hero Banner` → folder `hero-banner`, group title `Hero Banner`

2. **Custom block?** (required)
   - "Will this be a Custom Block? (yes/no)"
   - If **yes** → ask: "What's the Block Name? (Gutenberg title)"
     - Human-readable title (e.g., `Hero Banner`)
     - Kebab-case used for `'name'` and `'value' => 'acf/{block-name}'` location
   - If **no** → skip block registration, ACF group only

3. **Figma node or screenshot?** (optional, only if custom block)
   - "Do you have a Figma node ID, screenshot file, or design URL?"
   - **If Figma node provided** → call `mcp__claude_ai_Figma__get_design_context` with the fileKey + nodeId to retrieve reference code + tokens + screenshot. Use the screenshot analysis rules below to map to our design system.
   - **If screenshot file** → analyze visually with the same rules.
   - **If neither** → "Describe the ACF fields schema and the block's purpose (fields, layout, components)."

4. **Default editor display?** (optional, only if custom block)
   - "When inserted, should the block show its rendered preview or the field form by default? (preview/edit)"
   - **preview** (recommended) → `acf.mode: "preview"` — shows the rendered block; the editor clicks **"Switch to Edit"** to fill fields in the full-width canvas
   - **edit** → `acf.mode: "edit"` — opens straight into the field form
   - **Either way, ALWAYS write `apiVersion: 2` + `supports.mode: true`.** This keeps the canvas un-iframed so ACF's in-canvas Edit/Preview toggle works (editors fill repeaters in full width, not the cramped 280px sidebar).
   - ⚠️ **Do NOT use `apiVersion: 3`.** WordPress iframes the canvas when every block is v3, and ACF then **force-locks the block to preview and hides the toggle** — in-canvas editing becomes impossible and is not overridable. Frontend output is identical for v2/v3 (blocks are server-rendered), so v2 costs nothing on the public site. Full write-up: `my-acf-blocks/ACF-BLOCK-EDIT-MODE.md`.

### Step 2 — Create the four files

Only after all answers collected.

```
my-acf-blocks/{block-name-kebab}/
  block.json         # if custom block — WordPress standard registration
  fields.php         # always
  template.php       # if custom block
  _style.scss        # if custom block
```

### Step 3 — Append SCSS import

Append to `my-acf-blocks/_loader.scss`:
```scss
@import "{block-name}/style";
```

## Design-token mapping rules

When converting a screenshot or Figma reference, **NEVER hardcode hex values, pixel sizes, or arbitrary spacing**. Map to the theme's design system:

### Colors (from `assets/src/scss/_variables.scss`)

Available semantic tokens (default starter palette — re-valued per project):
- `primary`, `primary-darker`
- `secondary`, `secondary-light`
- `ochre`
- `black`, `white`

Use Bootstrap utilities: `bg-primary`, `bg-secondary-light`, `text-primary`, `btn-primary`, etc. If a Figma color doesn't exist as a token, pick the closest semantic match — never invent a new hex. To change the palette, edit `_tokens.scss` + `_variables.scss` (keep the slug names).

### Spacing (from `assets/src/scss/_tokens.scss`)

CSS custom properties:
- `var(--space-xxs)` → 4px
- `var(--space-xs)` → 12px
- `var(--space-s)` → 16px
- `var(--space-m)` → 24px
- `var(--space-l)` → 32px
- `var(--space-xl)` → 64px
- `var(--space-xxl)` → 128px
- `var(--space-edge)` → 84px (section horizontal padding)

Prefer Bootstrap utilities: `p-*`, `m-*`, `py-5` (3rem), `gap-3`, etc. For section vertical rhythm use the `.section` utility from `_globals.scss`.

### Typography

- Body: `"Inter"` (variable, 100–900 in one file) — automatic via base styles
- Display/headings (≥28px): `"InterDisplay"` — automatic on `h1`–`h6` via `_variables.scss`
- Use Bootstrap heading classes: `h1`–`h6`, `display-1`–`display-6`, `lead`, `small`
- **Never set `font-size` in px**

### Corners

- `var(--corners-m)` → 24px (cards)
- `var(--corners-xl)` → 45px (footer, large containers)
- `$border-radius-pill` → 9999px (buttons)

### Layout

- Bootstrap grid: `container`, `row`, `col-*`
- Bootstrap flex: `d-flex`, `align-items-center`, `justify-content-*`, `gap-*`

## Screenshot → tokens — example

❌ **WRONG (using exact screenshot values):**
```php
<a href="#" class="btn" style="background-color: #e52e2e; padding: 0.75rem 2rem; border-radius: 9999px;">
  Learn more
</a>
```

✅ **CORRECT (using design tokens):**
```php
<a href="#" class="btn btn-primary">Learn more</a>
```

Button padding + pill radius come from `_variables.scss` (`$btn-padding-y/x`, `$btn-border-radius`).

## File templates

### `block.json`

```json
{
  "$schema": "https://schemas.wp.org/trunk/block.json",
  "apiVersion": 2,
  "name": "acf/{block-name-kebab}",
  "title": "{Block Name Human}",
  "description": "",
  "category": "formatting",
  "icon": "admin-comments",
  "textdomain": "brmbh",
  "acf": {
    "mode": "preview",
    "renderTemplate": "template.php"
  },
  "supports": {
    "align": false,
    "anchor": false,
    "mode": true
  }
}
```

- **Keep `apiVersion: 2` + `supports.mode: true` — do not bump to 3.** v3 iframes the canvas and ACF force-disables in-canvas editing (see Step 1.4 + `ACF-BLOCK-EDIT-MODE.md`).
- Use `"mode": "edit"` if the block should open straight into the field form (default `"preview"`).
- Set `"anchor": true` if the block needs an ID for anchor-link navigation.

### `fields.php` — basic, no screenshot

```php
<?php
return array(
    'key'    => 'group_{block_name_snake}',
    'title'  => '{Group Name}',
    'fields' => array(
        array(
            'key'           => 'field_{block_name}_lorem',
            'label'         => 'Lorem Ipsum',
            'name'          => 'lorem_ipsum',
            'type'          => 'text',
            'default_value' => 'Lorem ipsum dolor sit amet.',
        ),
    ),
    'location' => array(
        array(
            array(
                'param'    => 'block',
                'operator' => '==',
                'value'    => 'acf/{block-name-kebab}',
            ),
        ),
    ),
);
```

**Field grouping:** when a block has >3 data fields, group them with ACF Tab fields (`'type' => 'tab'`) by purpose (content → image → button → layout/style).

### `template.php` — fallback when no design provided

```php
<?php
$id = '{block-name-kebab}-' . $block['id'];
if ( ! empty( $block['anchor'] ) ) { $id = $block['anchor']; }

$className = '{block-name-kebab}';
if ( ! empty( $block['className'] ) ) { $className .= ' ' . $block['className']; }

$lorem_ipsum = get_field( 'lorem_ipsum' );
?>
<section id="<?php echo esc_attr( $id ); ?>" class="<?php echo esc_attr( $className ); ?> section">
    <div class="container">
        <?php if ( $lorem_ipsum ) : ?>
            <p><?php echo esc_html( $lorem_ipsum ); ?></p>
        <?php endif; ?>
    </div>
</section>
```

### `_style.scss` — partial, scoped to block class

```scss
.{block-name-kebab} {
  // Block styles here. Prefer extending Bootstrap utilities in template.php
  // over writing custom CSS. Only add styles that utilities can't express.
}
```

## Auto-registration (handled by `my-acf-blocks/loader.php`)

- `block.json` exists → `register_block_type()` on `init` (WordPress standard; ACF reads `acf.renderTemplate`)
- `fields.php` exists → `acf_add_local_field_group()` on `acf/init`
- Zero manual registration needed

## After creation, remind the user

- Run `npm run build` (or `npm run watch` for live)
- The block appears in Gutenberg under category `formatting`
- Insert it on `/dev-sandbox` (or any page) to preview
- If the block has anchor links from the primary menu, set `$id` via `$block['anchor']`
