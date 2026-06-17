/**
 * `brmbh deploy <env>` — wraps the theme's deploy tooling (tools/deploy.sh).
 *
 * The CLI is a thin, predictable front for the existing rsync/CI scripts. If the
 * deploy suite isn't present (it ships separately), the command explains rather
 * than fails silently.
 */
import path from 'node:path';
import { LEVEL, ToolError } from '../tool.js';
import { exists } from '../fsutil.js';
import { findThemeDir } from '../wp.js';

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

  const script = path.join(themeDir, 'tools', 'deploy.sh');
  if (!(await exists(script))) {
    throw new ToolError(
      'no_deploy_suite',
      'No tools/deploy.sh in this theme.',
      'The deployment suite ships separately — add tools/deploy.sh + tools/env/*.env, then retry.',
    );
  }

  ctx.ui.step(`Deploying → ${args.env}`);
  const scriptArgs = [args.env];
  if (args['dry-run']) scriptArgs.push('--dry-run');
  const { code } = await ctx.run('bash', [script, ...scriptArgs], { cwd: themeDir });

  const klass = code === 0 ? 'deployed' : 'failed';
  if (code !== 0) throw new ToolError('deploy_failed', `deploy.sh exited with code ${code}`);
  return { message: `Deployed to ${args.env}`, class: klass, env: args.env };
}

export default { spec, run };
