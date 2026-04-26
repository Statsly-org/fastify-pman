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
      name: undefined,
      summary: 'List users',
      folder: 'Users',
    },
  ];

  const merged = mergeOpenApiIntoPostmanCollection({ existing, generated, routes });
  const flat = JSON.stringify(merged);
  assert.match(flat, /listUsers/);
  assert.match(flat, /pm\.test/);
  assert.match(flat, /"X"/);
  assert.match(flat, /"name":"GET users"/);
  assert.match(flat, /"description":"List users/);
  assert.match(flat, /`GET \/users`/);
});

test('merge uses pman display name; summary leads docs', () => {
  const existing = shellCollection('API');
  existing.item = [
    {
      name: 'Company',
      item: [
        {
          name: 'old',
          request: { method: 'POST', url: { path: ['invites', 'accept'] } },
          _pman: { routeId: 'acceptInvite' },
        },
      ],
    },
  ];

  const generated = shellCollection('gen');
  generated.item = [
    {
      name: 'Company',
      item: [
        {
          name: 'Long summary title from converter',
          request: { method: 'POST', url: { path: ['invites', 'accept'] } },
        },
      ],
    },
  ];

  const routes = [
    {
      routeId: 'acceptInvite',
      routeKey: 'POST /invites/accept',
      method: 'POST',
      path: '/invites/accept',
      tags: ['Company'],
      name: 'Accept invite',
      summary: 'Accept organization invitation; invitee only',
      folder: 'Company',
    },
  ];

  const merged = mergeOpenApiIntoPostmanCollection({ existing, generated, routes });
  const flat = JSON.stringify(merged);
  assert.match(flat, /"name":"Accept invite"/);
  assert.match(flat, /Accept organization invitation; invitee only/);
});
