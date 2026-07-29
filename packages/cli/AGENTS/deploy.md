# /deploy

Deploy the built theme to a remote environment via `tools/deploy.sh` (rsync over SSH).

## When to use

The user asks to deploy, ship, publish, or push the theme to staging/production. This deploys
**theme code only** — not the database (use `/sync-db` for that) and not plugins (use
`/sync-plugins`).

## Preconditions — check first

1. **Env file exists.** Deploys read `tools/env/{environment}.env` (gitignored). If it's
   missing, tell the user to `cp tools/env/staging.env.example tools/env/staging.env` and fill
   in `SSH_TARGET`, `REMOTE_WP_PATH`, `REMOTE_URL`, `REMOTE_THEME`.
2. **Assets are built.** Run `npm run build` first — `deploy.sh` excludes `assets/src/` and
   ships `assets/dist/`. Deploying without a build ships stale CSS/JS.
3. **Confirm the target.** Echo which environment + `REMOTE_URL` you're about to deploy to and
   get the user's go-ahead, especially for production.

## Run

```bash
npm run build
source tools/env/staging.env && ./tools/deploy.sh      # staging
source tools/env/production.env && ./tools/deploy.sh   # production
```

`deploy.sh` rsyncs the theme (excluding `.git`, `node_modules`, `tools`, `assets/src`, build
config, agent dirs) then flushes the object cache on the server.

## Notes

- **IP-restricted hosts:** `deploy.sh` runs from a machine whose IP is whitelisted for SSH.
  CI runners with dynamic IPs are often blocked — local deploy is the supported path.
- This is a one-way code sync. It does not touch the DB, uploads, or plugins.
- After deploying to a new environment, the DB may still point at the old URL — run
  `/sync-db` (pull or push) to reconcile URLs and content.

## Report

State the environment, `REMOTE_URL`, and confirm the cache flush succeeded.
