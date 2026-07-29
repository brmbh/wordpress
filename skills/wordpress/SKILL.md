---
name: wordpress
description: Scaffold, set up, and work with a brmbh WordPress theme. Use when the user wants to create a new brmbh theme, set up the WordPress development environment, install dependencies, run the doctor check, add ACF blocks or custom post types, deploy, or sync the database.
license: MIT
compatibility: Requires Node >=18, git, and a local WordPress install (Local by Flywheel recommended). wp-cli optional but recommended.
metadata:
  author: Jan Brombach
  version: "0.1.0"
---

# brmbh WordPress Skill

brmbh is an agentic WordPress starter theme: Bootstrap 5 + Gutenberg + a self-registering ACF block factory, designed to be driven by a coding agent. This skill covers setup from scratch. Once the theme is scaffolded, in-theme skills in `AGENTS/` take over (see [Handoff to in-theme skills](#handoff-to-in-theme-skills)).

## Installing this skill

Users get this skill with:

```bash
npx skills add brmbh/wordpress
```

That is the intended entry point — after it, "make me a new brmbh theme" is enough. The command
below is the fallback for someone who already knows brmbh exists.

## Two different things are called `brmbh`

| Command | What it is |
|---|---|
| `npx brmbh …` / `npx @brmbh/cli …` | the **Node CLI** — create, dev, doctor, deploy, db, uploads, add |
| `wp brmbh …` | a **WP-CLI subcommand** the theme registers — scaffold, tokens |

Unrelated programs. Dropping or adding the `wp` prefix gets you "unknown command".

## Prerequisites

Check these before starting:

```bash
node --version          # must be >=18
git --version           # required
wp --version 2>/dev/null || echo "wp-cli not found (optional)"
```

brmbh requires **Secure Custom Fields (SCF)** or ACF Pro in the WordPress install. SCF is free: `https://wordpress.org/plugins/secure-custom-fields/`

## Step 1 — Scaffold a new theme

Run from inside `wp-content/themes/` of an existing WordPress install:

```bash
npx @brmbh/cli create <theme-name>
```

No global install needed — `npx` fetches the current version on demand. Use the client's project
name as `<theme-name>`: it becomes the theme name **and** the text domain.

This clones the theme, strips the starter's own scaffolding, renames it to `<theme-name>`, runs
`npm install`, builds assets, wires agent skills for Claude Code / Cursor / Windsurf, and
attempts to activate the theme via wp-cli.

Afterwards the CLI is a devDependency of the theme, so use `npx brmbh <cmd>` from inside it —
and `npm update @brmbh/cli` to pull newer tooling and skills into an existing project.

### Offline / local checkout

If the user already has a local clone of the theme repo (`brmbh/wordpress`):

```bash
npx @brmbh/cli create <theme-name> --from /path/to/brmbh-wordpress
```

### Skip steps

```bash
npx @brmbh/cli create <theme-name> --skip-install   # skip npm install + build
npx @brmbh/cli create <theme-name> --skip-activate  # skip wp-cli theme activation
```

## Step 2 — Run doctor

Always run doctor after scaffolding to verify the environment:

```bash
brmbh doctor --json
```

Parse the JSON envelope to branch on state:

```json
{
  "ok": true,
  "class": "ready" | "warn" | "blocked",
  "checks": [
    { "name": "node",         "status": "ok" | "warn" | "fail", "note": "..." },
    { "name": "theme",        "status": "ok" | "warn" | "fail", "note": "..." },
    { "name": "dependencies", "status": "ok" | "warn" | "fail", "note": "..." },
    { "name": "build",        "status": "ok" | "warn" | "fail", "note": "..." },
    { "name": "skills",       "status": "ok" | "warn" | "fail", "note": "..." },
    { "name": "env",          "status": "ok" | "warn" | "fail", "note": "..." },
    { "name": "wp-cli",       "status": "ok" | "warn" | "fail", "note": "..." },
    { "name": "scf",          "status": "ok" | "warn" | "fail", "note": "..." }
  ]
}
```

**If `class` is `ready`:** environment is fully set up — proceed to in-theme skills.

**If `class` is `warn`:** non-blocking issues. Check each `warn` item and apply the relevant fix below.

**If `class` is `blocked`:** a required check failed. Must fix before continuing.

## Step 3 — Fix common issues

### `theme: fail` — not a brmbh theme

Doctor is running outside a brmbh theme directory. Run from inside the theme folder, or pass `--cwd`:

```bash
brmbh doctor --cwd /path/to/wp-content/themes/<theme-name>
```

A brmbh theme is identified by the presence of both `my-acf-blocks/` and `package.json` in the same directory.

### `dependencies: warn` — node_modules missing

```bash
brmbh dev --once --cwd /path/to/theme
# or
cd /path/to/theme && npm install && npm run build
```

### `build: warn` — assets not built

```bash
brmbh dev --once --cwd /path/to/theme
```

### `wp-cli: warn` — wp-cli not found

wp-cli is optional but required for SCF detection, theme activation, and DB sync. Install from `https://wp-cli.org/`.

On **Local by Flywheel**, use the `localwp` wrapper instead of `wp`. The global `wp` binary may fail due to MySQL socket issues. See "Local by Flywheel" section below.

### `scf: warn/fail` — Secure Custom Fields not found

Install and activate SCF via wp-cli:

```bash
wp plugin install secure-custom-fields --activate --path=/path/to/wp-root
# or with localwp:
localwp plugin install secure-custom-fields --activate --path=/path/to/wp-root
```

Or install manually from WP admin: Plugins → Add New → search "Secure Custom Fields".

### `scf: warn` — "cannot verify (run from the WP install)"

Doctor is running from the theme directory, not the WordPress root. For SCF detection, run doctor from the WP root or use `--cwd`:

```bash
brmbh doctor --json --cwd /path/to/wp-root
```

## Local by Flywheel — MySQL socket fix

The global `wp` command fails with "Error establishing a database connection" on Local sites because Local uses a per-site Unix socket instead of a TCP port.

**Find the socket path:**

```bash
ls ~/Library/Application\ Support/Local/run/
# Pick the active site ID, then:
cat ~/Library/Application\ Support/Local/run/<SITE_ID>/conf/mysql/my.cnf | grep socket
```

**Add a CLI branch to `wp-config.php`** (in the WP root, not the theme):

```php
define( 'DB_HOST', ( PHP_SAPI === 'cli' )
    ? 'localhost:/Users/<username>/Library/Application Support/Local/run/<SITE_ID>/mysql/mysqld.sock'
    : 'localhost'
);
```

After this fix, use `localwp` instead of `wp` for all WP-CLI commands:

```bash
localwp plugin list --path=/path/to/wp-root
localwp theme activate <theme-name> --path=/path/to/wp-root
```

## Step 4 — Activate the theme

If `create` couldn't activate automatically:

```bash
wp theme activate <theme-name> --path=/path/to/wp-root
# or with localwp:
localwp theme activate <theme-name> --path=/path/to/wp-root
```

Or activate from WP admin: Appearance → Themes.

## Handoff to in-theme skills

Once doctor reports `class: ready` and the theme is active, the in-theme `AGENTS/` skills take over. These are wired to your agent automatically by `brmbh create`. Available skills:

| Skill | What it does |
|---|---|
| `/create-block` | Build a new ACF block from a Figma node, screenshot, or field schema |
| `/edit-block` | Modify an existing block's json / fields / template / scss |
| `/list-blocks` | Audit registered blocks, ACF groups, and missing SCSS imports |
| `/delete-block` | Confirm + remove a block folder and its SCSS import |
| `/sync-tokens` | Regenerate `_tokens.scss` from Figma Variables via MCP |
| `/deploy` | Ship the built theme to a remote environment over SSH |
| `/sync-db` | Pull or push the database between environments |
| `/sync-plugins` | Mirror active plugins to a remote environment |
| `/sync-uploads` | Sync `wp-content/uploads` between environments (push is guarded + destructive) |
| `/check-versions` | Report PHP / WordPress / theme / plugin version drift |

Invoke them directly (e.g. `/create-block`) or let the agent pick them up from context.

## CLI reference

```bash
brmbh help                          # all commands
brmbh schema                        # machine-readable command schema (JSON)
brmbh doctor --json                 # structured environment check
npx @brmbh/cli create <name>        # scaffold a new theme
brmbh add block <name>              # add an ACF block (4-file convention)
brmbh add cpt <name>                # add a custom post type
brmbh add skills                    # regenerate agent skill wrappers
brmbh dev [--once]                  # build/watch CSS + JS
brmbh deploy <staging|prod>         # deploy over SSH
brmbh db pull|push <staging|prod>   # sync database
brmbh uploads pull|push <staging|prod> [--delete]  # sync wp-content/uploads
```

All commands accept `--json` for a structured envelope (always exit 0, `ok` field signals success):

```bash
brmbh doctor --json | jq '.class'
```
