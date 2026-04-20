export function pickOpenApiServerUrl(spec: Record<string, unknown>): string | undefined {
  const servers = spec.servers;
  if (!Array.isArray(servers) || servers.length === 0) return undefined;
  const first = servers[0];
  if (!first || typeof first !== 'object') return undefined;
  const url = (first as { url?: unknown }).url;
  if (typeof url !== 'string') return undefined;
  const t = url.trim();
  return t.length > 0 ? t : undefined;
}

function normalizeBaseUrl(url: string): string {
  let u = url.trim();
  while (u.length > 1 && u.endsWith('/')) u = u.slice(0, -1);
  return u;
}

export function ensureCollectionBaseUrl(collection: Record<string, unknown>, baseUrl: string): void {
  const normalized = normalizeBaseUrl(baseUrl);
  const prev = Array.isArray(collection.variable) ? [...(collection.variable as unknown[])] : [];
  const out: Array<Record<string, unknown>> = [];
  let found = false;
  for (const raw of prev) {
    if (!raw || typeof raw !== 'object') continue;
    const v = raw as Record<string, unknown>;
    if (v.key === 'baseUrl') {
      found = true;
      out.push({
        ...v,
        key: 'baseUrl',
        value: normalized,
        type: typeof v.type === 'string' ? v.type : 'string',
      });
    } else {
      out.push(v);
    }
  }
  if (!found) out.unshift({ key: 'baseUrl', value: normalized, type: 'string' });
  collection.variable = out;
}

