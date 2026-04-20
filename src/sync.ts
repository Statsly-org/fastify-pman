import type { FastifyInstance } from 'fastify';
import { ensureCollectionBaseUrl, pickOpenApiServerUrl } from './collection-variables.js';
import { openApiToPostmanCollection } from './convert.js';
import { attachFolders } from './folders.js';
import { listOpenApiOperations } from './openapi-routes.js';
import { getOpenApiObject } from './openapi.js';
import type { PmanRuntime, ResolvedPmanOptions } from './options.js';
import { isMissingCollectionError } from './postman-errors.js';
import { createCollection, findCollectionUidByName, getCollection, putCollection } from './postman-api.js';
import { managedFolderNames, mergeOpenApiIntoPostmanCollection, shellCollection } from './merge-collection.js';
import { clearSyncState, readSyncState, writeSyncState } from './state-file.js';
import {
  applyAuthHeaderToRequest,
  authPatchFromConfig,
  ensureCollectionVariable,
  inferGlobalAuthPatch,
} from './auth.js';

async function loadCollectionJson(
  resolved: ResolvedPmanOptions,
  uid: string,
): Promise<Record<string, unknown>> {
  const envelope = await getCollection(resolved, uid);
  const coll = envelope.collection ?? envelope;
  if (!coll || typeof coll !== 'object') {
    throw new Error('@st3ix/pman: Postman GET collection returned an unexpected body');
  }
  return coll as Record<string, unknown>;
}

export async function runPostmanSync(fastify: FastifyInstance, rt: PmanRuntime): Promise<void> {
  const { resolved, log } = rt;

  const openApi = getOpenApiObject(fastify);
  const operations = listOpenApiOperations(openApi);
  const foldered = attachFolders(operations, resolved.folderStrategy, resolved.folderPathStripPrefix);
  const generated = await openApiToPostmanCollection(openApi);

  if (!resolved.postmanApiKey) {
    log.warn('pman: skipped (set postmanApiKey or POSTMAN_API_KEY)');
    return;
  }
  if (!resolved.workspaceId) {
    log.warn('pman: skipped (set workspaceId or POSTMAN_WORKSPACE_ID)');
    return;
  }

  const state = await readSyncState(resolved.statePath);
  let collectionUid = state?.collectionUid;

  if (collectionUid && state?.collectionName && state.collectionName !== resolved.collectionName) {
    log.info(
      { collectionUid, savedName: state.collectionName, name: resolved.collectionName },
      'pman: collection name changed; ignoring saved uid',
    );
    collectionUid = undefined;
  }

  if (!collectionUid && !resolved.dryRun && resolved.reuseExistingCollectionByName) {
    const found = await findCollectionUidByName(resolved, resolved.collectionName);
    if (found) {
      collectionUid = found;
      await writeSyncState(resolved.statePath, {
        collectionUid: found,
        collectionName: resolved.collectionName,
      });
      log.info({ collectionUid: found, name: resolved.collectionName }, 'pman: linked existing Postman collection (same name)');
    }
  }

  let baseCollection: Record<string, unknown>;
  try {
    baseCollection = collectionUid
      ? await loadCollectionJson(resolved, collectionUid)
      : shellCollection(resolved.collectionName);
  } catch (err) {
    if (!collectionUid || !isMissingCollectionError(err)) throw err;

    if (resolved.dryRun) {
      log.warn(
        { collectionUid },
        'pman: dry run — saved collection uid is gone in Postman; using empty shell for preview',
      );
      baseCollection = shellCollection(resolved.collectionName);
      collectionUid = undefined;
    } else {
      log.warn(
        { collectionUid },
        'pman: saved collection uid no longer exists in Postman; cleared local state',
      );
      await clearSyncState(resolved.statePath);
      collectionUid = undefined;

      if (resolved.reuseExistingCollectionByName) {
        const found = await findCollectionUidByName(resolved, resolved.collectionName);
        if (found) {
          collectionUid = found;
          await writeSyncState(resolved.statePath, { collectionUid: found, collectionName: resolved.collectionName });
          log.info({ collectionUid: found, name: resolved.collectionName }, 'pman: linked Postman collection after reset (same name)');
          baseCollection = await loadCollectionJson(resolved, collectionUid);
        } else {
          baseCollection = shellCollection(resolved.collectionName);
        }
      } else {
        baseCollection = shellCollection(resolved.collectionName);
      }
    }
  }

  const merged = mergeOpenApiIntoPostmanCollection({
    existing: baseCollection,
    generated,
    routes: foldered,
    managedFoldersFromState: state?.managedFolders,
  });

  const info = merged.info;
  if (info && typeof info === 'object') {
    (info as Record<string, unknown>).name = resolved.collectionName;
  }

  const baseUrl = resolved.postmanBaseUrl?.trim() || pickOpenApiServerUrl(openApi);
  if (baseUrl) {
    ensureCollectionBaseUrl(merged, baseUrl);
  }

  if (resolved.autoAuth) {
    const authPatch = resolved.auth
      ? authPatchFromConfig(resolved.auth)
      : inferGlobalAuthPatch(openApi);
    if (authPatch) {
      ensureCollectionVariable(merged, authPatch.variableKey, '');
      const items = Array.isArray(merged.item) ? (merged.item as unknown[]) : [];
      for (const f of items) {
        if (!f || typeof f !== 'object') continue;
        const folder = f as Record<string, unknown>;
        const folderItems = Array.isArray(folder.item) ? (folder.item as unknown[]) : [];
        for (const raw of folderItems) {
          if (!raw || typeof raw !== 'object') continue;
          applyAuthHeaderToRequest(raw as Record<string, unknown>, authPatch);
        }
      }
    }
  }

  if (resolved.dryRun) {
    log.info({ routes: foldered.length, collectionUid: collectionUid ?? null }, 'pman: dry run — no Postman API writes');
    return;
  }

  if (!collectionUid) {
    const { uid } = await createCollection(resolved, merged);
    await writeSyncState(resolved.statePath, {
      collectionUid: uid,
      collectionName: resolved.collectionName,
      managedFolders: managedFolderNames(foldered),
    });
    log.info({ collectionUid: uid, routes: foldered.length }, 'pman: created Postman collection');
    return;
  }

  await putCollection(resolved, collectionUid, merged);
  await writeSyncState(resolved.statePath, {
    collectionUid,
    collectionName: resolved.collectionName,
    managedFolders: managedFolderNames(foldered),
  });
  log.info({ collectionUid, routes: foldered.length }, 'pman: updated Postman collection');
}

