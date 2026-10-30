import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  localTime, safeTimeZone, inactivityDecision, inactivityPayload, overtakeDecision, overtakePayload, testPayload, QUOTES
} from '../supabase/functions/send-reminders/reminders.ts';
import type { PushState } from '../supabase/functions/send-reminders/reminders.ts';

const at = (iso: string) => new Date(iso);

test('local time in different zones', () => {
  // 2026-10-31 is a Saturday. 06:00 UTC = 09:30 in Tehran (UTC+3:30, no DST since 2022)
  assert.deepEqual(localTime(at('2026-10-31T06:00:00Z'), 'Asia/Tehran'), { weekday: 6, minutes: 9 * 60 + 30, date: '2026-10-31' });
  assert.equal(localTime(at('2026-10-31T06:00:00Z'), 'Europe/Vienna').minutes, 7 * 60);
  assert.equal(safeTimeZone('Not/AZone'), 'Asia/Tehran');
  assert.equal(safeTimeZone(''), 'Asia/Tehran');
});

const active = (lastSeen: string | null) => ({ last_seen_at: lastSeen, suspended: false });
const decide = (lastSeen: string | null, state: Parameters<typeof inactivityDecision>[1], now: string, tz = 'Asia/Tehran') =>
  inactivityDecision(active(lastSeen), state, tz, '2026-10-01T00:00:00Z', at(now));

test('inactivity: nothing within 24 hours', () => {
  assert.equal(decide('2026-10-27T08:00:00Z', null, '2026-10-28T07:59:00Z').send, false);
  assert.deepEqual(decide('2026-10-27T08:00:00Z', null, '2026-10-28T08:01:00Z'), { send: true, count: 1 });
});

test('inactivity: quiet hours 21:00–10:00 local', () => {
  // 18:00 UTC = 21:30 Tehran
  assert.equal(decide('2026-10-26T08:00:00Z', null, '2026-10-28T18:00:00Z').send, false);
  // 06:00 UTC = 09:30 Tehran (too early), 06:30 UTC = 10:00 Tehran (ok)
  assert.equal(decide('2026-10-26T08:00:00Z', null, '2026-10-28T06:00:00Z').send, false);
  assert.equal(decide('2026-10-26T08:00:00Z', null, '2026-10-28T06:30:00Z').send, true);
});

test('inactivity: once per 24 hours, at most 3 times', () => {
  const lastSeen = '2026-10-20T08:00:00Z';
  const s1 = { inactivity_count: 1, last_inactivity_at: '2026-10-21T09:00:00Z', overtake_rank: null, last_overtake_at: null };
  assert.equal(decide(lastSeen, s1, '2026-10-22T08:00:00Z').send, false);           // 23 h after the first
  assert.deepEqual(decide(lastSeen, s1, '2026-10-22T09:15:00Z'), { send: true, count: 2 });
  const s3 = { inactivity_count: 3, last_inactivity_at: '2026-10-23T09:00:00Z', overtake_rank: null, last_overtake_at: null };
  assert.equal(decide(lastSeen, s3, '2026-10-26T09:00:00Z').send, false);           // stops after 3
});

test('inactivity: coming back resets the counter', () => {
  const s3 = { inactivity_count: 3, last_inactivity_at: '2026-10-23T09:00:00Z', overtake_rank: null, last_overtake_at: null };
  // seen again on the 24th, then away for more than a day
  assert.deepEqual(decide('2026-10-24T08:00:00Z', s3, '2026-10-25T09:00:00Z'), { send: true, count: 1 });
  // still active: no reminder, counter reported as reset
  assert.deepEqual(decide('2026-10-25T08:00:00Z', s3, '2026-10-25T09:00:00Z'), { send: false, count: 0 });
});

test('inactivity: not within 2 hours of a leaderboard notification, never for suspended users', () => {
  const s = { inactivity_count: 0, last_inactivity_at: null, overtake_rank: 3, last_overtake_at: '2026-10-28T06:00:00Z' };
  assert.equal(decide('2026-10-26T08:00:00Z', s, '2026-10-28T07:30:00Z').send, false);
  assert.equal(decide('2026-10-26T08:00:00Z', s, '2026-10-28T08:15:00Z').send, true);
  assert.equal(inactivityDecision({ last_seen_at: '2026-10-01T00:00:00Z', suspended: true }, null, 'Asia/Tehran', '2026-10-01T00:00:00Z', at('2026-10-28T08:15:00Z')).send, false);
});

test('inactivity: never seen falls back to the subscription date', () => {
  assert.equal(inactivityDecision(active(null), null, 'Asia/Tehran', '2026-10-28T00:00:00Z', at('2026-10-28T08:15:00Z')).send, false);
  assert.equal(inactivityDecision(active(null), null, 'Asia/Tehran', '2026-10-26T00:00:00Z', at('2026-10-28T08:15:00Z')).send, true);
});

test('messages in both languages', () => {
  assert.equal(QUOTES.fa.length, QUOTES.en.length);
  assert.ok(QUOTES.fa.length >= 30);
  assert.equal(testPayload('fa').tag, 'daf-test');
  const p = inactivityPayload('en', 5);
  assert.equal(p.url, '/?go=review');
  assert.equal(p.body, QUOTES.en[5]);
  assert.equal(inactivityPayload('fa', 5).body, QUOTES.fa[5]);
});

const state = (rank: number | null, lastOvertake: string | null = null, lastInactivity: string | null = null): PushState =>
  ({ inactivity_count: 0, last_inactivity_at: lastInactivity, overtake_rank: rank, last_overtake_at: lastOvertake });
// 08:30 UTC = 12:00 in Tehran
const NOON = '2026-10-28T08:30:00Z';

test('overtake: first time only records the rank', () => {
  assert.deepEqual(overtakeDecision({ rank: 4, score: 30 }, true, null, 'Asia/Tehran', at(NOON)), { send: false, passedBy: 0, rank: 4, baseline: 4 });
  assert.equal(overtakeDecision({ rank: 4, score: 30 }, true, state(null), 'Asia/Tehran', at(NOON)).baseline, 4);
});

test('overtake: better or same rank follows silently, worse rank notifies', () => {
  assert.deepEqual(overtakeDecision({ rank: 2, score: 30 }, true, state(4), 'Asia/Tehran', at(NOON)), { send: false, passedBy: 0, rank: 2, baseline: 2 });
  assert.equal(overtakeDecision({ rank: 4, score: 30 }, true, state(4), 'Asia/Tehran', at(NOON)).send, false);
  assert.deepEqual(overtakeDecision({ rank: 6, score: 30 }, true, state(4), 'Asia/Tehran', at(NOON)), { send: true, passedBy: 2, rank: 6, baseline: 6 });
});

test('overtake: waits (keeping the baseline) in quiet hours, after one today, right after an inactivity reminder', () => {
  // 19:00 UTC = 22:30 Tehran
  assert.deepEqual(overtakeDecision({ rank: 6, score: 30 }, true, state(4), 'Asia/Tehran', at('2026-10-28T19:00:00Z')), { send: false, passedBy: 0, rank: 6, baseline: 4 });
  // already notified this (Tehran) morning
  assert.equal(overtakeDecision({ rank: 6, score: 30 }, true, state(4, '2026-10-28T07:00:00Z'), 'Asia/Tehran', at(NOON)).send, false);
  // notified yesterday: fine again
  assert.equal(overtakeDecision({ rank: 6, score: 30 }, true, state(4, '2026-10-27T07:00:00Z'), 'Asia/Tehran', at(NOON)).send, true);
  // an inactivity reminder 1 hour ago
  assert.equal(overtakeDecision({ rank: 6, score: 30 }, true, state(4, null, '2026-10-28T07:30:00Z'), 'Asia/Tehran', at(NOON)).send, false);
});

test('overtake: "today" is the local day', () => {
  // 21:00 UTC on the 27th = 00:30 on the 28th in Tehran: a new day there, but quiet hours
  // 07:00 UTC on the 28th = 10:30 Tehran; last one at 20:00 UTC on the 27th = 23:30 Tehran on the 27th → new day
  assert.equal(overtakeDecision({ rank: 6, score: 30 }, true, state(4, '2026-10-27T20:00:00Z'), 'Asia/Tehran', at('2026-10-28T07:00:00Z')).send, true);
  // 20:45 UTC on the 27th = 00:15 on the 28th in Tehran: same Tehran day as 07:00 UTC on the 28th
  assert.equal(overtakeDecision({ rank: 6, score: 30 }, true, state(4, '2026-10-27T20:45:00Z'), 'Asia/Tehran', at('2026-10-28T07:00:00Z')).send, false);
});

test('overtake: hidden users lose the baseline; no score or switched off just follows', () => {
  assert.deepEqual(overtakeDecision(null, true, state(4), 'Asia/Tehran', at(NOON)), { send: false, passedBy: 0, rank: 0, baseline: null });
  assert.deepEqual(overtakeDecision({ rank: 9, score: 0 }, true, state(4), 'Asia/Tehran', at(NOON)), { send: false, passedBy: 0, rank: 9, baseline: 9 });
  assert.deepEqual(overtakeDecision({ rank: 9, score: 12 }, false, state(4), 'Asia/Tehran', at(NOON)), { send: false, passedBy: 0, rank: 9, baseline: 9 });
});

test('overtake messages', () => {
  assert.equal(overtakePayload('fa', 1, 7).title, 'یک نفر ازت جلو زد! 🏁');
  assert.match(overtakePayload('fa', 2, 7).title, /^۲ نفر/);
  assert.match(overtakePayload('fa', 2, 12).body, /رتبه‌ی ۱۲/);
  assert.equal(overtakePayload('en', 3, 7).title, '3 people passed you! 🏁');
  assert.equal(overtakePayload('en', 1, 7).url, '/?go=leaderboard');
});

test('index.ts contains the current reminders.ts (run scripts/build-edge-function.py after edits)', () => {
  const dir = new URL('../supabase/functions/send-reminders/', import.meta.url);
  const source = readFileSync(new URL('reminders.ts', dir), 'utf8').replace(/^\/\*\*[\s\S]*?\*\/\s*/, '').trim();
  const index = readFileSync(new URL('index.ts', dir), 'utf8');
  assert.ok(index.includes(source), 'index.ts is out of date: run python3 scripts/build-edge-function.py');
  // Supabase only bundles packages imported statically at the top of the file
  assert.match(index, /^import \{ createClient \} from 'npm:@supabase\/supabase-js@[\d.]+';$/m);
  assert.match(index, /^import webpush from 'npm:web-push@[\d.]+';$/m);
  assert.doesNotMatch(index, /import\((?!['"])/, 'no dynamic imports with computed specifiers');
});
