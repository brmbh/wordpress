/**
 * `brmbh db <action> <env>` — database sync between this machine and an environment.
 * Wraps tools/db-pull.sh / db-push.sh with the environment from brmbh.json (ADR 009).
 *
 *   db pull <env>   remote DB → local   (local DB is backed up to .brmbh/backups/ first)
 *   db push <env>   local DB → remote   (blocked unless the environment is `canonical: "local"`;
 *                                        remote DB is backed up to ~/.brmbh-backups/ first)
 *
 * Code flows up, content flows down: `canonical` says which side holds the real content.
 */
import { LEVEL, ToolError } from '../tool.js';
import { findThemeDir, themeNotFoundDetail } from '../wp.js';
import { runToolWithEnv } from '../envrun.js';

export const spec = {
  description: 'Pull or push the database between this machine and an environment (target is backed up first)',
  level: LEVEL.L2,
  positionals: [
    { name: 'action', required: true, choices: ['pull', 'push'], description: 'Direction' },
    { name: 'env', required: true, description: 'Environment name from brmbh.json (e.g. staging, production)' },
  ],
  flags: {
    yes: { type: 'boolean', default: false, description: 'push: confirm overwriting the remote DB without a prompt (agents, CI)' },
  },
};

export async function run(ctx, args) {
  const themeDir = await findThemeDir(ctx.cwd);
  if (!themeDir) throw new ToolError('no_theme', 'No brmbh theme found here.', await themeNotFoundDetail(ctx.cwd));

  if (args.action === 'push' && ctx.json && !args.yes) {
    throw new ToolError('confirm_required', 'db push overwrites the remote database', 'Ask the user, then re-run with --yes.');
  }

  ctx.ui.step(`db ${args.action} ${args.action === 'pull' ? '←' : '→'} ${args.env}`);
  const res = await runToolWithEnv(ctx, themeDir, args.env, `db-${args.action}.sh`, [], {
    required: ['ssh', 'path', 'url'],
    localRequired: ['url'],
    extraEnv: args.yes ? { SKIP_CONFIRM: '1' } : {},
  });
  if (res.code !== 0) throw new ToolError('db_failed', `db-${args.action}.sh exited with code ${res.code}`);
  return { message: `Database ${args.action} (${res.env}) complete`, class: 'synced', action: args.action, env: res.env };
}

export default { spec, run };
