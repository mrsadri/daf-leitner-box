import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  shareQuota, publishBlock, shareErrorCode, isSharedCopy, sharedIdOf, copyIdFor, scoreOf,
  SHARE_POINTS, SHARE_TITLE_MAX, SHARE_CONTENT_MAX
} from '../src/services/shareLogic.ts';
import type { LeitnerCard } from '../src/types/leitner.ts';

const card = (over: Partial<LeitnerCard> = {}): LeitnerCard => ({
  id: 'custom_1', type: 'reflection', box: 0, lastReviewedAt: null, nextReviewDate: '2026-11-01',
  createdAt: '2026-11-01T00:00:00Z', reviewCount: 0, correctCount: 0, wrongCount: 0,
  title: 'Jeden Tag', content: 'قبل از گوشی', category: 'habit', ...over
});

test('quota: one slot per 256 points, every publication uses one for good', () => {
  assert.equal(SHARE_POINTS, 256);
  assert.deepEqual(shareQuota(0, 0), { score: 0, allowed: 0, used: 0, remaining: 0, pointsToNext: 256 });
  assert.deepEqual(shareQuota(255, 0), { score: 255, allowed: 0, used: 0, remaining: 0, pointsToNext: 1 });
  assert.deepEqual(shareQuota(256, 0), { score: 256, allowed: 1, used: 0, remaining: 1, pointsToNext: 0 });
  assert.deepEqual(shareQuota(600, 1), { score: 600, allowed: 2, used: 1, remaining: 1, pointsToNext: 0 });
  assert.deepEqual(shareQuota(600, 2), { score: 600, allowed: 2, used: 2, remaining: 0, pointsToNext: 168 });
});

test('quota: score fell below what was used → next slot needs (used + 1) × 256', () => {
  // Used 2 slots at 520 points, now down to 300
  assert.deepEqual(shareQuota(300, 2), { score: 300, allowed: 1, used: 2, remaining: 0, pointsToNext: 468 });
});

test('score is the sum of boxes', () => {
  assert.equal(scoreOf([{ box: 6 }, { box: 3 }, { box: 0 }]), 9);
  assert.equal(scoreOf([]), 0);
});

test('copies: id shared_<public id>', () => {
  assert.equal(copyIdFor('abc'), 'shared_abc');
  assert.equal(isSharedCopy({ id: 'shared_abc' }), true);
  assert.equal(sharedIdOf({ id: 'shared_abc' }), 'abc');
  assert.equal(isSharedCopy({ id: 'custom_1' }), false);
  assert.equal(sharedIdOf({ id: 'custom_1' }), null);
});

test('publishBlock: reasons in order', () => {
  const q = shareQuota(600, 0);
  assert.equal(publishBlock(card(), q, false), null);
  assert.equal(publishBlock(card({ type: 'vocab' }), q, false), 'notInsight');
  assert.equal(publishBlock(card({ id: 'shared_x' }), q, false), 'copy');
  assert.equal(publishBlock(card(), q, true), 'public');
  assert.equal(publishBlock(card({ title: '   ' }), q, false), 'empty');
  assert.equal(publishBlock(card({ title: 'x'.repeat(SHARE_TITLE_MAX + 1) }), q, false), 'tooLong');
  assert.equal(publishBlock(card({ title: 'x'.repeat(SHARE_TITLE_MAX) }), q, false), null);
  assert.equal(publishBlock(card({ content: 'y'.repeat(SHARE_CONTENT_MAX + 1) }), q, false), 'tooLong');
  // Surrounding whitespace doesn't count, like on the server
  assert.equal(publishBlock(card({ content: `\n${'y'.repeat(SHARE_CONTENT_MAX)}\n` }), q, false), null);
  // Persian letters count as one character each
  assert.equal(publishBlock(card({ title: 'ب'.repeat(SHARE_TITLE_MAX) }), q, false), null);
  assert.equal(publishBlock(card(), shareQuota(255, 0), false), 'quota');
});

test('server error codes', () => {
  assert.equal(shareErrorCode({ message: 'share:quota' }), 'quota');
  assert.equal(shareErrorCode(new Error('share:not_public')), 'not_public');
  assert.equal(shareErrorCode({ message: 'TypeError: Failed to fetch' }), 'offline');
  assert.equal(shareErrorCode({ message: 'share:whatever' }), 'unknown');
  assert.equal(shareErrorCode(null), 'unknown');
});
