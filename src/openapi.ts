import type { FastifyInstance } from 'fastify';

type WithSwagger = FastifyInstance & { swagger?: () => unknown };

export function getOpenApiObject(fastify: FastifyInstance): Record<string, unknown> {
  const fn = (fastify as WithSwagger).swagger;
  if (typeof fn !== 'function') {
    throw new Error(
      '@st3ix/pman requires @fastify/swagger to register @fastify/swagger before @st3ix/pman.',
    );
  }
  const doc = fn.call(fastify);
  if (!doc || typeof doc !== 'object') {
    throw new Error('@st3ix/pman: fastify.swagger() did not return an OpenAPI object.');
  }
  return doc as Record<string, unknown>;
}

