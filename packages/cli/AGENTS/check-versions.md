# /check-versions

Report version drift between local and a remote environment via `tools/version-check.sh`.
Read-only — makes no changes.

## When to use

The user asks whether environments are in sync, before a deploy/DB-sync, or when debugging
"works locally, breaks on the server" issues. Safe to run any time.

## What it checks

1. **PHP** minor version (local vs remote)
2. **WordPress core** version
3. **Theme** version (from `style.css`)
4. **Active plugins** — version mismatches, plus plugins active on only one side

Each mismatch is reported with a suggested fix; it exits non-zero if any drift is found.

## Preconditions

Env file `tools/env/{environment}.env` exists with the SSH + path + URL vars, and WP-CLI is
available on both ends. On macOS + Local by Flywheel set `LOCAL_WP_CLI="localwp"` in the env
file; otherwise it defaults to `wp`.

## Run

```bash
source tools/env/staging.env && ./tools/version-check.sh
```

## Report

Summarize what drifted (PHP / WP / theme / plugins) and the suggested fixes. If clean, say
environments are in sync. This often precedes a `/deploy` or `/sync-db` — recommend the next
step based on what drifted (e.g. theme drift → `/deploy`; plugin drift → `/sync-plugins`).
