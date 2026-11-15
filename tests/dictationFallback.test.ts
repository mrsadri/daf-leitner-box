import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chainFor, CircuitBreaker, nextStepAfter, planSources, isFallback } from '../src/services/dictation/fallback.ts';

test('chains follow the table', () => {
  assert.deepEqual(chainFor('A'), ['A', 'B', 'C']);
  assert.deepEqual(chainFor('B'), ['B', 'A', 'C']);
  assert.deepEqual(chainFor('C'), ['C', 'A', 'B']);
});

test('a missing key, a 404 or a decode error go to the next source; network and timeout retry once', () => {
  for (const k of ['missing', 'http404', 'decode'] as const) assert.equal(nextStepAfter(k, false), 'next');
  for (const k of ['network', 'timeout'] as const) {
    assert.equal(nextStepAfter(k, false), 'retry');
    assert.equal(nextStepAfter(k, true), 'next');
  }
});

test('three consecutive failures open the breaker for five minutes; a success closes it', () => {
  const b = new CircuitBreaker();
  const t0 = 1_000_000;
  b.recordFailure('A', t0); b.recordFailure('A', t0);
  assert.equal(b.isOpen('A', t0), false);
  b.recordFailure('A', t0);
  assert.equal(b.isOpen('A', t0 + 1), true);
  assert.equal(b.isOpen('A', t0 + 5 * 60 * 1000 - 1), true);
  assert.equal(b.isOpen('B', t0), false);                    // per mode
  const c = new CircuitBreaker();
  c.recordFailure('A', t0); c.recordFailure('A', t0); c.recordSuccess('A'); c.recordFailure('A', t0);
  assert.equal(c.isOpen('A', t0), false);
});

test('after five minutes the breaker lets one attempt through and reopens at once if it fails', () => {
  const b = new CircuitBreaker();
  const t0 = 0;
  for (let i = 0; i < 3; i++) b.recordFailure('A', t0);
  const later = t0 + 5 * 60 * 1000;
  assert.equal(b.isOpen('A', later), false);
  b.recordFailure('A', later);
  assert.equal(b.isOpen('A', later + 1), true);
});

test('planSources skips modes without a key, open breakers, and Mode C without a German voice', () => {
  const breaker = new CircuitBreaker();
  const base = { hasKey: { A: true, B: true }, hasGermanVoice: true, breaker, now: 0 };
  assert.deepEqual(planSources('A', base), ['A', 'B', 'C']);
  assert.deepEqual(planSources('A', { ...base, hasKey: { A: false, B: true } }), ['B', 'C']);
  assert.deepEqual(planSources('C', { ...base, hasGermanVoice: false }), ['A', 'B']);
  for (let i = 0; i < 3; i++) breaker.recordFailure('A', 0);
  assert.deepEqual(planSources('A', base), ['B', 'C']);
  assert.deepEqual(planSources('B', { ...base, hasKey: { A: false, B: false }, hasGermanVoice: false }), []);
});

test('isFallback compares the selected and the played source', () => {
  assert.equal(isFallback('A', 'A'), false);
  assert.equal(isFallback('A', 'C'), true);
});
