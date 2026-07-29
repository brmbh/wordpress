# /delete-block

**⚠️ Irreversible.** Always confirm before writing.

## Workflow

1. **List blocks** — same scan as `/list-blocks`, numbered.
2. **Ask which block to delete** — accept folder name or number.
3. **Show what will be deleted**:
   ```
   You are about to delete:
   - Folder: my-acf-blocks/{block-name}/
   - Files: block.json, fields.php, template.php, _style.scss
   - SCSS import: @import "{block-name}/style";  (from _loader.scss)
   ```
4. **Confirm**: "Are you sure? This cannot be undone. (yes/no)"
5. **On yes**:
   - Delete every file inside the block folder
   - Delete the folder itself
   - Remove the matching `@import "{block-name}/style";` line from `my-acf-blocks/_loader.scss` (preserve other imports + whitespace)
   - Run `npm run build` to recompile without the block's styles
6. **On no** — show "Cancelled" and exit.

## Edge cases

- Folder doesn't exist → show error, re-list available blocks
- Folder empty → continue with folder removal
- SCSS import not in `_loader.scss` → continue, note it wasn't found
- The block is currently used on a page → WARN the user before deletion; deletion leaves orphan ACF data on those posts (the block disappears, the data remains in `wp_postmeta`)

## Safety

- Never delete more than the requested folder.
- Never bulk-delete (one block at a time).
- Never act on a partial / ambiguous name match without asking.
