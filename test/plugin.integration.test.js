import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';
import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import pman from '../dist/index.js';

async function withMockAgent(run) {
  const prior = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  try {
    await run(agent);
  } finally {
    await agent.close();
    setGlobalDispatcher(prior);
  }
}

test('creates collection via Postman API and writes state file', async () => {
  const workdir = await mkdtemp(join(tmpdir(), 'pman-'));
  try {
    await withMockAgent(async (agent) => {
      agent
        .get('https://api.getpostman.com')
        .intercept({
          path: '/collections',
          method: 'GET',
          query: { workspace: 'ws-test' },
        })
        .reply(200, { collections: [] });
      agent
        .get('https://api.getpostman.com')
        .intercept({
          path: '/collections',
          method: 'POST',
          query: { workspace: 'ws-test' },
        })
        .reply(200, { collection: { id: 'id-1', uid: 'uid-col-1' } });

      const statePath = join(workdir, 'sync.json');
      const app = Fastify({ logger: false });
      await app.register(swagger, {
        openapi: {
          openapi: '3.0.0',
          info: { title: 'API', version: '1.0.0' },
          servers: [{ url: 'http://127.0.0.1' }],
        },
      });
      app.get(
        '/items',
        {
          schema: {
            tags: ['Items'],
            summary: 'List items',
            response: { 200: { type: 'object' } },
          },
        },
        async () => ({}),
      );
      await app.register(pman, {
        workspaceId: 'ws-test',
        postmanApiKey: 'key-test',
        statePath,
        collectionName: 'FromTest',
        dryRun: false,
      });
      await app.ready();
      await app.close();

      const raw = await readFile(statePath, 'utf8');
      const st = JSON.parse(raw);
      assert.equal(st.collectionUid, 'uid-col-1');
    });
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
});

test('reuses workspace collection by name when state file is missing', async () => {
  const workdir = await mkdtemp(join(tmpdir(), 'pman-reuse-'));
  try {
    await withMockAgent(async (agent) => {
      let postHits = 0;
      agent
        .get('https://api.getpostman.com')
        .intercept({
          path: '/collections',
          method: 'GET',
          query: { workspace: 'ws-reuse' },
        })
        .reply(200, {
          collections: [{ name: 'ReuseMe', uid: 'uid-reuse-1', id: 'id-reuse' }],
        });
      agent
        .get('https://api.getpostman.com')
        .intercept({ path: '/collections/uid-reuse-1', method: 'GET' })
        .reply(200, {
          collection: {
            info: {
              name: 'ReuseMe',
              schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
            },
            item: [],
          },
        });
      agent
        .get('https://api.getpostman.com')
        .intercept({ path: '/collections/uid-reuse-1', method: 'PUT' })
        .reply(200, { collection: { uid: 'uid-reuse-1' } });
      agent
        .get('https://api.getpostman.com')
        .intercept({
          path: '/collections',
          method: 'POST',
          query: { workspace: 'ws-reuse' },
        })
        .reply(500, () => {
          postHits += 1;
          return {};
        });

      const statePath = join(workdir, 'sync.json');
      const app = Fastify({ logger: false });
      await app.register(swagger, {
        openapi: {
          openapi: '3.0.0',
          info: { title: 'API', version: '1.0.0' },
          servers: [{ url: 'http://127.0.0.1' }],
        },
      });
      app.get('/a', { schema: { response: { 200: { type: 'object' } } } }, async () => ({}));
      await app.register(pman, {
        workspaceId: 'ws-reuse',
        postmanApiKey: 'k',
        statePath,
        collectionName: 'ReuseMe',
        dryRun: false,
      });
      await app.ready();
      await app.close();

      const raw = await readFile(statePath, 'utf8');
      const st = JSON.parse(raw);
      assert.equal(st.collectionUid, 'uid-reuse-1');
      assert.equal(postHits, 0);
    });
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
});

test('recovers when saved collection uid returns 404', async () => {
  const workdir = await mkdtemp(join(tmpdir(), 'pman-404-'));
  try {
    await withMockAgent(async (agent) => {
      agent
        .get('https://api.getpostman.com')
        .intercept({ path: '/collections/stale-uid', method: 'GET' })
        .reply(404, {
          error: {
            name: 'instanceNotFoundError',
            message: 'We could not find the collection you are looking for',
          },
        });
      agent
        .get('https://api.getpostman.com')
        .intercept({
          path: '/collections',
          method: 'GET',
          query: { workspace: 'ws-404' },
        })
        .reply(200, { collections: [] });
      agent
        .get('https://api.getpostman.com')
        .intercept({
          path: '/collections',
          method: 'POST',
          query: { workspace: 'ws-404' },
        })
        .reply(200, { collection: { uid: 'fresh-uid', id: 'fresh-id' } });

      const statePath = join(workdir, 'sync.json');
      await writeFile(statePath, JSON.stringify({ collectionUid: 'stale-uid' }), 'utf8');

      const app = Fastify({ logger: false });
      await app.register(swagger, {
        openapi: {
          openapi: '3.0.0',
          info: { title: 'API', version: '1.0.0' },
          servers: [{ url: 'http://127.0.0.1' }],
        },
      });
      app.get('/x', { schema: { response: { 200: { type: 'object' } } } }, async () => ({}));
      await app.register(pman, {
        workspaceId: 'ws-404',
        postmanApiKey: 'k',
        statePath,
        collectionName: 'FreshColl',
        dryRun: false,
      });
      await app.ready();
      await app.close();

      const raw = await readFile(statePath, 'utf8');
      const st = JSON.parse(raw);
      assert.equal(st.collectionUid, 'fresh-uid');
    });
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
});

test('updates collection when state file exists', async () => {
  const workdir = await mkdtemp(join(tmpdir(), 'pman-up-'));
  try {
    await withMockAgent(async (agent) => {
      agent
        .get('https://api.getpostman.com')
        .intercept({ path: '/collections/col-uid-2', method: 'GET' })
        .reply(200, {
          collection: {
            info: { name: 'Old', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
            item: [],
          },
        });
      agent
        .get('https://api.getpostman.com')
        .intercept({ path: '/collections/col-uid-2', method: 'PUT' })
        .reply(200, { collection: { uid: 'col-uid-2' } });

      const statePath = join(workdir, 'sync.json');
      await writeFile(statePath, JSON.stringify({ collectionUid: 'col-uid-2' }), 'utf8');

      const app = Fastify({ logger: false });
      await app.register(swagger, {
        openapi: {
          openapi: '3.0.0',
          info: { title: 'API', version: '1.0.0' },
          servers: [{ url: 'http://127.0.0.1' }],
        },
      });
      app.get('/z', { schema: { response: { 200: { type: 'object' } } } }, async () => ({}));
      await app.register(pman, {
        workspaceId: 'ws',
        postmanApiKey: 'k',
        statePath,
        dryRun: false,
      });
      await app.ready();
      await app.close();
    });
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
});

test('dryRun does not call Postman API', async () => {
  const workdir = await mkdtemp(join(tmpdir(), 'pman-dry-'));
  try {
    await withMockAgent(async (agent) => {
      let hit = 0;
      agent
        .get('https://api.getpostman.com')
        .intercept({
          path: '/collections',
          method: 'POST',
          query: { workspace: 'ws' },
        })
        .reply(500, () => {
          hit += 1;
          return {};
        });

      const statePath = join(workdir, 'dry.json');
      const app = Fastify({ logger: false });
      await app.register(swagger, {
        openapi: {
          openapi: '3.0.0',
          info: { title: 'API', version: '1.0.0' },
          servers: [{ url: 'http://127.0.0.1' }],
        },
      });
      app.get('/x', { schema: { response: { 200: { type: 'object' } } } }, async () => ({}));
      await app.register(pman, {
        workspaceId: 'ws',
        postmanApiKey: 'k',
        statePath,
        dryRun: true,
      });
      await app.ready();
      await app.close();
      assert.equal(hit, 0);
    });
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
});
