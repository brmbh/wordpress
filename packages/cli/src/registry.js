/**
 * Resolve and materialize the brmbh theme source into a target directory.
 *
 * Two sources:
 *   - local copy   (--from <path>) — copies an existing checkout (offline, fast)
 *   - git clone    (default)       — shallow-clones the public OSS repo
 */
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { copyDir, exists, isDir } from './fsutil.js';
import { runOrThrow, has, capture } from './exec.js';

export const THEME_REPO = 'https://github.com/brmbh/wordpress.git';

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

  // Clone into a temp dir, then copy across. git refuses to clone into a
  // non-empty directory, which made --force silently useless on this path
  // while it worked fine via --from. Staging makes both paths behave alike.
  const staging = await fs.mkdtemp(path.join(os.tmpdir(), 'brmbh-'));
  const checkout = path.join(staging, 'theme');
  try {
    const args = ['clone', '--depth', '1'];
    if (ref) args.push('--branch', ref);
    args.push(THEME_REPO, checkout);
    await runOrThrow('git', args, { cwd: staging, json: ctx.json });

    // Record where this scaffold came from before dropping the history.
    let commit = null;
    const head = await capture('git', ['rev-parse', 'HEAD'], { cwd: checkout });
    if (head.ok) commit = head.stdout.trim();

    // The new project starts clean — no upstream history.
    await fs.rm(path.join(checkout, '.git'), { recursive: true, force: true });

    await copyDir(checkout, dest);
    return { source: 'git', repo: THEME_REPO, ref: ref ?? 'default', commit };
  } finally {
    await fs.rm(staging, { recursive: true, force: true }).catch(() => {});
  }
}
