#!/usr/bin/env node
/**
 * sync-tokens.mjs — Figma Variables → _tokens.scss
 *
 * Calls the Figma REST API to read local variables from the design file,
 * then writes assets/src/scss/_tokens.scss with CSS custom properties.
 *
 * Usage:
 *   node tools/sync-tokens.mjs                  # uses .brmbh-config.json
 *   node tools/sync-tokens.mjs --dry-run        # print to stdout, no file write
 *
 * Config (.brmbh-config.json at theme root, gitignored):
 *   { "figmaFileKey": "...", "figmaToken": "figd_..." }
 *
 * Get a Figma personal access token at:
 *   figma.com → Account Settings → Personal access tokens
 *
 * API ref: https://www.figma.com/developers/api#variables
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir  = dirname(fileURLToPath(import.meta.url));
const ROOT   = resolve(__dir, '..');
const OUT    = resolve(ROOT, 'assets/src/scss/_tokens.scss');
const DRY    = process.argv.includes('--dry-run');

// ── Config ─────────────────────────────────────────────────────────────────

const configPath = resolve(ROOT, '.brmbh-config.json');
if (!existsSync(configPath)) {
  console.error('\nError: .brmbh-config.json not found.');
  console.error('Copy .brmbh-config.example.json → .brmbh-config.json and fill in your Figma token.\n');
  process.exit(1);
}

const config = JSON.parse(readFileSync(configPath, 'utf8'));
const { figmaFileKey, figmaToken } = config;

if (!figmaFileKey || !figmaToken || figmaToken.startsWith('figd_YOUR')) {
  console.error('\nError: figmaFileKey and figmaToken must be set in .brmbh-config.json.\n');
  process.exit(1);
}

// ── Fetch Figma variables ───────────────────────────────────────────────────

console.log(`→ Fetching variables from Figma file ${figmaFileKey}…`);

const url = `https://api.figma.com/v1/files/${figmaFileKey}/variables/local`;
const res = await fetch(url, {
  headers: { 'X-Figma-Token': figmaToken },
});

if (!res.ok) {
  const body = await res.text();
  console.error(`\nFigma API error ${res.status}: ${body}\n`);
  process.exit(1);
}

const { meta } = await res.json();
const { variables, variableCollections } = meta;

// ── Map variable values ─────────────────────────────────────────────────────

/**
 * Resolve a variable value to a concrete CSS value.
 * Figma aliases point to other variable IDs; we resolve them recursively.
 */
function resolveValue(value, variables) {
  if (value?.type === 'VARIABLE_ALIAS') {
    const aliased = variables[value.id];
    if (aliased) {
      const modes = Object.values(aliased.valuesByMode);
      return resolveValue(modes[0], variables);
    }
  }
  return value;
}

/**
 * Convert a Figma color {r,g,b,a} (0–1 floats) to hex.
 */
function toHex({ r, g, b }) {
  const hex = (n) => Math.round(n * 255).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * Convert a Figma variable name like "Brand/Color/Primary" to a CSS var name
 * like "--brand-color-primary".
 */
function toCssVarName(name) {
  return '--' + name
    .toLowerCase()
    .replace(/\s+/g, '-')     // spaces → dashes
    .replace(/\//g, '-')      // slashes → dashes
    .replace(/[^a-z0-9-]/g, '') // strip anything else
    .replace(/-+/g, '-');        // collapse multiple dashes
}

// ── Build token groups ──────────────────────────────────────────────────────

const colors   = [];
const spacing  = [];
const radii    = [];
const typo     = [];
const other    = [];

for (const variable of Object.values(variables)) {
  if (variable.resolvedType === 'COLOR') {
    const modes = Object.values(variable.valuesByMode);
    const raw = resolveValue(modes[0], variables);
    if (raw && typeof raw === 'object' && 'r' in raw) {
      colors.push({ name: variable.name, cssVar: toCssVarName(variable.name), value: toHex(raw) });
    }
  } else if (variable.resolvedType === 'FLOAT') {
    const modes = Object.values(variable.valuesByMode);
    const raw   = resolveValue(modes[0], variables);
    const num   = typeof raw === 'number' ? raw : null;
    if (num === null) continue;

    const nameLC = variable.name.toLowerCase();
    const entry  = { name: variable.name, cssVar: toCssVarName(variable.name), value: num };

    if (/corner|radius/i.test(nameLC))         radii.push(entry);
    else if (/^(xxs|xs|s|m|l|xl|xxl|edge)$/i.test(nameLC.split('/').pop())) spacing.push(entry);
    else                                        other.push(entry);
  } else if (variable.resolvedType === 'STRING') {
    // Typography tokens are strings in Figma (e.g. font-family names).
    // We skip them here — they're captured in _variables.scss instead.
  }
}

// Sort for stable output
const sortByName = (a, b) => a.name.localeCompare(b.name);
colors.sort(sortByName);

// ── Generate SCSS ───────────────────────────────────────────────────────────

const HEADER = `// =============================================================================
// DESIGN TOKENS — generated by scripts/sync-tokens.mjs
// Source: figma.com/design/${figmaFileKey}
// Do NOT edit manually — run \`wp brmbh tokens\` to regenerate.
// =============================================================================

`;

const lines = [HEADER, ':root {\n'];

if (colors.length) {
  lines.push('  // Colors\n');
  for (const { cssVar, value, name } of colors) {
    lines.push(`  ${cssVar.padEnd(40)}: ${value}; // ${name}\n`);
  }
  lines.push('\n');
}

if (spacing.length) {
  lines.push('  // Spacing scale (px — mirrors Figma spacing tokens)\n');
  // Custom order for spacing
  const order = ['xxs','xs','s','m','l','xl','xxl','edge'];
  const sorted = [...spacing].sort((a, b) => {
    const ai = order.indexOf(a.name.split('/').pop().toLowerCase());
    const bi = order.indexOf(b.name.split('/').pop().toLowerCase());
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  for (const { cssVar, value, name } of sorted) {
    lines.push(`  ${cssVar.padEnd(40)}: ${value}px; // ${name}\n`);
  }
  lines.push('\n');
}

if (radii.length) {
  lines.push('  // Border radius\n');
  for (const { cssVar, value, name } of radii) {
    lines.push(`  ${cssVar.padEnd(40)}: ${value}px; // ${name}\n`);
  }
  lines.push('\n');
}

if (other.length) {
  lines.push('  // Other numeric tokens\n');
  for (const { cssVar, value, name } of other) {
    lines.push(`  ${cssVar.padEnd(40)}: ${value}; // ${name}\n`);
  }
  lines.push('\n');
}

lines.push('}\n');

const output = lines.join('');

// ── Write or print ──────────────────────────────────────────────────────────

if (DRY) {
  console.log('\n--- DRY RUN (no file written) ---\n');
  process.stdout.write(output);
  console.log('\n--- END ---');
} else {
  writeFileSync(OUT, output, 'utf8');
  console.log(`✓ Wrote ${OUT}`);
  console.log(`  ${colors.length} colors, ${spacing.length} spacing, ${radii.length} radii, ${other.length} other`);
}
