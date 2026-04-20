import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export type PostmanSyncState = {
  collectionUid: string;
  collectionName?: string;
  managedFolders?: string[];
};

export async function readSyncState(path: string): Promise<PostmanSyncState | null> {
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const uid = (parsed as { collectionUid?: unknown }).collectionUid;
    if (typeof uid !== 'string' || uid.length === 0) return null;
    const name = (parsed as { collectionName?: unknown }).collectionName;
    const folders = (parsed as { managedFolders?: unknown }).managedFolders;
    return {
      collectionUid: uid,
      collectionName: typeof name === 'string' && name.trim().length ? name.trim() : undefined,
      managedFolders: Array.isArray(folders) ? folders.map((x) => String(x)) : undefined,
    };
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') return null;
    throw e;
  }
}

export async function clearSyncState(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') return;
    throw e;
  }
}

export async function writeSyncState(path: string, state: PostmanSyncState): Promise<void> {
  const dir = dirname(path);
  await mkdir(dir, { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  const payload = `${JSON.stringify(state, null, 2)}\n`;
  await writeFile(tmp, payload, 'utf8');
  await rename(tmp, path);
}

