/**
 * `brmbh uploads <action> <env>` — sync wp-content/uploads between this machine and an environment.
 * Wraps tools/uploads-pull.sh / uploads-push.sh with the environment from brmbh.json (ADR 009).
 *
 *   uploads pull <env>   remote → local (additive by default; --delete mirrors)
 *   uploads push <env>   local → remote (mirror; blocked unless the environment is `canonical: "local"`;
 *                        --dry-run lists the changes; replaced/deleted files go to ~/.brmbh-backups/ on the server)
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
    exclude: { type: 'string', description: 'comma-separated folders to skip this run (e.g. videos); standing ones go in the environment\'s excludes' },
    'dry-run': { type: 'boolean', default: false, description: 'push: list what would be new, replaced and deleted on the server; send nothing' },
    yes: { type: 'boolean', default: false, description: 'push: confirm mirroring onto the remote without a prompt (agents, CI)' },
  },
};

export async function run(ctx, args) {
  const themeDir = await findThemeDir(ctx.cwd);
  if (!themeDir) throw new ToolError('no_theme', 'No brmbh theme found here.', await themeNotFoundDetail(ctx.cwd));

  const dry = args.action === 'push' && args['dry-run'];
  if (args.action === 'push' && ctx.json && !args.yes && !dry) {
    throw new ToolError('confirm_required', 'uploads push mirrors local uploads onto the remote (deletes remote-only files)',
      'Run with --dry-run to see what would change, ask the user, then re-run with --yes. Replaced and deleted files are kept in ~/.brmbh-backups/ on the server.');
  }
  ctx.ui.step(`uploads ${args.action} ${args.action === 'pull' ? '←' : '→'} ${args.env}`);
  const scriptArgs = [];
  if (args.action === 'pull' && args.delete) scriptArgs.push('--delete');
  if (dry) scriptArgs.push('--dry-run');
  for (const p of String(args.exclude ?? '').split(',').map((s) => s.trim()).filter(Boolean)) scriptArgs.push(`--exclude=${p}`);

  const res = await runToolWithEnv(ctx, themeDir, args.env, `uploads-${args.action}.sh`, scriptArgs, {
    required: ['ssh', 'path'],
    extraEnv: args.yes ? { SKIP_CONFIRM: '1' } : {},
  });
  if (res.code !== 0) throw new ToolError('uploads_failed', `uploads-${args.action}.sh exited with code ${res.code}`);

  if (dry) return { message: `Uploads push (${res.env}) dry run — nothing sent`, class: 'dry_run', action: args.action, env: res.env };
  return { message: `Uploads ${args.action} (${res.env}) complete`, class: 'synced', action: args.action, env: res.env };
}

export default { spec, run };
