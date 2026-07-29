/** Shell helpers built on child_process, with json-mode-aware stdio routing. */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { promises as fs, constants as fsConstants } from 'node:fs';

/**
 * Run a command, streaming its output to the user.
 * In json mode, child stdout is routed to stderr so the parent's stdout stays
 * reserved for the final JSON envelope.
 *
 * @returns {Promise<{ code: number }>}
 */
export function run(cmd, args = [], { cwd, json = false, env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['inherit', json ? process.stderr : 'inherit', 'inherit'],
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 0 }));
  });
}

/** Run and reject on non-zero exit. */
export async function runOrThrow(cmd, args = [], opts = {}) {
  const { code } = await run(cmd, args, opts);
  if (code !== 0) {
    const err = new Error(`\`${cmd} ${args.join(' ')}\` exited with code ${code}`);
    err.code = 'command_failed';
    throw err;
  }
}

/**
 * Run a command and capture stdout (trimmed). Never throws on non-zero;
 * returns { ok, code, stdout, stderr } so callers can branch.
 */
export function capture(cmd, args = [], { cwd, env } = {}) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let child;
    try {
      child = spawn(cmd, args, { cwd, env: { ...process.env, ...env } });
    } catch (e) {
      resolve({ ok: false, code: -1, stdout: '', stderr: String(e) });
      return;
    }
    child.stdout?.on('data', (d) => (stdout += d));
    child.stderr?.on('data', (d) => (stderr += d));
    child.on('error', (e) => resolve({ ok: false, code: -1, stdout: '', stderr: String(e) }));
    child.on('close', (code) =>
      resolve({ ok: code === 0, code: code ?? 0, stdout: stdout.trim(), stderr: stderr.trim() }),
    );
  });
}

/**
 * True if a binary is resolvable on PATH.
 *
 * Resolved by walking PATH directly rather than shelling out. The previous
 * implementation spawned `command -v <bin>`, which only worked on macOS:
 * macOS ships an actual /usr/bin/command executable, while on Linux (and in
 * every container and CI runner) `command` is a shell builtin with no binary
 * to exec. The spawn failed with ENOENT, so `has()` returned false for
 * everything — which broke `create` outright on Linux, since it refuses to
 * clone without git, and made doctor report wp-cli as missing even when
 * present.
 */
export async function has(bin) {
  if (path.isAbsolute(bin) || bin.includes(path.sep)) return isExecutable(bin);

  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  // On Windows a bare name resolves via PATHEXT (git -> git.exe, git.cmd, …)
  const exts = process.platform === 'win32'
    ? (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)
    : [''];

  for (const dir of dirs) {
    for (const ext of exts) {
      if (await isExecutable(path.join(dir, bin + ext))) return true;
    }
  }
  return false;
}

async function isExecutable(file) {
  try {
    const st = await fs.stat(file);
    if (!st.isFile()) return false;
    // Windows has no executable bit; existence on PATH with a PATHEXT match is enough.
    if (process.platform === 'win32') return true;
    await fs.access(file, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}
