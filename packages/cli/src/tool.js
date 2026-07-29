/**
 * The brmbh "tool" runtime — a tiny code-first-agents dispatcher.
 *
 * Design (after beogip/code-first-agents): deterministic work lives in command
 * handlers; the LLM/human orchestrates. Every command is dual-mode:
 *
 *   pretty (default) → for humans: streamed steps + a final summary line
 *   --json           → for agents: a single JSON ENVELOPE on stdout, exit 0
 *
 * Each command declares a LEVEL describing what its envelope is good for:
 *   L1 data           → raw facts; caller interprets
 *   L2 classification → a `class` field; caller branches deterministically
 *   L3 instructions   → a `next` procedure; caller executes verbatim
 *
 * Introspection is automatic and non-overridable: `brmbh schema` and `--help`.
 */
import { parseArgs } from 'node:util';
import path from 'node:path';
import { createUi } from './ui.js';
import { run, runOrThrow, capture, has } from './exec.js';

export const LEVEL = { L1: 'data', L2: 'classification', L3: 'instructions' };

export class ToolError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.name = 'ToolError';
    this.code = code;
    this.detail = detail;
  }
}

const GLOBAL_FLAGS = {
  json: { type: 'boolean', description: 'Emit a JSON envelope instead of human output' },
  cwd: { type: 'string', description: 'Run as if in this directory' },
  help: { type: 'boolean', short: 'h', description: 'Show help for the command' },
};

/** Turn a command spec's flag map into node:util parseArgs `options`. */
function toParseOptions(flags) {
  const options = {};
  for (const [name, def] of Object.entries({ ...flags, ...GLOBAL_FLAGS })) {
    options[name] = { type: def.type === 'boolean' ? 'boolean' : 'string' };
    if (def.short) options[name].short = def.short;
    if (def.multiple) options[name].multiple = true;
  }
  return options;
}

function makeCtx({ json, cwd }) {
  return {
    json,
    cwd: cwd ? path.resolve(process.cwd(), cwd) : process.cwd(),
    ui: createUi({ json }),
    // shell helpers, pre-bound to json mode so child output routes correctly
    run: (cmd, args, opts = {}) => run(cmd, args, { json, ...opts }),
    runOrThrow: (cmd, args, opts = {}) => runOrThrow(cmd, args, { json, ...opts }),
    capture,
    has,
  };
}

function validate(spec, values, positionals) {
  // positionals
  const pos = {};
  (spec.positionals ?? []).forEach((p, i) => {
    const v = positionals[i];
    if (p.required && (v === undefined || v === '')) {
      throw new ToolError('bad_input', `Missing required argument <${p.name}>`);
    }
    if (v !== undefined && p.choices && !p.choices.includes(v)) {
      throw new ToolError('bad_input', `<${p.name}> must be one of: ${p.choices.join(', ')}`);
    }
    pos[p.name] = v;
  });
  // flags
  const flags = {};
  for (const [name, def] of Object.entries(spec.flags ?? {})) {
    let v = values[name];
    if (v === undefined && 'default' in def) v = def.default;
    if (def.required && v === undefined) {
      throw new ToolError('bad_input', `Missing required flag --${name}`);
    }
    if (v !== undefined && def.choices && !def.choices.includes(v)) {
      throw new ToolError('bad_input', `--${name} must be one of: ${def.choices.join(', ')}`);
    }
    flags[name] = v;
  }
  return { ...pos, ...flags };
}

function printEnvelopeOk(result) {
  const { message, ...rest } = result ?? {};
  // keys prefixed with __ are pretty-mode hints, not part of the envelope
  for (const k of Object.keys(rest)) if (k.startsWith('__')) delete rest[k];
  process.stdout.write(JSON.stringify({ ok: true, message: message ?? 'ok', ...rest }) + '\n');
}

function printEnvelopeErr(err) {
  process.stdout.write(
    JSON.stringify({ ok: false, error: err.message, code: err.code ?? 'error', detail: err.detail }) +
      '\n',
  );
}

function commandHelp(name, spec, ui) {
  ui.banner(`brmbh ${name}`, spec.description);
  const usageArgs = (spec.positionals ?? []).map((p) => (p.required ? `<${p.name}>` : `[${p.name}]`));
  ui.raw('  ' + paintDim(`Usage: brmbh ${name} ${usageArgs.join(' ')} [flags]`));
  ui.raw('');
  if (spec.level) ui.raw('  ' + paintDim(`Level: ${spec.level}`));
  for (const p of spec.positionals ?? []) {
    ui.raw(`    ${p.name.padEnd(16)} ${paintDim(p.description ?? '')}`);
  }
  if (spec.flags && Object.keys(spec.flags).length) {
    ui.raw('');
    ui.raw('  Flags:');
    for (const [fn, def] of Object.entries(spec.flags)) {
      const lhs = `--${fn}` + (def.choices ? ` <${def.choices.join('|')}>` : def.type === 'boolean' ? '' : ' <value>');
      ui.raw(`    ${lhs.padEnd(28)} ${paintDim(def.description ?? '')}`);
    }
  }
  ui.raw('');
}

// tiny local dim helper (ui owns color, but help prints standalone lines)
function paintDim(s) {
  return process.stdout.isTTY && process.env.NO_COLOR === undefined ? `\x1b[2m${s}\x1b[0m` : s;
}

function schemaFor(commands) {
  const out = {};
  for (const [name, mod] of Object.entries(commands)) {
    out[name] = {
      description: mod.spec.description,
      level: mod.spec.level ?? null,
      positionals: (mod.spec.positionals ?? []).map((p) => ({
        name: p.name,
        required: !!p.required,
        choices: p.choices ?? null,
        description: p.description ?? '',
      })),
      flags: Object.fromEntries(
        Object.entries(mod.spec.flags ?? {}).map(([fn, def]) => [
          fn,
          {
            type: def.type,
            required: !!def.required,
            default: def.default ?? null,
            choices: def.choices ?? null,
            description: def.description ?? '',
          },
        ]),
      ),
    };
  }
  return out;
}

function rootHelp(commands, version) {
  const ui = createUi({ json: false });
  ui.banner('brmbh', `agentic WordPress suite · v${version}`);
  ui.raw('  ' + paintDim('Usage: brmbh <command> [args] [--flags]   ·   --json for agent output'));
  ui.raw('');
  ui.raw('  Commands:');
  for (const [name, mod] of Object.entries(commands)) {
    ui.raw(`    ${name.padEnd(12)} ${paintDim(mod.spec.description ?? '')}`);
  }
  ui.raw('');
  ui.raw('  ' + paintDim('Introspect: brmbh schema   ·   Help: brmbh <command> --help'));
  ui.raw('');
}

/**
 * Dispatch argv against a command map.
 * @param {Record<string, { spec: object, run: Function }>} commands
 * @param {string[]} argv
 * @param {{ version: string }} meta
 */
export async function dispatch(commands, argv, meta) {
  const [command, ...rest] = argv;

  // root-level meta commands
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    if (rest[0] && commands[rest[0]]) {
      commandHelp(rest[0], commands[rest[0]].spec, createUi({ json: false }));
      return 0;
    }
    rootHelp(commands, meta.version);
    return 0;
  }
  if (command === '--version' || command === '-v' || command === 'version') {
    process.stdout.write(meta.version + '\n');
    return 0;
  }
  if (command === 'schema') {
    process.stdout.write(JSON.stringify(schemaFor(commands), null, 2) + '\n');
    return 0;
  }

  const mod = commands[command];
  if (!mod) {
    process.stderr.write(`Unknown command: ${command}\nRun \`brmbh help\` for usage.\n`);
    return 1;
  }

  // parse this command's args
  let parsed;
  try {
    parsed = parseArgs({
      args: rest,
      options: toParseOptions(mod.spec.flags ?? {}),
      allowPositionals: true,
      strict: true,
    });
  } catch (e) {
    process.stderr.write(`✗ ${e.message}\nRun \`brmbh ${command} --help\`.\n`);
    return 1;
  }

  if (parsed.values.help) {
    commandHelp(command, mod.spec, createUi({ json: false }));
    return 0;
  }

  const json = !!parsed.values.json;
  const ctx = makeCtx({ json, cwd: parsed.values.cwd });

  try {
    const args = validate(mod.spec, parsed.values, parsed.positionals);
    const result = await mod.run(ctx, args);
    if (json) {
      printEnvelopeOk(result);
      return 0; // code-first: agents always get exit 0 + ok flag
    }
    if (result?.message && !result.__handled) ctx.ui.done(result.message);
    return 0;
  } catch (err) {
    if (json) {
      printEnvelopeErr(err);
      return 0;
    }
    ctx.ui.error(err.message);
    if (err.detail) ctx.ui.info(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail));
    return 1;
  }
}
