/**
 * The core + `brmbh update` (ADR 008), end to end through the real CLI binary.
 * Fixtures are scaffolded into a temp dir from this repo (now) and from git
 * `origin/main` before the core existed (pre-core site).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { promises as fs, existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { coreStatus, coreSourceDir, readCoreVersion } from '../src/core.js';

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(PKG, '..', '..');
const BIN = path.join(PKG, 'bin', 'brmbh.js');
const PRE_CORE_REF = process.env.BRMBH_PRE_CORE_REF || '7fc96f2'; // main before inc/core/ existed
const MEGAHERZ = path.join(os.homedir(), 'Local Sites/alfasigma/app/public/wp-content/themes/brmbh-megaherz');

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'brmbh-core-'));
process.on('exit', () => { try { execFileSync('rm', ['-r', tmp]); } catch {} });

function cli(args, cwd) {
  const out = execFileSync(process.execPath, [BIN, ...args, '--json'], { cwd, encoding: 'utf8' });
  return JSON.parse(out.trim().split('\n').pop());
}

/** Scaffold a site named `name` from a checkout, without npm. */
async function scaffold(name, from) {
  const env = cli(['create', name, '--from', from, '--skip-install', '--skip-activate'], tmp);
  assert.equal(env.ok, true, JSON.stringify(env));
  const dir = path.join(tmp, name);
  // create strips package-lock + workspaces; a site needs a package.json and my-acf-blocks/ to be found
  assert.ok(existsSync(path.join(dir, 'package.json')));
  return dir;
}

/** The starter as it was before the core: `git archive` of PRE_CORE_REF. */
let preCore;
async function preCoreCheckout() {
  if (preCore) return preCore;
  const dir = path.join(tmp, 'pre-core-src');
  const tar = path.join(tmp, 'pre-core.tar');
  await fs.mkdir(dir, { recursive: true });
  execFileSync('git', ['-C', REPO, 'archive', '-o', tar, PRE_CORE_REF]);
  execFileSync('tar', ['-x', '-f', tar, '-C', dir]);
  return (preCore = dir);
}

test('core.json version equals the package version', async () => {
  const pkg = JSON.parse(readFileSync(path.join(PKG, 'package.json'), 'utf8'));
  assert.equal(await readCoreVersion(path.join(REPO, 'inc', 'core')), pkg.version);
  assert.ok(await coreSourceDir(), 'the CLI must find a core to ship');
});

test('a fresh scaffold keeps inc/core/ byte-identical (never personalized)', async () => {
  const site = await scaffold('acme', REPO);
  assert.match(readFileSync(path.join(site, 'style.css'), 'utf8'), /^Text Domain: acme$/m);
  for (const f of ['load.php', 'blocks.php', 'cli.php', 'dependencies.php', 'core.json']) {
    assert.equal(
      readFileSync(path.join(site, 'inc/core', f), 'utf8'),
      readFileSync(path.join(REPO, 'inc/core', f), 'utf8'),
      `inc/core/${f} was rewritten`,
    );
  }
  assert.equal((await coreStatus(site)).status, 'current');
  const env = cli(['update', '--skip-install'], site);
  assert.equal(env.class, 'up_to_date', JSON.stringify(env));
});

test('a hand edit in inc/core/ is reported, and update restores the core', async () => {
  const site = await scaffold('edited', REPO);
  await fs.appendFile(path.join(site, 'inc/core/blocks.php'), '\n// local hack\n');
  const status = await coreStatus(site);
  assert.equal(status.status, 'edited');
  assert.deepEqual(status.edited, ['blocks.php']);

  const dry = cli(['update', '--skip-install', '--dry-run'], site);
  assert.equal(dry.class, 'would_update');
  assert.match(readFileSync(path.join(site, 'inc/core/blocks.php'), 'utf8'), /local hack/, 'dry run wrote');

  const env = cli(['update', '--skip-install'], site);
  assert.equal(env.class, 'updated');
  assert.deepEqual(env.core.changed, ['blocks.php']);
  assert.equal((await coreStatus(site)).status, 'current');
});

test('a pre-core site is migrated: old files gone, functions.php loads the core', async () => {
  const site = await scaffold('oldsite', await preCoreCheckout());
  assert.ok(existsSync(path.join(site, 'inc/dependencies.php')), 'fixture should be pre-core');
  assert.equal((await coreStatus(site)).status, 'missing');

  const env = cli(['update', '--skip-install'], site);
  assert.equal(env.class, 'updated', JSON.stringify(env));
  assert.deepEqual(env.migrations.map((m) => m.id), ['core-adopt']);
  for (const old of ['inc/dependencies.php', 'inc/cli.php', 'my-acf-blocks/loader.php']) {
    assert.ok(!existsSync(path.join(site, old)), `${old} should be removed`);
  }
  const fn = readFileSync(path.join(site, 'functions.php'), 'utf8');
  assert.match(fn, /require BRMBH_DIR \. '\/inc\/core\/load\.php';/);
  assert.doesNotMatch(fn, /inc\/dependencies\.php|my-acf-blocks\/loader\.php|inc\/cli\.php/);
  // the core loads before the site's own includes
  assert.ok(fn.indexOf('/inc/core/load.php') < fn.indexOf('/inc/template-functions.php'));
  assert.equal((await coreStatus(site)).status, 'current');
  phpLint(path.join(site, 'functions.php'));

  // second run: nothing left to do
  assert.equal(cli(['update', '--skip-install'], site).class, 'up_to_date');
});

test('an edited pre-core file blocks the update and nothing is written', async () => {
  const site = await scaffold('custom', await preCoreCheckout());
  await fs.appendFile(path.join(site, 'inc/cli.php'), '\n// my own command\n');
  const before = readFileSync(path.join(site, 'functions.php'), 'utf8');

  const env = cli(['update', '--skip-install'], site);
  assert.equal(env.class, 'blocked');
  assert.deepEqual(env.blocked.map((b) => b.file), ['inc/cli.php']);
  assert.match(env.blocked[0].fix, /WP-CLI commands/);
  assert.equal(readFileSync(path.join(site, 'functions.php'), 'utf8'), before, 'functions.php changed');
  assert.ok(existsSync(path.join(site, 'inc/dependencies.php')), 'unedited file was removed despite the block');
  assert.ok(!existsSync(path.join(site, 'inc/core')), 'core was written despite the block');
});

test('the first delivered site (copy): blocked only on its own WP-CLI commands', { skip: !existsSync(MEGAHERZ) && 'no Megaherz checkout on this machine' }, async () => {
  const site = path.join(tmp, 'megaherz-copy');
  await fs.cp(MEGAHERZ, site, { recursive: true, filter: (p) => !/\/(node_modules|\.git|\.tack)(\/|$)/.test(p) });
  const env = cli(['update', '--skip-install', '--dry-run'], site);
  assert.equal(env.class, 'blocked', JSON.stringify(env));
  assert.deepEqual(env.blocked.map((b) => b.file), ['inc/cli.php']);
});

function phpLint(file) {
  try {
    execFileSync('php', ['-l', file], { encoding: 'utf8' });
  } catch (e) {
    if (e.code === 'ENOENT') return; // no php on this machine
    throw new Error(e.stdout || e.message);
  }
}
