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
      folderPath: ['Users'],
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
      folderPath: ['Company'],
    },
  ];

  const merged = mergeOpenApiIntoPostmanCollection({ existing, generated, routes });
  const flat = JSON.stringify(merged);
  assert.match(flat, /"name":"Accept invite"/);
  assert.match(flat, /Accept organization invitation; invitee only/);
});

test('path strategy nests folderPath into Postman subfolders (Auth / User / Admin)', () => {
  const existing = shellCollection('API');
  const generated = shellCollection('gen');
  generated.item = [
    {
      name: 'g',
      item: [
        {
          name: 'Create',
          request: {
            method: 'POST',
            url: { path: ['auth', 'user', 'admin', 'create'] },
          },
        },
      ],
    },
  ];

  const routes = [
    {
      routeId: 'adminCreate',
      routeKey: 'POST /auth/user/admin/create',
      method: 'POST',
      path: '/auth/user/admin/create',
      tags: [],
      name: 'Create admin',
      summary: 'Create admin user',
      folder: 'Auth',
      folderPath: ['Auth', 'User', 'Admin'],
    },
  ];

  const merged = mergeOpenApiIntoPostmanCollection({ existing, generated, routes });
  const flat = JSON.stringify(merged);
  assert.match(flat, /"name":"Auth"/);
  assert.match(flat, /"name":"User"/);
  assert.match(flat, /"name":"Admin"/);
  assert.match(flat, /"name":"Create admin"/);
  assert.match(flat, /create admin user/i);
});

test('legacy tag-only folder is removed when state has only nested path keys (Demo>Users)', () => {
  const existing = shellCollection('API');
  existing.item = [
    {
      name: 'Users',
      _pman: { folderManaged: true },
      item: [
        {
          name: 'old',
          request: { method: 'GET', url: { path: ['demo', 'users'] } },
          _pman: { routeId: 'listDemoUsers' },
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
          name: 'List',
          request: { method: 'GET', url: { path: ['demo', 'users'] } },
        },
      ],
    },
  ];
  const routes = [
    {
      routeId: 'listDemoUsers',
      routeKey: 'GET /demo/users',
      method: 'GET',
      path: '/demo/users',
      tags: ['Users'],
      name: 'List users',
      summary: 'List demo users',
      folder: 'Demo',
      folderPath: ['Demo', 'Users'],
    },
  ];
  const merged = mergeOpenApiIntoPostmanCollection({
    existing,
    generated,
    routes,
    managedFoldersFromState: ['Demo>Users'],
  });
  const top = merged.item;
  assert.ok(Array.isArray(top));
  const rootLevelUsers = top.filter((x) => x && typeof x === 'object' && x.name === 'Users');
  assert.equal(rootLevelUsers.length, 0);
  const flat = JSON.stringify(merged);
  assert.match(flat, /"name":"Demo"/);
  assert.match(flat, /listDemoUsers/);
});
