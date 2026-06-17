/**
 * `brmbh create` / `create-brmbh` — genesis scaffold.
 *
 * The "slick install": one command turns an empty folder into a working,
 * agent-ready brmbh theme. Each step is best-effort and reported clearly;
 * environment gaps (no wp-cli, no ACF Pro yet) warn but never abort the build.
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

  const steps = { installed: false, built: false, skills: 0, activated: false };

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

  // 4. (re)generate agent skill wrappers from the canonical AGENTS/ folder
  if (await isDir(path.join(dest, 'AGENTS'))) {
    const gen = await generateSkillWrappers(dest);
    steps.skills = gen.wrappers;
    ui.ok(`Agent skills wired (${gen.skills} skills → ${gen.wrappers} wrappers across .claude/.cursor/.windsurf)`);
  }

  // 5. ACF Pro check
  const acf = await acfStatus(ctx.cwd);
  if (acf === 'active') ui.ok('ACF Pro detected and active');
  else if (acf === 'installed') ui.warn('ACF Pro installed but not active — activate it before editing blocks');
  else if (acf === 'missing') ui.warn('ACF Pro / Secure Custom Fields not found — required for blocks (bring your own license)');
  else ui.info('Could not verify ACF (no wp-cli) — ensure ACF Pro is installed');

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
    acf === 'missing' ? 'Install ACF Pro (or Secure Custom Fields) and activate it' : null,
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

export default { spec, run };
