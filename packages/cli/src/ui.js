/**
 * Minimal, dependency-free terminal UI.
 *
 * Two output worlds (see src/tool.js):
 *   - pretty  → for humans: colored steps, symbols, summaries
 *   - json    → for agents: UI is muted to keep stdout clean for the envelope;
 *               progress is redirected to stderr instead.
 */

const useColor =
  process.env.NO_COLOR === undefined &&
  process.env.TERM !== 'dumb' &&
  (process.stdout.isTTY ?? false);

const c = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));

export const paint = {
  bold: c('1'),
  dim: c('2'),
  red: c('31'),
  green: c('32'),
  yellow: c('33'),
  blue: c('34'),
  cyan: c('36'),
  gray: c('90'),
};

const SYM = {
  step: paint.cyan('›'),
  ok: paint.green('✓'),
  warn: paint.yellow('!'),
  err: paint.red('✗'),
  dot: paint.gray('·'),
};

/**
 * @param {{ json?: boolean }} opts
 */
export function createUi({ json = false } = {}) {
  // In json mode all human chatter goes to stderr so stdout carries only the envelope.
  const out = json ? process.stderr : process.stdout;
  const w = (line) => out.write(line + '\n');

  return {
    raw: (s = '') => w(s),
    banner(title, subtitle) {
      w('');
      w('  ' + paint.bold(title));
      if (subtitle) w('  ' + paint.dim(subtitle));
      w('');
    },
    step: (msg) => w(`  ${SYM.step} ${msg}`),
    ok: (msg) => w(`  ${SYM.ok} ${msg}`),
    warn: (msg) => w(`  ${SYM.warn} ${paint.yellow(msg)}`),
    error: (msg) => w(`  ${SYM.err} ${paint.red(msg)}`),
    info: (msg) => w(`    ${paint.dim(msg)}`),
    item: (msg) => w(`    ${SYM.dot} ${msg}`),
    done(msg) {
      w('');
      w(`  ${SYM.ok} ${paint.bold(msg)}`);
      w('');
    },
  };
}
