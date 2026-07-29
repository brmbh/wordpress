# Agent operating contract — brmbh

This file is the canonical instruction set for any coding agent working in this theme. Other
agents (Claude, Cursor, Windsurf) point here. Read it before making changes.

## Before anything else

1. No `node_modules/`? Run `npm install`. This installs `@brmbh/cli`, which carries the tooling
   **and** the skill docs — without it, deploy, DB sync, the CSS build and the skills are all absent.
2. Then `npx brmbh doctor --json` and branch on `class`: `ready` → proceed, `warn` → read each
   warning, `blocked` → fix before doing anything else.
3. No `wp-cli`? Say so. `/deploy`, `/sync-db`, `/sync-uploads` and SCF detection will not work.

**Checking a site you deployed to,** rather than this working copy — the theme is local, the
WordPress is on the server:

```bash
npx brmbh doctor --json --ssh host:/path/to/wordpress
```

Needs SSH access and wp-cli on the remote (most shared hosts have it); no WordPress locally.
Use it after `/deploy` to confirm the live site is healthy — a deploy that "succeeded" is not
the same as a site that works.

## Two different things are both called `brmbh`

Do not confuse these — dropping or adding the `wp` prefix gets you "unknown command":

| You type | What it is | Where it lives |
|---|---|---|
| `npx brmbh …` | the **Node CLI** — `create`, `dev`, `doctor`, `deploy`, `db`, `uploads`, `add` | `@brmbh/cli`, a devDependency |
| `wp brmbh …` | a **WP-CLI subcommand** this theme registers — `scaffold`, `tokens` | `inc/cli.php`, PHP, runs inside WordPress |

Different languages, different runtimes, same word. They are unrelated programs.

## Where things live

Skills and tooling ship in `@brmbh/cli` so `npm update` refreshes them; a project-local copy
always wins, so you can override one without losing updates to the rest.

| | Installed (updatable) | Project-local override |
|---|---|---|
| Skills | `node_modules/@brmbh/cli/AGENTS/*.md` | `AGENTS/<name>.md` |
| Scripts | `node_modules/@brmbh/cli/tools/*` | `tools/<name>` |

`tools/env/*.env` is always project-local — it holds this project's servers and is gitignored.
The `.claude/`, `.cursor/` and `.windsurf/` wrappers are **generated** on install: edit the skill
source, never a wrapper.

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
| `/sync-tokens` | Figma Variables → `_tokens.scss` | `wp brmbh tokens` |
| `/deploy` | Ship theme code to a remote env | `npx brmbh deploy` |
| `/sync-db` | Pull/push the database (push is destructive) | `npx brmbh db pull\|push` |
| `/sync-plugins` | Mirror active plugins to a remote env | `@brmbh/cli` → `tools/sync-plugins.sh` |
| `/sync-uploads` | Sync `wp-content/uploads` (push is destructive) | `npx brmbh uploads pull\|push` |
| `/check-versions` | Report PHP/WP/theme/plugin drift | `@brmbh/cli` → `tools/version-check.sh` |

Plus the scaffold: `wp brmbh scaffold` (idempotent pages + menus, defined in `inc/scaffold.php`).

**Operations guardrails (deploy + sync):** these touch live servers and databases.
- Always `npm run build` before `/deploy`.
- Always run `/check-versions` before a DB sync.
- `/sync-db` and `/sync-uploads` pushes are **destructive** and guarded by `CANONICAL_ENV` —
  never bypass the guard or set `SKIP_CONFIRM` on the user's behalf; if a push is blocked,
  stop and ask.
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
