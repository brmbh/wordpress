/**
 * `brmbh dev` — run the theme's asset pipeline.
 *   default     → watch (rebuild CSS + JS on change)
 *   --once      → single build, then exit
 */
import path from 'node:path';
import { LEVEL, ToolError } from '../tool.js';
import { exists } from '../fsutil.js';
import { findThemeDir, themeNotFoundDetail } from '../wp.js';

export const spec = {
  description: "Build or watch the theme's CSS + JS",
  level: LEVEL.L1,
  positionals: [],
  flags: {
    once: { type: 'boolean', default: false, description: 'Build once instead of watching' },
  },
};

export async function run(ctx, args) {
  const themeDir = await findThemeDir(ctx.cwd);
  if (!themeDir) throw new ToolError('no_theme', 'No brmbh theme found here.', await themeNotFoundDetail(ctx.cwd));
  if (!(await exists(path.join(themeDir, 'package.json')))) {
    throw new ToolError('no_package', 'Theme has no package.json — nothing to build.');
  }

  const script = args.once ? 'build' : 'watch';
  ctx.ui.step(`npm run ${script}  (${path.relative(ctx.cwd, themeDir) || '.'})`);
  const { code } = await ctx.run('npm', ['run', script], { cwd: themeDir });
  if (code !== 0) throw new ToolError('build_failed', `npm run ${script} exited with code ${code}`);

  return { message: args.once ? 'Build complete' : 'Watcher exited', script, themeDir };
}

export default { spec, run };
