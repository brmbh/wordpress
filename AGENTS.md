# Agent operating contract — brmbh Agentic WP Suite

This file is the canonical instruction set for any coding agent working in this theme. Other
agents (Claude, Cursor, Windsurf) point here. Read it before making changes.

## What this theme is

An agentic WordPress starter: Bootstrap 5 + Gutenberg + an auto-registering ACF block factory.
Content is driven by ACF blocks and native Gutenberg patterns — not page templates.

**Hard dependency:** SCF 6.0+ (Secure Custom Fields — free, wordpress.org/plugins/secure-custom-fields). ACF Pro also works — both define `ACF_PRO=true`. No fallback. `inc/dependencies.php` is the single source of truth (`brmbh_has_acf_pro()`); it surfaces admin notices and aborts `wp brmbh` commands when SCF is missing.

## Skills — everything an agent can do here

Every capability has a skill doc in `AGENTS/` (thin wrappers in `.claude/`, `.cursor/`,
`.windsurf/` point to it). Read the skill before performing the action — each carries its own
preconditions and guardrails.

| Skill | Action | Wraps |
|---|---|---|
| `/create-block` | Build a new ACF block from a design | block factory |
| `/edit-block` | Modify an existing block | block factory |
| `/list-blocks` | Audit blocks + missing SCSS imports | block factory |
| `/delete-block` | Remove a block + its SCSS import | block factory |
| `/sync-tokens` | Figma Variables → `_tokens.scss` | `tools/sync-tokens.mjs` |
| `/deploy` | Ship theme code to a remote env | `tools/deploy.sh` |
| `/sync-db` | Pull/push the database (push is destructive) | `tools/db-*.sh` |
| `/sync-plugins` | Mirror active plugins to a remote env | `tools/sync-plugins.sh` |
| `/check-versions` | Report PHP/WP/theme/plugin drift | `tools/version-check.sh` |

Plus the scaffold: `wp brmbh scaffold` (idempotent pages + menus, defined in `inc/scaffold.php`).

**Operations guardrails (deploy + sync):** these touch live servers and databases.
- Always `npm run build` before `/deploy`.
- Always run `db-verify.sh` (or `/check-versions`) before a DB sync.
- `/sync-db` push is **destructive** and guarded by `CANONICAL_ENV` — never bypass the guard or
  set `SKIP_CONFIRM` on the user's behalf; if a push is blocked, stop and ask.
- Real `tools/env/*.env` files are gitignored — never commit them or echo their secrets.

## Design system — the rules

1. **Never hardcode hex, px font-sizes, or arbitrary spacing.** Map to tokens.
   - Colors: `$theme-colors` slugs (`primary`, `secondary`, `secondary-light`, `ochre`, …) →
     Bootstrap utilities (`bg-primary`, `text-primary`, `btn-primary`).
   - Spacing: `var(--space-*)` or Bootstrap utilities (`py-5`, `gap-3`); section rhythm via
     the `.section` class.
   - Type: `"Inter"` (body) / `"InterDisplay"` (headings) — automatic. Use heading + `display-*`
     classes, never `font-size` in px.
2. **One source of truth for the palette:** `_tokens.scss` (CSS vars) → mirrored in
   `_variables.scss` (`$theme-colors`) and `inc/gutenberg.php` (editor palette). Change values,
   keep slug names.
3. **Layout:** full-width sections (`align: full` / `.alignfull`) with content constrained by
   the Bootstrap container. ACF blocks render a `<section>` with a `.container` inside.

## The block factory

- A block = a folder in `my-acf-blocks/{name}/` with `block.json`, `fields.php`, `template.php`,
  `_style.scss`. `loader.php` auto-registers it. Zero manual registration.
- **Every `block.json` ships `apiVersion: 2` + `supports.mode: true`.** Never `apiVersion: 3` —
  it iframes the editor canvas and ACF force-disables in-canvas editing. See
  `my-acf-blocks/ACF-BLOCK-EDIT-MODE.md`.
- To create/edit/remove a block, use the `/create-block`, `/edit-block`, `/delete-block` skills
  in `AGENTS/`. They keep `_loader.scss` imports in sync.

## Separation of concerns

| Concern | Owner |
|---|---|
| Pages + menus (theme bootstrap data) | `inc/scaffold.php` → `wp brmbh scaffold` (idempotent) |
| ACF field groups + block templates | per-block, via `/create-block` |
| Design tokens | `_tokens.scss`, via `/sync-tokens` or `wp brmbh tokens` |

**Hard rule:** scaffold never touches ACF; each block owns its own `fields.php`.

## What NOT to do

- Don't add `register_block_type()` calls by hand — the loader does it.
- Don't introduce raw hex/px values in templates or block SCSS.
- Don't bump a block to `apiVersion: 3`.
- Don't rename token slugs — re-value them instead.
- Don't commit `assets/dist/` build output or `node_modules/` (gitignored).

## Build

`npm run build` (once) or `npm run watch` (live). CSS → `assets/dist/css/`, JS →
`assets/dist/js/main.bundle.js`.
