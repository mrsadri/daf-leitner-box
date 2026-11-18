/**
 * StoryProgress <-> a row of Supabase public.story_progress (created for dictation in 20261115_story_dictation.sql,
 * reused unchanged by Stories). Pure; unit-tested.
 *   finished_count = pages reached (page + 1), total_count = pages in the story,
 *   last_sentence_id = "p<page+1>" (the column name is from dictation), completed_at = quiz answered.
 */
import type { StoryProgress } from './types';

export interface StoryProgressRow {
  quiz_score?: number | null;
  story_id: string;
  finished_count: number;
  total_count: number;
  last_sentence_id: string | null;
  content_version: string | null;
  completed_at: string | null;
  last_active_at: string;
}

/** Story ids written by Stories look like S01-Q1; older dictation rows are ignored. */
export const isStoryId = (id: string) => /^S\d{2}-Q[1-6]$/.test(id);

export function toRow(p: StoryProgress, contentVersion: string | null): StoryProgressRow {
  return {
    quiz_score: p.score ?? null,
    story_id: p.storyId,
    finished_count: p.page + 1,
    total_count: p.totalPages,
    last_sentence_id: `p${p.page + 1}`,
    content_version: contentVersion,
    completed_at: p.completedAt,
    last_active_at: p.updatedAt,
  };
}

export function fromRow(r: Pick<StoryProgressRow, 'story_id' | 'finished_count' | 'total_count' | 'completed_at' | 'last_active_at'> & { quiz_score?: number | null }): StoryProgress | null {
  if (!isStoryId(r.story_id)) return null;
  return {
    storyId: r.story_id,
    page: Math.max(0, (r.finished_count ?? 1) - 1),
    totalPages: r.total_count ?? 0,
    completedAt: r.completed_at ?? null,
    updatedAt: r.last_active_at,
    ...(r.quiz_score == null ? {} : { score: r.quiz_score }),
  };
}
