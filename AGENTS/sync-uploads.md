# /sync-uploads

Sync `wp-content/uploads` between local and a remote environment. Wraps
`tools/uploads-pull.sh` and `tools/uploads-push.sh`.

## ⚠️ Read this first — direction matters

| Direction | Script | Risk | Effect |
|---|---|---|---|
| **pull** (remote → local) | `uploads-pull.sh` | Safe-ish, additive by default | Copies remote files to local. Nothing is deleted locally unless `--delete` is passed. |
| **push** (local → remote) | `uploads-push.sh` | **Destructive** | Mirrors local to remote — files present remotely but not locally are **deleted there**. |

**Never run `uploads-push` to an environment where someone else (a client, an editor) is
actively uploading content without explicit, unambiguous user confirmation naming the
target.** Pushing mirrors — it doesn't merge. Run `/sync-db` alongside this if the uploads
have corresponding attachment DB rows (they usually do) — pushing uploads without the
matching DB state (or vice versa) leaves orphaned files or broken attachment references.

## The `CANONICAL_ENV` guard

`uploads-push.sh` is blocked when the env file sets `CANONICAL_ENV=remote` (remote is the
source of truth) — same guard as `db-push.sh`, and for the same reason: if someone else is
adding content directly on that remote, a push would silently wipe it. **Do not** edit the
env file to bypass it just to make a push go through — if push is blocked, stop and ask the
user; flipping the guard is their decision, not yours.

## Preconditions — check first

1. Env file `tools/env/{environment}.env` exists (gitignored). If missing, have the user copy
   from the `.example` and fill in SSH + path vars.
2. You know **which direction** the user wants and **which environment**.
3. If the remote host has no `rsync` binary (some shared hosts don't — check with
   `ssh <target> "which rsync"`), these scripts won't work as-is; fall back to a manual
   tar → scp → extract, or flag this to the user rather than silently failing.

## Run

```bash
# Pull remote → local (additive — won't delete local-only files)
source tools/env/staging.env && ./tools/uploads-pull.sh

# Pull, mirroring remote exactly (deletes local files not on remote)
source tools/env/staging.env && ./tools/uploads-pull.sh --delete

# Push local → remote (mirror — only if CANONICAL_ENV=local and the user confirmed the target)
source tools/env/staging.env && ./tools/uploads-push.sh
```

Both scripts respect an optional `UPLOADS_EXCLUDE` var in the env file — a comma-separated
list of rsync exclude patterns for anything project-specific that lands in
`wp-content/uploads` but shouldn't sync (a backup plugin's own storage dir is the most common
case). This is set per-project in the gitignored env file, never hardcoded in the script.

`uploads-push.sh` prompts for confirmation interactively unless `SKIP_CONFIRM=1` — do **not**
set `SKIP_CONFIRM` on the user's behalf for a push to an environment other than the one the
user explicitly named.

## Report

State the direction, environment, `REMOTE_URL` (or path), and what rsync reported (files
transferred, anything excluded). If a push was blocked by `CANONICAL_ENV`, report that and
stop — don't work around it.
