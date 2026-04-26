import { buildRouteId, isHttpMethod, routeKey } from './route-id.js';

export type OpenApiOperationRef = {
  routeId: string;
  routeKey: string;
  method: string;
  path: string;
  tags: string[];
  summary: string | undefined;
  /**
   * Short Postman item title.
   *
   * Prefer `schema['x-pman-name']` or `schema['x-name']` in Fastify route schemas — these are emitted
   * as OpenAPI operation extensions and are readable here. Plain `schema.name` is not emitted by @fastify/swagger.
   */
  name: string | undefined;
};

export function listOpenApiOperations(spec: Record<string, unknown>): OpenApiOperationRef[] {
  const paths = spec.paths;
  if (!paths || typeof paths !== 'object') return [];
  const out: OpenApiOperationRef[] = [];
  for (const [pathKey, pathItem] of Object.entries(paths as Record<string, unknown>)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const [method, operation] of Object.entries(pathItem as Record<string, unknown>)) {
      if (!isHttpMethod(method)) continue;
      if (!operation || typeof operation !== 'object') continue;
      const op = operation as {
        operationId?: string;
        tags?: unknown;
        summary?: string;
        name?: string;
        'x-name'?: unknown;
        'x-pman-name'?: unknown;
      };
      const tags = Array.isArray(op.tags) ? op.tags.map((t) => String(t)) : [];
      const rk = routeKey(method, pathKey);
      const extNameRaw =
        (typeof op['x-pman-name'] === 'string' && op['x-pman-name'].trim() ? op['x-pman-name'] : undefined) ||
        (typeof op['x-name'] === 'string' && op['x-name'].trim() ? op['x-name'] : undefined);
      const extName = extNameRaw ? String(extNameRaw).trim() : undefined;
      // NOTE: `schema.name` in Fastify is not represented as OpenAPI `name` in @fastify/swagger output,
      // but `x-…` OpenAPI extension fields on the operation are preserved.
      const displayName = typeof op.name === 'string' && op.name.trim() ? op.name.trim() : extName;
      out.push({
        routeId: buildRouteId(method, pathKey, op),
        routeKey: rk,
        method: method.toUpperCase(),
        path: pathKey,
        tags,
        summary: typeof op.summary === 'string' ? op.summary : undefined,
        name: displayName,
      });
    }
  }
  return out;
}

