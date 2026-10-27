import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  localTime, safeTimeZone, isClassReminderDue, inactivityDecision, inactivityPayload, classPayload, QUOTES
} from '../supabase/functions/send-reminders/reminders.ts';

const at = (iso: string) => new Date(iso);
const sub = (timezone: string, last: string | null = null) => ({ timezone, last_class_reminder_on: last });

test('local time in different zones', () => {
  // 2026-10-31 is a Saturday. 06:00 UTC = 09:30 in Tehran (UTC+3:30, no DST since 2022)
  assert.deepEqual(localTime(at('2026-10-31T06:00:00Z'), 'Asia/Tehran'), { weekday: 6, minutes: 9 * 60 + 30, date: '2026-10-31' });
  assert.equal(localTime(at('2026-10-31T06:00:00Z'), 'Europe/Vienna').minutes, 7 * 60);
  assert.equal(safeTimeZone('Not/AZone'), 'Asia/Tehran');
  assert.equal(safeTimeZone(''), 'Asia/Tehran');
});

test('class reminder: Saturday–Wednesday, 09:30–09:59 local, once per day', () => {
  // Saturday 09:30 Tehran
  assert.equal(isClassReminderDue(sub('Asia/Tehran'), at('2026-10-31T06:00:00Z')), true);
  // a late cron run at 09:59 still counts, 10:00 doesn't
  assert.equal(isClassReminderDue(sub('Asia/Tehran'), at('2026-10-31T06:29:00Z')), true);
  assert.equal(isClassReminderDue(sub('Asia/Tehran'), at('2026-10-31T06:30:00Z')), false);
  // 09:29 is too early
  assert.equal(isClassReminderDue(sub('Asia/Tehran'), at('2026-10-31T05:59:00Z')), false);
  // already sent today
  assert.equal(isClassReminderDue(sub('Asia/Tehran', '2026-10-31'), at('2026-10-31T06:15:00Z')), false);
  // sent yesterday: due again
  assert.equal(isClassReminderDue(sub('Asia/Tehran', '2026-10-31'), at('2026-11-01T06:00:00Z')), true);
});

test('no class reminder on Thursday and Friday', () => {
  assert.equal(isClassReminderDue(sub('Asia/Tehran'), at('2026-10-29T06:00:00Z')), false); // Thursday
  assert.equal(isClassReminderDue(sub('Asia/Tehran'), at('2026-10-30T06:00:00Z')), false); // Friday
  assert.equal(isClassReminderDue(sub('Asia/Tehran'), at('2026-11-04T06:00:00Z')), true);  // Wednesday
});

test('the weekday is the local one, not UTC', () => {
  // For a user in Toronto (UTC-4 in October), Saturday 09:30 local = 13:30 UTC
  assert.equal(isClassReminderDue(sub('America/Toronto'), at('2026-10-31T13:30:00Z')), true);
  assert.equal(isClassReminderDue(sub('America/Toronto'), at('2026-10-31T06:00:00Z')), false);
});

test('daylight saving: 09:30 in Vienna is 07:30 UTC in summer time and 08:30 UTC after the switch', () => {
  // 2026-10-24 (Saturday, CEST, UTC+2): 09:30 local = 07:30 UTC
  assert.equal(isClassReminderDue(sub('Europe/Vienna'), at('2026-10-24T07:30:00Z')), true);
  // 2026-10-31 (Saturday, CET, UTC+1): 09:30 local = 08:30 UTC
  assert.equal(isClassReminderDue(sub('Europe/Vienna'), at('2026-10-31T08:30:00Z')), true);
  assert.equal(isClassReminderDue(sub('Europe/Vienna'), at('2026-10-31T07:30:00Z')), false);
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
  const s1 = { inactivity_count: 1, last_inactivity_at: '2026-10-21T09:00:00Z', last_class_at: null };
  assert.equal(decide(lastSeen, s1, '2026-10-22T08:00:00Z').send, false);           // 23 h after the first
  assert.deepEqual(decide(lastSeen, s1, '2026-10-22T09:15:00Z'), { send: true, count: 2 });
  const s3 = { inactivity_count: 3, last_inactivity_at: '2026-10-23T09:00:00Z', last_class_at: null };
  assert.equal(decide(lastSeen, s3, '2026-10-26T09:00:00Z').send, false);           // stops after 3
});

test('inactivity: coming back resets the counter', () => {
  const s3 = { inactivity_count: 3, last_inactivity_at: '2026-10-23T09:00:00Z', last_class_at: null };
  // seen again on the 24th, then away for more than a day
  assert.deepEqual(decide('2026-10-24T08:00:00Z', s3, '2026-10-25T09:00:00Z'), { send: true, count: 1 });
  // still active: no reminder, counter reported as reset
  assert.deepEqual(decide('2026-10-25T08:00:00Z', s3, '2026-10-25T09:00:00Z'), { send: false, count: 0 });
});

test('inactivity: not within 2 hours of a class reminder, never for suspended users', () => {
  const s = { inactivity_count: 0, last_inactivity_at: null, last_class_at: '2026-10-28T06:00:00Z' };
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
  assert.match(classPayload('fa').body, /نیم ساعت/);
  assert.equal(classPayload('en').url, '/?go=learn');
  const p = inactivityPayload('en', 5);
  assert.equal(p.url, '/?go=review');
  assert.equal(p.body, QUOTES.en[5]);
  assert.equal(inactivityPayload('fa', 5).body, QUOTES.fa[5]);
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
