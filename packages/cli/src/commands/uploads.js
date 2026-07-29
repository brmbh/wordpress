/**
 * `brmbh uploads <action> <env>` — sync wp-content/uploads between environments.
 * Wraps the theme's tools/uploads-pull.sh / uploads-push.sh.
 *
 *   uploads pull <env>   remote → local (additive by default)
 *   uploads push <env>   local → remote (mirror, guarded by the script itself)
 *
 * Same approach as db.js/deploy.js: the scripts read already-`export`ed
 * shell vars, meant to be `source`d first. The CLI composes that exact same
 * `source && run` command rather than reimplementing env-file parsing in JS.
 */
import path from 'node:path';
import { LEVEL, ToolError } from '../tool.js';
import { findThemeDir, themeNotFoundDetail } from '../wp.js';
import { envFilePath, envFileName, sourceAndRun } from '../envfile.js';
import { resolveToolScript } from '../toolscript.js';

export const spec = {
  description: 'Pull or push wp-content/uploads between environments (wraps tools/uploads-*.sh)',
  level: LEVEL.L2,
  positionals: [
    { name: 'action', required: true, choices: ['pull', 'push'], description: 'Direction' },
    { name: 'env', required: true, choices: ['staging', 'prod'], description: 'Remote environment' },
  ],
  flags: {
    delete: { type: 'boolean', default: false, description: 'pull only: mirror remote exactly (deletes local-only files)' },
  },
};

export async function run(ctx, args) {
  const themeDir = await findThemeDir(ctx.cwd);
  if (!themeDir) throw new ToolError('no_theme', 'No brmbh theme found here.', await themeNotFoundDetail(ctx.cwd));

  const resolved = await resolveToolScript(themeDir, `uploads-${args.action}.sh`);
  if (!resolved) {
    throw new ToolError(
      'no_uploads_tooling',
      `uploads-${args.action}.sh could not be located.`,
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

  ctx.ui.step(`uploads ${args.action} ← ${args.env}`);
  const scriptArgs = args.action === 'pull' && args.delete ? ['--delete'] : [];
  const cmd = sourceAndRun(envFile, script, scriptArgs);
  const { code } = await ctx.run('bash', ['-c', cmd], { cwd: themeDir });
  if (code !== 0) throw new ToolError('uploads_failed', `uploads-${args.action}.sh exited with code ${code}`);

  return { message: `Uploads ${args.action} (${args.env}) complete`, class: 'synced', action: args.action, env: args.env };
}

export default { spec, run };
