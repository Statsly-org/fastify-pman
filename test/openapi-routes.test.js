import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listOpenApiOperations } from '../dist/openapi-routes.js';

test('listOpenApiOperations reads x-pman-name and x-name', () => {
  const spec = {
    paths: {
      '/a': {
        get: { summary: 'S', 'x-pman-name': 'A' },
      },
      '/b': {
        get: { summary: 'S', 'x-name': 'B' },
      },
    },
  };

  const ops = listOpenApiOperations(spec);
  const a = ops.find((o) => o.path === '/a' && o.method === 'GET');
  const b = ops.find((o) => o.path === '/b' && o.method === 'GET');
  assert.equal(a?.name, 'A');
  assert.equal(b?.name, 'B');
});

test('listOpenApiOperations prefers x-pman-name over x-name', () => {
  const spec = {
    paths: {
      '/c': {
        get: { summary: 'S', 'x-pman-name': 'P', 'x-name': 'N' },
      },
    },
  };
  const ops = listOpenApiOperations(spec);
  const c = ops.find((o) => o.path === '/c' && o.method === 'GET');
  assert.equal(c?.name, 'P');
});
