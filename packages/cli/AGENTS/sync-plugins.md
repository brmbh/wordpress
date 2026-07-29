# /sync-plugins

Sync active plugins from local to a remote environment via `tools/sync-plugins.sh`.

## When to use

The user wants the remote site to have the same active plugins as local — after adding a
plugin locally, or when standing up a new environment. Pairs with `/sync-db` (DB sync) and
`/deploy` (theme code).

## What it does

For each plugin active locally:
1. Tries `wp plugin install` on the remote (works for wp.org-hosted plugins).
2. If that fails (premium / not on wp.org), rsyncs the plugin directory directly.
3. Activates the plugin on the remote.

It reports three buckets: installed from wp.org, rsynced directly, and failed (not found
locally).

## Preconditions — check first

1. Env file `tools/env/{environment}.env` exists with `SSH_TARGET` + `REMOTE_WP_PATH`.
2. Premium plugins exist locally at `wp-content/plugins/{slug}` (the script rsyncs from there).
3. Confirm the target environment with the user — this changes the remote plugin set.

## Run

```bash
source tools/env/staging.env && ./tools/sync-plugins.sh
```

## Notes

- This installs/activates but does **not** deactivate plugins the remote has and local
  doesn't. Removing remote-only plugins is a manual decision.
- Premium plugin code is rsynced as-is — make sure licenses permit it for the target.
- Run `/sync-db` after if the plugins carry settings stored in the database.

## Report

Summarize the installed / rsynced / failed buckets the script printed, and flag any failures.
