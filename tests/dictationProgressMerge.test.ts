import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isFinished, isStale, mergeAll, mergeSentence, sequenceCounts, storyPosition, type SentenceProgress } from '../src/services/dictation/progressMerge.ts';
import type { Story } from '../src/types/dictation.ts';

const row = (id: string, over: Partial<SentenceProgress> = {}): SentenceProgress => ({
  storyId: 'story-01', sentenceId: id, sentenceOrder: 1, status: 'heard', attempts: 0, mistakes: 0, skips: 0, listens: 0,
  leitnerActions: 0, contentHash: null, firstCorrectAt: null, lastAttemptAt: null, ...over,
});

const sentence = (id: string) => ({ id, hash: 'h' + id, text: 'x', speaker: 'NARRATOR', endMark: '.' as const, quoteBalance: 0, flags: [], links: [], grammar: [] });
const story: Story = {
  id: 'story-01', title: 'T', block: 1, lessons: [1, 3], contentVersion: 'v1', speakersReviewed: true, names: [],
  sequences: [
    { id: 'S01-Q1', order: 1, title: 'a', situation: { fa: '', en: '' }, image: null, sentences: [sentence('a1'), sentence('a2')] },
    { id: 'S01-Q2', order: 2, title: 'b', situation: { fa: '', en: '' }, image: null, sentences: [sentence('b1')] },
  ],
};

test('status only moves up in rank; equal rank takes the incoming one', () => {
  assert.equal(mergeSentence(row('a', { status: 'correct' }), row('a', { status: 'attempted' })).status, 'correct');
  assert.equal(mergeSentence(row('a', { status: 'heard' }), row('a', { status: 'moved' })).status, 'moved');
  assert.equal(mergeSentence(row('a', { status: 'moved' }), row('a', { status: 'skipped' })).status, 'skipped');
});

test('counters take the greater value (idempotent, never double counted)', () => {
  const a = row('a', { attempts: 3, mistakes: 2, listens: 5, skips: 1, leitnerActions: 0 });
  const b = row('a', { attempts: 2, mistakes: 4, listens: 5, skips: 0, leitnerActions: 2 });
  const m = mergeSentence(a, b);
  assert.deepEqual([m.attempts, m.mistakes, m.listens, m.skips, m.leitnerActions], [3, 4, 5, 1, 2]);
  assert.deepEqual(mergeSentence(m, b), m);                  // applying the same row again changes nothing
  assert.deepEqual(mergeSentence(m, m), m);
});

test('first_correct_at is the earlier, ignoring null; last_attempt_at the later', () => {
  const m = mergeSentence(row('a', { firstCorrectAt: null, lastAttemptAt: '2026-01-02' }),
    row('a', { firstCorrectAt: '2026-01-05', lastAttemptAt: '2026-01-01' }));
  assert.equal(m.firstCorrectAt, '2026-01-05');
  assert.equal(m.lastAttemptAt, '2026-01-02');
  assert.equal(mergeSentence(row('a', { firstCorrectAt: '2026-01-09' }), row('a', { firstCorrectAt: '2026-01-05' })).firstCorrectAt, '2026-01-05');
});

test('merging is commutative for status and counters', () => {
  const a = row('a', { status: 'attempted', attempts: 4 });
  const b = row('a', { status: 'correct', attempts: 2 });
  const ab = mergeSentence(a, b), ba = mergeSentence(b, a);
  assert.equal(ab.status, ba.status);
  assert.equal(ab.attempts, ba.attempts);
});

test('the content hash follows the incoming row when it has one', () => {
  assert.equal(mergeSentence(row('a', { contentHash: 'old' }), row('a', { contentHash: 'new' })).contentHash, 'new');
  assert.equal(mergeSentence(row('a', { contentHash: 'old' }), row('a', { contentHash: null })).contentHash, 'old');
});

test('mergeAll merges a remote batch into the local map without touching other rows', () => {
  const local = new Map([['a1', row('a1', { status: 'correct' })], ['b1', row('b1')]]);
  const merged = mergeAll(local, [row('a1', { status: 'heard' }), row('a2', { status: 'moved' })]);
  assert.equal(merged.get('a1')!.status, 'correct');
  assert.equal(merged.get('a2')!.status, 'moved');
  assert.equal(merged.get('b1')!.status, 'heard');
  assert.equal(local.has('a2'), false);                      // the input map is not mutated
});

test('finished means moved, skipped or correct', () => {
  assert.deepEqual((['heard', 'attempted', 'moved', 'skipped', 'correct'] as const).map(isFinished), [false, false, true, true, true]);
  assert.equal(isFinished(undefined), false);
});

test('storyPosition: the frontier is the first unfinished sentence, not the last one touched', () => {
  const rows = new Map([['a1', row('a1', { status: 'correct' })], ['a2', row('a2', { status: 'attempted' })], ['b1', row('b1', { status: 'correct' })]]);
  const p = storyPosition(story, rows);
  assert.deepEqual(p.frontier, { sequenceIndex: 0, sentenceIndex: 1, sentenceId: 'a2' });
  assert.equal(p.finishedCount, 2);
  assert.equal(p.totalCount, 3);
  assert.equal(p.completed, false);
});

test('storyPosition: a complete story has no frontier; an empty one starts at the first sentence', () => {
  const all = new Map(['a1', 'a2', 'b1'].map(id => [id, row(id, { status: 'skipped' })]));
  assert.deepEqual(storyPosition(story, all), { finishedCount: 3, totalCount: 3, frontier: null, completed: true });
  assert.equal(storyPosition(story, new Map()).frontier?.sentenceId, 'a1');
});

test('retired ids (rows without a sentence) are ignored in the counts', () => {
  const rows = new Map([['gone', row('gone', { status: 'correct' })], ['a1', row('a1', { status: 'correct' })]]);
  assert.equal(storyPosition(story, rows).finishedCount, 1);
});

test('an inserted sentence reopens the frontier', () => {
  const rows = new Map([['a1', row('a1', { status: 'correct' })], ['a2', row('a2', { status: 'correct' })], ['b1', row('b1', { status: 'correct' })]]);
  assert.equal(storyPosition(story, rows).completed, true);
  const edited: Story = { ...story, sequences: [{ ...story.sequences[0], sentences: [story.sequences[0].sentences[0], sentence('new'), story.sequences[0].sentences[1]] }, story.sequences[1]] };
  assert.equal(storyPosition(edited, rows).frontier?.sentenceId, 'new');
});

test('sequenceCounts gives the six tile numbers', () => {
  const rows = new Map([['a1', row('a1', { status: 'correct' })]]);
  assert.deepEqual(sequenceCounts(story, rows), [{ id: 'S01-Q1', finished: 1, total: 2 }, { id: 'S01-Q2', finished: 0, total: 1 }]);
});

test('isStale: a finished row whose stored hash differs from the current text', () => {
  assert.equal(isStale(row('a', { contentHash: 'x' }), 'y'), true);
  assert.equal(isStale(row('a', { contentHash: 'x' }), 'x'), false);
  assert.equal(isStale(row('a', { contentHash: null }), 'x'), false);
  assert.equal(isStale(undefined, 'x'), false);
});
