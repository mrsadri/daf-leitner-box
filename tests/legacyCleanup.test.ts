import { test } from 'node:test';
import assert from 'node:assert/strict';
import { removeLegacyStorage } from '../src/core/legacyCleanup.ts';

function fakeStorage(keys: string[]) {
  const m = new Map(keys.map(k => [k, '1']));
  return {
    get length() { return m.size; },
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => { m.delete(k); },
    keys: () => [...m.keys()],
  };
}

test('removes only the keys of removed features', () => {
  const s = fakeStorage(['daf_dictation_queue_u1', 'daf_dictation_draft_u1_s1', 'daf_cards_cache_u1', 'daf_lang']);
  assert.equal(removeLegacyStorage(s), 2);
  assert.deepEqual(s.keys(), ['daf_cards_cache_u1', 'daf_lang']);
});

test('blocked storage does not throw', () => {
  const s = { get length(): number { throw new Error('blocked'); }, key: () => null, removeItem: () => {} };
  assert.equal(removeLegacyStorage(s), 0);
});
