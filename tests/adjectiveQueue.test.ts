import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTooOld, keepAfterOutcome, QUEUE_MAX_AGE_MS, type PendingFinish } from '../src/features/adjective/queue.ts';
import { mapBoardRow, mapMyBests } from '../src/features/adjective/boardMapping.ts';

const entry = (queuedAt: number): PendingFinish => ({ id: 'r1', score: 5, answered: 10, queuedAt });

test('isTooOld: within the window is not too old, past it is', () => {
  const queuedAt = 0;
  assert.equal(isTooOld(entry(queuedAt), QUEUE_MAX_AGE_MS - 1), false);
  assert.equal(isTooOld(entry(queuedAt), QUEUE_MAX_AGE_MS + 1), true);
});

test('isTooOld: a custom max age is honoured', () => {
  assert.equal(isTooOld(entry(0), 5000, 10_000), false);
  assert.equal(isTooOld(entry(0), 15_000, 10_000), true);
});

test('keepAfterOutcome: only a network error keeps retrying', () => {
  assert.equal(keepAfterOutcome('network-error'), true, 'offline/network failure: retry later');
  assert.equal(keepAfterOutcome('accepted'), false, 'accepted: nothing left to retry');
  assert.equal(keepAfterOutcome('rejected'), false, 'rejected for good: drop, do not retry');
});

test('a simulated flush pass: too-old entries are never attempted, network errors are kept, everything else is dropped', () => {
  const now = 2 * QUEUE_MAX_AGE_MS;
  const queue: PendingFinish[] = [
    { id: 'too-old', score: 1, answered: 1, queuedAt: 0 },
    { id: 'accepted', score: 2, answered: 2, queuedAt: now - 1000 },
    { id: 'rejected', score: 3, answered: 3, queuedAt: now - 1000 },
    { id: 'offline', score: 4, answered: 4, queuedAt: now - 1000 }
  ];
  const outcomeFor: Record<string, 'accepted' | 'rejected' | 'network-error'> = {
    accepted: 'accepted', rejected: 'rejected', offline: 'network-error'
  };
  const kept = queue.filter(p => {
    if (isTooOld(p, now)) return false; // dropped without even being attempted
    return keepAfterOutcome(outcomeFor[p.id]);
  });
  assert.deepEqual(kept.map(p => p.id), ['offline']);
});

test('mapBoardRow: converts the raw RPC row into the UI shape', () => {
  const row = mapBoardRow({
    user_id: 'u1', display_name: 'Sara', avatar_url: null, best: '14', top3: [14, 12, 10],
    best_at: '2026-11-01T00:00:00Z', rank: '1', is_me: true
  });
  assert.deepEqual(row, {
    userId: 'u1', displayName: 'Sara', avatarUrl: null, best: 14, top3: [14, 12, 10],
    bestAt: '2026-11-01T00:00:00Z', rank: 1, isMe: true
  });
});

test('mapBoardRow: a missing top3 becomes an empty array, not a crash', () => {
  const row = mapBoardRow({ user_id: 'u2', display_name: 'Demo', avatar_url: null, top3: null, best: 0, best_at: null, rank: 2, is_me: false });
  assert.deepEqual(row.top3, []);
});

test('mapMyBests: nulls stay null, numeric strings become numbers', () => {
  assert.deepEqual(mapMyBests({ best_all: '14', best_week: null }), { myBestAll: 14, myBestWeek: null });
  assert.deepEqual(mapMyBests(undefined), { myBestAll: null, myBestWeek: null });
});
