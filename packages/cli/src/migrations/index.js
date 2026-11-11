/**
 * Migrations: changes to files a site owns, shipped with the release that needs them (ADR 008).
 *
 * `inc/core/` is simply replaced on update. Everything else in a theme belongs to
 * the site, so upstream never overwrites it; when a release needs a change there,
 * it ships a migration. A migration plans first and writes nothing if any step
 * needs a human: the plan lists exactly which file and what to do.
 *
 * Shape: { id, description, applies(themeDir) → bool, plan(themeDir) → Plan }
 * Plan:  { writes: [{ file, content }], deletes: [file], blocked: [{ file, reason, fix }] }
 */
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { exists, readText } from '../fsutil.js';
import { CORE_REL, fingerprint, themeTextDomain } from '../core.js';

const KNOWN = JSON.parse(await fs.readFile(new URL('./pre-core-files.json', import.meta.url), 'utf8'));

/**
 * Pre-core files the core replaces, and how functions.php loaded each of them.
 * `require` matches the line(s) to remove from functions.php.
 */
// `//` comment lines directly above a require describe it, so they go with it
const LEAD = '(?:^[ \\t]*\\/\\/[^\\n]*\\n)*';
const req = (file) => new RegExp(`${LEAD}^[ \\t]*require(?:_once)?\\s*\\(?\\s*BRMBH_DIR\\s*\\.\\s*'\\/${file.replace(/[./]/g, (c) => '\\' + c)}'\\s*\\)?\\s*;[ \\t]*\\n`, 'm');

const PRE_CORE = [
  {
    file: 'inc/dependencies.php',
    require: req('inc/dependencies.php'),
  },
  {
    file: 'my-acf-blocks/loader.php',
    require: req('my-acf-blocks/loader.php'),
  },
  {
    file: 'inc/cli.php',
    // usually wrapped:  if ( defined( 'WP_CLI' ) && WP_CLI ) { require …/inc/cli.php; }
    require: /^[ \t]*if\s*\(\s*defined\(\s*'WP_CLI'\s*\)\s*&&\s*WP_CLI\s*\)\s*\{\s*require(?:_once)?\s*\(?\s*BRMBH_DIR\s*\.\s*'\/inc\/cli\.php'\s*\)?\s*;\s*\}[ \t]*\n|^[ \t]*require(?:_once)?\s*\(?\s*BRMBH_DIR\s*\.\s*'\/inc\/cli\.php'\s*\)?\s*;[ \t]*\n/m,
  },
];

const CORE_LOAD = "require BRMBH_DIR . '/inc/core/load.php';";

const FIX = {
  'inc/dependencies.php': 'It differs from every starter version. Move your changes into a file of your own in inc/ (the core keeps brmbh_has_acf_pro() and the notices), delete inc/dependencies.php, then run `brmbh update` again.',
  'my-acf-blocks/loader.php': 'It differs from every starter version. If it loads blocks from other folders, use the `brmbh/block_dirs` filter in your theme instead; move anything else into a file of your own in inc/. Then delete my-acf-blocks/loader.php and run `brmbh update` again.',
  'inc/cli.php': 'It differs from every starter version, usually because it holds your own WP-CLI commands. Move them into a file of your own (e.g. inc/cli-site.php with its own class and `WP_CLI::add_command( \'<your-site>\', … )`), required from functions.php. Then delete inc/cli.php and run `brmbh update` again.',
};

/** A theme built before the core existed: old files present, inc/core/load.php absent. */
export const coreAdopt = {
  id: 'core-adopt',
  description: 'Move the SCF guard, block factory loader and WP-CLI commands into inc/core/',
  async applies(themeDir) {
    if (await exists(path.join(themeDir, CORE_REL, 'load.php'))) return false;
    for (const p of PRE_CORE) if (await exists(path.join(themeDir, p.file))) return true;
    return false;
  },
  async plan(themeDir) {
    const plan = { writes: [], deletes: [], blocked: [] };
    const domain = (await themeTextDomain(themeDir)) || 'brmbh';
    const fnFile = path.join(themeDir, 'functions.php');
    let functions = (await exists(fnFile)) ? await readText(fnFile) : null;
    if (functions === null) {
      plan.blocked.push({ file: 'functions.php', reason: 'missing', fix: 'A brmbh theme needs functions.php.' });
      return plan;
    }

    let insertAt = -1;
    for (const p of PRE_CORE) {
      const abs = path.join(themeDir, p.file);
      const present = await exists(abs);
      if (present) {
        const known = KNOWN[p.file]?.includes(fingerprint(await readText(abs), domain));
        if (!known) {
          plan.blocked.push({ file: p.file, reason: 'edited', fix: FIX[p.file] });
          continue;
        }
        plan.deletes.push(p.file);
      }
      const m = functions.match(p.require);
      if (m) {
        // the core loads where the first removed require was (removals after it don't move it)
        if (insertAt === -1 || m.index < insertAt) insertAt = m.index;
        functions = functions.slice(0, m.index) + functions.slice(m.index + m[0].length);
      } else if (present) {
        plan.blocked.push({
          file: 'functions.php',
          reason: `no recognisable require of ${p.file}`,
          fix: `Remove the line in functions.php that loads ${p.file}, then run \`brmbh update\` again.`,
        });
      }
    }

    if (!functions.includes("/inc/core/load.php'")) {
      const line = `// brmbh core — SCF/ACF guard, block factory, \`wp brmbh\` commands. Replaced by \`brmbh update\`;\n// never edit inc/core/, extend it with hooks (inc/core/README.md).\n${CORE_LOAD}\n`;
      if (insertAt === -1) {
        plan.blocked.push({ file: 'functions.php', reason: 'nothing to replace', fix: `Add \`${CORE_LOAD}\` near the top of the includes in functions.php.` });
      } else {
        functions = functions.slice(0, insertAt) + line + functions.slice(insertAt);
      }
    }
    plan.writes.push({ file: 'functions.php', content: functions });
    return plan;
  },
};

/** In release order. */
export const MIGRATIONS = [coreAdopt];

/** Plan every migration that applies; nothing is written. */
export async function planMigrations(themeDir) {
  const out = [];
  for (const m of MIGRATIONS) {
    if (await m.applies(themeDir)) out.push({ id: m.id, description: m.description, ...(await m.plan(themeDir)) });
  }
  return out;
}

/** Write planned migrations. Callers must refuse when any plan is blocked. */
export async function applyMigrations(themeDir, plans) {
  for (const plan of plans) {
    for (const w of plan.writes) await fs.writeFile(path.join(themeDir, w.file), w.content, 'utf8');
    for (const d of plan.deletes) await fs.rm(path.join(themeDir, d), { force: true });
  }
}
