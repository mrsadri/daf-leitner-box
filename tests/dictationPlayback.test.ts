import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlaybackController, PlayError, type PlayRequest, type Sources } from '../src/services/dictation/playback.ts';
import type { Sentence } from '../src/types/dictation.ts';
import type { AudioIndex } from '../src/services/dictation/content.ts';

const sentence = { id: 's1', hash: 'h', text: 'Hallo.', speaker: 'NARRATOR', endMark: '.', quoteBalance: 0, flags: [], links: [], grammar: [] } as Sentence;
const idx = (mode: 'A' | 'B', has = true): AudioIndex => ({ version: 1, mode, sentences: has ? { s1: { key: 'k' + mode, ms: 1000, bytes: 1, textHash: 'h' } } : {} });
const req = (over: Partial<PlayRequest> = {}): PlayRequest => ({
  sentence, storyId: 'story-01', selected: 'B', rate: 1, indexes: { A: null, B: idx('B') }, hasGermanVoice: true, mediaBase: '/m', ...over,
});

function fake(script: Partial<Sources> = {}) {
  const calls: string[] = [];
  const sources: Sources = {
    async playFile(url) { calls.push('file:' + url); },
    async speak() { calls.push('speak'); },
    ...script,
  };
  return { sources, calls };
}
const noWait = async () => {};

test('plays the selected mode from the media base URL', async () => {
  const { sources, calls } = fake();
  const c = new PlaybackController({ sources, wait: noWait });
  const r = await c.play(req());
  assert.deepEqual(calls, ['file:/m/audio/B/kB.mp3']);
  assert.equal(r.status, 'played');
  assert.ok(r.status === 'played' && r.source === 'B' && !r.fallback);
  assert.equal(c.getState(), 'idle');
});

test('a missing key or 404 goes straight to the next source without retry', async () => {
  const { sources, calls } = fake({ async playFile() { throw new PlayError('http404'); } });
  const c = new PlaybackController({ sources, wait: noWait });
  const r = await c.play(req());
  assert.deepEqual(calls, ['speak']);
  assert.ok(r.status === 'played' && r.source === 'C' && r.fallback);
});

test('a network error retries once, then falls back', async () => {
  let n = 0;
  const { sources, calls } = fake({ async playFile() { n++; throw new PlayError('network'); } });
  const waits: number[] = [];
  const c = new PlaybackController({ sources, wait: async ms => { waits.push(ms); } });
  const r = await c.play(req());
  assert.equal(n, 2);
  assert.deepEqual(waits, [500]);
  assert.deepEqual(calls, ['speak']);
  assert.ok(r.status === 'played' && r.source === 'C');
});

test('everything failing reports the failures (UI state 16)', async () => {
  const { sources } = fake({ async playFile() { throw new PlayError('decode'); }, async speak() { throw new PlayError('network'); } });
  const c = new PlaybackController({ sources, wait: noWait });
  const r = await c.play(req());
  assert.equal(r.status, 'failed');
  assert.ok(r.status === 'failed' && r.failures.length === 2);
});

test('Mode C is skipped when the device has no German voice', async () => {
  const { sources, calls } = fake({ async playFile() { throw new PlayError('http404'); } });
  const c = new PlaybackController({ sources, wait: noWait });
  const r = await c.play(req({ hasGermanVoice: false }));
  assert.equal(r.status, 'failed');
  assert.deepEqual(calls, []);
});

test('a sentence without a file in the index plays with the device voice', async () => {
  const { sources, calls } = fake();
  const c = new PlaybackController({ sources, wait: noWait });
  const r = await c.play(req({ indexes: { A: null, B: idx('B', false) } }));
  assert.deepEqual(calls, ['speak']);
  assert.ok(r.status === 'played' && r.fallback);
});

test('Mode C selected plays the device voice first', async () => {
  const { sources, calls } = fake();
  const c = new PlaybackController({ sources, wait: noWait });
  await c.play(req({ selected: 'C' }));
  assert.deepEqual(calls, ['speak']);
});

test('a new request cancels the running one: the stale callback is ignored, only one plays to the end', async () => {
  let release: () => void = () => {};
  const finished: string[] = [];
  const { sources } = fake({
    playFile(url, _r, signal) {
      return new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => resolve());          // the element stops; the stale promise resolves
        release = () => { finished.push(url); resolve(); };
      });
    },
  });
  const c = new PlaybackController({ sources, wait: noWait });
  const first = c.play(req());
  const second = c.play(req({ sentence: { ...sentence, id: 's2' }, indexes: { A: null, B: { ...idx('B'), sentences: { s2: { key: 'k2', ms: 1, bytes: 1, textHash: 'h' } } } } }));
  assert.equal((await first).status, 'cancelled');
  release();
  const r2 = await second;
  assert.equal(r2.status, 'played');
  assert.deepEqual(finished, ['/m/audio/B/k2.mp3']);
});

test('stop() invalidates the running playback', async () => {
  const { sources } = fake({ playFile: (_u, _r, signal) => new Promise<void>(res => signal.addEventListener('abort', () => res())) });
  const c = new PlaybackController({ sources, wait: noWait });
  const p = c.play(req());
  c.stop();
  assert.equal((await p).status, 'cancelled');
  assert.equal(c.getState(), 'idle');
});

test('replays within 150 ms are ignored; the first start of a sentence is never debounced', async () => {
  let t = 1000;
  const { sources, calls } = fake();
  const c = new PlaybackController({ sources, wait: noWait, now: () => t });
  await c.play(req({ isReplay: true }));
  t += 100;
  assert.equal((await c.play(req({ isReplay: true }))).status, 'cancelled');
  t += 100;
  assert.equal((await c.play(req({ isReplay: true }))).status, 'played');
  assert.equal((await c.play(req())).status, 'played');
  assert.equal(calls.length, 3);
});

test('three network failures open the circuit breaker: the mode is skipped for the next sentences', async () => {
  let n = 0;
  const { sources, calls } = fake({ async playFile() { n++; throw new PlayError('network'); } });
  const c = new PlaybackController({ sources, wait: noWait, now: () => 5 });
  await c.play(req());                     // 2 attempts (retry) -> 2 failures recorded
  await c.play(req());                     // third failure opens the breaker during this request
  const before = n;
  await c.play(req());
  assert.equal(n, before);                 // B is skipped now
  assert.ok(calls.filter(x => x === 'speak').length >= 3);
});

test('state events: loading, then idle at the end', async () => {
  const { sources } = fake();
  const c = new PlaybackController({ sources, wait: noWait });
  const seen: string[] = [];
  c.onState(s => seen.push(s));
  await c.play(req());
  assert.ok(seen.includes('loading'));
  assert.equal(seen[seen.length - 1], 'idle');
});
