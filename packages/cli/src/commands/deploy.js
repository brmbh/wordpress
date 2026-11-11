/**
 * `brmbh deploy <env>` — ship a commit of the theme to an environment (ADR 009).
 *
 *   1. the theme must be a clean git tree: what is deployed is a commit
 *   2. build (npm run build), unless --skip-build
 *   3. stage tracked files + build output (deploy.include) minus dev files, plus
 *      brmbh-deploy.json (commit, env, time) as the record of what is live
 *   4. rsync the stage to <path>/wp-content/themes/<theme>/ — a dry run unless --apply
 *   5. after --apply: flush the object cache, then verify by content: the live
 *      brmbh-deploy.json must carry this commit
 *
 * Runs the same on a laptop and in CI; credentials come from the machine
 * (SSH config, agent, CI secret), never from brmbh.json.
 * L2: class is would_deploy | up_to_date | deployed | verify_failed.
 */
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LEVEL, ToolError } from '../tool.js';
import { exists } from '../fsutil.js';
import { findThemeDir, themeNotFoundDetail } from '../wp.js';
import { loadConfig } from '../environments.js';
import { resolveForScript } from '../envrun.js';

const CLI_VERSION = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json'), 'utf8')).version;

export const STAMP = 'brmbh-deploy.json';

/** Never shipped: development files, agent wrappers, local config. */
const DEV_FILES = [
  '.git', '.github', '.gitignore', 'node_modules', 'vendor', 'tools', 'assets/src', '.DS_Store', '.claude', '.cursor',
  '.windsurf', '.vscode', '.debug-screenshots', '.tack', '.brmbh', 'package.json', 'package-lock.json',
  'webpack.config.js', '.brmbh-config.json', '.brmbh-config.example.json', 'plugins.txt', 'brmbh.json', 'brmbh.local.json',
  'AGENTS.md', 'CLAUDE.md', // instructions for coding agents, not for the web server
];

export const spec = {
  description: 'Deploy a commit of the theme to an environment: dry run unless --apply, then verify the live site',
  level: LEVEL.L2,
  positionals: [{ name: 'env', required: true, description: 'Environment name from brmbh.json (e.g. staging, production)' }],
  flags: {
    apply: { type: 'boolean', default: false, description: 'Send the files (default: dry run, nothing is sent)' },
    'skip-build': { type: 'boolean', default: false, description: 'Deploy the build output as it is' },
    'allow-dirty': { type: 'boolean', default: false, description: 'Deploy uncommitted changes (recorded as dirty)' },
  },
};

export async function run(ctx, args) {
  const { ui } = ctx;
  const themeDir = await findThemeDir(ctx.cwd);
  if (!themeDir) throw new ToolError('no_theme', 'No brmbh theme found here.', await themeNotFoundDetail(ctx.cwd));

  const { resolved } = await resolveForScript(themeDir, args.env, ['path']);
  const { env } = resolved;
  const theme = env.theme ?? path.basename(themeDir);
  const target = `${env.path.replace(/\/$/, '')}/wp-content/themes/${theme}/`;
  const dest = env.ssh ? `${env.ssh}:${target}` : target;
  ui.banner(`brmbh deploy → ${resolved.name}`, dest);

  // 1. a commit, not a working tree
  const git = (a) => ctx.capture('git', ['-C', themeDir, ...a]);
  const head = await git(['rev-parse', 'HEAD']);
  if (!head.ok) throw new ToolError('not_git', 'The theme is not a git repository with a commit', 'Deploys ship a commit: `git init && git add -A && git commit`.');
  const commit = head.stdout;
  const dirtyOut = (await git(['status', '--porcelain', '--untracked-files=no', '--', '.'])).stdout;
  const dirty = dirtyOut.length > 0;
  if (dirty && !args['allow-dirty']) {
    throw new ToolError('dirty_tree', 'Uncommitted changes in the theme', `Commit them first (deploys ship a commit), or pass --allow-dirty.\n${dirtyOut}`);
  }

  // 2. build
  const cfg = await loadConfig(themeDir);
  const deployCfg = cfg.deploy ?? {};
  if (!args['skip-build'] && (await hasBuildScript(themeDir))) {
    ui.step('Building (npm run build)');
    const build = await ctx.run('npm', ['run', 'build'], { cwd: themeDir });
    if (build.code !== 0) throw new ToolError('build_failed', 'npm run build failed', 'Fix the build, or deploy the existing output with --skip-build.');
  }

  // 3. stage
  const stage = await fs.mkdtemp(path.join(os.tmpdir(), 'brmbh-deploy-'));
  try {
    const exclude = [...DEV_FILES, ...(deployCfg.exclude ?? [])];
    const include = deployCfg.include ?? ['assets/dist'];
    const tracked = (await git(['ls-files', '-z', '--', '.'])).stdout.split('\0').filter(Boolean);
    let files = 0;
    for (const rel of tracked) {
      if (isExcluded(rel, exclude)) continue;
      const src = path.join(themeDir, rel);
      if (!(await exists(src))) continue; // deleted in the tree, not yet committed (only with --allow-dirty)
      await fs.mkdir(path.dirname(path.join(stage, rel)), { recursive: true });
      await fs.copyFile(src, path.join(stage, rel));
      files++;
    }
    for (const rel of include) {
      const src = path.join(themeDir, rel);
      if (await exists(src)) {
        await fs.cp(src, path.join(stage, rel), { recursive: true });
      } else {
        ui.warn(`deploy.include: ${rel} does not exist (not built?)`);
      }
    }
    const stamp = { commit, dirty, env: resolved.name, theme, deployedAt: new Date().toISOString(), cli: CLI_VERSION };
    await fs.writeFile(path.join(stage, STAMP), JSON.stringify(stamp, null, 2) + '\n');
    ui.ok(`Staged commit ${commit.slice(0, 7)}${dirty ? ' + uncommitted changes' : ''}: ${files} tracked files + ${include.join(', ')}`);

    // 4. rsync: always a dry run first, for the report
    const rsyncArgs = ['-rlcz', '--delete', '--itemize-changes', `${stage}/`, dest];
    const plan = await ctx.capture('rsync', ['-n', ...rsyncArgs]);
    if (!plan.ok) throw new ToolError('rsync_failed', 'rsync dry run failed', plan.stderr || plan.stdout);
    const changes = parseItemize(plan.stdout);
    const total = changes.new.length + changes.changed.length + changes.deleted.length;
    if (!ctx.json) {
      ui.info(`new ${changes.new.length} · changed ${changes.changed.length} · deleted ${changes.deleted.length}`);
      for (const f of changes.new.slice(0, 20)) ui.item(`+ ${f}`);
      for (const f of changes.changed.slice(0, 20)) ui.item(`~ ${f}`);
      for (const f of changes.deleted.slice(0, 20)) ui.item(`- ${f}`);
    }
    const report = { env: resolved.name, dest, commit, dirty, changes: cap(changes) };

    if (!args.apply) {
      return { message: total ? `Dry run — ${total} file(s) would change; re-run with --apply` : 'Dry run — the target already has this commit', class: total ? 'would_deploy' : 'up_to_date', ...report };
    }

    // 5. send, flush, verify
    ui.step('Sending');
    const sent = await ctx.capture('rsync', rsyncArgs);
    if (!sent.ok) throw new ToolError('rsync_failed', 'rsync failed', sent.stderr || sent.stdout);
    if (env.ssh) await ctx.capture('ssh', [env.ssh, `cd ${shq(env.path)} && wp cache flush 2>/dev/null || true`]);

    const verify = await verifyLive(env.url, theme, commit);
    if (verify.status === 'ok') ui.ok(`Live: ${env.url} serves commit ${commit.slice(0, 7)}`);
    else if (verify.status === 'skipped') ui.info(`Not verified: ${verify.note}`);
    else ui.warn(`Verify failed: ${verify.note}`);

    return {
      message: verify.status === 'failed' ? `Sent to ${resolved.name}, but the live check failed` : `Deployed ${commit.slice(0, 7)} to ${resolved.name}`,
      class: verify.status === 'failed' ? 'verify_failed' : 'deployed',
      ...report,
      verify,
    };
  } finally {
    await fs.rm(stage, { recursive: true, force: true });
  }
}

async function hasBuildScript(themeDir) {
  try {
    return Boolean(JSON.parse(await fs.readFile(path.join(themeDir, 'package.json'), 'utf8')).scripts?.build);
  } catch {
    return false;
  }
}

/** Excluded when the path is, or lies inside, an excluded entry; or its file name is one. */
export function isExcluded(rel, exclude) {
  const norm = rel.split(path.sep).join('/');
  return exclude.some((e) => norm === e || norm.startsWith(`${e}/`) || path.posix.basename(norm) === e);
}

/** rsync --itemize-changes → { new, changed, deleted } file lists (directories and the stamp left out). */
export function parseItemize(out) {
  const res = { new: [], changed: [], deleted: [] };
  for (const line of out.split('\n')) {
    if (line.startsWith('*deleting')) {
      const f = line.slice(9).trim();
      if (!f.endsWith('/')) res.deleted.push(f);
      continue;
    }
    // flag field: 9 chars on rsync ≥3, 7 on the 2.6.9 macOS still ships
    const m = line.match(/^([<>ch.])f(\S{7,11})\s+(.+)$/);
    if (!m || m[3] === STAMP) continue;
    (m[2].startsWith('+++') ? res.new : res.changed).push(m[3]);
  }
  return res;
}

function cap(c, n = 100) {
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.length > n ? [...v.slice(0, n), `… ${v.length - n} more`] : v]));
}

function shq(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

/** The live stamp must carry the commit just sent. */
export async function verifyLive(url, theme, commit) {
  if (!url) return { status: 'skipped', note: 'no url for this environment' };
  const stampUrl = `${url.replace(/\/$/, '')}/wp-content/themes/${theme}/${STAMP}?t=${Date.now()}`;
  try {
    const res = await fetch(stampUrl, { headers: { 'cache-control': 'no-cache' }, redirect: 'follow', signal: AbortSignal.timeout(15000) });
    if (res.status === 401 || res.status === 403) return { status: 'skipped', note: `${stampUrl} answers ${res.status} (protected site)`, url: stampUrl };
    if (!res.ok) return { status: 'failed', note: `${stampUrl} answers ${res.status}`, url: stampUrl };
    const live = await res.json().catch(() => null);
    if (live?.commit !== commit) return { status: 'failed', note: `live stamp has ${live?.commit?.slice(0, 7) ?? 'no commit'}, expected ${commit.slice(0, 7)}`, url: stampUrl };
    const home = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    const body = await home.text();
    if (home.status >= 500 || /<b>Fatal error<\/b>|There has been a critical error/i.test(body)) {
      return { status: 'failed', note: `${url} answers ${home.status}${home.status < 500 ? ' with a PHP fatal error' : ''}`, url: stampUrl };
    }
    return { status: 'ok', note: `stamp ${commit.slice(0, 7)}, home ${home.status}`, url: stampUrl };
  } catch (e) {
    return { status: 'failed', note: `could not fetch ${stampUrl}: ${e.message}`, url: stampUrl };
  }
}

export default { spec, run };
