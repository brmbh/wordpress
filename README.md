# brmbh Agentic WP Suite

**An agentic WordPress starter theme: Bootstrap 5 + Gutenberg + a self-registering ACF block
factory, built to be driven by a coding agent.**

Clone it, point Claude / Cursor / Windsurf at it, and build production page sections straight
from a Figma design — ACF blocks, design tokens, page scaffolding, and deploys, without
hand-writing the boilerplate. Everything is a folder convention or a one-line command, so an
agent (or a human) can extend it without reverse-engineering the theme first.

It's a classic PHP theme — no build-step lock-in, no Blade, no Composer. Just Bootstrap, ACF
Pro, vanilla WordPress, and a set of conventions that automate the repetitive parts.

---

## Why "agentic", why "suite"

**Agentic** — every capability is exposed as an **agent skill**, not just human docs:

- Each tool (build a block, sync tokens, deploy, sync the DB, check drift) has a skill file in
  `AGENTS/` with its own preconditions and guardrails, plus thin wrappers for Claude, Cursor,
  and Windsurf. An agent knows *when* to use it and *how* to do it safely.
- **Convention over configuration:** a block is a folder of four files; pages are a declarative
  array. An agent extends the theme by following a pattern, not by reading the whole codebase.
- **Deterministic mechanics, agent judgment:** the actual work runs in plain CLI scripts; the
  agent supplies the reasoning (which design token, which environment, is this safe). No magic.
- The docs (`README`, `AGENTS.md`, `CLAUDE.md`) are written to be read by an LLM as a system
  prompt for the codebase.

**Suite** — it's more than a theme. It bundles the pieces of a whole workflow:

> theme + ACF block factory + Figma→SCSS token pipeline + deploy & DB-sync toolchain +
> agent skill packs for three editors

…so you can go from a Figma frame to a deployed section without leaving the repo.

---

## How it compares

| | This suite | Underscores (`_s`) | Understrap | Sage (Roots) |
|---|---|---|---|---|
| CSS framework | **Bootstrap 5** | none | Bootstrap | Tailwind |
| Bootstrap ↔ Gutenberg token bridge | ✅ | — | partial | — |
| Self-registering ACF block factory | ✅ | — | — | — |
| Agent skills (Claude/Cursor/Windsurf) | ✅ | — | — | — |
| Figma → SCSS token sync | ✅ | — | — | — |
| Deploy + DB-sync tooling included | ✅ | — | — | — |
| Templating | vanilla PHP | vanilla PHP | vanilla PHP | Blade |
| Build toolchain | npm + Webpack + Sass | none | Gulp/npm | Bud + Composer |
| Requires SCF | **yes (free)** | no | no | no |

**Use it when** you build content-driven WordPress sites with ACF blocks and want a coding
agent to do the repetitive block/scaffold/deploy work against a Bootstrap design system.
**Skip it when** you want a block-theme/FSE (`theme.json`-only) setup, a Tailwind/Blade stack,
or a theme with no ACF dependency.

---

## The three pillars

### 1. 🧱 An ACF block factory that registers itself

A block is a folder of four files. Drop it into `my-acf-blocks/` and it's live — no
`register_block_type()` calls, no central registry, no manual ACF group wiring.

```
my-acf-blocks/{block-name}/
  block.json     # WordPress block registration (ACF reads acf.renderTemplate)
  fields.php     # ACF field group (returned as an array)
  template.php   # render output (PHP + Bootstrap + get_field())
  _style.scss    # block styles (auto-imported)
```

`my-acf-blocks/loader.php` scans the folder and registers each block + field group on
`init` / `acf/init`. The **`/create-block`** agent skill writes all four files from a Figma
node or a screenshot, mapping the design to your tokens — never raw hex. Working reference:
`my-acf-blocks/example-hero/`.

### 2. 🔁 A sync toolchain: design tokens in, code + database out

One command in each direction, every one agent-callable:

| Tool | Skill | Direction | What it does |
|---|---|---|---|
| `tools/sync-tokens.mjs` | `/sync-tokens` | Figma → repo | Pull Figma Variables into `_tokens.scss` as CSS custom properties |
| `tools/deploy.sh` | `/deploy` | local → server | rsync the built theme over SSH — works with IP-restricted hosts where CI can't reach |
| `tools/db-pull.sh` | `/sync-db` | server → local | Export remote DB, import locally, URL search-replace, reconcile plugins + schema |
| `tools/db-push.sh` | `/sync-db` | local → server | The reverse — guarded by `CANONICAL_ENV` so you can't clobber production |
| `tools/sync-plugins.sh` | `/sync-plugins` | local → server | Install wp.org plugins remotely; rsync premium ones |
| `tools/version-check.sh` | `/check-versions` | both | Report PHP / WordPress / theme / plugin version drift |

Environments are tiny gitignored `tools/env/*.env` files (copy from the `.example`
templates). See [`tools/env/README.md`](tools/env/README.md).

### 3. 🎨 A real Bootstrap 5 ↔ Gutenberg integration

Bootstrap and the block editor share **one source of truth** for color, spacing, and
typography. Editors never type a Bootstrap class; agents never invent a hex value.

```
_tokens.scss            CSS custom properties (Figma-synced)
  → _variables.scss     $theme-colors + Bootstrap overrides
  → _wp-css-variables   the SCSS-to-WordPress bridge
  → inc/gutenberg.php   editor color palette + spacing scale
```

Change a value once and it propagates to SCSS, the live frontend, and the editor canvas. The
editor loads the compiled theme CSS so block previews match production. Full-width sections
with container-constrained content work for both native Gutenberg patterns
(`inc/block-patterns.php`) and ACF blocks.

> ⚠️ **Requires Advanced Custom Fields PRO 6.0+.** The block layer is load-bearing — there is
> no fallback path. `inc/dependencies.php` enforces it with admin notices and CLI guards.

---

## Quick start

```bash
# 1. Clone into your WordPress themes directory
git clone https://github.com/Schmandarine/brmbh-agentic-wp-suite.git \
  wp-content/themes/brmbh-agentic-wp-suite
cd wp-content/themes/brmbh-agentic-wp-suite

# 2. Install + build assets
npm install
npm run build            # or: npm run watch  (live rebuild)

# 3. Activate the theme in wp-admin (SCF must be active).
#    It scaffolds starter pages + menus once on activation.

# 4. Re-run the scaffold any time — it's idempotent
wp brmbh scaffold        # add --dry-run to preview
```

Then ask your agent to **`/create-block`** and build your first section from a design.

---

## Agent skills

`AGENTS/` is the canonical source. Each agent has a thin wrapper that reads and executes the
matching `AGENTS/{skill}.md` (wrappers in `.claude/commands/`, `.cursor/rules/`,
`.windsurf/rules/`). Works with any agent that can read files and run shell commands.

| Skill | Purpose |
|---|---|
| `/create-block` | Build a new ACF block from a Figma node, screenshot, or field schema |
| `/edit-block` | Modify an existing block's json/fields/template/scss |
| `/list-blocks` | Audit registered blocks, ACF groups, and missing SCSS imports |
| `/delete-block` | Confirm + remove a block folder and its SCSS import |
| `/sync-tokens` | Regenerate `_tokens.scss` from Figma Variables via MCP |
| `/deploy` | Ship the built theme to a remote environment over SSH |
| `/sync-db` | Pull or push the database between environments (push is guarded + destructive) |
| `/sync-plugins` | Mirror active plugins to a remote environment |
| `/check-versions` | Report PHP / WordPress / theme / plugin drift between environments |

The operating contract every agent follows is [AGENTS.md](AGENTS.md); Claude-specific workflow
is in [CLAUDE.md](CLAUDE.md). Both are written to be read by an LLM as a system prompt for the
codebase.

---

## Customizing the brand

1. Edit `assets/src/scss/_tokens.scss` — or run `/sync-tokens` to pull from Figma.
2. Mirror new palette values in `_variables.scss` (`$theme-colors`) and `inc/gutenberg.php`
   (editor palette). **Keep the slug names** — they're the contract.
3. Drop your logo at `assets/img/logo.svg` (optionally `logo-on-light.svg`), or set it via
   Customizer → Site Identity.
4. `npm run build`.

---

## Tech stack

WordPress 6.4+ · PHP 8.0+ · SCF 6.0+ (free) · Bootstrap 5.3 · GSAP · Webpack · Dart Sass ·
Node 18+ · WP-CLI (`wp brmbh` namespace) · Inter / InterDisplay variable fonts ·
GPL-2.0-or-later.

## Project layout

```
my-acf-blocks/        ACF block factory (loader + one example block)
inc/                  scaffold, block patterns, editor config, ACF dependency guard, CLI
assets/src/scss/      tokens → variables → Bootstrap bridge → globals → components
assets/src/js/        Bootstrap + GSAP entry, scroll entrances, sticky nav
tools/                deploy + DB-sync + Figma token-sync scripts; env templates
AGENTS/               canonical agent skills (+ thin wrappers in .claude / .cursor / .windsurf)
template-parts/       reusable partials (site logo)
```

## License

GPL-2.0-or-later. See [LICENSE](LICENSE). Built and maintained by
[Jan Brombach](https://brombach.de).
