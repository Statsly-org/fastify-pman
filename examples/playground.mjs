import { createServer } from 'node:net';
import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import pman from '../dist/index.js';

/**
 * Local manual test for @st3ix/pman (nested path folders + titles/docs).
 *
 * Run (repo root):
 *   npm run build && node --env-file=.env examples/playground.mjs
 * or:
 *   npm run dev:example
 *
 * Env (or fill `postman` below): POSTMAN_API_KEY, POSTMAN_WORKSPACE_ID, optional POSTMAN_BASE_URL.
 * Never commit secrets. Do not commit `.postman-sync.json`.
 *
 * After sync, open the workspace collection in Postman and verify:
 * - `folderStrategy: 'path'` + `pathFolderNesting: 'nested'`: URL segments become nested folders.
 *   Example: POST `/auth/user/admin/create` → folders Auth → User → Admin, request under Admin.
 * - `/demo/...` routes sit under Demo → … (e.g. Demo → Users).
 * - Short request names from `x-pman-name`; long `summary` text in request Docs.
 */

const postman = {
  postmanApiKey: '',
  workspaceId: '',
  workspaceLink: '',
};

async function pickListenPort(preferred) {
  const probe = (p) =>
    new Promise((resolve, reject) => {
      const s = createServer();
      s.once('error', reject);
      s.listen(p, '127.0.0.1', () => {
        const addr = s.address();
        const chosen =
          typeof addr === 'object' && addr !== null && 'port' in addr ? addr.port : p;
        s.close(() => resolve(chosen));
      });
    });
  try {
    return await probe(preferred);
  } catch {
    return await probe(0);
  }
}

async function main() {
  let logger = true;
  try {
    await import('pino-pretty');
    logger = {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
    };
  } catch {
    /* optional */
  }

  const preferredPort = Number(process.env.PORT);
  const port =
    Number.isFinite(preferredPort) && preferredPort > 0
      ? await pickListenPort(preferredPort)
      : await pickListenPort(3030);

  const publicBase = `http://127.0.0.1:${port}`;

  const fastify = Fastify({ logger });

  await fastify.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: { title: 'pman playground', version: '0.0.1' },
      servers: [{ url: publicBase }],
      components: {
        securitySchemes: {
          apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Token' },
        },
      },
      security: [{ apiKey: [] }],
    },
  });

  fastify.get(
    '/demo/users',
    {
      schema: {
        // Postman item title: use an OpenAPI extension field (plain `name` is not emitted to OpenAPI by @fastify/swagger)
        'x-pman-name': 'List users',
        tags: ['Users'],
        summary: 'List demo users (playground) — this sentence should be the first line in Postman "Docs"',
        response: { 200: { type: 'array', items: { type: 'string' } } },
      },
    },
    async () => ['alice', 'bob'],
  );

  fastify.get(
    '/demo/users/:id',
    {
      schema: {
        'x-pman-name': 'Get user',
        tags: ['Users'],
        summary: 'Get a single demo user by id from the in-memory list',
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        response: { 200: { type: 'object' } },
      },
    },
    async (req) => ({ id: req.params.id }),
  );

  fastify.post(
    '/demo/users',
    {
      schema: {
        'x-pman-name': 'Create user',
        tags: ['Users'],
        summary: 'Create a demo user with a `name` field (201 response included for Postman)',
        body: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              created: { type: 'boolean' },
              name: { type: 'string' },
            },
            required: ['created', 'name'],
          },
        },
      },
    },
    async (req, reply) => reply.code(201).send({ created: true, name: req.body.name }),
  );

  fastify.post(
    '/auth/user/admin/create',
    {
      schema: {
        'x-pman-name': 'Create admin',
        summary: 'Path-nested demo: expect Postman folders Auth → User → Admin (folderStrategy: path).',
        response: { 201: { type: 'object', additionalProperties: true } },
      },
    },
    async (_req, reply) => reply.code(201).send({ created: true }),
  );

  fastify.get(
    '/demo/posts',
    {
      schema: {
        // Intentionally no `x-pman-name` / `x-name`: Postman title should fall back to something like `GET posts`.
        tags: ['Posts'],
        summary: 'List all demo posts (this long summary should not become the request title)',
        response: { 200: { type: 'array', items: { type: 'object' } } },
      },
    },
    async () => [{ id: 'p1', title: 'Hello' }],
  );

  fastify.post(
    '/demo/company/invites/accept',
    {
      schema: {
        // Mirrors the "long summary" pain case: `x-pman-name` keeps Postman titles short.
        'x-pman-name': 'Accept invite',
        tags: ['Company'],
        summary:
          'Accept organization invitation (Better Auth); invitee only — this line should be the first paragraph in Postman docs, not the request title',
        body: { type: 'object', additionalProperties: true },
        response: { 200: { type: 'object' } },
      },
    },
    async () => ({ ok: true }),
  );

  fastify.delete(
    '/demo/posts/:id',
    {
      schema: {
        'x-pman-name': 'Delete post',
        tags: ['Posts'],
        summary: 'Delete a demo post by id (returns 204)',
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        response: { 204: { type: 'null' } },
      },
    },
    async (_req, reply) => reply.code(204).send(),
  );

  await fastify.register(pman, {
    postmanApiKey: postman.postmanApiKey,
    workspaceId: postman.workspaceId,
    workspaceLink: postman.workspaceLink,
    postmanBaseUrl: publicBase,
    collectionName: 'pman ~ by st3ix',
    folderStrategy: 'path',
    pathFolderNesting: 'nested',
  });

  await fastify.listen({ port, host: '127.0.0.1' });
  fastify.log.info(
    { publicBase, folderStrategy: 'path', pathFolderNesting: 'nested' },
    'pman: listening — check Postman for nested folders (e.g. Auth/User/Admin for POST /auth/user/admin/create)',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
