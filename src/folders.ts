import type { FolderStrategy } from './options.js';
import type { OpenApiOperationRef } from './openapi-routes.js';
import { normalizeOpenApiPath } from './route-id.js';

function titleCaseSegment(seg: string): string {
  if (!seg) return '';
  const s = seg.replace(/[{}]/g, '');
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function folderFromPath(path: string, stripPrefix?: string): string {
  let p = normalizeOpenApiPath(path);
  if (stripPrefix) {
    const sp = normalizeOpenApiPath(stripPrefix);
    if (p === sp || p.startsWith(`${sp}/`)) {
      p = p.slice(sp.length) || '/';
      if (!p.startsWith('/')) p = `/${p}`;
    }
  }
  const segments = p.split('/').filter(Boolean);
  const first = segments[0];
  if (!first) return 'Root';
  return titleCaseSegment(first.replace(/[{}]/g, ''));
}

export function folderNameForOperation(
  op: OpenApiOperationRef,
  strategy: FolderStrategy,
  stripPrefix?: string,
): string {
  if (strategy === 'tags' || strategy === 'hybrid') {
    const tag = op.tags[0];
    if (tag) return titleCaseSegment(tag);
    if (strategy === 'hybrid') return folderFromPath(op.path, stripPrefix);
    return 'Untagged';
  }
  return folderFromPath(op.path, stripPrefix);
}

export type FolderedRoute = OpenApiOperationRef & { folder: string };

export function attachFolders(
  ops: OpenApiOperationRef[],
  strategy: FolderStrategy,
  stripPrefix?: string,
): FolderedRoute[] {
  return ops.map((op) => ({
    ...op,
    folder: folderNameForOperation(op, strategy, stripPrefix),
  }));
}

