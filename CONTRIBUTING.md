# Contributing

## Scope

This repository is a Fastify plugin that syncs route schemas to Postman through OpenAPI.

## Ground rules

- All user-facing text (README, errors, docs) is **English**.
- No secrets in git. Never commit `.env`, `.postman-sync.json`, API keys, or workspace ids.
- Keep files single-purpose. Avoid dumping unrelated helpers into one module.
- Prefer stable behavior over clever behavior (sync must be deterministic).
- No unnecessary code. Ie,f a change does not support a concrete issue or a new featur it does not ship.

## Development

```bash
npm install
npm test
```

`npm test` builds TypeScript and runs `node --test` against `test/*.test.js`.

## Testing changes

- Unit tests should cover merge behavior and id/route mapping.
- Integration tests must mock the Postman API (no real HTTP in CI).

## Code style

- TypeScript `strict` stays on.
- Avoid redundant comments and tutorial-style prose in code.
- Prefer small, well-named functions over large multi-purpose modules.

## Commit messages

Use a conventional format:

```
<type>(<scope>): <summary>

<optional details>
```

Allowed `type`: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`.

Examples:

- `feat(sync): reuse collection by name`
- `fix(merge): prevent duplicate managed folders`
- `docs(readme): update package scope to @st3ix/pman`

## Pull requests

### PR requirements

- Every PR must reference an existing issue (link it in the PR body).
- One PR = one issue (unless explicitly agreed in the issue).
- PRs without tests must explain why (rare).

### PR template (what to include)

- What changed and why
- How it was tested (`npm test`, and optionally manual Postman verification)
- Any breaking behavior changes called out clearly

Example:

- **Issue**: #123
- **Summary**: Fix folder de-duplication when state exists
- **Test plan**:
  - `npm test`
  - Manual: run `node --env-file=.env examples/playground.mjs` and confirm no duplicate folders

