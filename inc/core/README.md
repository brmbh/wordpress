# brmbh core — do not edit

This folder is the part of the theme that every brmbh site shares. It ships inside
[`@brmbh/cli`](https://www.npmjs.com/package/@brmbh/cli) and **`brmbh update` replaces the
whole folder** with the installed version. Edits made here are lost on the next update;
`brmbh doctor` reports them as a warning.

| File | What it does |
|---|---|
| `load.php` | Entry point. `functions.php` requires it and nothing else from here. |
| `dependencies.php` | Hard dependency on Secure Custom Fields (or ACF Pro): admin notices, WP-CLI guard. |
| `blocks.php` | ACF block factory: registers every block folder (`block.json`) and field group (`fields.php`). |
| `cli.php` | The `wp brmbh …` WP-CLI commands (`scaffold`, `tokens`, `sandbox`). |
| `core.json` | The core version. Written by `brmbh update` / `brmbh create`; read by `brmbh doctor`. |

## Changing behaviour without editing the core

| Need | Do this in your theme |
|---|---|
| Load blocks from another folder too | `add_filter( 'brmbh/block_dirs', fn( $dirs ) => [ ...$dirs, get_template_directory() . '/blocks-extra' ] );` |
| Pages and menus `wp brmbh scaffold` creates | Edit `brmbh_scaffold_definition()` in `inc/scaffold.php` (that file is yours) |
| Something the core can't do yet | Open an issue on [brmbh/wordpress](https://github.com/brmbh/wordpress/issues) for a new hook; meanwhile add your own code in your theme's `inc/`, not here |

## Updating

```bash
npx brmbh update            # update @brmbh/cli within its semver range, replace inc/core/, run migrations
npx brmbh update --latest   # also take a new major version (may run migrations on your own files)
npx brmbh update --dry-run  # show what would change, write nothing
```

The text domain here stays `brmbh` in every site: renaming a scaffolded theme never
touches this folder, so an update is always a clean replacement, never a merge.
