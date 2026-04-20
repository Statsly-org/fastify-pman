# @st3ix/pman

Sync Fastify route schemas to Postman automatically.

You keep writing normal Fastify routes with JSON Schema. This plugin reads the OpenAPI spec from `@fastify/swagger`, converts it with `openapi-to-postmanv2`, merges changes into an existing Postman collection (preserving your tests/examples), and pushes updates through the Postman API so Postman Desktop picks them up via cloud sync.

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
    tags: ['Users'],
    summary: 'List users',
    response: { 200: { type: 'array' } },
  },
}, async () => []);

await app.register(pman, {
  postmanApiKey: 'PMAK-…',
  workspaceId: '00000000-0000-4000-8000-000000000000',
  postmanBaseUrl: 'http://127.0.0.1:3000',
  collectionName: 'My API',
  folderStrategy: 'path',
  // Optional explicit auth config:
  // auth: { type: 'apiKey', headerKey: 'X-API-Token', variableKey: 'apiToken' },
});

await app.listen({ port: 3000 });
```

Pass **`postmanApiKey`** and **`workspaceId`** in the same object as the rest of the plugin options (recommended for apps you control). If either value is omitted or an empty string, the plugin falls back to `POSTMAN_API_KEY` / `POSTMAN_WORKSPACE_ID`.

**`postmanBaseUrl`** defines the Postman collection variable **`baseUrl`**, so requests that use `{{baseUrl}}` resolve correctly. If you omit it (and `POSTMAN_BASE_URL`), the first OpenAPI **`servers[].url`** is used.

**`reuseExistingCollectionByName`** (default `true`): if there is no `.postman-sync.json` yet, the workspace is searched for a collection whose name equals **`collectionName`**; that collection is reused instead of creating a duplicate. Set to `false` to always create a new collection when no state file exists.

On `onReady`, the plugin reads the OpenAPI document, converts it, merges it into the Postman collection, and pushes changes. The first successful run creates a collection and stores its uid in `.postman-sync.json` (override with `statePath`).

### Environment variables (optional fallback)

| Variable | Purpose |
|----------|---------|
| `POSTMAN_API_KEY` | Used when `postmanApiKey` is not set or is blank |
| `POSTMAN_WORKSPACE_ID` | Used when `workspaceId` is not set or is blank |
| `POSTMAN_BASE_URL` | Used when `postmanBaseUrl` is not set or is blank |

Secrets are never written to the sync state file.

### Options

| Option | Description |
|--------|-------------|
| `workspaceId` | Postman workspace id |
| `postmanApiKey` | Postman API key |
| `postmanBaseUrl` | Value for Postman variable `baseUrl` (`{{baseUrl}}` in URLs) |
| `reuseExistingCollectionByName` | Reuse workspace collection with same name when no state file (default `true`) |
| `collectionName` | Collection title (default `Fastify (pman)`) |
| `statePath` | Path to JSON state file (default `.postman-sync.json` in `cwd`) |
| `dryRun` | If `true`, no Postman HTTP calls are made |
| `folderStrategy` | `path` (default), `tags`, or `hybrid` — controls folder layout in Postman |
| `folderPathStripPrefix` | Strip this URL prefix before using the first segment as a folder (`path` / `hybrid`) |
| `postmanApiBase` | Override Postman API base URL |
| `fetchImpl` | Custom `fetch` (for tests) |

If the API key and workspace id are both missing (options and env), the plugin logs a warning and skips sync so local development still works.

If **`.postman-sync.json`** points to a collection that was **deleted in Postman** (HTTP 404), the plugin **removes that state file**, then tries **reuse by name** again or **creates** a new collection — you should not see a hard failure for a stale uid anymore.

### Merge behaviour

Requests managed by this plugin are tagged with `_pman.routeId`. On each sync, spec-driven fields are refreshed from OpenAPI while `event` (tests, prerequest) is copied from the previous collection item when present. **`response`** saved examples are kept only if that request already had a non-empty `response` array in Postman; otherwise OpenAPI-generated example responses are not written (avoids clutter from the converter’s defaults).

### Tech stack

- **Fastify**: routes + schemas
- **`@fastify/swagger`**: generates OpenAPI (you don't write OpenAPI by hand)
- **`openapi-to-postmanv2`**: converts OpenAPI → Postman Collection v2
- **Postman API**: stores the collection in your workspace

## Local Postman smoke test

1. **From repo root:** copy [`.env.example`](.env.example) to `.env` and set `POSTMAN_API_KEY`, `POSTMAN_WORKSPACE_ID`, and optionally `POSTMAN_BASE_URL` (`.env` is gitignored), then run `npm run dev:example` — builds the plugin, loads `.env`, picks a free port if `PORT` is busy, syncs on `onReady`.
2. **From `examples/`:** after `npm run build`, edit [`examples/playground.mjs`](examples/playground.mjs) and fill the `postman` object (`postmanApiKey`, `workspaceId`), then run `node examples/playground.mjs`. The script picks **3030** (or `PORT`) or a free port, sets **`postmanBaseUrl`** to match that port, and uses **`pino-pretty`** for readable logs when the dev dependency is installed.

### Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

MIT
