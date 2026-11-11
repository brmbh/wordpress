/**
 * `brmbh update` — bring a site to the core and skills this CLI ships (ADR 008).
 *
 *   1. update @brmbh/cli in the theme (npm), then hand over to the *installed*
 *      version, which knows its own core and migrations
 *   2. plan migrations on the site's own files; refuse everything if one is blocked
 *   3. replace inc/core/ with the shipped core
 *   4. report what changed, so the user or agent reviews the diff
 *
 * L2: `class` is up_to_date | updated | would_update | blocked.
 */
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LEVEL, ToolError } from '../tool.js';
import { exists } from '../fsutil.js';
import { findThemeDir, themeNotFoundDetail } from '../wp.js';
import { CORE_REL, coreSourceDir, readCoreVersion, diffCore, writeCore } from '../core.js';
import { planMigrations, applyMigrations } from '../migrations/index.js';
import { generateSkillWrappers } from './add.js';

const OWN_VERSION = JSON.parse(
  readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json'), 'utf8'),
).version;

export const spec = {
  description: 'Update @brmbh/cli, replace the theme core (inc/core/) and run migrations',
  level: LEVEL.L2,
  positionals: [],
  flags: {
    'dry-run': { type: 'boolean', default: false, description: 'Show what would change, write nothing' },
    latest: { type: 'boolean', default: false, description: 'Install the latest @brmbh/cli, including a new major version' },
    'skip-install': { type: 'boolean', default: false, description: 'Use the installed @brmbh/cli as is (no npm)' },
  },
};

export async function run(ctx, args) {
  const { ui } = ctx;
  const themeDir = await findThemeDir(ctx.cwd);
  if (!themeDir) throw new ToolError('no_theme', 'No brmbh theme found here', await themeNotFoundDetail(ctx.cwd));

  ui.banner('brmbh update', path.basename(themeDir));

  // 1. npm, then hand over to the installed CLI so its core + migrations apply
  if (!args['skip-install'] && !args['dry-run']) {
    const installed = path.join(themeDir, 'node_modules', '@brmbh', 'cli');
    const linked = await fs.lstat(installed).then((s) => s.isSymbolicLink()).catch(() => false);
    if (linked) {
      ui.info('@brmbh/cli is a workspace link (the brmbh repo itself) — skipping npm');
    } else {
      ui.step(args.latest ? 'Installing the latest @brmbh/cli' : 'Updating @brmbh/cli within its version range');
      const npmArgs = args.latest ? ['install', '--save-dev', '@brmbh/cli@latest'] : ['update', '@brmbh/cli'];
      const npm = await ctx.run('npm', npmArgs, { cwd: themeDir });
      if (npm.code !== 0) throw new ToolError('npm_failed', `npm ${npmArgs.join(' ')} failed`, 'Fix npm, or run with --skip-install to use the installed version.');
      const newVersion = await installedVersion(installed);
      if (newVersion && newVersion !== OWN_VERSION) {
        ui.ok(`@brmbh/cli ${OWN_VERSION} → ${newVersion}; continuing with the new version`);
        return handOver(ctx, installed, themeDir);
      }
      ui.ok(`@brmbh/cli ${OWN_VERSION} is current`);
    }
  }

  // 2. what would change
  const source = await coreSourceDir();
  if (!source) throw new ToolError('no_core', 'This @brmbh/cli ships no core', 'Reinstall @brmbh/cli (npm install).');
  const siteCore = path.join(themeDir, CORE_REL);
  const from = await readCoreVersion(siteCore);
  const to = await readCoreVersion(source);
  const sameDir = path.resolve(source) === path.resolve(siteCore);
  const coreDiff = sameDir ? { added: [], changed: [], removed: [] } : await diffCore(siteCore, source);
  const coreChanges = coreDiff.added.length + coreDiff.changed.length + coreDiff.removed.length;
  const migrations = await planMigrations(themeDir);
  const blocked = migrations.flatMap((m) => m.blocked.map((b) => ({ migration: m.id, ...b })));

  const report = {
    themeDir,
    core: { from, to, ...coreDiff },
    migrations: migrations.map((m) => ({ id: m.id, description: m.description, writes: m.writes.map((w) => w.file), deletes: m.deletes })),
  };

  if (blocked.length) {
    if (!ctx.json) {
      ui.warn('Nothing was changed: these files need you first');
      for (const b of blocked) ui.item(`${b.file} — ${b.fix}`);
    }
    return { message: `Update blocked: ${blocked.length} file(s) need a manual step`, class: 'blocked', ...report, blocked, next: blocked.map((b) => `${b.file}: ${b.fix}`), __handled: true };
  }

  if (!coreChanges && !migrations.length) {
    return { message: `Up to date (core ${to})`, class: 'up_to_date', ...report };
  }

  if (!ctx.json) {
    if (coreChanges) ui.info(`core ${from ?? 'none'} → ${to}: ${coreDiff.added.length} added, ${coreDiff.changed.length} changed, ${coreDiff.removed.length} removed`);
    for (const m of migrations) ui.info(`migration ${m.id}: ${m.description} (${[...m.writes.map((w) => w.file), ...m.deletes.map((d) => `−${d}`)].join(', ')})`);
  }

  if (args['dry-run']) {
    return { message: 'Dry run — nothing written', class: 'would_update', ...report };
  }

  // 3. write: migrations first (they remove what the core replaces), then the core
  await applyMigrations(themeDir, migrations);
  if (coreChanges) await writeCore(themeDir, source);
  const skills = await generateSkillWrappers(themeDir).catch(() => ({ wrappers: 0 }));
  ui.ok(`Updated${coreChanges ? ` core to ${to}` : ''}${migrations.length ? `, ran ${migrations.map((m) => m.id).join(', ')}` : ''}`);

  const isGit = await exists(path.join(themeDir, '.git'));
  return {
    message: `Updated core ${from ?? 'none'} → ${to}`,
    class: 'updated',
    ...report,
    skills: skills.wrappers,
    next: [
      isGit ? 'Review the changes: git diff' : 'Review the changed files listed above',
      'Check the theme: brmbh doctor',
      'Load the site once and check the editor for PHP errors before deploying',
    ],
  };
}

async function installedVersion(dir) {
  try {
    return JSON.parse(await fs.readFile(path.join(dir, 'package.json'), 'utf8')).version;
  } catch {
    return null;
  }
}

/** Re-run `update --skip-install` with the freshly installed CLI and pass its result through. */
async function handOver(ctx, installed, themeDir) {
  const bin = path.join(installed, 'bin', 'brmbh.js');
  const argv = [bin, 'update', '--skip-install', '--cwd', themeDir];
  if (ctx.json) {
    const res = await ctx.capture(process.execPath, [...argv, '--json'], { cwd: themeDir });
    try {
      const env = JSON.parse(res.stdout.split('\n').filter(Boolean).pop());
      if (!env.ok) throw new ToolError(env.code ?? 'error', env.error, env.detail);
      const { ok, ...rest } = env;
      return rest;
    } catch (e) {
      if (e instanceof ToolError) throw e;
      throw new ToolError('handover_failed', 'The updated @brmbh/cli did not return a result', res.stderr || res.stdout);
    }
  }
  const res = await ctx.run(process.execPath, argv, { cwd: themeDir });
  if (res.code !== 0) throw new ToolError('handover_failed', 'The updated @brmbh/cli reported an error (see above)');
  return { message: 'Update finished by the new @brmbh/cli', __handled: true };
}

export default { spec, run };
