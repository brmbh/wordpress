/**
 * Run a tools/*.sh script against a named environment (ADR 009).
 *
 * Resolves the environment (brmbh.json / brmbh.local.json / legacy tools/env),
 * maps it to the variables the scripts read, and runs the script with them.
 * Scripts never source anything themselves when called this way.
 */
import { ToolError } from './tool.js';
import { findWpRoot } from './wp.js';
import { resolveEnvironment, toScriptEnv, missingKeys } from './environments.js';
import { resolveToolScript } from './toolscript.js';

export async function resolveForScript(themeDir, envName, required = ['ssh', 'path']) {
  let resolved;
  try {
    resolved = await resolveEnvironment(themeDir, envName);
  } catch (e) {
    throw new ToolError(e.code ?? 'no_environment', e.message, e.detail);
  }
  const missing = missingKeys(resolved.env, required);
  if (missing.length) {
    throw new ToolError('incomplete_environment', `Environment "${resolved.name}" is missing: ${missing.join(', ')}`, 'Add the keys in brmbh.json or brmbh.local.json.');
  }
  const wpRoot = await findWpRoot(themeDir);
  return { resolved, vars: toScriptEnv(resolved, themeDir, wpRoot) };
}

/**
 * @returns {Promise<{ code: number, env: string, source: string, script: string }>}
 */
export async function runToolWithEnv(ctx, themeDir, envName, scriptName, scriptArgs = [], { required, extraEnv = {} } = {}) {
  const tool = await resolveToolScript(themeDir, scriptName);
  if (!tool) {
    throw new ToolError('no_tool', `${scriptName} could not be located.`, 'It ships in @brmbh/cli — run `npm install` in the theme, or add your own tools/ override.');
  }
  const { resolved, vars } = await resolveForScript(themeDir, envName, required);
  if (resolved.source === 'legacy') ctx.ui.warn(`Using legacy tools/env/${resolved.name}.env — \`brmbh update\` moves it into brmbh.local.json`);
  const { code } = await ctx.run('bash', [tool.path, ...scriptArgs], { cwd: themeDir, env: { ...vars, ...extraEnv } });
  return { code, env: resolved.name, source: resolved.source, script: tool.source };
}
