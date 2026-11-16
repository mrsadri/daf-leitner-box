/**
 * Stories progress rules. Pure; unit-tested in tests/storiesProgress.test.ts.
 *
 *   - every book is open; inside a book, a story opens once the quiz of the story before it is answered
 *   - progress only moves forward: merging two copies (this device, the server) keeps the furthest page and the
 *     earliest completion, so a second device or an old cache never undoes anything
 */
import type { StoryProgress } from './types';

export type StoryState = 'done' | 'open' | 'locked';

export function mergeProgress(a: StoryProgress | undefined, b: StoryProgress | undefined): StoryProgress | undefined {
  if (!a) return b;
  if (!b) return a;
  const completed = [a.completedAt, b.completedAt].filter((x): x is string => !!x).sort()[0] ?? null;
  return {
    storyId: a.storyId,
    page: Math.max(a.page, b.page),
    totalPages: Math.max(a.totalPages, b.totalPages),
    completedAt: completed,
    score: a.updatedAt >= b.updatedAt ? (a.score ?? b.score) : (b.score ?? a.score),
    updatedAt: a.updatedAt >= b.updatedAt ? a.updatedAt : b.updatedAt,
  };
}

export function mergeAll(local: Record<string, StoryProgress>, remote: Record<string, StoryProgress>): Record<string, StoryProgress> {
  const out: Record<string, StoryProgress> = {};
  for (const id of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    const m = mergeProgress(local[id], remote[id]);
    if (m) out[id] = m;
  }
  return out;
}

/** States of a book's stories, in order. */
export function storyStates(storyIds: string[], progress: Record<string, StoryProgress>): StoryState[] {
  return storyIds.map((id, i) => {
    if (progress[id]?.completedAt) return 'done';
    if (i === 0 || progress[storyIds[i - 1]]?.completedAt) return 'open';
    return 'locked';
  });
}

/** The story to continue with in a book: the first one that is open and not done (null when all are done). */
export function nextStory(storyIds: string[], progress: Record<string, StoryProgress>): string | null {
  const states = storyStates(storyIds, progress);
  const i = states.indexOf('open');
  return i === -1 ? null : storyIds[i];
}

/** Advance the page reached (never backwards). */
export function withPage(p: StoryProgress | undefined, storyId: string, page: number, totalPages: number, now: string): StoryProgress {
  return {
    storyId,
    page: Math.max(p?.page ?? 0, page),
    totalPages,
    completedAt: p?.completedAt ?? null,
    score: p?.score,
    updatedAt: now,
  };
}

/** Mark the quiz answered. A repeated quiz keeps the first completion date but records the new score. */
export function withQuizDone(p: StoryProgress | undefined, storyId: string, totalPages: number, score: number, now: string): StoryProgress {
  return {
    storyId,
    page: Math.max(p?.page ?? 0, totalPages - 1),
    totalPages,
    completedAt: p?.completedAt ?? now,
    score,
    updatedAt: now,
  };
}
