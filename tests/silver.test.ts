import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { afterCorrectAnswer, mergeServer, emptySilver, rollDay, SILVER_THRESHOLD, collectionSlots, pendingCelebration, settleSeen } from '../src/features/silver/silverLogic.ts';
import { SILVER_FACTS, SILVER_MAX } from '../src/features/silver/silverFacts.ts';

const DAY = '2026-11-02';
const answer = (s: ReturnType<typeof emptySilver>, n: number, day = DAY, max = 30) => {
  const won: number[] = [];
  for (let i = 0; i < n; i++) {
    const r = afterCorrectAnswer(s, day, max);
    s = r.state;
    if (r.earned) won.push(r.earned);
  }
  return { s, won };
};

test('the 16th correct answer of a day earns a card, only one per day', () => {
  assert.equal(SILVER_THRESHOLD, 15);
  let { s, won } = answer(emptySilver(DAY), 15);
  assert.deepEqual(won, []);
  ({ s, won } = answer(s, 1));
  assert.deepEqual(won, [1]);
  ({ s, won } = answer(s, 40));
  assert.deepEqual(won, []);
  assert.equal(s.total, 1);
  // next day: from zero again, the next card is number 2
  ({ s, won } = answer(s, 16, '2026-11-03'));
  assert.deepEqual(won, [2]);
});

test('nothing before the start date; the collection ends at 30', () => {
  assert.deepEqual(answer(emptySilver('2026-10-30'), 20, '2026-10-30').won, []);
  const full = { day: DAY, correctToday: 0, earnedToday: false, total: 30 };
  assert.deepEqual(answer(full, 20).won, []);
});

test('the server knows about other devices and earlier sessions', () => {
  // earned on another device today: no second card here
  let s = mergeServer(emptySilver(DAY), { total: 3, todayCorrect: 16, earnedToday: true }, DAY, 30);
  assert.deepEqual(answer(s, 10).won, []);
  // 10 correct elsewhere today: 6 more here earn the card
  s = mergeServer(emptySilver(DAY), { total: 3, todayCorrect: 10, earnedToday: false }, DAY, 30);
  assert.deepEqual(answer(s, 6).won, [4]);
  // the device is ahead of the server (not synced yet): keeps its own count
  s = mergeServer({ day: DAY, correctToday: 17, earnedToday: true, total: 5 }, { total: 4, todayCorrect: 3, earnedToday: false }, DAY, 30);
  assert.deepEqual([s.total, s.correctToday, s.earnedToday], [5, 17, true]);
  // yesterday's local count doesn't carry over
  assert.equal(rollDay({ day: '2026-11-01', correctToday: 12, earnedToday: false, total: 2 }, DAY).correctToday, 0);
});

test('30 facts in both languages', () => {
  assert.equal(SILVER_MAX, 30);
  assert.equal(new Set(SILVER_FACTS.map(f => f.fa)).size, 30);
  assert.equal(new Set(SILVER_FACTS.map(f => f.en)).size, 30);
  for (const f of SILVER_FACTS) {
    assert.ok(f.fa.length > 30 && f.en.length > 30 && f.icon);
    assert.ok(existsSync(new URL(`../public/icons3d/${f.icon}.webp`, import.meta.url)), `icon file for ${f.icon}`);
    assert.doesNotMatch(f.fa, /ستاک/);
  }
});

test('collection slots: earned first, the rest locked; bad totals clamped', () => {
  assert.deepEqual(collectionSlots(3, 5), { earned: [1, 2, 3], locked: [4, 5] });
  assert.deepEqual(collectionSlots(0, 3), { earned: [], locked: [1, 2, 3] });
  assert.deepEqual(collectionSlots(30, 30).locked, []);
  assert.equal(collectionSlots(30, 30).earned.length, 30);
  assert.deepEqual(collectionSlots(99, 3), { earned: [1, 2, 3], locked: [] });
  assert.deepEqual(collectionSlots(-2, 2), { earned: [], locked: [1, 2] });
  assert.deepEqual(collectionSlots(NaN, 2), { earned: [], locked: [1, 2] });
  assert.deepEqual(collectionSlots(2.7, 4), { earned: [1, 2], locked: [3, 4] });
});

test('celebration: only today\'s confirmed card, once per device', () => {
  const today = { day: DAY, correctToday: 16, earnedToday: true, total: 4 };
  assert.equal(pendingCelebration(today, 3, DAY, 30), 4);
  // already shown here
  assert.equal(pendingCelebration(today, 4, DAY, 30), null);
  // not earned today (e.g. the server's total went up by an old card): nothing to celebrate, marked seen quietly
  const old = { day: DAY, correctToday: 3, earnedToday: false, total: 4 };
  assert.equal(pendingCelebration(old, 3, DAY, 30), null);
  assert.equal(settleSeen(old, 3, DAY, 30), 4);
  // today's card stays pending (seen untouched) until the learner closes it
  assert.equal(settleSeen(today, 3, DAY, 30), 3);
  // yesterday's state (the session ran past midnight) is not today's card
  assert.equal(pendingCelebration({ ...today, day: '2026-11-01' }, 3, DAY, 30), null);
  // two cards behind (one from another day): only today's, the highest, is shown
  assert.equal(pendingCelebration({ ...today, total: 6 }, 4, DAY, 30), 6);
  // never past the collection
  assert.equal(pendingCelebration({ ...today, total: 31 }, 29, DAY, 30), 30);
  assert.equal(pendingCelebration({ ...today, total: 31 }, 30, DAY, 30), null);
  // a seen mark from a newer device state never goes backwards
  assert.equal(settleSeen({ ...old, total: 2 }, 5, DAY, 30), 5);
});

test('celebration follows the local count in demo: the 16th answer makes card 1 pending', () => {
  let { s } = answer(emptySilver(DAY), 15);
  assert.equal(pendingCelebration(s, 0, DAY, 30), null);
  ({ s } = answer(s, 1));
  assert.equal(pendingCelebration(s, 0, DAY, 30), 1);
});
