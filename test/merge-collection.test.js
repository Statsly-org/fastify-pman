import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeOpenApiIntoPostmanCollection, shellCollection } from '../dist/merge-collection.js';

test('merge preserves events and marks _pman', () => {
  const existing = shellCollection('API');
  existing.item = [
    {
      name: 'Users',
      item: [
        {
          name: 'List',
          request: { method: 'GET', url: { path: ['users'] } },
          event: [{ listen: 'test', script: { exec: ['pm.test("x", () => {})'] } }],
          _pman: { routeId: 'listUsers' },
        },
      ],
    },
  ];

  const generated = shellCollection('gen');
  generated.item = [
    {
      name: 'g',
      item: [
        {
          name: 'List gen',
          request: {
            method: 'GET',
            url: { path: ['users'], host: ['{{baseUrl}}'], raw: 'GET {{baseUrl}}/users' },
            header: [{ key: 'X', value: '1' }],
          },
        },
      ],
    },
  ];

  const routes = [
    {
      routeId: 'listUsers',
      routeKey: 'GET /users',
      method: 'GET',
      path: '/users',
      tags: [],
      summary: 'List users',
      folder: 'Users',
    },
  ];

  const merged = mergeOpenApiIntoPostmanCollection({ existing, generated, routes });
  const flat = JSON.stringify(merged);
  assert.match(flat, /listUsers/);
  assert.match(flat, /pm\.test/);
  assert.match(flat, /"X"/);
});
