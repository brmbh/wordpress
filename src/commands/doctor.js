/**
 * `brmbh doctor` — environment health check.
 *
 * L2 classification: returns a single `class` (ready | warn | blocked) plus the
 * individual checks, so an agent can branch deterministically instead of
 * re-deriving health from raw output.
 */
import path from 'node:path';
import { LEVEL } from '../tool.js';
import { exists } from '../fsutil.js';
import { paint } from '../ui.js';
import { findThemeDir, acfStatus, hasWpCli } from '../wp.js';

export const spec = {
  description: 'Check that the theme + environment are correctly wired',
  level: LEVEL.L2,
  positionals: [],
  flags: {},
};

export async function run(ctx, args) {
  const { ui } = ctx;
  const checks = [];
  const add = (name, status, note) => checks.push({ name, status, note }); // status: ok|warn|fail

  // node
  const major = Number(process.versions.node.split('.')[0]);
  add('node', major >= 18 ? 'ok' : 'fail', `v${process.versions.node}`);

  // theme
  const themeDir = await findThemeDir(ctx.cwd);
  add('theme', themeDir ? 'ok' : 'fail', themeDir ? path.basename(themeDir) : 'no brmbh theme found');

  if (themeDir) {
    add('dependencies', (await exists(path.join(themeDir, 'node_modules'))) ? 'ok' : 'warn', 'node_modules');
    const built = await exists(path.join(themeDir, 'assets', 'dist', 'css', 'style.css'));
    add('build', built ? 'ok' : 'warn', built ? 'assets/dist present' : 'run `brmbh dev --once`');
    add('skills', (await exists(path.join(themeDir, 'AGENTS'))) ? 'ok' : 'warn', 'AGENTS/');
    add('env', (await exists(path.join(themeDir, 'tools', 'env'))) ? 'ok' : 'warn', 'tools/env/*.env');
  }

  // wp-cli + acf
  const wpcli = await hasWpCli();
  add('wp-cli', wpcli ? 'ok' : 'warn', wpcli ? 'available' : 'not found (optional but recommended)');
  const acf = await acfStatus(ctx.cwd);
  add('scf', acf === 'active' ? 'ok' : acf === 'unknown' ? 'warn' : 'fail',
    acf === 'active' ? 'active' : acf === 'installed' ? 'installed, not active' : acf === 'unknown' ? (wpcli ? 'cannot verify (run from the WP install)' : 'cannot verify (no wp-cli)') : 'missing — install free from wordpress.org/plugins/secure-custom-fields');

  const hasFail = checks.some((c) => c.status === 'fail');
  const hasWarn = checks.some((c) => c.status === 'warn');
  const klass = hasFail ? 'blocked' : hasWarn ? 'warn' : 'ready';

  if (!ctx.json) {
    ui.banner('brmbh doctor', themeDir ? path.basename(themeDir) : 'no theme detected');
    const sym = { ok: paint.green('✓'), warn: paint.yellow('!'), fail: paint.red('✗') };
    for (const c of checks) {
      ui.raw(`  ${sym[c.status]} ${c.name.padEnd(14)} ${paint.dim(c.note ?? '')}`);
    }
    ui.raw('');
    const verdict = klass === 'blocked' ? paint.red(klass) : klass === 'warn' ? paint.yellow(klass) : paint.green(klass);
    ui.raw(`  Environment: ${paint.bold(verdict)}`);
    ui.raw('');
  }

  return {
    message: `Environment: ${klass}`,
    class: klass, // L2 branch field
    checks,
    __handled: true, // doctor prints its own verdict in pretty mode
  };
}

export default { spec, run };
