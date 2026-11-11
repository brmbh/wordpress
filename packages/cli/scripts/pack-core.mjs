#!/usr/bin/env node
/**
 * prepack: copy the starter theme's inc/core/ into this package as core/ (ADR 008).
 * The theme's inc/core/ is the one source; the package carries a copy so
 * `brmbh update` can install it into sites. Refuses when versions disagree.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.resolve(pkgDir, '..', '..', 'inc', 'core');
const dest = path.join(pkgDir, 'core');

const pkg = JSON.parse(await fs.readFile(path.join(pkgDir, 'package.json'), 'utf8'));
const core = JSON.parse(await fs.readFile(path.join(src, 'core.json'), 'utf8'));
if (core.version !== pkg.version) {
  console.error(`inc/core/core.json is ${core.version}, @brmbh/cli is ${pkg.version} — bump them together.`);
  process.exit(1);
}
await fs.rm(dest, { recursive: true, force: true });
await fs.cp(src, dest, { recursive: true, filter: (p) => !p.endsWith('.DS_Store') });
console.log(`core ${core.version} packed from inc/core/`);
