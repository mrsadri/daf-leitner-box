import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDeadline, remainingMs, isExpired, formatClock, DRILL_DURATION_MS } from '../src/features/adjective/timer.ts';

test('createDeadline is now plus the drill duration', () => {
  assert.equal(createDeadline(1_000_000), 1_000_000 + DRILL_DURATION_MS);
  assert.equal(createDeadline(1_000_000, 10_000), 1_010_000);
});

test('remainingMs never goes negative and does not depend on how many ticks happened', () => {
  const deadline = createDeadline(0);
  // A background/throttled tab fires far fewer ticks, but remainingMs only looks at the clock.
  assert.equal(remainingMs(deadline, 0), DRILL_DURATION_MS);
  assert.equal(remainingMs(deadline, DRILL_DURATION_MS - 1), 1);
  assert.equal(remainingMs(deadline, DRILL_DURATION_MS), 0);
  assert.equal(remainingMs(deadline, DRILL_DURATION_MS + 60_000), 0); // long overdue: still 0, not negative
});

test('isExpired is a pure function of the clock, not of elapsed ticks', () => {
  const deadline = createDeadline(0);
  assert.equal(isExpired(deadline, DRILL_DURATION_MS - 1), false);
  assert.equal(isExpired(deadline, DRILL_DURATION_MS), true);
  assert.equal(isExpired(deadline, DRILL_DURATION_MS + 1), true);
  // A tab that was hidden for the whole run and only wakes up once at the very end: still correct.
  assert.equal(isExpired(deadline, DRILL_DURATION_MS + 120_000), true);
});

test('an answer submitted after the deadline is not counted (isExpired gates scoring)', () => {
  const deadline = createDeadline(0);
  const answerArrivesAt = DRILL_DURATION_MS + 5;
  assert.equal(isExpired(deadline, answerArrivesAt), true, 'a round finished after the deadline must not score');
  const answerArrivesInTime = DRILL_DURATION_MS - 5;
  assert.equal(isExpired(deadline, answerArrivesInTime), false, 'a round finished before the deadline must score');
});

test('formatClock: mm:ss, rounded up to the next second', () => {
  assert.equal(formatClock(5 * 60 * 1000), '05:00');
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(1), '00:01'); // 1ms left still shows a second, never blank
  assert.equal(formatClock(61_000), '01:01');
  assert.equal(formatClock(9_999), '00:10'); // 9.999s rounds up to 10, not down to 9
});
