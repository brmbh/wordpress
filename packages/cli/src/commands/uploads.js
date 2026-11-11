/**
 * `brmbh uploads <action> <env>` — sync wp-content/uploads between this machine and an environment.
 * Wraps tools/uploads-pull.sh / uploads-push.sh with the environment from brmbh.json (ADR 009).
 *
 *   uploads pull <env>   remote → local (additive by default; --delete mirrors)
 *   uploads push <env>   local → remote (mirror; blocked unless the environment is `canonical: "local"`)
 */
import { LEVEL, ToolError } from '../tool.js';
import { findThemeDir, themeNotFoundDetail } from '../wp.js';
import { runToolWithEnv } from '../envrun.js';

export const spec = {
  description: 'Pull or push wp-content/uploads between this machine and an environment',
  level: LEVEL.L2,
  positionals: [
    { name: 'action', required: true, choices: ['pull', 'push'], description: 'Direction' },
    { name: 'env', required: true, description: 'Environment name from brmbh.json (e.g. staging, production)' },
  ],
  flags: {
    delete: { type: 'boolean', default: false, description: 'pull only: mirror remote exactly (deletes local-only files)' },
    yes: { type: 'boolean', default: false, description: 'push: confirm mirroring onto the remote without a prompt (agents, CI)' },
  },
};

export async function run(ctx, args) {
  const themeDir = await findThemeDir(ctx.cwd);
  if (!themeDir) throw new ToolError('no_theme', 'No brmbh theme found here.', await themeNotFoundDetail(ctx.cwd));

  if (args.action === 'push' && ctx.json && !args.yes) {
    throw new ToolError('confirm_required', 'uploads push mirrors local uploads onto the remote (deletes remote-only files)', 'Ask the user, then re-run with --yes.');
  }
  ctx.ui.step(`uploads ${args.action} ${args.action === 'pull' ? '←' : '→'} ${args.env}`);
  const scriptArgs = args.action === 'pull' && args.delete ? ['--delete'] : [];
  const res = await runToolWithEnv(ctx, themeDir, args.env, `uploads-${args.action}.sh`, scriptArgs, {
    required: ['ssh', 'path'],
    extraEnv: args.yes ? { SKIP_CONFIRM: '1' } : {},
  });
  if (res.code !== 0) throw new ToolError('uploads_failed', `uploads-${args.action}.sh exited with code ${res.code}`);

  return { message: `Uploads ${args.action} (${res.env}) complete`, class: 'synced', action: args.action, env: res.env };
}

export default { spec, run };
