# /update

Update this site to the newest brmbh: `@brmbh/cli` (commands + skills), the core in
`inc/core/`, and any migration a release ships for the site's own files.

## When to use

The user asks to update brmbh, `brmbh doctor` reports the core as missing or outdated, or a
release note says a migration is needed (e.g. a WordPress change that touches every block).

## What is replaced and what is not

- `inc/core/` is **replaced as a whole** — block factory loader, SCF guard, `wp brmbh` commands.
  It is never edited in a site, so this is a copy, not a merge.
- Everything else belongs to the site. It is only changed by a **migration**, and a migration
  plans first: if any file needs a human, nothing is written at all.

## Steps

1. Make sure the working tree is committed, so the update shows up as one reviewable diff:
   `git status`. If there are unrelated changes, ask the user before continuing.
2. Preview: `npx brmbh update --dry-run --json`. Read `class`:
   - `up_to_date` → tell the user, stop.
   - `would_update` → summarise `core` (from → to, files) and `migrations` for the user.
   - `blocked` → see step 4.
3. Run it: `npx brmbh update --json`. Add `--latest` only when the user wants a new **major**
   version (majors may run migrations on their own files).
4. If `class` is `blocked`, nothing was changed. For each entry in `blocked`, do what its `fix`
   says. Typical case: an old `inc/cli.php` that holds the site's own WP-CLI commands — move those
   commands into a new file of the site's own (own class, own `WP_CLI::add_command` name),
   require it from `functions.php`, delete the old file, then run step 3 again. Show the user the
   moved code before deleting anything.
5. Review: `git diff`, `npx brmbh doctor --json` (`core` must be `ok`), then load the site and
   the block editor once and check for PHP errors.
6. Commit with a message that names the version, e.g. `chore: update brmbh core to 1.3.0`.
   Deploying is a separate step (`/deploy`).

## Never

- Edit files in `inc/core/` to "fix" something — the next update overwrites it. Use the core's
  hooks (`inc/core/README.md`) from the site's own files.
- Run `update` on a server. It runs where the code lives (your machine or CI); deploys ship the
  result.
