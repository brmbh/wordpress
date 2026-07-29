/**
 * WordPress / theme environment detection. Best-effort and non-fatal:
 * the CLI must degrade gracefully when wp-cli or a WP install isn't present.
 */
import path from 'node:path';
import { exists, isDir, readText } from './fsutil.js';
import { capture, has } from './exec.js';

const ACF_PRO_PLUGINS = ['advanced-custom-fields-pro', 'secure-custom-fields'];

/**
 * Walk up from `start` to find a WordPress root (has wp-load.php) and/or the
 * wp-content/themes directory.
 */
export async function findWpRoot(start) {
  let dir = path.resolve(start);
  for (let i = 0; i < 8; i++) {
    if (await exists(path.join(dir, 'wp-load.php'))) return dir;
    if (await isDir(path.join(dir, 'wp-content', 'themes'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** Detect the themes dir relative to a wp root, or null. */
export async function themesDir(wpRoot) {
  if (!wpRoot) return null;
  const d = path.join(wpRoot, 'wp-content', 'themes');
  return (await isDir(d)) ? d : null;
}

/** Heuristically decide whether `dir` is a brmbh theme. */
export async function isBrmbhTheme(dir) {
  // Primary signal: the ACF block factory directory — unique to brmbh themes
  if (!(await isDir(path.join(dir, 'my-acf-blocks')))) return false;
  // Secondary signal: must also have a package.json (built theme, not just any dir with that folder name)
  return exists(path.join(dir, 'package.json'));
}

/**
 * Find the brmbh theme dir starting from cwd: the cwd itself, or scan
 * wp-content/themes/* for a brmbh theme.
 */
export async function findThemeDir(cwd) {
  if (await isBrmbhTheme(cwd)) return cwd;
  const wpRoot = await findWpRoot(cwd);
  const themes = await themesDir(wpRoot);
  if (!themes) return null;
  const { promises: fs } = await import('node:fs');
  const entries = await fs.readdir(themes, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    if (e.isDirectory() && (await isBrmbhTheme(path.join(themes, e.name)))) {
      return path.join(themes, e.name);
    }
  }
  return null;
}

export async function hasWpCli() {
  return has('wp');
}

/**
 * Check SCF (Secure Custom Fields) or ACF Pro via wp-cli when available.
 * @returns {Promise<'active'|'installed'|'missing'|'unknown'>}
 */
export async function acfStatus(cwd) {
  if (!(await hasWpCli())) return 'unknown';
  const list = await capture('wp', ['plugin', 'list', '--field=name', '--status=active'], { cwd });
  if (list.ok) {
    const active = list.stdout.split('\n').map((s) => s.trim());
    if (ACF_PRO_PLUGINS.some((p) => active.includes(p))) return 'active';
  }
  const all = await capture('wp', ['plugin', 'list', '--field=name'], { cwd });
  if (all.ok) {
    const installed = all.stdout.split('\n').map((s) => s.trim());
    if (ACF_PRO_PLUGINS.some((p) => installed.includes(p))) return 'installed';
  }
  return list.ok || all.ok ? 'missing' : 'unknown';
}

/** Activate a theme by directory name via wp-cli. Returns boolean success. */
export async function activateTheme(wpRoot, themeSlug) {
  if (!(await hasWpCli())) return false;
  const { ok } = await capture('wp', ['theme', 'activate', themeSlug], { cwd: wpRoot });
  return ok;
}
