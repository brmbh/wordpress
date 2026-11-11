# /sync-db

Sync the WordPress database between local and an environment with `npx brmbh db pull|push <env>`
(wraps `tools/db-pull.sh` / `db-push.sh`). The environment comes from `brmbh.json` /
`brmbh.local.json` (`npx brmbh env` lists them). **The target of every import is backed up
first:** pull saves the local DB to `.brmbh/backups/`, push saves the remote DB to
`~/.brmbh-backups/` on the server.

## ⚠️ Read this first — direction matters

| Direction | Script | Risk | Effect |
|---|---|---|---|
| **pull** (remote → local) | `npx brmbh db pull <env>` | Safe-ish | Overwrites your **local** DB (backup in `.brmbh/backups/`) |
| **push** (local → remote) | `npx brmbh db push <env> --yes` | **Destructive** | Overwrites the **remote/production** DB (backup in `~/.brmbh-backups/` on the server) |

**Always verify connections first:** `npx brmbh env run <env> db-verify` (no changes). **Never run `db-push` to a
production environment without explicit, unambiguous user confirmation naming the target.**

## The `CANONICAL_ENV` guard

Push is blocked unless the environment says `"canonical": "local"` (unset means `remote`: the
server holds the real content — the post-launch default). This is intentional. **Do not** edit
`brmbh.json` / `brmbh.local.json` to bypass it just to make a push go through — if push is blocked, stop and ask the user; flipping the
guard is their decision, not yours.

## Preconditions — check first

1. The environment exists (`npx brmbh env`). If not, ask the user for `ssh`, `path`, `url` and
   add it to `brmbh.local.json` (or `brmbh.json` if hosts may be committed).
2. WP-CLI works locally and on the server, SSH key is set up.
3. You know **which direction** the user wants and **which environment**.

## Run

```bash
# 1. ALWAYS verify connections first (read-only)
npx brmbh env run staging db-verify

# 2a. Pull remote → local (refresh local from staging/production)
npx brmbh db pull staging

# 2b. Push local → remote (only if canonical is "local" and the user confirmed the target)
npx brmbh db push staging --yes
```

What each one does, in order:

- **pull:** check both connections → back up the local DB → stream the server's DB into the
  local one → rewrite the server URL to `local.url` (http + https, then a convergence pass) →
  set `siteurl`/`home`, activate the local theme, flush cache → install exactly the plugin
  versions the server runs (never newer; premium plugins not on wordpress.org are named, copy
  those by hand) → pending schema upgrades → version drift report.
- **push:** canonical guard → confirmation → check both connections → back up the server's DB
  → export locally, upload to a unique temp file, import, delete the temp file → rewrite the
  local URL to the server URL → `siteurl`/`home`, theme, cache, schema upgrades on the server.

`local.url` (in `brmbh.local.json`) is required: every URL in the database is rewritten to it,
so the CLI refuses rather than guessing. Missing → ask the user for their local site URL.
`db push` asks for confirmation; with `--json` it refuses without `--yes`. Pass `--yes` only
after the user confirmed this exact target in the conversation — never for production on your
own.

## Report

State the direction, environment, `REMOTE_URL`, and a summary of what the script reported
(rows replaced, theme activated, schema upgrades). If a push was blocked by `CANONICAL_ENV`,
report that and stop — don't work around it. Name the backup file the script printed, and any
plugin it could not match (premium). To undo: `wp db import <backup>` on the side that was
overwritten.
