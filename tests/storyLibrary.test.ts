import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lastReading } from '../src/features/stories/library.ts';
import type { BookSummary, StoryProgress } from '../src/features/stories/types.ts';

test('resume ignores completed and locked stories, preserving page zero', () => {
  const books = [{ n: 1, stories: [{ id: 'a' }, { id: 'b' }] }, { n: 2, stories: [{ id: 'c' }] }] as BookSummary[];
  const saved = (storyId: string, updatedAt: string): StoryProgress => ({ storyId, page: 0, totalPages: 3, updatedAt, completedAt: null });
  const progress = { a: saved('a', '2026-01-01'), b: saved('b', '2026-01-03'), c: saved('c', '2026-01-02') };
  assert.equal(lastReading(books, progress)?.story.id, 'c');
  progress.c.completedAt = '2026-01-02';
  assert.equal(lastReading(books, progress)?.story.id, 'a');
  assert.equal(lastReading(books, progress)?.saved.page, 0);
  assert.equal(lastReading(books, {}), undefined);
});
