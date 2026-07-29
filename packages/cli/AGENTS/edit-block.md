# /edit-block

Modify an existing block in `my-acf-blocks/{block-name}/`. Ask first, edit second.

## Workflow

1. **List blocks** — run the same scan as `/list-blocks` and present a numbered list.
2. **Ask which block** — accept folder name or list number.
3. **Ask which file**:
   - `block.json` (settings: title, icon, mode, supports)
   - `fields.php` (ACF fields)
   - `template.php` (markup)
   - `_style.scss` (styles)
4. **Ask what to change** — specific change request (e.g. "add a new image field", "change the heading to use h2 not h1", "make the card padding larger").
5. **Show the diff** before writing — explain what will change and why.
6. **Apply** the change.
7. **Remind the user** to run `npm run build` if SCSS changed.

## Rules

- **Preserve the four-file convention.** Don't rename files; don't split or merge them.
- **Field-key stability.** When adding fields to `fields.php`, generate unique keys (`field_{block_name}_{field_name}`). Never reuse a key.
- **Location rules unchanged** unless explicitly asked. The `acf/{block-name}` location is load-bearing.
- **Design tokens still apply.** When editing `template.php` or `_style.scss`, follow the same token mapping rules as `/create-block` — never hardcode colors, sizes, or spacing.
- **SCSS scope unchanged.** `_style.scss` content must remain nested inside `.{block-name} { ... }`.

## Common edit operations

### Add a field
- Append to `fields.php` `fields` array
- Use `field_{block_name}_{name}` for the key
- If field count crosses 4, propose grouping with ACF `'type' => 'tab'` fields

### Add backend preview mode
- `block.json`: set `"acf": { "mode": "preview" }`

### Add anchor support
- `template.php`: `$id = $block['anchor'] ?? '{block-name}-' . $block['id'];`

### Update visual styling
- Prefer Bootstrap utility class changes in `template.php`
- Only fall back to `_style.scss` when utilities can't express the style
