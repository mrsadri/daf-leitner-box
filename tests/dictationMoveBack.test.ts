import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMoveBack } from '../src/services/dictation/moveBack.ts';

/** A local noon, so the local date is unambiguous in every time zone. */
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0);
const iso = (y: number, m: number, d: number) => day(y, m, d).toISOString();
const TODAY = day(2026, 11, 15);

test('the owner example: entered the 16-day compartment 3 days ago, moves to box 3 and is due in 5 days', () => {
  const r = computeMoveBack({ box: 4, lastReviewedAt: iso(2026, 11, 12), nextReviewDate: '2026-11-28' }, TODAY);
  assert.deepEqual(r, { box: 3, nextReviewDate: '2026-11-20', moved: true });
});

test('entered ten days ago: the due date is in the past, so it clamps to today', () => {
  const r = computeMoveBack({ box: 4, lastReviewedAt: iso(2026, 11, 5), nextReviewDate: '2026-11-21' }, TODAY);
  assert.deepEqual(r, { box: 3, nextReviewDate: '2026-11-15', moved: true });
});

test('box 0 stays in box 0, due today, and is reported as not moved', () => {
  const r = computeMoveBack({ box: 0, lastReviewedAt: iso(2026, 11, 14), nextReviewDate: '2026-11-16' }, TODAY);
  assert.deepEqual(r, { box: 0, nextReviewDate: '2026-11-15', moved: false });
});

test('mastered (box 6) goes to box 5 with entryDay + 32 days, clamped to today', () => {
  const fresh = computeMoveBack({ box: 6, lastReviewedAt: iso(2026, 11, 14), nextReviewDate: '9999-12-31' }, TODAY);
  assert.deepEqual(fresh, { box: 5, nextReviewDate: '2026-12-16', moved: true });
  const old = computeMoveBack({ box: 6, lastReviewedAt: iso(2026, 1, 1), nextReviewDate: '9999-12-31' }, TODAY);
  assert.deepEqual(old, { box: 5, nextReviewDate: '2026-11-15', moved: true });
});

test('a null lastReviewedAt counts the entry as today', () => {
  const r = computeMoveBack({ box: 3, lastReviewedAt: null, nextReviewDate: '2026-11-15' }, TODAY);
  assert.deepEqual(r, { box: 2, nextReviewDate: '2026-11-19', moved: true });
});

test('an unparsable lastReviewedAt is treated like null', () => {
  const r = computeMoveBack({ box: 2, lastReviewedAt: 'not a date', nextReviewDate: '2026-11-15' }, TODAY);
  assert.equal(r.box, 1);
  assert.equal(r.nextReviewDate, '2026-11-17');
});

test('every box uses the interval 2^newBox, capped at 32 days', () => {
  const entered = iso(2026, 11, 15);       // entered today so nothing clamps
  const want: Record<number, [number, string]> = {
    1: [0, '2026-11-16'], 2: [1, '2026-11-17'], 3: [2, '2026-11-19'], 4: [3, '2026-11-23'], 5: [4, '2026-12-01'], 6: [5, '2026-12-17'],
  };
  for (const [box, [newBox, due]] of Object.entries(want)) {
    const r = computeMoveBack({ box: Number(box), lastReviewedAt: entered, nextReviewDate: '2026-11-15' }, TODAY);
    assert.deepEqual([r.box, r.nextReviewDate], [newBox, due], `box ${box}`);
  }
});

test('out-of-range boxes are clamped, never negative', () => {
  assert.equal(computeMoveBack({ box: -3, lastReviewedAt: null, nextReviewDate: '2026-11-15' }, TODAY).box, 0);
  assert.equal(computeMoveBack({ box: 99, lastReviewedAt: null, nextReviewDate: '2026-11-15' }, TODAY).box, 5);
});

test('date arithmetic follows the calendar across month and year ends', () => {
  const r = computeMoveBack({ box: 6, lastReviewedAt: iso(2026, 12, 20), nextReviewDate: '9999-12-31' }, day(2026, 12, 20));
  assert.equal(r.nextReviewDate, '2027-01-21');
});

test('the input card is not changed', () => {
  const card = { box: 4, lastReviewedAt: iso(2026, 11, 12), nextReviewDate: '2026-11-28' };
  const copy = { ...card };
  computeMoveBack(card, TODAY);
  assert.deepEqual(card, copy);
});
