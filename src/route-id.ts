const METHODS = new Set([
  'GET',
  'PUT',
  'POST',
  'DELETE',
  'OPTIONS',
  'HEAD',
  'PATCH',
  'TRACE',
]);

export function normalizeOpenApiPath(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return p
    .split('/')
    .map((seg) => {
      if (!seg) return '';
      const colon = seg.match(/^:([^/]+)$/);
      if (colon) return `{${colon[1]}}`;
      return seg;
    })
    .join('/');
}

export function routeKey(method: string, openApiPath: string): string {
  return `${method.toUpperCase()} ${normalizeOpenApiPath(openApiPath)}`;
}

export function buildRouteId(
  method: string,
  openApiPath: string,
  operation: { operationId?: string } | undefined,
): string {
  if (operation?.operationId && operation.operationId.trim()) {
    return operation.operationId.trim();
  }
  return routeKey(method, openApiPath);
}

export function postmanPathSegmentsToOpenApiPath(segments: string[]): string {
  const normalized = segments.map((s) => {
    const m = s.match(/^:(.+)$/);
    if (m) return `{${m[1]}}`;
    return s;
  });
  return `/${normalized.join('/')}`;
}

export function postmanRequestToRouteKey(method: string, url: unknown): string | null {
  if (!url || typeof url !== 'object') return null;
  const u = url as Record<string, unknown>;
  const m = method.toUpperCase();
  if (Array.isArray(u.path)) {
    const segs = u.path.map((x) => String(x));
    if (segs.length === 0) return null;
    return routeKey(m, postmanPathSegmentsToOpenApiPath(segs));
  }
  if (typeof u.raw === 'string') {
    const raw = u.raw as string;
    const upper = m.toUpperCase();
    let rest = raw;
    if (rest.toUpperCase().startsWith(upper)) {
      rest = rest.slice(upper.length).trim();
    }
    try {
      const parsed = new URL(rest, 'http://local.invalid');
      const pathname = parsed.pathname || '/';
      const parts = pathname.split('/').filter(Boolean);
      if (parts.length === 0) return routeKey(m, '/');
      return routeKey(m, postmanPathSegmentsToOpenApiPath(parts));
    } catch {
      return null;
    }
  }
  return null;
}

export function isHttpMethod(s: string): boolean {
  return METHODS.has(s.toUpperCase());
}

