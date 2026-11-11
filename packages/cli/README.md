# @brmbh/cli

> [!IMPORTANT]
> **This repo is moving into [brmbh/wordpress](https://github.com/brmbh/wordpress).**
> The CLI is becoming a devDependency of the theme rather than a separate scaffolder, so that
> tooling *and* agent skills stay updatable via `npm update`. See
> [brmbh/wordpress#8](https://github.com/brmbh/wordpress/issues/8) for the plan. This repo will
> be archived once the migration lands; `@brmbh/cli` continues to publish from the new location.
>
> To start a new theme today, prefer: `npx skills add brmbh/wordpress`, then ask your agent for a
> new brmbh theme.

The command-line front door to the **[brmbh agentic WordPress suite](https://github.com/brmbh/wordpress)** — a modern Bootstrap 5 + Gutenberg + ACF block-factory starter theme with built-in agent skills.

One command turns an empty folder into a working, agent-ready theme. A handful of verbs cover the whole lifecycle: scaffold → build → ship.

```bash
npx -y -p @brmbh/cli create-brmbh my-site   # scaffold + install + build + skills + activate
```

## Why

Every other WP starter hands you empty boilerplate. brmbh hands you boilerplate **plus an agent that plans and builds your sections from a design** — the agent skills ship inside the theme and work in Claude Code, Cursor, and Windsurf.

The CLI keeps the human experience tiny (one install command + ~5 verbs) while every command is also **agent-legible**: pass `--json` and you get a structured envelope instead of prose, so an agent can drive the exact same commands.

## The user journey

```
1.  cd wp-content/themes
2.  npx -y -p @brmbh/cli create-brmbh my-site
       → clones the theme, npm install + build
       → wires the agent skills into .claude/ .cursor/ .windsurf/
       → checks for SCF, activates the theme (when wp-cli is present)
3.  Open your editor + Claude/Cursor — the skills are right there:
       "create a hero block from this Figma frame"
4.  brmbh deploy staging          → ship it
```

## Commands

| Command | What it does | Pillar |
|---|---|---|
| `create [name]` | Scaffold a new theme (clone, install, build, skills, activate) | Scaffolding |
| `add block <name>` | Four-file ACF block (factory convention) | Scaffolding |
| `add cpt <name>` | One-file custom post type | Scaffolding |
| `add skills` | (Re)generate agent skill wrappers from canonical `AGENTS/` | Scaffolding |
| `dev [--once]` | Build / watch the theme's CSS + JS | Dev ops |
| `doctor` | Health check (node, theme, build, skills, core, SCF, env) | Dev ops |
| `update [--latest] [--dry-run]` | Update `@brmbh/cli`, replace the theme core in `inc/core/`, run migrations on the site's own files | Updates |
| `deploy <env> [--apply]` | Ship a commit: build, dry run (default) or send, verify the live site | Deploy |
| `db pull\|push <env> [--yes]` | Database between this machine and an environment; target backed up first | DB / sync |
| `env [list]` · `env run <env> <tool>` | List environments (`brmbh.json`); run `db-verify`, `sync-plugins` or `version-check` against one | DB / sync |
| `add ci github` | Opt-in GitHub Actions workflow that runs `brmbh deploy` | Deploy |
| `uploads pull\|push <env> [--delete] [--yes]` | Sync `wp-content/uploads` between this machine and an environment | DB / sync |

Introspection is built in:

```bash
brmbh help            # all commands
brmbh <cmd> --help    # one command
brmbh schema          # machine-readable schema of every command (for agents)
brmbh doctor --json   # → {"ok":true,"class":"ready","checks":[...]}
```

## Design: code-first, dual-mode

Built on the [code-first-agents](https://github.com/beogip/code-first-agents) idea — *the LLM orchestrates, code executes*. Deterministic work (generating files, wiring registrations, running builds) lives in the command handlers. The **reasoning** (turning a screenshot or Figma frame into ACF fields + markup) stays with the agent skill.

Every command runs in one of two modes:

- **pretty** (default) — streamed steps + a summary, for humans.
- **`--json`** — a single JSON **envelope** (`{ ok, message, ... }`, always exit 0), for agents.

Commands declare a *level* describing their envelope: **L1** data, **L2** a `class` field to branch on (e.g. `doctor`), **L3** a literal `next` procedure to execute (e.g. `create`, `add`).

## Requirements

- Node ≥ 18
- `git` (to clone the theme; or use `--from <local-checkout>` offline)
- [Secure Custom Fields](https://wordpress.org/plugins/secure-custom-fields/) — free, required for ACF blocks (ACF Pro also works)
- `wp-cli` (optional; enables auto-activation + ACF detection)

## Local development

```bash
git clone https://github.com/brmbh/cli && cd cli
node bin/brmbh.js help
# scaffold from a local theme checkout (offline):
node bin/brmbh.js create demo --from ../wordpress
```

## Releasing

Nobody runs `npm publish` by hand, and merging to `main` never publishes. Fixes collect on
`main`; a release happens when someone decides to ship:

```bash
gh workflow run release.yml -f bump=patch   # or minor / major; also: Actions → release → Run workflow
```

`.github/workflows/release.yml` bumps `package.json` and `inc/core/core.json` together, runs
the tests, publishes to npm through trusted publishing (no token, provenance attached), then
commits the bump to `main`, tags `vX.Y.Z` and creates the GitHub release with notes generated
from the merged PRs.

## License

MIT
