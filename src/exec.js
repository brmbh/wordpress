/** Shell helpers built on child_process, with json-mode-aware stdio routing. */
import { spawn } from 'node:child_process';

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

/** True if a binary is resolvable on PATH. */
export async function has(bin) {
  const probe = process.platform === 'win32' ? 'where' : 'command';
  const args = process.platform === 'win32' ? [bin] : ['-v', bin];
  const { ok } = await capture(probe, args);
  return ok;
}
