# Environment files

Each environment is a small file of `export` vars consumed by the deploy + DB-sync
scripts in `tools/`.

## Setup

```bash
cp tools/env/staging.env.example    tools/env/staging.env
cp tools/env/production.env.example tools/env/production.env
# edit each with your SSH target, paths, URLs
```

**`*.env` files are gitignored** — they hold server hosts and paths, never commit them.
Only the `*.example` templates are tracked.

## Usage

Source an env file, then run a tool:

```bash
source tools/env/staging.env && ./tools/db-verify.sh   # safe — connection test only
source tools/env/staging.env && ./tools/deploy.sh       # rsync theme → server
source tools/env/staging.env && ./tools/db-push.sh      # local DB → remote (if allowed)
source tools/env/production.env && ./tools/db-pull.sh   # remote DB → local
source tools/env/staging.env && ./tools/uploads-pull.sh # remote uploads → local
source tools/env/staging.env && ./tools/uploads-push.sh # local uploads → remote (if allowed)
```

## The `CANONICAL_ENV` guard

`db-push.sh` and `uploads-push.sh` overwrite/mirror the remote, so both are gated:

- `CANONICAL_ENV=local` → push allowed (local dev is the source of truth, pre-launch).
- `CANONICAL_ENV=remote` → push **blocked** (production is the source of truth, post-launch).

Flip `production.env` to `remote` once the site is live so you can never accidentally
clobber the production database from local.
