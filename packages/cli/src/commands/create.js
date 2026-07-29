/**
 * `brmbh create` / `create-brmbh` — genesis scaffold.
 *
 * The "slick install": one command turns an empty folder into a working,
 * agent-ready brmbh theme. Each step is best-effort and reported clearly;
 * environment gaps (no wp-cli, no SCF yet) warn but never abort the build.
 */
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { LEVEL, ToolError } from '../tool.js';
import { exists, isDir, slugify } from '../fsutil.js';
import { materializeTheme } from '../registry.js';
import { findWpRoot, acfStatus, activateTheme, hasWpCli } from '../wp.js';
import { generateSkillWrappers } from './add.js';

export const spec = {
  description: 'Scaffold a new brmbh theme into a folder, install, build, and wire up skills',
  level: LEVEL.L3,
  positionals: [{ name: 'name', required: false, description: 'Theme folder name (default: brmbh-theme)' }],
  flags: {
    from: { type: 'string', description: 'Copy the theme from a local checkout instead of cloning' },
    ref: { type: 'string', description: 'Git branch/tag to clone (default: repo default)' },
    'skip-install': { type: 'boolean', default: false, description: 'Skip npm install + build' },
    'skip-activate': { type: 'boolean', default: false, description: 'Skip wp-cli theme activation' },
    force: { type: 'boolean', default: false, description: 'Allow scaffolding into a non-empty folder' },
  },
};

export async function run(ctx, args) {
  const { ui } = ctx;
  const slug = slugify(args.name || 'brmbh-theme') || 'brmbh-theme';
  const dest = path.resolve(ctx.cwd, slug);

  ui.banner('Creating a brmbh theme', slug);

  // 1. target dir guard
  if (await exists(dest)) {
    const entries = await fs.readdir(dest).catch(() => []);
    if (entries.length && !args.force) {
      throw new ToolError('target_not_empty', `Folder already exists and is not empty: ${dest}`, 'Pass --force to scaffold anyway.');
    }
  }

  // 2. materialize theme files
  const source = await materializeTheme({ dest, from: args.from, ref: args.ref, ctx });
  ui.ok(`Theme files ready (${source.source})`);

  const steps = { installed: false, built: false, skills: 0, activated: false, stripped: [] };

  // 2b. strip starter-repo scaffolding.
  // The source repo is a monorepo: the theme at the root plus packages/cli,
  // which is published to npm. A scaffolded project consumes @brmbh/cli from
  // the registry, so it must not carry a copy of the package, and must not be
  // a workspace root — otherwise npm resolves the dependency to the local copy
  // and `npm update` can never reach it.
  steps.stripped = await stripStarterScaffolding(dest, ui);

  // 3. install + build
  if (!args['skip-install']) {
    if (await exists(path.join(dest, 'package.json'))) {
      ui.step('Installing npm dependencies');
      const npm = await ctx.run('npm', ['install'], { cwd: dest });
      if (npm.code === 0) {
        steps.installed = true;
        ui.ok('Dependencies installed');
        ui.step('Building assets (CSS + JS)');
        const build = await ctx.run('npm', ['run', 'build'], { cwd: dest });
        steps.built = build.code === 0;
        build.code === 0 ? ui.ok('Assets built') : ui.warn('Build step failed — run `brmbh dev --once` later');
      } else {
        ui.warn('npm install failed — install manually with `npm install`');
      }
    } else {
      ui.warn('No package.json in theme — skipping install');
    }
  } else {
    ui.info('Skipped install/build (--skip-install)');
  }

  // 4. (re)generate agent skill wrappers.
  // Sources come from node_modules/@brmbh/cli/AGENTS (plus any local override),
  // so this only produces anything once the install in step 3 has run.
  const gen = await generateSkillWrappers(dest);
  steps.skills = gen.wrappers;
  if (gen.wrappers) {
    ui.ok(`Agent skills wired (${gen.skills} skills → ${gen.wrappers} wrappers across .claude/.cursor/.windsurf)`);
  } else {
    ui.warn('No skills wired yet — run `npm install && npx brmbh add skills` in the theme');
  }

  // 5. SCF check (Secure Custom Fields — free drop-in, ACF Pro also works)
  const acf = await acfStatus(ctx.cwd);
  if (acf === 'active') ui.ok('SCF / ACF detected and active');
  else if (acf === 'installed') ui.warn('SCF installed but not active — activate it before editing blocks');
  else if (acf === 'missing') ui.warn('Secure Custom Fields (SCF) not found — install free from wordpress.org/plugins/secure-custom-fields');
  else ui.info('Could not verify SCF (no wp-cli) — ensure Secure Custom Fields is installed');

  // 6. activate theme via wp-cli when we're inside a real WP install
  if (!args['skip-activate']) {
    const wpRoot = await findWpRoot(dest);
    const insideThemes = wpRoot && dest.includes(path.join('wp-content', 'themes'));
    if (insideThemes && (await hasWpCli())) {
      const okAct = await activateTheme(wpRoot, slug);
      steps.activated = okAct;
      okAct ? ui.ok('Theme activated') : ui.warn('Could not activate theme automatically — run `wp theme activate ' + slug + '`');
    } else {
      ui.info('Not inside wp-content/themes (or no wp-cli) — activate the theme from WP admin');
    }
  }

  const next = [
    !steps.installed && !args['skip-install'] ? `cd ${slug} && npm install && npm run build` : null,
    acf === 'missing' ? 'Install Secure Custom Fields (SCF) — free at wordpress.org/plugins/secure-custom-fields' : null,
    !steps.activated ? `Activate the "${slug}" theme in WordPress` : null,
    'Open your editor + Claude/Cursor and try: "create a hero block from this Figma frame"',
    'Build assets while you work: brmbh dev',
  ].filter(Boolean);

  if (!ctx.json) {
    ui.raw('');
    ui.raw('  Next steps:');
    next.forEach((n) => ui.item(n));
  }

  return {
    message: `Created brmbh theme "${slug}"`,
    slug,
    path: dest,
    source,
    steps,
    acf,
    next, // L3: literal follow-up procedure for an agent to execute
  };
}

/**
 * Remove the parts of the source repo that belong to the starter, not to a
 * scaffolded project, and de-monorepo its package.json.
 *
 * Anything listed here is infrastructure for *publishing* brmbh; a client
 * project neither needs nor should ship it. Stale copies are worse than
 * missing ones — a vendored packages/cli would silently win over the
 * registry version forever.
 *
 * @returns {Promise<string[]>} what was removed, for the result envelope
 */
async function stripStarterScaffolding(dest, ui) {
  const removed = [];

  // paths that only make sense in the monorepo
  const drop = [
    'packages',       // the @brmbh/cli source — consumed from npm instead
    'skills',         // pre-scaffold skill, distributed via `npx skills add`
    'skills.sh.json', // its manifest
    '.github',        // the starter's own CI
  ];
  for (const rel of drop) {
    const target = path.join(dest, rel);
    if (await exists(target)) {
      await fs.rm(target, { recursive: true, force: true });
      removed.push(rel);
    }
  }

  // a scaffolded theme is not a workspace root
  const pkgPath = path.join(dest, 'package.json');
  if (await exists(pkgPath)) {
    try {
      const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
      if (pkg.workspaces) {
        delete pkg.workspaces;
        await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
        removed.push('package.json#workspaces');
      }
    } catch {
      ui.warn('Could not parse package.json — leaving it untouched');
    }
  }

  if (removed.length) ui.ok(`Stripped starter scaffolding (${removed.join(', ')})`);
  return removed;
}

export default { spec, run };
