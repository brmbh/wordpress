/**
 * `brmbh db <action> <env>` — database migration between environments.
 * Wraps the theme's tools/db-pull.sh / db-push.sh.
 *
 *   db pull <env>   pull remote DB → local
 *   db push <env>   push local DB → remote  (guarded by the script itself)
 */
import path from 'node:path';
import { LEVEL, ToolError } from '../tool.js';
import { exists } from '../fsutil.js';
import { findThemeDir } from '../wp.js';

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
  if (!themeDir) throw new ToolError('no_theme', 'No brmbh theme found here.');

  const script = path.join(themeDir, 'tools', `db-${args.action}.sh`);
  if (!(await exists(script))) {
    throw new ToolError(
      'no_db_tooling',
      `No tools/db-${args.action}.sh in this theme.`,
      'The DB suite ships separately — add tools/db-*.sh + tools/env/*.env, then retry.',
    );
  }

  ctx.ui.step(`db ${args.action} ← ${args.env}`);
  const { code } = await ctx.run('bash', [script, args.env], { cwd: themeDir });
  if (code !== 0) throw new ToolError('db_failed', `db-${args.action}.sh exited with code ${code}`);

  return { message: `Database ${args.action} (${args.env}) complete`, class: 'synced', action: args.action, env: args.env };
}

export default { spec, run };
