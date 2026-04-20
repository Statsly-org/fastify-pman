import type { ResolvedPmanOptions } from './options.js';

type Json = Record<string, unknown>;

export type PostmanCollectionEnvelope = {
  collection: Json;
};

function headers(apiKey: string): Record<string, string> {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Api-Key': apiKey,
  };
}

async function readJson(res: Response): Promise<Json> {
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { parseError: true, text };
  }
  if (!res.ok) {
    const msg =
      typeof (body as Json).error === 'object' && (body as Json).error !== null
        ? JSON.stringify((body as Json).error)
        : text.slice(0, 500);
    throw new Error(`Postman API ${res.status}: ${msg}`);
  }
  return body as Json;
}

export async function getCollection(
  resolved: ResolvedPmanOptions,
  collectionUid: string,
): Promise<Json> {
  const url = new URL(`/collections/${encodeURIComponent(collectionUid)}`, resolved.postmanApiBase);
  const res = await resolved.fetchImpl(url, {
    method: 'GET',
    headers: headers(resolved.postmanApiKey!),
  });
  return readJson(res);
}

export async function putCollection(
  resolved: ResolvedPmanOptions,
  collectionUid: string,
  collection: Json,
): Promise<Json> {
  const url = new URL(`/collections/${encodeURIComponent(collectionUid)}`, resolved.postmanApiBase);
  const body = JSON.stringify({ collection });
  const res = await resolved.fetchImpl(url, {
    method: 'PUT',
    headers: headers(resolved.postmanApiKey!),
    body,
  });
  return readJson(res);
}

export async function findCollectionUidByName(
  resolved: ResolvedPmanOptions,
  collectionName: string,
): Promise<string | undefined> {
  if (!resolved.workspaceId) return undefined;
  const url = new URL('/collections', resolved.postmanApiBase);
  url.searchParams.set('workspace', resolved.workspaceId);
  const res = await resolved.fetchImpl(url, {
    method: 'GET',
    headers: headers(resolved.postmanApiKey!),
  });
  const data = await readJson(res);
  const list = data.collections;
  if (!Array.isArray(list)) return undefined;
  const want = collectionName.trim();
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const c = raw as Record<string, unknown>;
    if (typeof c.name !== 'string' || c.name.trim() !== want) continue;
    const uid = typeof c.uid === 'string' ? c.uid : typeof c.id === 'string' ? c.id : undefined;
    if (uid) return uid;
  }
  return undefined;
}

export async function createCollection(
  resolved: ResolvedPmanOptions,
  collection: Json,
): Promise<{ uid: string }> {
  if (!resolved.workspaceId) {
    throw new Error('workspaceId (or POSTMAN_WORKSPACE_ID) is required to create a collection');
  }
  const url = new URL('/collections', resolved.postmanApiBase);
  url.searchParams.set('workspace', resolved.workspaceId);
  const res = await resolved.fetchImpl(url, {
    method: 'POST',
    headers: headers(resolved.postmanApiKey!),
    body: JSON.stringify({ collection }),
  });
  const data = await readJson(res);
  const coll = data.collection as Json | undefined;
  const uid = coll?.uid ?? coll?.id;
  if (typeof uid !== 'string') {
    throw new Error('Postman API did not return collection uid');
  }
  return { uid };
}

