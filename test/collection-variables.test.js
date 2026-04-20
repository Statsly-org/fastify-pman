import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureCollectionBaseUrl,
  pickOpenApiServerUrl,
} from '../dist/collection-variables.js';

test('pickOpenApiServerUrl reads first server', () => {
  assert.equal(
    pickOpenApiServerUrl({
      servers: [{ url: '  http://x.test  ' }, { url: 'http://y' }],
    }),
    'http://x.test',
  );
  assert.equal(pickOpenApiServerUrl({}), undefined);
});

test('ensureCollectionBaseUrl upserts baseUrl', () => {
  const coll = { variable: [{ key: 'other', value: '1', type: 'string' }] };
  ensureCollectionBaseUrl(coll, 'http://host:9/');
  const vars = coll.variable;
  const b = vars.find((v) => v.key === 'baseUrl');
  assert.equal(b.value, 'http://host:9');
  assert.ok(vars.some((v) => v.key === 'other'));
});
