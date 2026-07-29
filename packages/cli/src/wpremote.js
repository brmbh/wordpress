/**
 * Remote WordPress targets — `--ssh <target>`.
 *
 * The WordPress install is often not on the machine running this CLI: an agent
 * or CI box has Node, the WordPress lives on shared hosting reached over SSH.
 * Without this, the wp-cli-backed checks (`doctor`'s wp-cli and scf, theme
 * activation) can only ever describe the local machine, which on such a box
 * means "no WordPress here" — true, and useless.
 *
 * Two ways to reach a remote install, in order of preference:
 *
 *   1. wp-cli's own `--ssh=<target>` — used when wp-cli exists locally. It
 *      handles the remote invocation itself, including finding WordPress.
 *   2. `ssh <host> 'cd <path> && wp …'` — used when there is no local wp-cli
 *      (the common case on a plain Node VPS). Requires wp-cli on the remote,
 *      which shared hosts frequently have.
 *
 * Target syntax mirrors wp-cli's: `[user@]host[:port][/path]` or an
 * `~/.ssh/config` alias with an optional path — `allinkl:/www/htdocs/x/wp`.
 */

/**
 * @param {string} raw e.g. "allinkl:/www/htdocs/w00bc6c9/site" or "user@host/var/www"
 * @returns {{ host: string, path: string|null, raw: string }}
 */
export function parseSshTarget(raw) {
  const value = String(raw || '').trim();
  if (!value) throw new Error('--ssh needs a target, e.g. --ssh host:/path/to/wordpress');

  // Split on the FIRST ':' or '/' that starts the path. A bare alias has neither.
  const m = value.match(/^([^:/]+(?:@[^:/]+)?)(?::(\d+))?(?:[:/](.*))?$/);
  if (!m) throw new Error(`Could not parse --ssh target: ${value}`);

  const [, host, port, rest] = m;
  let path = rest ? rest.trim() : null;
  // A leading slash was consumed by the separator when the form was host/path.
  if (path && !path.startsWith('/') && value.includes('/' + path)) path = '/' + path;
  if (path === '') path = null;

  return { host: port ? `${host}:${port}` : host, path, raw: value };
}

/** Quote a string for safe inclusion in a remote sh command. */
function shQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

/**
 * Build the argv for a wp-cli call, local or remote.
 *
 * @param {string[]} wpArgs      e.g. ['plugin','list','--status=active']
 * @param {object}   opts
 * @param {string}   [opts.ssh]  raw --ssh target; omit for a local call
 * @param {boolean}  [opts.hasLocalWpCli]
 * @returns {{ cmd: string, args: string[] }}
 */
export function wpCommand(wpArgs, { ssh, hasLocalWpCli = true } = {}) {
  if (!ssh) return { cmd: 'wp', args: wpArgs };

  const { host, path } = parseSshTarget(ssh);

  if (hasLocalWpCli) {
    // Let wp-cli do the work; it accepts the same target form we parse.
    return { cmd: 'wp', args: [`--ssh=${ssh}`, ...wpArgs] };
  }

  // No local wp-cli: drive the remote one over plain ssh.
  const remote = [path ? `cd ${shQuote(path)} &&` : '', 'wp', ...wpArgs.map(shQuote)]
    .filter(Boolean)
    .join(' ');
  return { cmd: 'ssh', args: [host, remote] };
}

/** The `--ssh` flag, shared by every command that talks to WordPress. */
export const SSH_FLAG = {
  ssh: {
    type: 'string',
    description: 'Operate on a remote WordPress over SSH: [user@]host[:port][/path]',
  },
};
