import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeOpenApiPath,
  routeKey,
  buildRouteId,
  postmanRequestToRouteKey,
} from '../dist/route-id.js';

test('normalizeOpenApiPath adds leading slash and colon params', () => {
  assert.equal(normalizeOpenApiPath('users/:id'), '/users/{id}');
  assert.equal(normalizeOpenApiPath('/users/{id}'), '/users/{id}');
});

test('routeKey matches postmanRequestToRouteKey for same route', () => {
  const rk = routeKey('get', '/users/{id}');
  const pk = postmanRequestToRouteKey('GET', { path: ['users', ':id'] });
  assert.equal(pk, rk);
});

test('buildRouteId prefers operationId', () => {
  assert.equal(buildRouteId('GET', '/x', { operationId: 'op1' }), 'op1');
  assert.equal(buildRouteId('GET', '/x', {}), routeKey('GET', '/x'));
});
