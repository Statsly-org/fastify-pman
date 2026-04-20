import { buildRouteId, isHttpMethod, routeKey } from './route-id.js';

export type OpenApiOperationRef = {
  routeId: string;
  routeKey: string;
  method: string;
  path: string;
  tags: string[];
  summary: string | undefined;
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
      const op = operation as { operationId?: string; tags?: unknown; summary?: string };
      const tags = Array.isArray(op.tags) ? op.tags.map((t) => String(t)) : [];
      const rk = routeKey(method, pathKey);
      out.push({
        routeId: buildRouteId(method, pathKey, op),
        routeKey: rk,
        method: method.toUpperCase(),
        path: pathKey,
        tags,
        summary: typeof op.summary === 'string' ? op.summary : undefined,
      });
    }
  }
  return out;
}

