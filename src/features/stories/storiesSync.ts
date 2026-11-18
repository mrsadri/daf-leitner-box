/** Supabase adapter; the store is independently testable without a live database. */
import { supabase } from '../../shared/lib/supabase';
import { isDemoMode } from '../../shared/lib/demo';
import { StoriesProgressStore as ProgressStore } from './progressStore';

export class StoriesProgressStore extends ProgressStore {
  constructor(userId: string) {
    const db = supabase;
    super(userId, isDemoMode || !db ? null : {
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
