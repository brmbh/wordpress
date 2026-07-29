#!/usr/bin/env node
/**
 * create-brmbh — the genesis entrypoint.
 *
 *   npm create brmbh@latest my-site
 *   npx create-brmbh my-site
 *
 * This is sugar for `brmbh create <args>`: it forwards argv straight to the
 * create command so there is a single implementation.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { dispatch } from '../src/tool.js';
import create from '../src/commands/create.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

dispatch({ create }, ['create', ...process.argv.slice(2)], { version: pkg.version })
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`Fatal: ${err?.stack || err}\n`);
    process.exit(1);
  });
