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
 * Find the brmbh theme dir for a given cwd.
 *
 * Order matters — an install can hold several brmbh-derived themes, and
 * silently reporting on the wrong one is worse than finding none:
 *   1. cwd is itself a brmbh theme          unambiguous
 *   2. a brmbh theme at or above cwd        you are working inside it
 *   3. the *active* theme (via wp-cli)      what WordPress is actually serving
 *   4. sole brmbh theme in wp-content/themes
 *   5. several candidates, none active      → null, caller must disambiguate
 */
export async function findThemeDir(cwd) {
  if (await isBrmbhTheme(cwd)) return cwd;

  // walk up: `brmbh dev` from a subdirectory of the theme should still work
  let dir = path.resolve(cwd);
  for (let i = 0; i < 8; i++) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
    if (await isBrmbhTheme(dir)) return dir;
  }

  const wpRoot = await findWpRoot(cwd);
  const themes = await themesDir(wpRoot);
  if (!themes) return null;

  const { promises: fs } = await import('node:fs');
  const entries = await fs.readdir(themes, { withFileTypes: true }).catch(() => []);
  const candidates = [];
  for (const e of entries) {
    if (e.isDirectory() && (await isBrmbhTheme(path.join(themes, e.name)))) candidates.push(e.name);
  }
  if (!candidates.length) return null;
  if (candidates.length === 1) return path.join(themes, candidates[0]);

  // several — let WordPress break the tie
  const active = await activeThemeSlug(wpRoot);
  if (active && candidates.includes(active)) return path.join(themes, active);
  return null;
}

/** The active theme's directory name, or null when wp-cli can't tell us. */
export async function activeThemeSlug(wpRoot) {
  if (!wpRoot || !(await hasWpCli())) return null;
  const { ok, stdout } = await capture('wp', ['option', 'get', 'stylesheet'], { cwd: wpRoot });
  return ok && stdout ? stdout.trim() : null;
}

/** All brmbh themes under a WP root — for disambiguating error messages. */
export async function listBrmbhThemes(cwd) {
  const themes = await themesDir(await findWpRoot(cwd));
  if (!themes) return [];
  const { promises: fs } = await import('node:fs');
  const entries = await fs.readdir(themes, { withFileTypes: true }).catch(() => []);
  const found = [];
  for (const e of entries) {
    if (e.isDirectory() && (await isBrmbhTheme(path.join(themes, e.name)))) found.push(e.name);
  }
  return found;
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

/**
 * Human-readable reason `findThemeDir` came back empty. Distinguishes "none
 * here" from "several, and WordPress couldn't tell me which" — the latter is
 * the case that used to silently pick an arbitrary one.
 */
export async function themeNotFoundDetail(cwd) {
  const found = await listBrmbhThemes(cwd);
  if (found.length > 1) {
    return `Found ${found.length} brmbh themes (${found.join(', ')}) and none is active. ` +
      'cd into the one you mean, or pass --cwd <path-to-theme>.';
  }
  return 'Run from inside a brmbh theme, or scaffold one with `npx @brmbh/cli create <name>`.';
}
