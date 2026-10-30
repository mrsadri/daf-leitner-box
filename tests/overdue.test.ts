import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeOverdueMoves } from '../src/services/overdueSummary.ts';

test('groups moves by from → to box, highest first', () => {
  const s = summarizeOverdueMoves([
    { cardId: 'a', fromBox: 3, toBox: 2, demotedOn: '2026-11-10' },
    { cardId: 'b', fromBox: 3, toBox: 2, demotedOn: '2026-11-10' },
    { cardId: 'c', fromBox: 5, toBox: 1, demotedOn: '2026-11-10' },
    { cardId: 'd', fromBox: 1, toBox: 0, demotedOn: '2026-11-09' }
  ]);
  assert.equal(s.total, 4);
  assert.deepEqual(s.groups, [
    { fromBox: 5, toBox: 1, count: 1 },
    { fromBox: 3, toBox: 2, count: 2 },
    { fromBox: 1, toBox: 0, count: 1 }
  ]);
  assert.equal(s.cardIds.at(-1), 'd');   // most recent first
});

test('a card moved on several nights counts once, from its first box to its last', () => {
  const s = summarizeOverdueMoves([
    { cardId: 'a', fromBox: 3, toBox: 2, demotedOn: '2026-11-10' },
    { cardId: 'a', fromBox: 2, toBox: 1, demotedOn: '2026-11-13' }
  ]);
  assert.equal(s.total, 1);
  assert.deepEqual(s.groups, [{ fromBox: 3, toBox: 1, count: 1 }]);
});

test('nothing to explain', () => {
  assert.deepEqual(summarizeOverdueMoves([]), { total: 0, groups: [], cardIds: [] });
});
