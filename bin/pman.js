#!/usr/bin/env node
import { unlink } from 'node:fs/promises';

const SUPPORT_DISCORD_URL = 'https://discord.gg/4FBYAMxwdk';

const cmd = process.argv[2];
const statePath = process.argv.includes('--state')
  ? process.argv[process.argv.indexOf('--state') + 1]
  : `${process.cwd()}/.postman-sync.json`;

if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
  process.stdout.write(`pman

Commands:
  pman clear [--state <path>]   Deletes the local sync state file (default .postman-sync.json)
  pman support                  Prints the Discord support invite

Support:
  ${SUPPORT_DISCORD_URL}
`);
  process.exit(0);
}

if (cmd === 'clear') {
  try {
    await unlink(statePath);
    process.stdout.write(`Cleared state: ${statePath}\n`);
  } catch (e) {
    const err = e;
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
      process.stdout.write(`State already missing: ${statePath}\n`);
      process.exit(0);
    }
    process.stderr.write(`Failed to clear state: ${statePath}\n`);
    process.stderr.write(String(e) + '\n');
    process.exit(1);
  }
  process.exit(0);
}

if (cmd === 'support') {
  process.stdout.write(`${SUPPORT_DISCORD_URL}\n`);
  process.exit(0);
}

process.stderr.write(`Unknown command: ${cmd}\n`);
process.exit(1);

