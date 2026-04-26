import type { FolderStrategy, PathFolderNesting } from './options.js';
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

function pathFolderSegments(path: string, stripPrefix?: string): string[] {
  let p = normalizeOpenApiPath(path);
  if (stripPrefix) {
    const sp = normalizeOpenApiPath(stripPrefix);
    if (p === sp || p.startsWith(`${sp}/`)) {
      p = p.slice(sp.length) || '/';
      if (!p.startsWith('/')) p = `/${p}`;
    }
  }
  const segments = p.split('/').filter(Boolean);
  if (segments.length <= 1) return [];
  return segments.slice(0, -1).map((s) => titleCaseSegment(s.replace(/[{}]/g, '')));
}

export function folderNameForOperation(
  op: OpenApiOperationRef,
  strategy: FolderStrategy,
  stripPrefix?: string,
  pathFolderNesting: PathFolderNesting = 'nested',
): string {
  if (strategy === 'tags' || strategy === 'hybrid') {
    const tag = op.tags[0];
    if (tag) return titleCaseSegment(tag);
    if (strategy === 'hybrid') {
      if (pathFolderNesting === 'nested') {
        const segs = pathFolderSegments(op.path, stripPrefix);
        return (segs[0] ?? folderFromPath(op.path, stripPrefix)) || 'Root';
      }
      return folderFromPath(op.path, stripPrefix);
    }
    return 'Untagged';
  }
  if (pathFolderNesting === 'nested') {
    const segs = pathFolderSegments(op.path, stripPrefix);
    return (segs[0] ?? folderFromPath(op.path, stripPrefix)) || 'Root';
  }
  return folderFromPath(op.path, stripPrefix);
}

export type FolderedRoute = OpenApiOperationRef & { folder: string; folderPath: string[] };

export function attachFolders(
  ops: OpenApiOperationRef[],
  strategy: FolderStrategy,
  stripPrefix?: string,
  pathFolderNesting: PathFolderNesting = 'nested',
): FolderedRoute[] {
  return ops.map((op) => {
    const root = folderNameForOperation(op, strategy, stripPrefix, pathFolderNesting);
    let folderPath: string[] = [root];
    if ((strategy === 'path' || strategy === 'hybrid') && pathFolderNesting === 'nested') {
      const segs = pathFolderSegments(op.path, stripPrefix);
      if (segs.length) folderPath = segs;
    }
    return {
      ...op,
      folder: root,
      folderPath,
    };
  });
}

