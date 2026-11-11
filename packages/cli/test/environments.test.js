/**
 * Environments + deploy (ADR 009), through the real CLI binary.
 * Deploys go to a local folder (no ssh) served by a local HTTP server, so the
 * whole path runs here: commit check, staging, dry run, apply, live verify.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs, existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, parseEnvFile, resolveEnvironment, toScriptEnv } from '../src/environments.js';
import { parseItemize, isExcluded } from '../src/commands/deploy.js';

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(PKG, '..', '..');
const BIN = path.join(PKG, 'bin', 'brmbh.js');

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'brmbh-env-'));
process.on('exit', () => { try { execFileSync('rm', ['-r', tmp]); } catch {} });

function cli(args, cwd) {
  const out = execFileSync(process.execPath, [BIN, ...args, '--json'], { cwd, encoding: 'utf8' });
  return JSON.parse(out.trim().split('\n').pop());
}
/** Async: needed while this process also serves HTTP for the live check. */
async function cliAsync(args, cwd) {
  const { stdout } = await promisify(execFile)(process.execPath, [BIN, ...args, '--json'], { cwd, encoding: 'utf8' });
  return JSON.parse(stdout.trim().split('\n').pop());
}
const git = (cwd, ...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd, encoding: 'utf8' });

async function site(name) {
  const env = cli(['create', name, '--from', REPO, '--skip-install', '--skip-activate'], tmp);
  assert.equal(env.ok, true, JSON.stringify(env));
  const dir = path.join(tmp, name);
  // a built asset, as `npm run build` would leave it (gitignored)
  await fs.mkdir(path.join(dir, 'assets/dist/css'), { recursive: true });
  await fs.writeFile(path.join(dir, 'assets/dist/css/style.css'), 'body{}');
  git(dir, 'init', '-q');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'site');
  return dir;
}

test('brmbh.local.json overrides brmbh.json per key; legacy env files parse without running', async () => {
  const dir = path.join(tmp, 'cfg');
  await fs.mkdir(path.join(dir, 'tools/env'), { recursive: true });
  await fs.writeFile(path.join(dir, 'brmbh.json'), JSON.stringify({ environments: { staging: { ssh: 'a@b', path: '/p', url: 'https://s' } }, local: { wpCli: 'wp' } }));
  await fs.writeFile(path.join(dir, 'brmbh.local.json'), JSON.stringify({ environments: { staging: { ssh: 'me@private' } }, local: { wpCli: 'localwp' } }));
  await fs.writeFile(path.join(dir, 'tools/env/production.env'), 'export SSH_TARGET="deploy@prod"   # host\nexport REMOTE_WP_PATH=/var/www\nexport CANONICAL_ENV="remote"\n$(touch /tmp/never)\n');

  const cfg = await loadConfig(dir);
  assert.deepEqual(cfg.environments.staging, { ssh: 'me@private', path: '/p', url: 'https://s' });
  assert.equal(cfg.local.wpCli, 'localwp');

  const prod = await resolveEnvironment(dir, 'prod'); // old CLI spelling still finds production.env
  assert.equal(prod.source, 'legacy');
  assert.deepEqual(prod.env, { ssh: 'deploy@prod', path: '/var/www', canonical: 'remote' });
  assert.equal(parseEnvFile('$(touch /x)\n').SSH_TARGET, undefined);

  const vars = toScriptEnv(await resolveEnvironment(dir, 'staging'), dir, '/wp');
  assert.equal(vars.SSH_TARGET, 'me@private');
  assert.equal(vars.CANONICAL_ENV, 'remote', 'unset canonical must default to remote (push blocked)');
  assert.equal(vars.LOCAL_WP_PATH, '/wp');
  assert.equal(vars.BRMBH_THEME_DIR, dir);

  await assert.rejects(resolveEnvironment(dir, 'nope'), /No environment "nope"/);
});

test('deploy: refuses a dirty tree, dry run sends nothing, apply ships the commit and verifies it live', async () => {
  const dir = await site('shop');
  const web = path.join(tmp, 'webroot');
  await fs.mkdir(path.join(web, 'wp-content/themes'), { recursive: true });
  const server = http.createServer(async (req, res) => {
    const file = path.join(web, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    try {
      const body = await fs.readFile(file.endsWith('/') ? path.join(file, 'index.html') : file);
      res.writeHead(200).end(body);
    } catch {
      res.writeHead(404).end('nope');
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  await fs.writeFile(path.join(web, 'index.html'), '<html>ok</html>');
  const url = `http://127.0.0.1:${server.address().port}`;
  await fs.writeFile(path.join(dir, 'brmbh.json'), JSON.stringify({ environments: { live: { path: web, url } }, deploy: { include: ['assets/dist'] } }));
  git(dir, 'commit', '-qam', 'environments');
  const commit = git(dir, 'rev-parse', 'HEAD').trim();

  try {
    await fs.appendFile(path.join(dir, 'functions.php'), '\n// wip\n');
    assert.equal(cli(['deploy', 'live', '--skip-build'], dir).code, 'dirty_tree');
    git(dir, 'checkout', '--', 'functions.php');

    const dry = cli(['deploy', 'live', '--skip-build'], dir);
    assert.equal(dry.class, 'would_deploy', JSON.stringify(dry));
    assert.ok(dry.changes.new.includes('functions.php'));
    assert.ok(dry.changes.new.includes('inc/core/load.php'));
    assert.ok(dry.changes.new.includes('assets/dist/css/style.css'), 'build output must ship');
    assert.ok(!dry.changes.new.some((f) => f.startsWith('assets/src/') || ['package.json', 'brmbh.json', 'AGENTS.md', 'CLAUDE.md'].includes(f)), 'dev files must not ship');
    assert.ok(!existsSync(path.join(web, 'wp-content/themes/shop')), 'dry run wrote');

    const live = await cliAsync(['deploy', 'live', '--skip-build', '--apply'], dir);
    assert.equal(live.class, 'deployed', JSON.stringify(live));
    assert.equal(live.verify.status, 'ok');
    const stamp = JSON.parse(readFileSync(path.join(web, 'wp-content/themes/shop/brmbh-deploy.json'), 'utf8'));
    assert.equal(stamp.commit, commit);
    assert.equal(stamp.env, 'live');

    assert.equal(cli(['deploy', 'live', '--skip-build'], dir).class, 'up_to_date');

    // a file removed in a commit is removed on the target too
    git(dir, 'rm', '-q', 'my-acf-blocks/example-hero/_style.scss');
    git(dir, 'commit', '-qm', 'drop');
    const again = await cliAsync(['deploy', 'live', '--skip-build', '--apply'], dir);
    assert.deepEqual(again.changes.deleted, ['my-acf-blocks/example-hero/_style.scss']);
  } finally {
    server.close();
  }
});

test('db push needs --yes from an agent; unknown environments name what exists', async () => {
  const dir = await site('guard');
  await fs.writeFile(path.join(dir, 'brmbh.local.json'), JSON.stringify({ environments: { staging: { ssh: 'x@y', path: '/p', url: 'https://s' } } }));
  assert.equal(cli(['db', 'push', 'staging'], dir).code, 'confirm_required');
  const missing = cli(['db', 'pull', 'nope'], dir);
  assert.equal(missing.code, 'no_environment');
  assert.match(missing.detail, /staging/);
  const list = cli(['env'], dir);
  assert.deepEqual(list.environments.map((e) => e.name), ['staging']);
});

test('brmbh update moves tools/env/*.env into brmbh.local.json and gitignores it', async () => {
  const dir = await site('legacy');
  await fs.mkdir(path.join(dir, 'tools/env'), { recursive: true });
  await fs.writeFile(path.join(dir, 'tools/env/staging.env'), 'export SSH_TARGET="deploy@stage"\nexport REMOTE_WP_PATH="/srv/wp"\nexport REMOTE_URL="https://stage.example"\nexport CANONICAL_ENV="local"\nexport LOCAL_URL="http://site.local"\nexport LOCAL_WP_CLI="localwp"\n');
  await fs.writeFile(path.join(dir, '.gitignore'), 'node_modules/\n');

  const doc = cli(['doctor'], dir);
  assert.equal(doc.checks.find((c) => c.name === 'environments').status, 'warn');

  const env = cli(['update', '--skip-install'], dir);
  assert.equal(env.class, 'updated', JSON.stringify(env));
  assert.ok(env.migrations.some((m) => m.id === 'env-config'));
  const local = JSON.parse(readFileSync(path.join(dir, 'brmbh.local.json'), 'utf8'));
  assert.deepEqual(local.environments.staging, { ssh: 'deploy@stage', path: '/srv/wp', url: 'https://stage.example', canonical: 'local' });
  assert.deepEqual(local.local, { url: 'http://site.local', wpCli: 'localwp' });
  assert.ok(!existsSync(path.join(dir, 'tools/env/staging.env')));
  const gi = readFileSync(path.join(dir, '.gitignore'), 'utf8');
  assert.match(gi, /^brmbh\.local\.json$/m);
  assert.match(gi, /^\.brmbh\/$/m);
  assert.equal(cli(['env'], dir).environments[0].source, 'config');
});

test('add ci github writes a workflow that runs the same deploy command', async () => {
  const dir = await site('ci');
  const env = cli(['add', 'ci', 'github'], dir);
  assert.equal(env.file, '.github/workflows/deploy.yml');
  const yml = readFileSync(path.join(dir, '.github/workflows/deploy.yml'), 'utf8');
  assert.match(yml, /npx brmbh deploy "\$TARGET_ENV" --apply/);
  assert.match(yml, /workflow_dispatch/);
  assert.equal(cli(['add', 'ci', 'github'], dir).code, 'exists');
});

test('deploy helpers: rsync itemize parsing and exclusion', () => {
  const out = '>f+++++++++ functions.php\n>f.st...... style.css\ncd+++++++++ inc/\n*deleting   old.php\n*deleting   gone/\n>f+++++++++ brmbh-deploy.json\n';
  assert.deepEqual(parseItemize(out), { new: ['functions.php'], changed: ['style.css'], deleted: ['old.php'] });
  // rsync 2.6.9 (macOS): 7-char flags
  assert.deepEqual(parseItemize('>f+++++++ a.txt\n>f.st.... b.txt\n'), { new: ['a.txt'], changed: ['b.txt'], deleted: [] });
  assert.ok(isExcluded('assets/src/js/a.js', ['assets/src']));
  assert.ok(isExcluded('package.json', ['package.json']));
  assert.ok(!isExcluded('assets/srcset.php', ['assets/src']));
});
