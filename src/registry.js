/**
 * Resolve and materialize the brmbh theme source into a target directory.
 *
 * Two sources:
 *   - local copy   (--from <path>) — copies an existing checkout (offline, fast)
 *   - git clone    (default)       — shallow-clones the public OSS repo
 */
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { copyDir, exists, isDir } from './fsutil.js';
import { runOrThrow, has } from './exec.js';

export const THEME_REPO = 'https://github.com/Schmandarine/brmbh-agentic-wp-suite.git';

/**
 * @param {object} opts
 * @param {string} opts.dest        absolute destination dir (created)
 * @param {string} [opts.from]      local source checkout to copy instead of cloning
 * @param {string} [opts.ref]       git ref/branch/tag (default: repo default)
 * @param {object} opts.ctx         command context (ui, json)
 */
export async function materializeTheme({ dest, from, ref, ctx }) {
  const { ui } = ctx;

  if (from) {
    const src = path.resolve(from);
    if (!(await isDir(src))) {
      const e = new Error(`--from path is not a directory: ${src}`);
      e.code = 'bad_input';
      throw e;
    }
    ui.step(`Copying theme from ${src}`);
    await copyDir(src, dest);
    return { source: 'local', from: src };
  }

  if (!(await has('git'))) {
    const e = new Error('git is required to download the theme (or pass --from <local-checkout>)');
    e.code = 'missing_dependency';
    throw e;
  }

  ui.step(`Cloning ${THEME_REPO}${ref ? ` (${ref})` : ''}`);
  const args = ['clone', '--depth', '1'];
  if (ref) args.push('--branch', ref);
  args.push(THEME_REPO, dest);
  await runOrThrow('git', args, { cwd: path.dirname(dest), json: ctx.json });

  // Drop the upstream git history — the new project starts clean.
  const gitDir = path.join(dest, '.git');
  if (await exists(gitDir)) await fs.rm(gitDir, { recursive: true, force: true });

  return { source: 'git', repo: THEME_REPO, ref: ref ?? 'default' };
}
