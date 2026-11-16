import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toRow, fromRow, isStoryId } from '../src/features/stories/progressRow.ts';

test('row round trip', () => {
  const p = { storyId: 'S03-Q2', page: 4, totalPages: 6, completedAt: '2026-11-16T10:00:00Z', updatedAt: '2026-11-16T10:00:00Z' };
  const r = toRow(p, 'abc');
  assert.equal(r.finished_count, 5);
  assert.equal(r.last_sentence_id, 'p5');
  assert.deepEqual(fromRow(r), p);
});

test('old dictation rows are ignored', () => {
  assert.equal(isStoryId('story-01'), false);
  assert.equal(isStoryId('S10-Q6'), true);
  assert.equal(fromRow({ story_id: 'story-01', finished_count: 3, total_count: 9, completed_at: null, last_active_at: 'x' }), null);
});
