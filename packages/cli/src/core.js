/**
 * The brmbh core: the part of a theme every site shares (ADR 008).
 *
 * It lives in a site at `inc/core/`, ships inside this package as `core/`
 * (packed from the starter's own `inc/core/` by scripts/pack-core.mjs), and
 * `brmbh update` replaces the site's copy with the shipped one. The core is
 * never personalized, so a replacement is always a clean copy, never a merge.
 */
import path from 'node:path';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { exists, readText } from './fsutil.js';

/** Where the core lives inside a theme. */
export const CORE_REL = path.join('inc', 'core');
export const CORE_MANIFEST = 'core.json';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The core this CLI ships. Running from the brmbh/wordpress repo: the starter's own
 * `inc/core/` (the one source; a packed copy could be stale). Published package:
 * `<pkg>/core`, packed by scripts/pack-core.mjs. An installed package can't see the
 * monorepo path (`node_modules/inc/core` doesn't exist), so the order is safe.
 * @returns {Promise<string|null>}
 */
export async function coreSourceDir() {
  const monorepo = path.resolve(PKG_ROOT, '..', '..', CORE_REL);
  if (await exists(path.join(monorepo, CORE_MANIFEST))) return monorepo;
  const packed = path.join(PKG_ROOT, 'core');
  if (await exists(path.join(packed, CORE_MANIFEST))) return packed;
  return null;
}

/** @returns {Promise<string|null>} the version in `<dir>/core.json`, or null */
export async function readCoreVersion(dir) {
  try {
    return JSON.parse(await readText(path.join(dir, CORE_MANIFEST))).version ?? null;
  } catch {
    return null;
  }
}

/** Relative file paths under dir (recursive, sorted). */
export async function listFiles(dir, base = dir, out = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    if (e.name === '.DS_Store') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await listFiles(full, base, out);
    else out.push(path.relative(base, full));
  }
  return out.sort();
}

/**
 * What replacing `siteCore` with `sourceCore` would change.
 * @returns {Promise<{ added: string[], changed: string[], removed: string[] }>}
 */
export async function diffCore(siteCore, sourceCore) {
  const site = new Set(await listFiles(siteCore));
  const src = await listFiles(sourceCore);
  const added = [], changed = [], removed = [];
  for (const rel of src) {
    if (!site.has(rel)) { added.push(rel); continue; }
    const [a, b] = await Promise.all([fs.readFile(path.join(siteCore, rel)), fs.readFile(path.join(sourceCore, rel))]);
    if (!a.equals(b)) changed.push(rel);
    site.delete(rel);
  }
  removed.push(...[...site].sort());
  return { added, changed, removed };
}

/** Replace `<theme>/inc/core` with a fresh copy of `sourceCore`. */
export async function writeCore(themeDir, sourceCore) {
  const dest = path.join(themeDir, CORE_REL);
  await fs.rm(dest, { recursive: true, force: true });
  await fs.mkdir(dest, { recursive: true });
  for (const rel of await listFiles(sourceCore)) {
    await fs.mkdir(path.dirname(path.join(dest, rel)), { recursive: true });
    await fs.copyFile(path.join(sourceCore, rel), path.join(dest, rel));
  }
}

/**
 * State of a theme's core against the core this CLI ships.
 * status: missing | current | edited | outdated | no_source
 */
export async function coreStatus(themeDir) {
  const source = await coreSourceDir();
  const siteCore = path.join(themeDir, CORE_REL);
  const siteVersion = await readCoreVersion(siteCore);
  if (!(await exists(path.join(siteCore, 'load.php')))) return { status: 'missing', siteVersion: null, sourceVersion: source ? await readCoreVersion(source) : null };
  if (!source) return { status: 'no_source', siteVersion, sourceVersion: null };
  const sourceVersion = await readCoreVersion(source);
  if (siteVersion !== sourceVersion) return { status: 'outdated', siteVersion, sourceVersion };
  const diff = await diffCore(siteCore, source);
  const edited = [...diff.added, ...diff.changed, ...diff.removed];
  return edited.length ? { status: 'edited', siteVersion, sourceVersion, edited } : { status: 'current', siteVersion, sourceVersion };
}

/* ------------------------------------------------------- text domain --- */

/**
 * Rewrite a text domain only where it is unambiguously a text domain.
 * Shared by `create` (personalize) and the migrations, which use it in
 * reverse to recognise starter files inside a renamed theme.
 *
 * `add_command( 'brmbh', … )` registers the WP-CLI namespace and looks exactly
 * like `load_theme_textdomain( 'brmbh', … )`, so a blunt find/replace would
 * silently rename the command namespace. These patterns are deliberately
 * narrow rather than clever.
 */
export function rewriteTextDomainIn(text, from, to) {
  const q = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text
    // trailing argument of an i18n call:  __( 'Menu', 'brmbh' )
    .replace(new RegExp(`,(\\s*)'${q}'(\\s*\\))`, 'g'), `,$1'${to}'$2`)
    .replace(new RegExp(`,(\\s*)"${q}"(\\s*\\))`, 'g'), `,$1"${to}"$2`)
    // load_theme_textdomain( 'brmbh', … ) — domain is the *first* argument
    .replace(new RegExp(`(load_theme_textdomain\\(\\s*)'${q}'`, 'g'), `$1'${to}'`)
    // block.json
    .replace(new RegExp(`("textdomain"\\s*:\\s*)"${q}"`, 'g'), `$1"${to}"`)
    // docblocks
    .replace(new RegExp(`(@package\\s+)${q}\\b`, 'g'), `$1${to}`)
    // stylesheet banner comment
    .replace(new RegExp(`^(\\s*\\*\\s*)${q}( — )`, 'gm'), `$1${to}$2`);
}

/** The theme's text domain from the `Text Domain:` header in style.css. */
export async function themeTextDomain(themeDir) {
  try {
    const m = (await readText(path.join(themeDir, 'style.css'))).match(/^Text Domain:\s*(\S+)/m);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** Fingerprint of a starter file, independent of the theme's text domain. */
export function fingerprint(text, textDomain) {
  const normal = textDomain && textDomain !== 'brmbh' ? rewriteTextDomainIn(text, textDomain, 'brmbh') : text;
  return createHash('sha256').update(normal.replace(/\r\n/g, '\n')).digest('hex');
}
