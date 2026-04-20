import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import pman from '../dist/index.js';

test('boots with swagger and pman when Postman env is missing', async () => {
  const app = Fastify({ logger: false });
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: { title: 'API', version: '1.0.0' },
      servers: [{ url: 'http://127.0.0.1' }],
    },
  });
  app.get('/health', { schema: { response: { 200: { type: 'object' } } } }, async () => ({ ok: true }));
  await app.register(pman, {});
  await app.ready();
  const res = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(res.statusCode, 200);
  await app.close();
});
