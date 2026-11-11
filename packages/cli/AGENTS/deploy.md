# /deploy

Deploy a commit of the theme to an environment with `npx brmbh deploy <env>`: it builds, ships
tracked files plus the build output, and checks the live site afterwards.

## When to use

The user asks to deploy, ship, publish, or push the theme to an environment. This deploys
**theme code only** — not the database (`/sync-db`), uploads (`/sync-uploads`) or plugins
(`/sync-plugins`).

## How it works

- **Environments** are named in `brmbh.json` (committed) and `brmbh.local.json` (gitignored,
  overrides per machine): `ssh`, `path` (WordPress root), `url`, `canonical`. `npx brmbh env`
  lists them. Missing → ask the user for host, path and URL, and whether the hosts may be
  committed (`brmbh.json`) or stay on this machine (`brmbh.local.json`).
- **A commit, not a working tree.** Uncommitted changes stop the deploy (`dirty_tree`). Commit
  first; `--allow-dirty` exists for emergencies and is recorded in the stamp.
- **Dry run by default.** Without `--apply` nothing is sent; you get the list of files that would
  be new, changed or deleted on the server.
- **Verified by content.** After sending, the live `wp-content/themes/<theme>/brmbh-deploy.json`
  must carry the commit just deployed, and the home page must load without a PHP fatal error.
- Runs the same on a laptop and in CI (`npx brmbh add ci github` writes an opt-in workflow).
  SSH keys come from the machine or a CI secret, never from the config.

## Steps

1. `npx brmbh env --json` — confirm the environment exists. Name the target URL to the user.
2. `git status` — the theme must be committed.
3. `npx brmbh deploy <env> --json` — dry run. Report `changes` (new / changed / deleted counts,
   and any deletions by name). Deletions on the server are expected when files were removed in
   git; anything else deleted needs the user's look.
4. Get the user's go-ahead (always for production), then `npx brmbh deploy <env> --apply --json`.
5. Read `class`: `deployed` → report `verify.note`. `verify_failed` → the files were sent but the
   live check failed: report `verify.note` and check the site; don't redeploy blindly.
   `verify.status: "skipped"` means the site is protected (401/403) or has no `url`.

## Report

Environment, URL, commit (short), counts of new / changed / deleted, and the verify result.
