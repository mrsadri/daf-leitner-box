/**
 * Progress merging, the same rules as the server function save_dictation_progress (docs/dictation/09-data-model.md):
 * status only moves up in rank, counters take the greater value, first_correct_at the earlier, last_attempt_at the later.
 * Pure and unit-tested; used by dictationSync to merge the local cache with the rows from the server.
 */
import type { Story } from '../../types/dictation.ts';

export type Status = 'heard' | 'attempted' | 'moved' | 'skipped' | 'correct';

export const STATUS_RANK: Record<Status, number> = { heard: 1, attempted: 2, moved: 3, skipped: 3, correct: 4 };

export interface SentenceProgress {
  storyId: string;
  sentenceId: string;
  sentenceOrder: number;
  status: Status;
  attempts: number;
  mistakes: number;
  skips: number;
  listens: number;
  leitnerActions: number;
  contentHash: string | null;
  firstCorrectAt: string | null;
  lastAttemptAt: string | null;
}

/** Finished = left the sentence one way or another. A missing row means the sentence is new. */
export const isFinished = (status: Status | undefined): boolean => status === 'moved' || status === 'skipped' || status === 'correct';

const maxDate = (a: string | null, b: string | null) => (a && b ? (a >= b ? a : b) : a ?? b);
const minDate = (a: string | null, b: string | null) => (a && b ? (a <= b ? a : b) : a ?? b);   // like SQL least(): ignores NULL

/** `incoming` wins ties on rank and supplies the content hash, exactly like the SQL `>=` comparison. */
export function mergeSentence(existing: SentenceProgress | undefined, incoming: SentenceProgress): SentenceProgress {
  if (!existing) return { ...incoming };
  const takeIncomingStatus = STATUS_RANK[incoming.status] >= STATUS_RANK[existing.status];
  return {
    ...existing,
    status: takeIncomingStatus ? incoming.status : existing.status,
    sentenceOrder: incoming.sentenceOrder,
    attempts: Math.max(existing.attempts, incoming.attempts),
    mistakes: Math.max(existing.mistakes, incoming.mistakes),
    skips: Math.max(existing.skips, incoming.skips),
    listens: Math.max(existing.listens, incoming.listens),
    leitnerActions: Math.max(existing.leitnerActions, incoming.leitnerActions),
    contentHash: incoming.contentHash ?? existing.contentHash,
    firstCorrectAt: minDate(existing.firstCorrectAt, incoming.firstCorrectAt),
    lastAttemptAt: maxDate(existing.lastAttemptAt, incoming.lastAttemptAt),
  };
}

export function mergeAll(local: ReadonlyMap<string, SentenceProgress>, remote: Iterable<SentenceProgress>): Map<string, SentenceProgress> {
  const out = new Map(local);
  for (const row of remote) out.set(row.sentenceId, mergeSentence(out.get(row.sentenceId), row));
  return out;
}

export interface StoryPosition {
  finishedCount: number;
  totalCount: number;
  /** First unfinished sentence in reading order, or null when the story is complete. */
  frontier: { sequenceIndex: number; sentenceIndex: number; sentenceId: string } | null;
  completed: boolean;
}

/**
 * Counts only ids that exist in the current content (retired ids are ignored) and finds where to resume.
 * Also the recomputation when `contentVersion` differs from the stored one.
 */
export function storyPosition(story: Story, rows: ReadonlyMap<string, SentenceProgress>): StoryPosition {
  let finished = 0, total = 0;
  let frontier: StoryPosition['frontier'] = null;
  story.sequences.forEach((q, qi) => {
    q.sentences.forEach((s, si) => {
      total++;
      if (isFinished(rows.get(s.id)?.status)) finished++;
      else if (!frontier) frontier = { sequenceIndex: qi, sentenceIndex: si, sentenceId: s.id };
    });
  });
  return { finishedCount: finished, totalCount: total, frontier, completed: total > 0 && finished === total };
}

/** Per-sequence finished counts, for the six tiles of the story detail screen. */
export function sequenceCounts(story: Story, rows: ReadonlyMap<string, SentenceProgress>): { id: string; finished: number; total: number }[] {
  return story.sequences.map(q => ({
    id: q.id,
    total: q.sentences.length,
    finished: q.sentences.filter(s => isFinished(rows.get(s.id)?.status)).length,
  }));
}

/** A finished sentence whose stored hash differs from the current text was edited after the learner finished it. */
export const isStale = (row: SentenceProgress | undefined, currentHash: string): boolean =>
  !!row && !!row.contentHash && row.contentHash !== currentHash;
