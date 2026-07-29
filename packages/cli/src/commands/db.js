/**
 * `brmbh db <action> <env>` — database migration between environments.
 * Wraps the theme's tools/db-pull.sh / db-push.sh.
 *
 *   db pull <env>   pull remote DB → local
 *   db push <env>   push local DB → remote  (guarded by the script itself)
 *
 * The scripts don't take the environment as an argument — they read it from
 * already-`export`ed shell vars (see tools/env/*.env.example), meant to be
 * `source`d first. The CLI composes that exact same `source && run` command
 * rather than reimplementing env-file parsing in JS.
 */
import path from 'node:path';
import { LEVEL, ToolError } from '../tool.js';
import { findThemeDir, themeNotFoundDetail } from '../wp.js';
import { envFilePath, envFileName, sourceAndRun } from '../envfile.js';
import { resolveToolScript } from '../toolscript.js';

export const spec = {
  description: 'Pull or push the database between environments (wraps tools/db-*.sh)',
  level: LEVEL.L2,
  positionals: [
    { name: 'action', required: true, choices: ['pull', 'push'], description: 'Direction' },
    { name: 'env', required: true, choices: ['staging', 'prod'], description: 'Remote environment' },
  ],
  flags: {},
};

export async function run(ctx, args) {
  const themeDir = await findThemeDir(ctx.cwd);
  if (!themeDir) throw new ToolError('no_theme', 'No brmbh theme found here.', await themeNotFoundDetail(ctx.cwd));

  const resolved = await resolveToolScript(themeDir, `db-${args.action}.sh`);
  if (!resolved) {
    throw new ToolError(
      'no_db_tooling',
      `db-${args.action}.sh could not be located.`,
      'It ships in @brmbh/cli — run `npm install` in the theme, or add your own tools/ override.',
    );
  }
  const script = resolved.path;

  const envFile = await envFilePath(themeDir, args.env);
  if (!envFile) {
    throw new ToolError(
      'no_env_file',
      `No tools/env/${envFileName(args.env)} in this theme.`,
      `Copy tools/env/${envFileName(args.env)}.example to ${envFileName(args.env)} and fill in your values, then retry.`,
    );
  }

  ctx.ui.step(`db ${args.action} ← ${args.env}`);
  const cmd = sourceAndRun(envFile, script);
  const { code } = await ctx.run('bash', ['-c', cmd], { cwd: themeDir });
  if (code !== 0) throw new ToolError('db_failed', `db-${args.action}.sh exited with code ${code}`);

  return { message: `Database ${args.action} (${args.env}) complete`, class: 'synced', action: args.action, env: args.env };
}

export default { spec, run };
