import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMissingCollectionError } from '../dist/postman-errors.js';

test('isMissingCollectionError detects Postman 404', () => {
  assert.equal(
    isMissingCollectionError(
      new Error(
        'Postman API 404: {"name":"instanceNotFoundError","message":"We could not find the collection you are looking for"}',
      ),
    ),
    true,
  );
  assert.equal(isMissingCollectionError(new Error('Postman API 500: oops')), false);
});
