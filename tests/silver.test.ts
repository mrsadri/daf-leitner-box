import { test } from 'node:test';
import assert from 'node:assert/strict';
import { afterCorrectAnswer, mergeServer, emptySilver, rollDay, SILVER_THRESHOLD } from '../src/services/silverLogic.ts';
import { SILVER_FACTS, SILVER_MAX } from '../src/data/silverFacts.ts';

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
    assert.ok(f.fa.length > 30 && f.en.length > 30 && f.emoji);
    assert.doesNotMatch(f.fa, /ستاک/);
  }
});
