import { createServer } from 'node:net';
import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import pman from '../dist/index.js';

/**
 * Postman: fill when you run `node examples/playground.mjs` without `.env`.
 * Leave blank to use POSTMAN_* from the environment.
 * Never commit these values! Make sure before you commit!
 */
const postman = {
  postmanApiKey: '',
  workspaceId: '',
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
        tags: ['Users'],
        summary: 'List demo users',
        response: { 200: { type: 'array', items: { type: 'string' } } },
      },
    },
    async () => ['alice', 'bob'],
  );

  fastify.get(
    '/demo/users/:id',
    {
      schema: {
        tags: ['Users'],
        summary: 'Get demo user',
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
        tags: ['Users'],
        summary: 'Create demo user',
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

  fastify.get(
    '/demo/posts',
    {
      schema: {
        tags: ['Posts'],
        summary: 'List demo posts',
        response: { 200: { type: 'array', items: { type: 'object' } } },
      },
    },
    async () => [{ id: 'p1', title: 'Hello' }],
  );

  fastify.delete(
    '/demo/posts/:id',
    {
      schema: {
        tags: ['Posts'],
        summary: 'Delete demo post',
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
    postmanBaseUrl: publicBase,
    collectionName: 'pman ~ by st3ix',
  });

  await fastify.listen({ port, host: '127.0.0.1' });
  fastify.log.info(`Listening at ${publicBase} (Postman baseUrl matches this port)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
