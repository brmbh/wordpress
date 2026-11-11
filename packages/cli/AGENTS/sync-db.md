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

Both pull and push run URL search-replace (http + https variants, convergence pass), fix
`siteurl`/`home`, activate the right theme, flush cache, and run pending schema upgrades.
`db push` asks for confirmation; with `--json` it refuses without `--yes`. Pass `--yes` only
after the user confirmed this exact target in the conversation — never for production on your
own.

## Report

State the direction, environment, `REMOTE_URL`, and a summary of what the script reported
(rows replaced, theme activated, schema upgrades). If a push was blocked by `CANONICAL_ENV`,
report that and stop — don't work around it. Name the backup file the script printed.
