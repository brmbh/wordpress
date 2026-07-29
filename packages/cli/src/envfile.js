/**
 * Locates the theme's `tools/env/<name>.env` files and composes the exact
 * `source <envfile> && bash <script>` invocation the AGENTS/*.md skill docs
 * already tell an agent to type by hand.
 *
 * The CLI never parses or interprets env file content — that's real bash,
 * meant to be `source`d by real bash. It only knows the naming convention
 * (staging.env / production.env) and shells out to the *same* recipe a human
 * or agent would run manually, so there's exactly one implementation of
 * "how do I invoke this script," not two that can drift apart.
 */
import path from 'node:path';
import { exists } from './fsutil.js';

/** Map the CLI's env choices to the theme's env-file naming convention. */
export function envFileName(env) {
  return env === 'prod' ? 'production.env' : `${env}.env`;
}

/** @returns {Promise<string|null>} absolute path to the env file, or null if missing. */
export async function envFilePath(themeDir, env) {
  const file = path.join(themeDir, 'tools', 'env', envFileName(env));
  return (await exists(file)) ? file : null;
}

function shQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

/**
 * Compose `source <envFile> && bash <script> <scriptArgs...>` as a single
 * string for `bash -c`. This is textually the same command the AGENTS/*.md
 * docs already document — the CLI is just typing it on the agent's behalf.
 */
export function sourceAndRun(envFile, script, scriptArgs = []) {
  return ['source', shQuote(envFile), '&&', 'bash', shQuote(script), ...scriptArgs.map(shQuote)].join(' ');
}
