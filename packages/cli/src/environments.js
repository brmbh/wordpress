/**
 * Environments (ADR 009): named deploy/sync targets in the project config.
 *
 *   brmbh.json         committed — what CI and every teammate sees
 *   brmbh.local.json   gitignored — overrides per machine (e.g. hosts you keep out of git)
 *
 * {
 *   "environments": {
 *     "staging": { "ssh": "deploy@staging.example.com", "path": "/var/www/html",
 *                  "url": "https://staging.example.com", "canonical": "local" },
 *     "production": { "ssh": "deploy@example.com", "path": "/var/www/html",
 *                     "url": "https://example.com", "canonical": "remote" }
 *   },
 *   "local": { "url": "http://example.local", "wpCli": "wp" },
 *   "deploy": { "include": ["assets/dist"], "exclude": ["docs"] }
 * }
 *
 * Any number of environments, any names. Nothing secret belongs here: SSH keys and
 * passwords come from the machine or the CI runner. Projects still on the old
 * tools/env/<name>.env files keep working (read-only parse, never executed);
 * `brmbh update` migrates them into brmbh.local.json.
 *
 * The shell scripts in tools/ read plain variables; toScriptEnv() is the one
 * place that maps config → those variables.
 */
import path from 'node:path';
import { exists, readText } from './fsutil.js';

export const CONFIG = 'brmbh.json';
export const LOCAL_CONFIG = 'brmbh.local.json';

const LEGACY_DIR = path.join('tools', 'env');
/** Old CLI spelling → the env file the starter shipped. */
const LEGACY_ALIAS = { prod: 'production' };

async function readJson(file) {
  if (!(await exists(file))) return null;
  try {
    return JSON.parse(await readText(file));
  } catch (e) {
    throw Object.assign(new Error(`${path.basename(file)} is not valid JSON: ${e.message}`), { code: 'bad_config' });
  }
}

/** brmbh.json with brmbh.local.json merged over it (per environment, per key). */
export async function loadConfig(themeDir) {
  const base = (await readJson(path.join(themeDir, CONFIG))) ?? {};
  const local = (await readJson(path.join(themeDir, LOCAL_CONFIG))) ?? {};
  const environments = { ...(base.environments ?? {}) };
  for (const [name, env] of Object.entries(local.environments ?? {})) {
    environments[name] = { ...(environments[name] ?? {}), ...env };
  }
  return {
    environments,
    local: { ...(base.local ?? {}), ...(local.local ?? {}) },
    deploy: { ...(base.deploy ?? {}), ...(local.deploy ?? {}) },
  };
}

/**
 * Parse a legacy `tools/env/<name>.env` without executing it: only
 * `export KEY="value"` / `KEY=value` lines, quotes stripped.
 */
export function parseEnvFile(text) {
  const vars = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].replace(/\s+#.*$/, '').trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    vars[m[1]] = v;
  }
  return vars;
}

/** Legacy env vars → the config shape. */
export function fromLegacyVars(v) {
  const env = {
    ssh: v.SSH_TARGET || undefined,
    path: v.REMOTE_WP_PATH || undefined,
    url: v.REMOTE_URL || undefined,
    theme: v.REMOTE_THEME || undefined,
    canonical: v.CANONICAL_ENV || undefined,
    excludes: v.UPLOADS_EXCLUDE ? v.UPLOADS_EXCLUDE.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
  };
  const local = { url: v.LOCAL_URL || undefined, theme: v.LOCAL_THEME || undefined, wpCli: v.LOCAL_WP_CLI || undefined, wpPath: v.LOCAL_WP_PATH || undefined };
  const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, x]) => x !== undefined));
  return { env: clean(env), local: clean(local) };
}

/** Names of legacy env files present (`staging`, `production`, …). */
export async function legacyEnvNames(themeDir) {
  const { promises: fs } = await import('node:fs');
  const dir = path.join(themeDir, LEGACY_DIR);
  const entries = await fs.readdir(dir).catch(() => []);
  return entries.filter((f) => f.endsWith('.env')).map((f) => f.slice(0, -4)).sort();
}

/** Every environment name: config first, then legacy files not yet migrated. */
export async function listEnvironments(themeDir) {
  const cfg = await loadConfig(themeDir);
  const names = Object.keys(cfg.environments);
  const legacy = (await legacyEnvNames(themeDir)).filter((n) => !names.includes(n));
  return { names: [...names, ...legacy], legacy, config: cfg };
}

/**
 * Resolve one environment by name.
 * @returns {Promise<{ name: string, env: object, local: object, source: 'config'|'legacy' }>}
 */
export async function resolveEnvironment(themeDir, name) {
  const cfg = await loadConfig(themeDir);
  if (cfg.environments[name]) return { name, env: cfg.environments[name], local: cfg.local, source: 'config' };
  for (const candidate of [name, LEGACY_ALIAS[name]].filter(Boolean)) {
    const file = path.join(themeDir, LEGACY_DIR, `${candidate}.env`);
    if (await exists(file)) {
      const { env, local } = fromLegacyVars(parseEnvFile(await readText(file)));
      return { name: candidate, env, local: { ...local, ...cfg.local }, source: 'legacy' };
    }
  }
  const { names } = await listEnvironments(themeDir);
  const err = new Error(`No environment "${name}"`);
  err.code = 'no_environment';
  err.detail = names.length
    ? `Configured: ${names.join(', ')}.`
    : `Add it to ${CONFIG} (or ${LOCAL_CONFIG} to keep hosts out of git): {"environments": {"${name}": {"ssh": "user@host", "path": "/var/www/html", "url": "https://…", "canonical": "remote"}}}`;
  throw err;
}

/** Check the keys an operation needs; returns the missing ones. */
export function missingKeys(env, keys) {
  return keys.filter((k) => env[k] === undefined || env[k] === '');
}

/**
 * The variables the tools/*.sh scripts read. One mapping, so scripts never
 * learn where values come from.
 */
export function toScriptEnv(resolved, themeDir, wpRoot) {
  const { env, local } = resolved;
  const themeSlug = path.basename(themeDir);
  const vars = {
    BRMBH_THEME_DIR: themeDir,
    SSH_TARGET: env.ssh ?? '',
    REMOTE_WP_PATH: env.path ?? '',
    REMOTE_URL: env.url ?? '',
    REMOTE_THEME: env.theme ?? themeSlug,
    CANONICAL_ENV: env.canonical ?? 'remote', // safe default: never push over a remote that isn't declared local-canonical
    LOCAL_URL: local.url ?? '',
    LOCAL_THEME: local.theme ?? themeSlug,
    LOCAL_WP_CLI: local.wpCli ?? 'wp',
    BRMBH_ENV: resolved.name,
  };
  if (local.wpPath || wpRoot) vars.LOCAL_WP_PATH = local.wpPath ?? wpRoot;
  if (env.excludes?.length) vars.UPLOADS_EXCLUDE = env.excludes.join(',');
  return vars;
}
