import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BATCH_SIZE, DictationQueue, MAX_DRAFTS, MigrationMissingError, RETRY_MAX_MS, RETRY_START_MS, clearDraft, fromDbRow, queueKey,
  readDraft, rowsKey, toRpcRow, writeDraft, type Storage, type StorySummary, type Timers, type Transport,
} from '../src/services/dictation/syncCore.ts';
import type { SentenceProgress } from '../src/services/dictation/progressMerge.ts';

const row = (id: string, over: Partial<SentenceProgress> = {}): SentenceProgress => ({
  storyId: 'story-01', sentenceId: id, sentenceOrder: 1, status: 'attempted', attempts: 1, mistakes: 0, skips: 0, listens: 1,
  leitnerActions: 0, contentHash: 'h', firstCorrectAt: null, lastAttemptAt: '2026-11-15T10:00:00Z', ...over,
});
const summary = (finished = 1): StorySummary => ({ storyId: 'story-01', finishedCount: finished, totalCount: 352, lastSentenceId: 's1', contentVersion: 'v1' });

class MemStorage implements Storage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
  keys() { return [...this.data.keys()]; }
}

class FakeTimers implements Timers {
  next = 1;
  pending = new Map<number, { fn: () => void; ms: number }>();
  set(fn: () => void, ms: number) { const id = this.next++; this.pending.set(id, { fn, ms }); return id; }
  clear(h: unknown) { this.pending.delete(h as number); }
  /** Run the (single) pending timer and return its delay. */
  fire(): number { const [[id, t]] = [...this.pending]; this.pending.delete(id); t.fn(); return t.ms; }
}

function fakeTransport(overrides: Partial<Transport> = {}) {
  const saves: { story: StorySummary | null; rows: SentenceProgress[] }[] = [];
  const t: Transport = {
    async save(story, rows) { saves.push({ story, rows }); },
    async load() { return { rows: [], stories: [] }; },
    ...overrides,
  };
  return { t, saves };
}
const settle = () => new Promise(r => setTimeout(r, 0));

test('record merges locally, persists, and schedules a flush after 800 ms', () => {
  const st = new MemStorage(), tm = new FakeTimers(), { t } = fakeTransport();
  const q = new DictationQueue('u1', st, t, tm);
  q.record(row('a'));
  assert.equal(q.pendingCount(), 1);
  assert.equal([...tm.pending.values()][0].ms, 800);
  assert.ok(st.getItem(rowsKey('u1')) && st.getItem(queueKey('u1')));
});

test('a flush sends absolute rows and the story summary once, then the queue is empty', async () => {
  const st = new MemStorage(), tm = new FakeTimers(), { t, saves } = fakeTransport();
  const q = new DictationQueue('u1', st, t, tm);
  q.record(row('a', { attempts: 2 }), summary());
  q.record(row('a', { attempts: 3 }));            // merged: greatest
  await q.flush();
  assert.equal(saves.length, 1);
  assert.equal(saves[0].rows.length, 1);
  assert.equal(saves[0].rows[0].attempts, 3);
  assert.equal(saves[0].story?.finishedCount, 1);
  assert.equal(q.pendingCount(), 0);
  assert.equal(st.getItem(queueKey('u1')), null);
  assert.equal(q.getStatus(), 'idle');
});

test('rows survive a restart: a new queue restores the dirty rows from storage', async () => {
  const st = new MemStorage(), tm = new FakeTimers();
  const a = new DictationQueue('u1', st, fakeTransport().t, tm);
  a.record(row('a')); a.record(row('b', { status: 'correct' }));
  const { t, saves } = fakeTransport();
  const b = new DictationQueue('u1', st, t, new FakeTimers());
  assert.equal(b.pendingCount(), 2);
  assert.equal(b.getRows().get('b')?.status, 'correct');
  await b.flush();
  assert.equal(saves[0].rows.length, 2);
});

test('storage is per user', () => {
  const st = new MemStorage();
  const a = new DictationQueue('u1', st, fakeTransport().t, new FakeTimers());
  a.record(row('a'));
  const b = new DictationQueue('u2', st, fakeTransport().t, new FakeTimers());
  assert.equal(b.getRows().size, 0);
});

test('a failed flush keeps the rows and retries with backoff 2 s, 4 s, ... capped at 60 s', async () => {
  const st = new MemStorage(), tm = new FakeTimers();
  let fail = true;
  const { t, saves } = fakeTransport({ async save(s, r) { if (fail) throw new Error('boom'); saves.push({ story: s, rows: r }); } });
  const q = new DictationQueue('u1', st, t, tm);
  q.record(row('a'));
  tm.pending.clear();
  await q.flush();
  assert.equal(q.getStatus(), 'error');
  assert.equal(q.pendingCount(), 1);
  const delays: number[] = [];
  for (let i = 0; i < 8; i++) { delays.push([...tm.pending.values()][0].ms); tm.fire(); await settle(); }
  assert.deepEqual(delays.slice(0, 5), [RETRY_START_MS, 4000, 8000, 16000, 32000]);
  assert.equal(delays[delays.length - 1], RETRY_MAX_MS);
  fail = false;
  tm.fire(); await settle();
  assert.equal(q.pendingCount(), 0);
  assert.equal(q.getStatus(), 'idle');
  assert.equal(saves.length, 1);
});

test('more than 500 rows are sent in batches of 500, the summary only with the first', async () => {
  const { t, saves } = fakeTransport();
  const q = new DictationQueue('u1', new MemStorage(), t, new FakeTimers());
  for (let i = 0; i < 1200; i++) q.record(row('s' + i, { sentenceOrder: i }), i === 0 ? summary() : undefined);
  await q.flush();
  assert.deepEqual(saves.map(s => s.rows.length), [BATCH_SIZE, BATCH_SIZE, 200]);
  assert.ok(saves[0].story && !saves[1].story && !saves[2].story);
});

test('one failing batch keeps the rest queued', async () => {
  let calls = 0;
  const { t } = fakeTransport({ async save() { if (++calls === 2) throw new Error('second batch fails'); } });
  const q = new DictationQueue('u1', new MemStorage(), t, new FakeTimers());
  for (let i = 0; i < 1100; i++) q.record(row('s' + i));
  await q.flush();
  assert.equal(q.getStatus(), 'error');
  assert.equal(q.pendingCount(), 600);
});

test('missing migration: status unavailable, one notice, no retries, progress stays local', async () => {
  const tm = new FakeTimers();
  const { t } = fakeTransport({ async save() { throw new MigrationMissingError(); } });
  const q = new DictationQueue('u1', new MemStorage(), t, tm);
  let notices = 0;
  q.onUnavailableNotice(() => { notices++; });
  q.record(row('a'));
  await q.flush();
  q.record(row('b'));
  await q.flush();
  assert.equal(q.getStatus(), 'unavailable');
  assert.equal(notices, 1);
  assert.equal(tm.pending.size, 0);
  assert.equal(q.getRows().size, 2);              // the learner keeps working
});

test('load merges server rows into local state without losing local progress', async () => {
  const { t } = fakeTransport({ async load() { return { rows: [row('a', { status: 'heard', attempts: 0 }), row('c', { status: 'correct' })], stories: [summary(5)] }; } });
  const q = new DictationQueue('u1', new MemStorage(), t, new FakeTimers());
  q.record(row('a', { status: 'correct', attempts: 4 }));
  const rows = await q.load(['story-01']);
  assert.equal(rows.get('a')?.status, 'correct');
  assert.equal(rows.get('a')?.attempts, 4);
  assert.equal(rows.get('c')?.status, 'correct');
  assert.equal(q.getStory('story-01')?.finishedCount, 5);
});

test('a failing load leaves the local rows alone and reports the status', async () => {
  const { t } = fakeTransport({ async load() { throw new Error('offline'); } });
  const q = new DictationQueue('u1', new MemStorage(), t, new FakeTimers());
  q.record(row('a'));
  const rows = await q.load(['story-01']);
  assert.equal(rows.size, 1);
  assert.equal(q.getStatus(), 'error');
});

test('clear removes the user data (sign out)', () => {
  const st = new MemStorage();
  const q = new DictationQueue('u1', st, fakeTransport().t, new FakeTimers());
  q.record(row('a'));
  q.clear();
  assert.equal(q.getRows().size, 0);
  assert.equal(st.getItem(rowsKey('u1')), null);
  assert.equal(st.getItem(queueKey('u1')), null);
});

test('row mapping: snake_case for the database, absolute totals', () => {
  const r = row('a', { attempts: 7, leitnerActions: 2 });
  const rpc = toRpcRow(r);
  assert.equal(rpc.sentence_id, 'a');
  assert.equal(rpc.leitner_actions, 2);
  assert.deepEqual(fromDbRow({ ...rpc }), r);
});

test('drafts: kept per sentence and hash, ignored when the hash changed, capped at 20', () => {
  const st = new MemStorage();
  const keys = () => st.keys();
  writeDraft(st, 'u1', keys, 's1', 'h1', 'Ich bin', 1000);
  assert.equal(readDraft(st, 'u1', 's1', 'h1'), 'Ich bin');
  assert.equal(readDraft(st, 'u1', 's1', 'h2'), null);
  writeDraft(st, 'u1', keys, 's1', 'h1', '   ', 2000);               // empty text removes the draft
  assert.equal(readDraft(st, 'u1', 's1', 'h1'), null);
  for (let i = 0; i < 30; i++) writeDraft(st, 'u1', keys, 'd' + i, 'h', 'text ' + i, 10_000 + i);
  assert.equal(st.keys().filter(k => k.includes('_draft_')).length, MAX_DRAFTS);
  assert.equal(readDraft(st, 'u1', 'd0', 'h'), null);                // oldest removed
  assert.equal(readDraft(st, 'u1', 'd29', 'h'), 'text 29');
  clearDraft(st, 'u1', 'd29');
  assert.equal(readDraft(st, 'u1', 'd29', 'h'), null);
});
