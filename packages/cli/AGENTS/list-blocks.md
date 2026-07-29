# /list-blocks

Scan `my-acf-blocks/` and report what's registered. Read-only.

## Workflow

1. **Scan** `my-acf-blocks/` — get all subdirectories.
2. **For each folder**, detect:
   - `fields.php` exists → ACF field group
   - `block.json` exists → registered block
   - `template.php` exists → has render template
   - `_style.scss` exists → has styles
3. **Parse** each existing file via PHP `include` (or grep + regex if execution unavailable):
   - From `fields.php`: `key`, `title`, fields count, location rules
   - From `block.json`: `name`, `title`, `category`, `icon`, `acf.mode`
4. **Also check** `my-acf-blocks/_loader.scss` for SCSS imports — flag any block with `_style.scss` but no import line.

## Output format

```
📦 ACF Groups:

• hero-banner
  └─ Group: "Hero Banner"
  └─ Key: group_hero_banner
  └─ Fields: 5
  └─ Location: block == acf/hero-banner

🧱 Registered Blocks:

• Hero Banner (hero-banner)
  └─ Folder: hero-banner
  └─ Category: formatting
  └─ Icon: admin-comments
  └─ Mode: preview
  └─ Connected to ACF Group: "Hero Banner"
  └─ SCSS import: ✅ present

⚠️  Issues:
  • {folder}: has _style.scss but no @import in _loader.scss

━━━━━━━━━━━━━━━━━━━━━━━
Summary:
• Total ACF Groups: N
• Total Registered Blocks: N
• Folders with both: N
• Issues: N
```

## Edge cases

- Folder has `fields.php` only → ACF group, no block (valid: e.g. page-settings fields)
- Folder has `block.json` but no `fields.php` → warn (block with no fields)
- Folder has neither → skip silently
- File parse error → show the error per folder, don't abort
