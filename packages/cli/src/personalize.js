/**
 * Turn the starter into a client project.
 *
 * The rules live in the theme's `brmbh.template.json`, not here — the theme
 * can change its own identity without waiting for a CLI release, and an older
 * CLI keeps working against a newer theme.
 *
 * What is rewritten is the project's *identity*: the theme name a client sees
 * in WP Admin, and the text domain that groups its translatable strings. What
 * is left alone is framework plumbing — the `wp brmbh` command namespace, the
 * `BRMBH_*` constants, the `brmbh_` function prefix, the `@brmbh/cli`
 * dependency. Only one theme is active at a time, so those cannot collide.
 */
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { exists, readText, writeText, titleCase } from './fsutil.js';

const MANIFEST = 'brmbh.template.json';

/** Files we walk when rewriting the text domain. */
const CODE_EXT = new Set(['.php', '.json', '.scss', '.css']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'packages', 'vendor']);

export async function readTemplateManifest(themeDir) {
  const p = path.join(themeDir, MANIFEST);
  if (!(await exists(p))) return null;
  try {
    return JSON.parse(await readText(p));
  } catch {
    return null;
  }
}

/**
 * @param {string} themeDir  scaffolded theme (already materialized)
 * @param {string} slug      new theme slug, e.g. "acme-site"
 * @param {object} manifest  parsed brmbh.template.json
 * @returns {Promise<{ files: number, replacements: number, themeName: string, textDomain: string }>}
 */
export async function personalizeTheme(themeDir, slug, manifest) {
  const from = manifest?.identifier;
  if (!from) return { files: 0, replacements: 0, themeName: '', textDomain: '' };
  const themeName = titleCase(slug);

  let files = 0;
  let replacements = 0;
  const bump = (n) => { if (n) { files++; replacements += n; } };

  bump(await rewriteStyleHeader(themeDir, from, slug, themeName, manifest));
  bump(await rewritePackageJson(themeDir, slug));
  for (const file of await walk(themeDir)) {
    bump(await rewriteTextDomain(file, from, slug));
  }

  return { files, replacements, themeName, textDomain: slug };
}

/* ------------------------------------------------------------------ bits --- */

async function walk(dir, out = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, out);
    else if (CODE_EXT.has(path.extname(e.name))) out.push(full);
  }
  return out;
}

/**
 * Replace the text domain only where it is unambiguously a text domain.
 *
 * `add_command( 'brmbh', … )` registers the WP-CLI namespace and looks exactly
 * like `load_theme_textdomain( 'brmbh', … )`, so a blunt find/replace would
 * silently rename the command namespace. These patterns are deliberately
 * narrow rather than clever.
 */
async function rewriteTextDomain(file, from, to) {
  const before = await readText(file);
  const q = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let after = before
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

  if (after === before) return 0;
  const n = countDiff(before, after, from);
  await writeText(file, after);
  return n;
}

function countDiff(before, after, needle) {
  const c = (s) => (s.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  return Math.max(1, c(before) - c(after));
}

async function rewriteStyleHeader(themeDir, from, slug, themeName, manifest) {
  const file = path.join(themeDir, manifest?.rewrite?.styleHeader || 'style.css');
  if (!(await exists(file))) return 0;
  let s = await readText(file);
  const orig = s;
  s = s
    .replace(/^Theme Name:.*$/m, `Theme Name: ${themeName}`)
    .replace(/^Text Domain:.*$/m, `Text Domain: ${slug}`)
    .replace(/^Version:.*$/m, 'Version: 0.1.0')
    .replace(/^Theme URI:.*\n/m, '')
    .replace(/^Description:.*$/m, `Description: ${themeName} — built on the brmbh agentic WordPress suite.`);
  if (s === orig) return 0;
  await writeText(file, s);
  return 1;
}

async function rewritePackageJson(themeDir, slug) {
  const file = path.join(themeDir, 'package.json');
  if (!(await exists(file))) return 0;
  try {
    const pkg = JSON.parse(await readText(file));
    pkg.name = slug;
    pkg.version = '0.1.0';
    pkg.description = `${titleCase(slug)} — WordPress theme built on the brmbh agentic suite.`;
    pkg.private = true; // a client theme is not an npm package
    delete pkg.repository;
    delete pkg.homepage;
    await writeText(file, JSON.stringify(pkg, null, 2) + '\n');
    return 1;
  } catch {
    return 0;
  }
}
