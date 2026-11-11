/**
 * `brmbh env` — the project's environments (ADR 009).
 *
 *   env list                    every environment, where it is defined, what it points at
 *   env run <name> <script>     run a tools/ script against one (db-verify, sync-plugins, version-check)
 *
 * L1: facts only. Environments are defined in brmbh.json / brmbh.local.json.
 */
import { LEVEL, ToolError } from '../tool.js';
import { findThemeDir, themeNotFoundDetail } from '../wp.js';
import { listEnvironments, CONFIG, LOCAL_CONFIG } from '../environments.js';
import { runToolWithEnv } from '../envrun.js';

const SCRIPTS = {
  'db-verify': { file: 'db-verify.sh', required: ['ssh', 'path', 'url'] },
  'sync-plugins': { file: 'sync-plugins.sh', required: ['ssh', 'path'] },
  'version-check': { file: 'version-check.sh', required: ['ssh', 'path'] },
};

export const spec = {
  description: 'List environments, or run a tool script (db-verify, sync-plugins, version-check) against one',
  level: LEVEL.L1,
  positionals: [
    { name: 'action', required: false, choices: ['list', 'run'], description: 'list (default) or run' },
    { name: 'name', required: false, description: 'run: environment name' },
    { name: 'script', required: false, choices: Object.keys(SCRIPTS), description: 'run: which tool' },
  ],
  flags: {},
};

export async function run(ctx, args) {
  const themeDir = await findThemeDir(ctx.cwd);
  if (!themeDir) throw new ToolError('no_theme', 'No brmbh theme found here.', await themeNotFoundDetail(ctx.cwd));

  if ((args.action ?? 'list') === 'list') {
    const { names, legacy, config } = await listEnvironments(themeDir);
    const environments = names.map((name) => {
      const e = config.environments[name];
      return e
        ? { name, source: 'config', ssh: e.ssh ?? null, path: e.path ?? null, url: e.url ?? null, canonical: e.canonical ?? 'remote' }
        : { name, source: 'legacy', note: `tools/env/${name}.env — \`brmbh update\` moves it into ${LOCAL_CONFIG}` };
    });
    if (!ctx.json) {
      ctx.ui.banner('brmbh env', `${environments.length} environment(s)`);
      if (!environments.length) ctx.ui.info(`None yet. Add them to ${CONFIG} (or ${LOCAL_CONFIG} to keep hosts out of git).`);
      for (const e of environments) {
        ctx.ui.item(e.source === 'config' ? `${e.name.padEnd(12)} ${e.url ?? '(no url)'}  ${e.ssh ? `${e.ssh}:` : ''}${e.path ?? ''}  canonical=${e.canonical}` : `${e.name.padEnd(12)} ${e.note}`);
      }
      ctx.ui.raw('');
    }
    return { message: `${environments.length} environment(s)`, environments, legacy, __handled: true };
  }

  if (!args.name || !args.script) throw new ToolError('bad_input', 'Usage: brmbh env run <name> <script>', `Scripts: ${Object.keys(SCRIPTS).join(', ')}`);
  const s = SCRIPTS[args.script];
  ctx.ui.step(`${args.script} → ${args.name}`);
  const res = await runToolWithEnv(ctx, themeDir, args.name, s.file, [], { required: s.required });
  if (res.code !== 0) throw new ToolError('script_failed', `${s.file} exited with code ${res.code}`);
  return { message: `${args.script} (${res.env}) finished`, env: res.env, script: args.script };
}

export default { spec, run };
