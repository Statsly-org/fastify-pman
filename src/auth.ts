function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object';
}

export type AuthPatch = {
  headerKey: string;
  headerValue: string;
  variableKey: string;
};

export function authPatchFromConfig(cfg: {
  type: 'apiKey' | 'bearer';
  headerKey: string;
  variableKey: string;
}): AuthPatch {
  if (cfg.type === 'bearer') {
    return { headerKey: 'Authorization', headerValue: `Bearer {{${cfg.variableKey}}}`, variableKey: cfg.variableKey };
  }
  return { headerKey: cfg.headerKey, headerValue: `{{${cfg.variableKey}}}`, variableKey: cfg.variableKey };
}

export function inferGlobalAuthPatch(openApi: Record<string, unknown>): AuthPatch | null {
  const components = openApi.components;
  if (!isRecord(components)) return null;
  const schemes = components.securitySchemes;
  if (!isRecord(schemes)) return null;

  for (const value of Object.values(schemes)) {
    if (!isRecord(value)) continue;
    const type = typeof value.type === 'string' ? value.type : '';
    if (type === 'http') {
      const scheme = typeof value.scheme === 'string' ? value.scheme : '';
      if (scheme === 'bearer') {
        return { headerKey: 'Authorization', headerValue: 'Bearer {{token}}', variableKey: 'token' };
      }
    }
    if (type === 'apiKey') {
      const place = typeof value.in === 'string' ? value.in : '';
      const name = typeof value.name === 'string' ? value.name : '';
      if (place === 'header' && name) {
        const variableKey = name === 'Authorization' ? 'token' : name;
        const headerValue = name === 'Authorization' ? 'Bearer {{token}}' : `{{${variableKey}}}`;
        return { headerKey: name, headerValue, variableKey };
      }
    }
  }
  return null;
}

export function applyAuthHeaderToRequest(item: Record<string, unknown>, patch: AuthPatch): void {
  const req = item.request;
  if (!isRecord(req)) return;
  const headers = Array.isArray(req.header) ? [...(req.header as unknown[])] : [];
  const exists = headers.some((h) => isRecord(h) && String(h.key).toLowerCase() === patch.headerKey.toLowerCase());
  if (!exists) {
    headers.unshift({ key: patch.headerKey, value: patch.headerValue });
    req.header = headers;
  }
}

export function ensureCollectionVariable(
  collection: Record<string, unknown>,
  key: string,
  value: string,
): void {
  const prev = Array.isArray(collection.variable) ? [...(collection.variable as unknown[])] : [];
  const out: Array<Record<string, unknown>> = [];
  let found = false;
  for (const raw of prev) {
    if (!isRecord(raw)) continue;
    const v = raw as Record<string, unknown>;
    if (v.key === key) {
      found = true;
      out.push({ ...v, key, value, type: typeof v.type === 'string' ? v.type : 'string' });
    } else {
      out.push(v);
    }
  }
  if (!found) out.unshift({ key, value, type: 'string' });
  collection.variable = out;
}

