import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeProgress, mergeAll, storyStates, nextStory, withPage, withQuizDone } from '../src/features/stories/progress.ts';
import type { StoryProgress } from '../src/features/stories/types.ts';

const p = (o: Partial<StoryProgress> & { storyId: string }): StoryProgress =>
  ({ page: 0, totalPages: 5, completedAt: null, updatedAt: '2026-11-16T10:00:00Z', ...o });

const ids = ['S01-Q1', 'S01-Q2', 'S01-Q3'];

test('the first story is open, the rest wait for the quiz before them', () => {
  assert.deepEqual(storyStates(ids, {}), ['open', 'locked', 'locked']);
  const prog = { 'S01-Q1': p({ storyId: 'S01-Q1', completedAt: '2026-11-16T10:00:00Z' }) };
  assert.deepEqual(storyStates(ids, prog), ['done', 'open', 'locked']);
  assert.equal(nextStory(ids, prog), 'S01-Q2');
});

test('reading pages without answering the quiz does not open the next story', () => {
  const prog = { 'S01-Q1': p({ storyId: 'S01-Q1', page: 4 }) };
  assert.deepEqual(storyStates(ids, prog), ['open', 'locked', 'locked']);
});

test('all done: nothing next', () => {
  const done = Object.fromEntries(ids.map(id => [id, p({ storyId: id, completedAt: '2026-11-16T10:00:00Z' })]));
  assert.equal(nextStory(ids, done), null);
});

test('merge never goes backwards', () => {
  const a = p({ storyId: 'S01-Q1', page: 3, completedAt: null, updatedAt: '2026-11-16T12:00:00Z' });
  const b = p({ storyId: 'S01-Q1', page: 1, completedAt: '2026-11-15T09:00:00Z', updatedAt: '2026-11-15T09:00:00Z' });
  const m = mergeProgress(a, b)!;
  assert.equal(m.page, 3);
  assert.equal(m.completedAt, '2026-11-15T09:00:00Z');
  assert.equal(m.updatedAt, '2026-11-16T12:00:00Z');
  assert.deepEqual(mergeProgress(a, b), mergeProgress(b, a));
});

test('merge of whole maps keeps stories only one side knows', () => {
  const m = mergeAll({ A: p({ storyId: 'A' }) }, { B: p({ storyId: 'B', page: 2 }) });
  assert.deepEqual(Object.keys(m).sort(), ['A', 'B']);
});

test('page and quiz updates', () => {
  const now = '2026-11-16T10:00:00Z';
  let s = withPage(undefined, 'S01-Q1', 2, 5, now);
  assert.equal(s.page, 2);
  s = withPage(s, 'S01-Q1', 1, 5, now);
  assert.equal(s.page, 2, 'going back a page keeps the furthest page');
  s = withQuizDone(s, 'S01-Q1', 5, 2, now);
  assert.equal(s.completedAt, now);
  assert.equal(s.page, 4);
  const again = withQuizDone(s, 'S01-Q1', 5, 3, '2026-11-20T10:00:00Z');
  assert.equal(again.completedAt, now, 'a repeated quiz keeps the first completion');
  assert.equal(again.score, 3);
});
