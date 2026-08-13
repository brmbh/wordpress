# /edit-block-content

Change **field values** of an ACF block on a live page (`post_content` in the DB) — not block code.
For code (`fields.php`, `template.php`, `_style.scss`) use `/edit-block`.

## The one rule

`post_content` containing block comments is **structured data, not text**.
Never `sed` / `str_replace` / regex it. Parse → modify → re-serialize.

A silent, unrecoverable data-loss bug follows from breaking this rule. See [Why](#why-string-editing-corrupts-it).

## Workflow

1. **Snapshot first** — the edit is not reversible from the editor UI:
   ```bash
   wp post get <ID> --field=content > /tmp/post-<ID>-before.txt
   ```
2. **Find the block and field key.** ACF stores repeaters flattened: `events_0_body`, `events_1_image`, plus a `_events_0_body` pointer to the field key. Never guess an index — read the content and match on a stable value (title, URL), because **editors reorder repeater rows**.
3. **Edit via the block API**, in PHP:
   ```php
   $blocks = parse_blocks( get_post_field( 'post_content', $post_id ) );

   array_walk_recursive( $blocks, function ( &$v, $k ) {
       if ( 'events_0_image' === $k ) { $v = 263; }
   } );

   wp_update_post( [
       'ID'           => $post_id,
       'post_content' => wp_slash( serialize_blocks( $blocks ) ), // wp_slash is REQUIRED
   ] );
   ```
4. **Verify** — this must print nothing:
   ```bash
   wp post get <ID> --field=content | grep -oE '[^\\]u00[0-9a-f]{2}|[a-zäöüß]rn[A-ZÄÖÜ]'
   ```
   Any hit means one level of backslashes was stripped. Restore from the snapshot and retry.
5. **Diff the copy, not just the thing you changed:**
   ```bash
   wp post get <ID> --field=content > /tmp/post-<ID>-after.txt
   diff <(fold -w100 /tmp/post-<ID>-before.txt) <(fold -w100 /tmp/post-<ID>-after.txt)
   ```
   The expected diff is only the field you touched. Anything else — especially disappearing `\` — is corruption.

## Why string-editing corrupts it

An ACF block stores its whole field set as JSON inside an HTML comment in `post_content`:

```html
<!-- wp:acf/events-grid {"name":"acf/events-grid","data":{"events_0_body":"…Main &\r\nProf. Dr. …"}} /-->
```

So WordPress hex-escapes anything that could break out of that comment. `serialize_block_attributes()`
(`wp-includes/blocks.php`) runs `wp_json_encode()` and then rewrites:

| Stored as | Actually means | What a lost backslash leaves behind |
|---|---|---|
| `&` | `&` | `u0026` |
| `<` / `>` | `<` / `>` | `u003c` / `u003e` |
| `--` | `--` (would end the comment!) | `u002d` |
| `"` | `\"` | `u0022` |
| `\r\n` | newline (Enter in a textarea) | `rn` |

Strip one backslash level and every one of those degrades into literal on-page text.

**The usual culprit is the write, not the read:** `wp_update_post()` and `wp_insert_post()` call
`wp_unslash()` on their input — magic-quotes-era legacy, they expect raw `$_POST`. Hand them clean
content and it loses one backslash level. Always `wp_slash()` first. Shell round-trips
(`--post_content="$(…)"`, heredocs, `sed`, `jq`) do the same damage.

**Nothing warns you.** `u0026` is still valid JSON, just the wrong string. `parse_blocks()` parses it,
ACF returns it, the template prints it. There is no checksum and no validation — the only detector is
the verify step above, or a human reading the page weeks later.

## Rendering gotcha — newlines in a textarea field

An ACF textarea stores real CRLF, but `esc_html()` inside a `<p>` collapses them to spaces. If line
breaks must be visible, the template has to opt in:

```php
<p><?php echo nl2br( esc_html( $ev['body'] ) ); ?></p>
```

Don't "fix" a missing line break by editing the content — check the template first.

## If content is already corrupted

1. Do **not** hand-delete the junk tokens in the ACF field. Deleting `u0026` loses the `&` for good and
   leaves no trace that anything was ever there — far worse than the visible corruption.
2. Recover the original from a pre-incident DB dump, then reapply via the workflow above.
3. Check every environment separately. A `db push` from a "cleaned" environment makes the loss permanent.
