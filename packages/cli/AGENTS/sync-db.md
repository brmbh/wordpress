# /sync-db

Sync the WordPress database between local and a remote environment. Wraps
`tools/db-verify.sh`, `tools/db-pull.sh`, and `tools/db-push.sh`.

## ⚠️ Read this first — direction matters

| Direction | Script | Risk | Effect |
|---|---|---|---|
| **pull** (remote → local) | `db-pull.sh` | Safe-ish | Overwrites your **local** DB. You lose local-only changes |
| **push** (local → remote) | `db-push.sh` | **Destructive** | Overwrites the **remote/production** DB. Can take a site down |

**Always run `db-verify.sh` first** (connection test, no changes). **Never run `db-push` to a
production environment without explicit, unambiguous user confirmation naming the target.**

## The `CANONICAL_ENV` guard

`db-push.sh` is blocked when the env file sets `CANONICAL_ENV=remote` (remote is the source of
truth — the post-launch default). This is intentional. **Do not** edit the env file to bypass
it just to make a push go through — if push is blocked, stop and ask the user; flipping the
guard is their decision, not yours.

## Preconditions — check first

1. Env file `tools/env/{environment}.env` exists (gitignored). If missing, have the user copy
   from the `.example` and fill in SSH + URL + path vars.
2. WP-CLI works locally and on the server, SSH key is set up.
3. You know **which direction** the user wants and **which environment**.

## Run

```bash
# 1. ALWAYS verify connections first (read-only)
source tools/env/staging.env && ./tools/db-verify.sh

# 2a. Pull remote → local (refresh local from staging/production)
source tools/env/staging.env && ./tools/db-pull.sh

# 2b. Push local → remote (only if CANONICAL_ENV=local and the user confirmed the target)
source tools/env/staging.env && ./tools/db-push.sh
```

Both pull and push run URL search-replace (http + https variants, convergence pass), fix
`siteurl`/`home`, activate the right theme, flush cache, and run pending schema upgrades.
`db-push.sh` prompts for confirmation interactively unless `SKIP_CONFIRM=1` — do **not** set
`SKIP_CONFIRM` on the user's behalf for a production push.

## Report

State the direction, environment, `REMOTE_URL`, and a summary of what the script reported
(rows replaced, theme activated, schema upgrades). If a push was blocked by `CANONICAL_ENV`,
report that and stop — don't work around it.
