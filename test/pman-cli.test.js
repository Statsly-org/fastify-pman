import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { text } from 'node:stream/consumers';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bin = join(root, 'bin', 'pman.js');

async function runPman(args) {
  const child = spawn(process.execPath, [bin, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const outP = text(child.stdout);
  const errP = text(child.stderr);
  const [code] = await once(child, 'exit');
  const out = await outP;
  const err = await errP;
  return { code, out, err };
}

test('pman help includes Discord support link', async () => {
  const { code, out, err } = await runPman(['help']);
  assert.equal(code, 0);
  assert.equal(err, '');
  assert.match(out, /https:\/\/discord\.gg\/4FBYAMxwdk/);
});

test('pman support prints Discord invite', async () => {
  const { code, out, err } = await runPman(['support']);
  assert.equal(code, 0);
  assert.equal(err, '');
  assert.equal(out.trim(), 'https://discord.gg/4FBYAMxwdk');
});
