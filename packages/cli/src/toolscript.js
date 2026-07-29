/**
 * Locate the shell scripts that do the real work (deploy, db, uploads, …).
 *
 * They ship inside this package, so `npm update @brmbh/cli` refreshes them.
 * A theme may still keep its own `tools/<name>.sh`, which wins — the same
 * precedence rule the AGENTS/ skills use, so a project can override one script
 * without giving up updates to the rest.
 *
 * Resolution order:
 *   1. <theme>/tools/<name>            project override
 *   2. <theme>/node_modules/@brmbh/cli/tools/<name>   installed package
 *   3. <this package>/tools/<name>     running from a checkout / npx, where the
 *                                      theme has no node_modules of its own
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exists } from './fsutil.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OWN_TOOLS = path.join(__dirname, '..', 'tools');

/**
 * @param {string} themeDir absolute path to the theme
 * @param {string} name     script filename, e.g. 'deploy.sh'
 * @returns {Promise<{ path: string, source: 'theme'|'package'|'bundled' }|null>}
 */
export async function resolveToolScript(themeDir, name) {
  const candidates = [
    { path: path.join(themeDir, 'tools', name), source: 'theme' },
    { path: path.join(themeDir, 'node_modules', '@brmbh', 'cli', 'tools', name), source: 'package' },
    { path: path.join(OWN_TOOLS, name), source: 'bundled' },
  ];
  for (const c of candidates) {
    if (await exists(c.path)) return c;
  }
  return null;
}
