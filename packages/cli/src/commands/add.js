/**
 * `brmbh add <kind> <name>` — incremental scaffolders.
 *
 *   add block <name>   four-file ACF block (factory convention)
 *   add cpt   <name>   one-file custom post type
 *   add skills         (re)generate agent skill wrappers from canonical AGENTS/
 *
 * Deterministic file generation only. The *reasoning* (turning a design into
 * fields/markup) is the agent skill's job — this just lays down the skeleton.
 */
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LEVEL, ToolError } from '../tool.js';
import { exists, isDir, ensureDir, readText, writeText, render, slugify, titleCase } from '../fsutil.js';
import { findThemeDir } from '../wp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES = path.join(__dirname, '..', '..', 'templates');

export const spec = {
  description: 'Add a block, custom post type, or (re)generate agent skill wrappers',
  level: LEVEL.L3,
  positionals: [
    { name: 'kind', required: true, choices: ['block', 'cpt', 'skills'], description: 'What to add' },
    { name: 'name', required: false, description: 'Name (required for block/cpt)' },
  ],
  flags: {
    mode: { type: 'string', choices: ['preview', 'edit'], default: 'preview', description: 'block: default editor display' },
    plural: { type: 'string', description: 'cpt: plural label (default: name + "s")' },
    force: { type: 'boolean', default: false, description: 'Overwrite if it already exists' },
  },
};

export async function run(ctx, args) {
  const themeDir = await findThemeDir(ctx.cwd);
  if (!themeDir) {
    throw new ToolError('no_theme', 'No brmbh theme found here.', 'Run from inside a brmbh theme, or scaffold one with `create-brmbh`.');
  }

  switch (args.kind) {
    case 'block':
      return addBlock(ctx, themeDir, args);
    case 'cpt':
      return addCpt(ctx, themeDir, args);
    case 'skills':
      return addSkills(ctx, themeDir);
    default:
      throw new ToolError('bad_input', `Unknown kind: ${args.kind}`);
  }
}

/* ---------------------------------------------------------------- block --- */

async function addBlock(ctx, themeDir, args) {
  const { ui } = ctx;
  if (!args.name) throw new ToolError('bad_input', 'block needs a <name>, e.g. `brmbh add block hero`');

  const slug = slugify(args.name);
  const title = titleCase(slug);
  const key = slug.replace(/-/g, '_');
  const blockDir = path.join(themeDir, 'my-acf-blocks', slug);

  if ((await isDir(blockDir)) && !args.force) {
    throw new ToolError('exists', `Block already exists: my-acf-blocks/${slug}`, 'Pass --force to overwrite.');
  }

  ui.banner(`Adding block: ${title}`, `my-acf-blocks/${slug}`);
  const vars = { SLUG: slug, TITLE: title, KEY: key, MODE: args.mode };
  const files = ['block.json', 'fields.php', 'template.php', '_style.scss'];
  for (const f of files) {
    const tpl = await readText(path.join(TEMPLATES, 'block', f));
    await writeText(path.join(blockDir, f), render(tpl, vars));
    ui.item(`my-acf-blocks/${slug}/${f}`);
  }

  // append SCSS import to the loader (idempotent)
  const loaderScss = path.join(themeDir, 'my-acf-blocks', '_loader.scss');
  const importLine = `@import "${slug}/style";`;
  let scssAppended = false;
  if (await exists(loaderScss)) {
    const current = await readText(loaderScss);
    if (!current.includes(importLine)) {
      await fs.appendFile(loaderScss, (current.endsWith('\n') ? '' : '\n') + importLine + '\n');
      scssAppended = true;
      ui.ok('Registered SCSS import in _loader.scss');
    }
  }

  const next = [
    'Define the ACF fields in fields.php to match your design',
    'Render them with Bootstrap utilities + tokens in template.php (no hardcoded px/hex)',
    'Rebuild styles: brmbh dev --once',
    `Insert the "${title}" block in the editor to verify`,
  ];
  if (!ctx.json) {
    ui.raw('');
    ui.raw('  Next:');
    next.forEach((n) => ui.item(n));
  }

  return {
    message: `Added block "${title}"`,
    slug,
    dir: path.relative(themeDir, blockDir),
    files,
    scssImport: scssAppended,
    next,
  };
}

/* ------------------------------------------------------------------ cpt --- */

async function addCpt(ctx, themeDir, args) {
  const { ui } = ctx;
  if (!args.name) throw new ToolError('bad_input', 'cpt needs a <name>, e.g. `brmbh add cpt speaker`');

  const slug = slugify(args.name);
  const title = titleCase(slug);
  // WP post_type keys are max 20 chars, [a-z0-9_]
  const key = slug.replace(/-/g, '_').slice(0, 20);
  const plural = args.plural || `${title}s`;

  const dir = path.join(themeDir, 'inc', 'post-types');
  const file = path.join(dir, `${slug}.php`);
  if ((await exists(file)) && !args.force) {
    throw new ToolError('exists', `CPT already exists: inc/post-types/${slug}.php`, 'Pass --force to overwrite.');
  }

  ui.banner(`Adding post type: ${title}`, `inc/post-types/${slug}.php`);
  await ensureDir(dir);
  const tpl = await readText(path.join(TEMPLATES, 'cpt', 'post-type.php'));
  await writeText(file, render(tpl, { SLUG: slug, KEY: key, TITLE: title, TITLE_PLURAL: plural }));
  ui.item(`inc/post-types/${slug}.php`);

  // ensure functions.php auto-loads inc/post-types/*.php (idempotent)
  const autoloaded = await ensurePostTypeAutoload(themeDir);
  if (autoloaded === 'added') ui.ok('Added post-types autoloader to functions.php');
  else if (autoloaded === 'present') ui.info('Autoloader already present');
  else ui.warn('Could not find functions.php — require inc/post-types/' + slug + '.php manually');

  const next = [
    'Add ACF fields in the acf/init block (template has a commented stub)',
    `Reference this CPT from a block via an ACF relationship field (return_format: id)`,
    'Create entries under the new admin menu',
  ];
  if (!ctx.json) {
    ui.raw('');
    ui.raw('  Next:');
    next.forEach((n) => ui.item(n));
  }

  return {
    message: `Added post type "${title}"`,
    slug,
    key,
    file: path.relative(themeDir, file),
    autoloader: autoloaded,
    next,
  };
}

async function ensurePostTypeAutoload(themeDir) {
  const functionsPhp = path.join(themeDir, 'functions.php');
  if (!(await exists(functionsPhp))) return 'missing';
  const current = await readText(functionsPhp);
  if (current.includes('brmbh post-types autoload') || /post-types\/\*\.php/.test(current)) {
    return 'present';
  }
  const snippet = await readText(path.join(TEMPLATES, 'cpt', 'autoload.php'));
  await fs.appendFile(functionsPhp, (current.endsWith('\n') ? '' : '\n') + snippet);
  return 'added';
}

/* --------------------------------------------------------------- skills --- */

async function addSkills(ctx, themeDir) {
  const { ui } = ctx;
  ui.banner('Generating agent skill wrappers', 'from canonical AGENTS/');
  const result = await generateSkillWrappers(themeDir);
  if (!result.skills) {
    throw new ToolError('no_skills', 'No AGENTS/*.md skills found in this theme.');
  }
  result.names.forEach((n) => ui.item(n));
  ui.ok(`${result.skills} skills → ${result.wrappers} wrappers (.claude, .cursor, .windsurf)`);
  return {
    message: `Generated ${result.wrappers} skill wrappers from ${result.skills} skills`,
    ...result,
  };
}

/** Where a theme's skill sources can live, lowest precedence first. */
const PACKAGE_AGENTS = path.join('node_modules', '@brmbh', 'cli', 'AGENTS');
const LOCAL_AGENTS = 'AGENTS';

/**
 * Resolve the skill set for a theme.
 *
 * Skills ship inside @brmbh/cli, so `npm update` refreshes them. A theme may
 * still keep its own AGENTS/<name>.md — a project-local file wins for that one
 * skill only, so customising one never costs you updates to the others.
 *
 * @returns {Promise<Map<string, string>>} skill name → theme-relative source path
 */
async function resolveSkillSources(themeDir) {
  const sources = new Map();
  for (const base of [PACKAGE_AGENTS, LOCAL_AGENTS]) {
    const dir = path.join(themeDir, base);
    if (!(await isDir(dir))) continue;
    const entries = await fs.readdir(dir).catch(() => []);
    for (const f of entries) {
      if (!f.endsWith('.md') || f.toLowerCase() === 'readme.md') continue;
      sources.set(f.replace(/\.md$/, ''), path.join(base, f)); // later base overrides
    }
  }
  return sources;
}

/**
 * Single source of truth → thin per-agent wrappers.
 * Emits matching wrappers for Claude, Cursor, Windsurf. Wrappers are generated
 * output, not content: they are gitignored and rebuilt on install.
 * Exported so `create` can call it during scaffolding.
 *
 * @returns {Promise<{ skills: number, wrappers: number, names: string[], overrides: string[] }>}
 */
export async function generateSkillWrappers(themeDir) {
  const sources = await resolveSkillSources(themeDir);
  if (!sources.size) return { skills: 0, wrappers: 0, names: [], overrides: [] };

  const targets = [
    { dir: ['.claude', 'commands'], ext: '.md', body: claudeWrapper },
    { dir: ['.cursor', 'rules'], ext: '.mdc', body: cursorWrapper },
    { dir: ['.windsurf', 'rules'], ext: '.md', body: windsurfWrapper },
  ];

  let wrappers = 0;
  const names = [];
  const overrides = [];
  for (const [name, relSource] of sources) {
    names.push(name);
    if (relSource.startsWith(LOCAL_AGENTS + path.sep)) overrides.push(name);
    const desc = deriveDescription(await readText(path.join(themeDir, relSource)), name);
    // POSIX separators: these paths are read by agents out of markdown, not by fs
    const ref = relSource.split(path.sep).join('/');
    for (const t of targets) {
      const outDir = path.join(themeDir, ...t.dir);
      await ensureDir(outDir);
      await writeText(path.join(outDir, name + t.ext), t.body(ref, desc));
      wrappers++;
    }
  }
  return { skills: sources.size, wrappers, names, overrides };
}

function deriveDescription(md, fallback) {
  for (const raw of md.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('---')) continue;
    return line.replace(/[*`>]/g, '').replace(/\s+/g, ' ').slice(0, 100);
  }
  return `Run the ${fallback} skill`;
}

function claudeWrapper(ref, desc) {
  return `---\ndescription: ${desc}\n---\n\nRead \`${ref}\` and execute the skill defined there.\n`;
}
function cursorWrapper(ref, desc) {
  return `---\ndescription: ${desc}\nalwaysApply: false\n---\n\nRead \`${ref}\` and execute the skill defined there.\n`;
}
function windsurfWrapper(ref, desc) {
  return `---\ndescription: ${desc}\n---\n\nRead \`${ref}\` and execute the skill defined there.\n`;
}

export default { spec, run };
