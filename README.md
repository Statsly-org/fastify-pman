# @st3ix/pman

Sync Fastify route schemas to Postman automatically.

You keep writing normal Fastify routes with JSON Schema. This plugin reads the OpenAPI spec from `@fastify/swagger`, converts it with `openapi-to-postmanv2`, merges changes into an existing Postman collection (preserving your tests and scripts), and pushes updates through the Postman API so Postman Desktop picks them up via cloud sync.

## Pain points this plugin addresses

- **Long OpenAPI `summary` text** is great for documentation but a poor default for Postman request titles. pman uses **`x-pman-name` / `x-name`** (OpenAPI operation extensions) for short item names and still puts the full `summary` in the request description (“Docs”).

- **Monolithic or misleading folder layout** when grouping only by a single path segment (or by tags) makes large APIs hard to browse. With **`folderStrategy: 'path'`** (or **`'hybrid'`**) and **`pathFolderNesting: 'nested'`** (default), URL prefixes become **nested Postman folders**—for example `POST /auth/user/admin/create` is grouped as **Auth → User → Admin**, with the request under **Admin**.

- **Stale or duplicate folders after you change strategy or upgrade** pman. The sync state tracks managed trees with **path keys** (e.g. `Auth>User>Admin`) and, on each merge, **derives extra removal keys** from the current routes (e.g. first path segment, first tag) so older layouts (tag-only top-level folders, flat path folders from earlier releases) are still removed when you sync.

## Requirements

- Node.js 20+
- Fastify 5
- Register [`@fastify/swagger`](https://github.com/fastify/fastify-swagger) **before** this plugin so `fastify.swagger()` is available.

## Install

```bash
npm install @st3ix/pman @fastify/swagger
```

## Usage

```javascript
import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import pman from '@st3ix/pman';

const app = Fastify();

await app.register(swagger, {
  openapi: {
    openapi: '3.0.0',
    info: { title: 'My API', version: '1.0.0' },
    servers: [{ url: 'http://127.0.0.1:3000' }],
  },
});

app.get('/users', {
  schema: {
    // Short Postman item title. Use an OpenAPI extension field because
    // plain `name` is not emitted into OpenAPI by @fastify/swagger.
    'x-pman-name': 'List users',
    tags: ['Users'],
    summary: 'List users in the current workspace',
    response: { 200: { type: 'array' } },
  },
}, async () => []);

await app.register(pman, {
  postmanApiKey: 'PMAK-…',
  // Either pass workspaceId directly...
  workspaceId: '00000000-0000-4000-8000-000000000000',
  // ...or pass a workspace link and let pman extract the id:
  // workspaceLink: 'https://<team>.postman.co/workspace/My~00000000-0000-4000-8000-000000000000/overview',
  postmanBaseUrl: 'http://127.0.0.1:3000',
  collectionName: 'My API',
  folderStrategy: 'path',
  // Default: one Postman subfolder per path prefix segment, e.g. /auth/.../... → Auth → …
  // Use 'flat' to only use the first segment as a single folder (legacy style).
  pathFolderNesting: 'nested',
  // Optional explicit auth config:
  // auth: { type: 'apiKey', headerKey: 'X-API-Token', variableKey: 'apiToken' },
});

await app.listen({ port: 3000 });
```

### Postman item titles and docs

OpenAPI `summary` strings are often long, but they make poor Postman request titles. Set a short **OpenAPI extension** on the operation to control the Postman item name:

- `schema['x-pman-name']` (recommended)
- `schema['x-name']` (also supported)

Use `summary` for the first paragraph of the generated Postman “Docs” text.

Postman stores request documentation on the **request** (`item.request.description`) in Collection v2.1; pman writes the same text to `item.description` as well for compatibility.

| Route schema field | How it is used in Postman |
|--------------------|---------------------------|
| `x-pman-name` / `x-name` | Request title (short) |
| `summary` | First paragraph in the item description, followed by auto-generated route metadata |

If `x-pman-name` / `x-name` is omitted, the title falls back to `METHOD <lastPathSegment>` (for example `GET users`).

Pass **`postmanApiKey`** and **`workspaceId`** in the same object as the rest of the plugin options (recommended for apps you control). If either value is omitted or an empty string, the plugin falls back to `POSTMAN_API_KEY` / `POSTMAN_WORKSPACE_ID`.

| Route schema field | How it is used in Postman |
|--------------------|---------------------------|
| `x-pman-name` (recommended) or `x-name` | Request title (short) |
| `summary` | First part of the item description (Docs), plus auto-generated route metadata |

If `x-pman-name` / `x-name` is omitted, the title falls back to something like `GET users` (method plus last path segment).

Postman stores primary documentation on the **request** (`item.request.description`); pman also writes the same text to `item.description` for compatibility with tools that only read the folder-level field.

### Folder layout in Postman

| `folderStrategy` | Behaviour |
|------------------|------------|
| `path` (default) | Folders follow the route URL (after optional `folderPathStripPrefix`). |
| `tags` | One folder per first OpenAPI tag (or `Untagged`). |
| `hybrid` | Tag when present; otherwise same as `path` for that operation. |

**Path nesting** applies when `folderStrategy` is `path` or `hybrid` and **`pathFolderNesting`** is set:

| `pathFolderNesting` | Behaviour |
|---------------------|------------|
| `nested` (default) | Each path **prefix** segment (except the last) becomes a folder, title-cased. Example: `POST /auth/user/admin/create` → folders **Auth → User → Admin**, request under **Admin**. |
| `flat` | Only the first segment (or the tag/hybrid resolution) is used as a **single** folder name—closer to older single-folder behaviour. |

Use `folderPathStripPrefix` to ignore a common API base (e.g. `/v1`) before computing segments.

**Environment variables (optional fallback)**

| Variable | Purpose |
|----------|---------|
| `POSTMAN_API_KEY` | Used when `postmanApiKey` is not set or is blank |
| `POSTMAN_WORKSPACE_ID` | Used when `workspaceId` is not set or is blank |
| `POSTMAN_BASE_URL` | Used when `postmanBaseUrl` is not set or is blank |

Pass **`postmanApiKey`** and **`workspaceId`** in the same object as the rest of the plugin options (recommended for apps you control). If either value is omitted or is an empty string, the plugin falls back to the environment variables above.

**`postmanBaseUrl`** defines the Postman collection variable **`baseUrl`**, so requests that use `{{baseUrl}}` resolve correctly. If you omit it (and `POSTMAN_BASE_URL`), the first OpenAPI **`servers[].url`** is used.

**`reuseExistingCollectionByName`** (default `true`): if there is no `.postman-sync.json` yet, the workspace is searched for a collection whose name equals **`collectionName`**; that collection is reused instead of creating a duplicate. Set to `false` to always create a new collection when no state file exists.

On `onReady`, the plugin reads the OpenAPI document, converts it, merges it into the Postman collection, and pushes changes. The first successful run creates a collection and stores its uid in `.postman-sync.json` (override with `statePath`).

Secrets are never written to the sync state file.

### Options

| Option | Description |
|--------|-------------|
| `workspaceId` | Postman workspace id |
| `workspaceLink` | Postman workspace link (extracts `workspaceId` automatically) |
| `postmanApiKey` | Postman API key |
| `postmanBaseUrl` | Value for Postman variable `baseUrl` (`{{baseUrl}}` in URLs) |
| `reuseExistingCollectionByName` | Reuse workspace collection with same name when no state file (default `true`) |
| `collectionName` | Collection title (default `Fastify (pman)`) |
| `statePath` | Path to JSON state file (default `.postman-sync.json` in `cwd`) |
| `dryRun` | If `true`, no Postman HTTP calls are made |
| `folderStrategy` | `path` (default), `tags`, or `hybrid` — how routes are grouped into Postman folders |
| `folderPathStripPrefix` | Strip this URL prefix (normalized like OpenAPI) before path segments are used for folders (`path` / `hybrid`) |
| `pathFolderNesting` | `nested` (default) or `flat` — see [Folder layout in Postman](#folder-layout-in-postman) |
| `postmanApiBase` | Override Postman API base URL |
| `fetchImpl` | Custom `fetch` (for tests) |

If the API key and workspace id are both missing (options and env), the plugin logs a warning and skips sync so local development still works.

If **`.postman-sync.json`** points to a collection that was **deleted in Postman** (HTTP 404), the plugin **removes that state file**, then tries **reuse by name** again or **creates** a new collection so a stale collection uid does not hard-fail the app.

### Merge behaviour

- Requests managed by this plugin are tagged with `_pman.routeId`. On each sync, spec-driven fields are refreshed from OpenAPI while **`event`** (tests, prerequest) is copied from the previous collection item when present.
- **`response`** saved examples are kept only if that request already had a non-empty `response` array in Postman; otherwise OpenAPI-generated example responses are not written (avoids clutter from the converter defaults).
- The sync state file stores **`managedFolders`**: one **path key** per managed route group (e.g. `Auth>User>Admin`) so the correct **nested** folder tree can be replaced on the next run even if many folders share a short name in different areas of the tree.
- In addition, each merge **computes removal aliases** from the current route list (full path key, first URL segment, first tag) so **legacy** collection shapes from earlier pman versions (for example a single top-level `Users` tag folder) are still removed after you switch to path-based nested folders or upgrade the plugin.

### Tech stack

- **Fastify**: routes and schemas
- **`@fastify/swagger`**: generates OpenAPI
- **`openapi-to-postmanv2`**: converts OpenAPI to Postman Collection v2.1
- **Postman API**: stores the collection in your workspace

## Local Postman smoke test

1. **From the repo root:** copy [`.env.example`](.env.example) to `.env` and set `POSTMAN_API_KEY`, `POSTMAN_WORKSPACE_ID`, and optionally `POSTMAN_BASE_URL` (`.env` is gitignored), then run `npm run dev:example` — builds the plugin, loads `.env`, picks a free port if `PORT` is busy, syncs on `onReady`.
2. **From `examples/`:** after `npm run build`, edit [`examples/playground.mjs`](examples/playground.mjs) and fill the `postman` object (`postmanApiKey`, `workspaceId`), then run `node --env-file=.env examples/playground.mjs` or `node examples/playground.mjs`. The script picks **3030** (or `PORT`) or a free port, sets **`postmanBaseUrl`** to that origin, and uses **`pino-pretty`** for readable logs when the dev dependency is installed. The example uses **`pathFolderNesting: 'nested'`** and includes `POST /auth/user/admin/create` to verify **Auth → User → Admin** in Postman.

### Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## CLI

The package ships a small `pman` CLI:

```bash
pman help
pman clear
pman support
```

`pman support` prints the Discord invite: `https://discord.gg/4FBYAMxwdk`.

## License

MIT
