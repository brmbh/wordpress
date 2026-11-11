# /sync-uploads

Sync `wp-content/uploads` between local and a remote environment with
`npx brmbh uploads pull|push <env>` (wraps `tools/uploads-pull.sh` / `uploads-push.sh`).

## ⚠️ Read this first — direction matters

| Direction | Script | Risk | Effect |
|---|---|---|---|
| **pull** (remote → local) | `npx brmbh uploads pull <env>` | Safe-ish, additive by default | Copies remote files to local. Nothing is deleted locally unless `--delete` is passed. |
| **push** (local → remote) | `npx brmbh uploads push <env> --yes` | **Destructive** | Mirrors local to remote — files present remotely but not locally are **deleted there**. Every replaced or deleted file is first moved to `~/.brmbh-backups/uploads-<env>-before-push-<time>/` on the server. |

**Never run `uploads-push` to an environment where someone else (a client, an editor) is
actively uploading content without explicit, unambiguous user confirmation naming the
target.** Pushing mirrors — it doesn't merge. Run `/sync-db` alongside this if the uploads
have corresponding attachment DB rows (they usually do) — pushing uploads without the
matching DB state (or vice versa) leaves orphaned files or broken attachment references.

## The `CANONICAL_ENV` guard

Push is blocked unless the environment says `"canonical": "local"` (unset means `remote`: the
server is the source of truth) — same guard as `db-push.sh`, and for the same reason: if someone else is
adding content directly on that remote, a push would silently wipe it. **Do not** edit
`brmbh.json` / `brmbh.local.json` to bypass it just to make a push go through — if push is blocked, stop and ask the
user; flipping the guard is their decision, not yours.

## Preconditions — check first

1. The environment exists (`npx brmbh env`). If not, ask the user for `ssh` + `path` and add it
   to `brmbh.local.json` (or `brmbh.json` if hosts may be committed).
2. You know **which direction** the user wants and **which environment**.
3. If the remote host has no `rsync` binary (some shared hosts don't — check with
   `ssh <target> "which rsync"`), these scripts won't work as-is; fall back to a manual
   tar → scp → extract, or flag this to the user rather than silently failing.

## Run

```bash
# Pull remote → local (additive — won't delete local-only files)
npx brmbh uploads pull staging

# Pull, mirroring remote exactly (deletes local files not on remote)
npx brmbh uploads pull staging --delete

# Skip a folder for this run only (standing ones: the environment's `excludes`)
npx brmbh uploads pull staging --exclude=videos

# Push local → remote: dry run first, show the user the deletions, then send
npx brmbh uploads push staging --dry-run
npx brmbh uploads push staging --yes
```

Both respect an optional `excludes` list on the environment in `brmbh.json` — rsync exclude
patterns for anything project-specific that lands in
`wp-content/uploads` but shouldn't sync (a backup plugin's own storage dir is the most common
case). This is set per project in the config, never hardcoded in the script.

`uploads push` asks for confirmation; with `--json` it refuses without `--yes` (or
`--dry-run`). Run `--dry-run` first and name the files it would delete; pass `--yes` only for
the environment the user explicitly named, after they saw that list.

## Report

State the direction, environment, `REMOTE_URL` (or path), and what rsync reported (files
transferred, anything excluded). If a push was blocked by `CANONICAL_ENV`, report that and
stop — don't work around it. After a push, name the backup folder the script printed.
