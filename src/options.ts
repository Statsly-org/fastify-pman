import type { FastifyBaseLogger } from 'fastify';

export type FolderStrategy = 'path' | 'tags' | 'hybrid';

export type FastifyPmanOptions = {
  workspaceId?: string;
  /** Optional Postman workspace URL. If set, the workspace id is extracted automatically. */
  workspaceLink?: string;
  collectionName?: string;
  statePath?: string;
  dryRun?: boolean;
  postmanApiKey?: string;
  /** Sets the Postman collection variable `baseUrl` (used by `{{baseUrl}}` in generated requests). */
  postmanBaseUrl?: string;
  /** If true (default), reuse a workspace collection with the same `collectionName` when no state file exists. */
  reuseExistingCollectionByName?: boolean;
  postmanApiBase?: string;
  /** Adds auth (best-effort) based on OpenAPI security schemes. */
  autoAuth?: boolean;
  /**
   * Explicit auth configuration (overrides inference).
   * Use this when your OpenAPI securitySchemes are missing or you want a stable variable name.
   */
  auth?: {
    type: 'apiKey' | 'bearer';
    headerKey?: string;
    variableKey?: string;
  };
  folderStrategy?: FolderStrategy;
  folderPathStripPrefix?: string;
  fetchImpl?: typeof fetch;
};

export type ResolvedPmanOptions = {
  workspaceId: string | undefined;
  collectionName: string;
  statePath: string;
  dryRun: boolean;
  postmanApiKey: string | undefined;
  postmanBaseUrl: string | undefined;
  postmanApiBase: string;
  folderStrategy: FolderStrategy;
  folderPathStripPrefix: string | undefined;
  reuseExistingCollectionByName: boolean;
  autoAuth: boolean;
  auth:
    | {
        type: 'apiKey' | 'bearer';
        headerKey: string;
        variableKey: string;
      }
    | null;
  fetchImpl: typeof fetch;
};

function firstNonEmpty(...candidates: (string | undefined)[]): string | undefined {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c.trim();
  }
  return undefined;
}

function wspacelink(link: string | undefined): string | undefined {
  if (typeof link !== 'string') return undefined;
  const raw = link.trim();
  if (!raw) return undefined;

  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return undefined;
  }

  const parts = u.pathname.split('/').filter(Boolean);
  const i = parts.indexOf('workspace');
  if (i < 0) return undefined;
  const seg = parts[i + 1];
  if (typeof seg !== 'string' || seg.length === 0) return undefined;

  // Typical format: "<name>~<uuid>"
  const afterTilde = seg.includes('~') ? seg.split('~').pop() : seg;
  const id = (afterTilde ?? '').trim();
  if (!id) return undefined;

  // Very small sanity check: UUID-ish.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return undefined;
  }
  return id;
}

export function resolvePmanOptions(opts: FastifyPmanOptions): ResolvedPmanOptions {
  const auth =
    opts.auth && typeof opts.auth === 'object'
      ? {
          type: opts.auth.type,
          headerKey:
            opts.auth.type === 'bearer'
              ? 'Authorization'
              : (opts.auth.headerKey?.trim() || 'X-API-Key'),
          variableKey:
            opts.auth.variableKey?.trim() ||
            (opts.auth.type === 'bearer' ? 'token' : 'apiKey'),
        }
      : null;

  const extractedWorkspaceId = wspacelink(opts.workspaceLink);

  return {
    workspaceId: firstNonEmpty(opts.workspaceId, extractedWorkspaceId, process.env.POSTMAN_WORKSPACE_ID),
    collectionName: opts.collectionName?.trim() || 'Fastify (pman)',
    statePath: opts.statePath ?? `${process.cwd()}/.postman-sync.json`,
    dryRun: opts.dryRun ?? false,
    postmanApiKey: firstNonEmpty(opts.postmanApiKey, process.env.POSTMAN_API_KEY),
    postmanBaseUrl: firstNonEmpty(opts.postmanBaseUrl, process.env.POSTMAN_BASE_URL),
    postmanApiBase: opts.postmanApiBase?.trim() || 'https://api.getpostman.com',
    folderStrategy: opts.folderStrategy ?? 'path',
    folderPathStripPrefix: opts.folderPathStripPrefix,
    reuseExistingCollectionByName: opts.reuseExistingCollectionByName ?? true,
    autoAuth: opts.autoAuth ?? true,
    auth,
    fetchImpl: opts.fetchImpl ?? globalThis.fetch,
  };
}

export type PmanRuntime = {
  resolved: ResolvedPmanOptions;
  log: FastifyBaseLogger;
};
