import type { FastifyBaseLogger } from 'fastify';

type ChildLogger = FastifyBaseLogger & {
  child?: (bindings: Record<string, unknown>) => FastifyBaseLogger;
};

export function createPmanLogger(parent: FastifyBaseLogger): FastifyBaseLogger {
  const c = parent as ChildLogger;
  return typeof c.child === 'function' ? c.child({ plugin: 'pman' }) : parent;
}

