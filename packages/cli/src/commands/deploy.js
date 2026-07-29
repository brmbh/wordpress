/**
 * `brmbh deploy <env>` — wraps the theme's deploy tooling (tools/deploy.sh).
 *
 * The CLI is a thin, predictable front for the existing rsync/CI scripts. If the
 * deploy suite isn't present (it ships separately), the command explains rather
 * than fails silently.
 *
 * deploy.sh doesn't take the environment as an argument — it reads already-
 * `export`ed shell vars (see tools/env/*.env.example), meant to be `source`d
 * first. The CLI composes that exact same `source && run` command rather
 * than reimplementing env-file parsing in JS.
 */
import path from 'node:path';
import { LEVEL, ToolError } from '../tool.js';
import { findThemeDir } from '../wp.js';
import { envFilePath, envFileName, sourceAndRun } from '../envfile.js';
import { resolveToolScript } from '../toolscript.js';

export const spec = {
  description: "Deploy the theme to an environment (wraps tools/deploy.sh)",
  level: LEVEL.L2,
  positionals: [{ name: 'env', required: true, choices: ['staging', 'prod'], description: 'Target environment' }],
  flags: {
    'dry-run': { type: 'boolean', default: false, description: 'Pass through as a dry run if the script supports it' },
  },
};

export async function run(ctx, args) {
  const themeDir = await findThemeDir(ctx.cwd);
  if (!themeDir) throw new ToolError('no_theme', 'No brmbh theme found here.');

  const resolved = await resolveToolScript(themeDir, 'deploy.sh');
  if (!resolved) {
    throw new ToolError(
      'no_deploy_suite',
      'deploy.sh could not be located.',
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

  ctx.ui.step(`Deploying → ${args.env}`);
  const scriptArgs = args['dry-run'] ? ['--dry-run'] : [];
  const cmd = sourceAndRun(envFile, script, scriptArgs);
  const { code } = await ctx.run('bash', ['-c', cmd], { cwd: themeDir });

  const klass = code === 0 ? 'deployed' : 'failed';
  if (code !== 0) throw new ToolError('deploy_failed', `deploy.sh exited with code ${code}`);
  return { message: `Deployed to ${args.env}`, class: klass, env: args.env };
}

export default { spec, run };
