#!/usr/bin/env node
/**
 * brmbh — agentic WordPress suite CLI.
 * One front door for: scaffold, add (block/cpt/skills), dev, doctor, deploy, db.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { dispatch } from '../src/tool.js';

import create from '../src/commands/create.js';
import add from '../src/commands/add.js';
import dev from '../src/commands/dev.js';
import doctor from '../src/commands/doctor.js';
import deploy from '../src/commands/deploy.js';
import db from '../src/commands/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

const commands = { create, add, dev, doctor, deploy, db };

dispatch(commands, process.argv.slice(2), { version: pkg.version })
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`Fatal: ${err?.stack || err}\n`);
    process.exit(1);
  });
