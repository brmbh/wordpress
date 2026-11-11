/**
 * db / uploads sync scripts, through the real CLI, against a fake server:
 * `ssh` runs the remote command locally (in a folder standing in for the server),
 * `wp` answers the few calls the scripts make and logs every call.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { promises as fs, existsSync, readFileSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(PKG, '..', '..');
const BIN = path.join(PKG, 'bin', 'brmbh.js');

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'brmbh-sync-'));
process.on('exit', () => { try { execFileSync('rm', ['-r', tmp]); } catch {} });

const fake = path.join(tmp, 'bin');
const log = path.join(tmp, 'wp.log');
const remoteHome = path.join(tmp, 'server-home');
const remoteWp = path.join(tmp, "srv/my site's wp"); // a space and a quote: paths must be quoted on the server
const localWp = path.join(tmp, 'local-wp');

await fs.mkdir(fake, { recursive: true });
await fs.mkdir(remoteHome, { recursive: true });
await fs.mkdir(path.join(remoteWp, 'wp-content/uploads'), { recursive: true });
await fs.mkdir(path.join(localWp, 'wp-content/uploads'), { recursive: true });

// ssh <opts> <host> <command…> → run the command here, as "the server"
await fs.writeFile(path.join(fake, 'ssh'), `#!/usr/bin/env bash
while [[ "$1" == -* ]]; do case "$1" in -l|-p|-i|-o|-e) shift 2;; *) shift;; esac; done
shift
export HOME="${remoteHome}" FAKE_SIDE=remote
cd "$HOME"
exec bash -c "$*"
`, { mode: 0o755 });

// wp: logs "<side> <args>", answers plugin lists per side, fails installs of a premium plugin
await fs.writeFile(path.join(fake, 'wp'), `#!/usr/bin/env bash
side="\${FAKE_SIDE:-local}"
echo "$side $*" >> "${log}"
case "$1 $2" in
  "db check") exit 0 ;;
  "option get") echo "https://$side.example" ;;
  "db export")
    if [[ "$3" == "-" ]]; then echo "-- dump from $side"; else echo "-- dump from $side" > "$3"; fi ;;
  "db import") [[ "$3" == "-" ]] && cat > /dev/null; [[ "$3" != "-" && ! -s "$3" ]] && exit 1; exit 0 ;;
  "plugin list")
    if [[ "$side" == remote ]]; then printf 'name,version\\nakismet,5.3\\npremium,2.0\\nsame,1.0\\n'
    else printf 'name,version\\nakismet,5.0\\npremium,1.0\\nsame,1.0\\n'; fi ;;
  "plugin install") [[ "$3" == premium ]] && exit 1; exit 0 ;;
  "eval "*) echo "$PWD/wp-content" ;;
  "search-replace "*) echo "Success: Made 3 replacements." ;;
  *) exit 0 ;;
esac
`, { mode: 0o755 });

const env = { ...process.env, PATH: `${fake}:${process.env.PATH}` };
function cli(args, cwd) {
  try {
    const out = execFileSync(process.execPath, [BIN, ...args, '--json'], { cwd, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] });
    return JSON.parse(out.trim().split('\n').pop());
  } catch (e) {
    return JSON.parse(String(e.stdout).trim().split('\n').pop());
  }
}
const calls = () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : []);

async function site(name, local) {
  const res = cli(['create', name, '--from', REPO, '--skip-install', '--skip-activate'], tmp);
  assert.equal(res.ok, true, JSON.stringify(res));
  const dir = path.join(tmp, name);
  await fs.writeFile(path.join(dir, 'brmbh.local.json'), JSON.stringify({
    environments: { staging: { ssh: 'deploy@server', path: remoteWp, url: 'https://remote.example', canonical: 'local' } },
    local: { wpPath: localWp, wpCli: path.join(fake, 'wp'), ...local },
  }));
  return dir;
}

test('db pull refuses without local.url instead of guessing one', async () => {
  const dir = await site('nourl', {});
  const res = cli(['db', 'pull', 'staging'], dir);
  assert.equal(res.code, 'incomplete_environment', JSON.stringify(res));
  assert.match(res.error ?? res.message, /local\.url/);
});

test('db pull: backup first, then import, then plugins at the server\'s exact versions', async () => {
  const dir = await site('pull', { url: 'https://pull.local' });
  await fs.rm(log, { force: true });
  const res = cli(['db', 'pull', 'staging'], dir);
  assert.equal(res.class, 'synced', JSON.stringify(res));

  const backups = readdirSync(path.join(dir, '.brmbh/backups'));
  assert.equal(backups.length, 1);
  assert.match(backups[0], /^local-before-staging-.*\.sql\.gz$/);

  const c = calls();
  const at = (re) => c.findIndex((l) => re.test(l));
  assert.ok(at(/^local db export .*backups/) < at(/^local db import -/), 'backup must come before the import');
  assert.ok(c.some((l) => l.startsWith('local search-replace https://remote.example https://pull.local')));
  assert.ok(c.some((l) => /^local plugin install akismet --version=5\.3 --force/.test(l)), 'akismet must go to the server\'s 5.3');
  assert.ok(c.some((l) => /^local plugin install premium --version=2\.0/.test(l)));
  assert.ok(!c.some((l) => /plugin install same/.test(l)), 'a plugin already at the server\'s version is left alone');
  assert.ok(!c.some((l) => /plugin update/.test(l)), 'never update plugins past the server\'s versions');
});

test('db push: remote backup, a quoted path with a space and a quote, and no temp file left', async () => {
  const dir = await site('push', { url: 'https://push.local' });
  await fs.rm(log, { force: true });
  assert.equal(cli(['db', 'push', 'staging'], dir).code, 'confirm_required');
  const res = cli(['db', 'push', 'staging', '--yes'], dir);
  assert.equal(res.class, 'synced', JSON.stringify(res));

  const backups = readdirSync(path.join(remoteHome, '.brmbh-backups')).filter((f) => f.startsWith('staging-before-push-'));
  assert.equal(backups.length, 1);
  const c = calls();
  assert.ok(c.some((l) => /^remote db import \/tmp\/brmbh-import-\w+/.test(l)), 'import from a unique temp file');
  const tmpFile = c.find((l) => /^remote db import/.test(l)).split(' ')[3];
  assert.ok(!existsSync(tmpFile), 'temp dump removed on the server');
  assert.ok(c.some((l) => l.startsWith('remote search-replace https://push.local https://remote.example')));
});

test('uploads push: dry-run counts, then replaced and deleted files land in a backup on the server', async () => {
  const dir = await site('up', { url: 'https://up.local' });
  const lu = path.join(localWp, 'wp-content/uploads');
  const ru = path.join(remoteWp, 'wp-content/uploads');
  await fs.writeFile(path.join(lu, 'new.jpg'), 'new');
  await fs.writeFile(path.join(lu, 'same.jpg'), 'v2 local');
  await fs.writeFile(path.join(ru, 'same.jpg'), 'v1');
  await fs.writeFile(path.join(ru, 'only-on-server.jpg'), 'client upload');

  assert.equal(cli(['uploads', 'push', 'staging'], dir).code, 'confirm_required');
  const res = cli(['uploads', 'push', 'staging', '--yes'], dir);
  assert.equal(res.class, 'synced', JSON.stringify(res));

  assert.equal(readFileSync(path.join(ru, 'same.jpg'), 'utf8'), 'v2 local');
  assert.ok(existsSync(path.join(ru, 'new.jpg')));
  assert.ok(!existsSync(path.join(ru, 'only-on-server.jpg')));
  const [bk] = readdirSync(path.join(remoteHome, '.brmbh-backups')).filter((f) => f.startsWith('uploads-staging-before-push-'));
  assert.ok(bk, 'backup folder on the server');
  assert.equal(readFileSync(path.join(remoteHome, '.brmbh-backups', bk, 'only-on-server.jpg'), 'utf8'), 'client upload');
  assert.equal(readFileSync(path.join(remoteHome, '.brmbh-backups', bk, 'same.jpg'), 'utf8'), 'v1');
});

test('deploy over ssh reaches a server path with a space and a quote', async () => {
  const dir = await site('shipit', {});
  await fs.writeFile(path.join(dir, 'brmbh.local.json'), JSON.stringify({ environments: { staging: { ssh: 'deploy@server', path: remoteWp } } }));
  const git = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: dir });
  git('init', '-q'); git('add', '-A'); git('commit', '-qm', 'site');
  await fs.mkdir(path.join(remoteWp, 'wp-content/themes'), { recursive: true });
  const res = execFileSync(process.execPath, [BIN, 'deploy', 'staging', '--skip-build', '--apply', '--json'], { cwd: dir, encoding: 'utf8', env });
  const out = JSON.parse(res.trim().split('\n').pop());
  assert.equal(out.class, 'deployed', JSON.stringify(out));
  assert.ok(existsSync(path.join(remoteWp, 'wp-content/themes/shipit/functions.php')));
  assert.ok(existsSync(path.join(remoteWp, 'wp-content/themes/shipit/brmbh-deploy.json')));
});

test('uploads pull: additive, and --exclude skips a folder for this run', async () => {
  const dir = await site('down', {});
  const lu = path.join(localWp, 'wp-content/uploads');
  const ru = path.join(remoteWp, 'wp-content/uploads');
  await fs.mkdir(path.join(ru, 'videos'), { recursive: true });
  await fs.writeFile(path.join(ru, 'videos/big.mp4'), 'video');
  await fs.writeFile(path.join(ru, 'photo.jpg'), 'photo');
  await fs.writeFile(path.join(lu, 'local-only.jpg'), 'mine');

  const res = cli(['uploads', 'pull', 'staging', '--exclude=videos'], dir);
  assert.equal(res.class, 'synced', JSON.stringify(res));
  assert.ok(existsSync(path.join(lu, 'photo.jpg')));
  assert.ok(!existsSync(path.join(lu, 'videos/big.mp4')), 'excluded folder not pulled');
  assert.ok(existsSync(path.join(lu, 'local-only.jpg')), 'pull never deletes local files without --delete');
});
