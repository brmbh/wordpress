/** Small filesystem helpers — no external deps. */
import { promises as fs } from 'node:fs';
import path from 'node:path';

export async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function isDir(p) {
  try {
    return (await fs.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

export async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

export async function readText(p) {
  return fs.readFile(p, 'utf8');
}

export async function writeText(p, content) {
  await ensureDir(path.dirname(p));
  await fs.writeFile(p, content, 'utf8');
}

/** Recursively copy a directory, skipping noise (node_modules, .git, dist). */
export async function copyDir(src, dest, { skip = ['node_modules', '.git', 'dist', '.DS_Store'] } = {}) {
  await ensureDir(dest);
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (skip.includes(entry.name)) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(from, to, { skip });
    } else if (entry.isSymbolicLink()) {
      await fs.symlink(await fs.readlink(from), to).catch(() => {});
    } else {
      await fs.copyFile(from, to);
    }
  }
}

/** Render a template string: replaces {{ KEY }} tokens. */
export function render(tpl, vars) {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) =>
    k in vars ? String(vars[k]) : `{{ ${k} }}`,
  );
}

/** Convert any human label to a kebab-case ascii slug. */
export function slugify(input) {
  return String(input)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** "hero-banner" -> "Hero Banner" */
export function titleCase(slug) {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}
