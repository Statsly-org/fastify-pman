import { test } from 'node:test';
import assert from 'node:assert/strict';

test('update-check registry URL encodes scoped name', () => {
  const url = `https://registry.npmjs.org/${encodeURIComponent('@st3ix/pman')}`;
  assert.equal(url, 'https://registry.npmjs.org/%40st3ix%2Fpman');
});

