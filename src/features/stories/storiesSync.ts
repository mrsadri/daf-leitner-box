/** Supabase adapter; the store is independently testable without a live database. */
import { supabase } from '../../shared/lib/supabase';
import { isDemoMode } from '../../shared/lib/demo';
import { StoriesProgressStore as ProgressStore } from './progressStore';
import { parseStoryBackup } from '../../core/backup';
import type { StoryProgress } from './types';

/** The id under which a signed-out visitor's progress is kept on the device (never sent anywhere). */
export const GUEST_ID = 'guest';

export class StoriesProgressStore extends ProgressStore {
  constructor(userId: string) {
    const db = supabase;
    super(userId, isDemoMode || !db || userId === GUEST_ID ? null : {
      async pull() {
        const { data, error } = await db.from('story_progress')
          .select('story_id, finished_count, total_count, completed_at, last_active_at, quiz_score').eq('user_id', userId);
        return error ? null : data;
      },
      async save(row) {
        const { error } = await db.from('story_progress').upsert(row, { onConflict: 'user_id,story_id' });
        return !error;
      },
    });
  }
}

/**
 * After sign-in: carry a guest's reading on this device into the account (merged, never backwards), then forget the
 * guest copy. Safe to call on every start; returns how many stories were brought in.
 */
export function importGuestProgress(store: ProgressStore): number {
  let raw: string | null;
  try { raw = localStorage.getItem(`daf_stories_progress_${GUEST_ID}`); } catch { return 0; }
  if (!raw) return 0;
  let entries: Record<string, StoryProgress> = {};
  try { entries = parseStoryBackup(JSON.parse(raw)); } catch { /* unreadable guest copy: nothing to import */ }
  const n = store.importFrom(entries);
  try {
    localStorage.removeItem(`daf_stories_progress_${GUEST_ID}`);
    localStorage.removeItem(`daf_stories_pending_${GUEST_ID}`);
  } catch { /* storage unavailable */ }
  return n;
}
