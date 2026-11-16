/** Public insight sharing was removed: leftover 'shared_…' copies must never be shown or sent back to the server. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRemovedSharedCopy } from '../src/core/sharedCopies.ts';

test('only shared_ ids are removed copies', () => {
  assert.equal(isRemovedSharedCopy({ id: 'shared_0b6c1f0e-1234' }), true);
  assert.equal(isRemovedSharedCopy({ id: 'refl_123' }), false);
  assert.equal(isRemovedSharedCopy({ id: 'daf_01_80' }), false);
  assert.equal(isRemovedSharedCopy({ id: 'my_shared_note' }), false);
});
