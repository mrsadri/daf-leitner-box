/**
 * Stories progress on this device and in Supabase.
 *
 *   - localStorage keeps a copy (works offline, shows progress at once); changes wait in a "pending" list
 *   - pending rows are upserted into public.story_progress (row-level security: own rows only) a moment after a
 *     change, when the connection comes back, and at the next start
 *   - the server copy is merged in before anything is sent, so a device that was offline never overwrites progress
 *     made elsewhere with an older copy; progress never goes backwards (progress.ts), and a missing quiz date is
 *     never sent as an empty value
 *   - demo mode: localStorage only
 */
import { supabase } from '../../shared/lib/supabase';
import { isDemoMode } from '../../shared/lib/demo';
import { mergeAll } from './progress';
import { fromRow, toRow, type StoryProgressRow } from './progressRow';
import type { StoryProgress } from './types';

type Map_ = Record<string, StoryProgress>;
const FLUSH_DELAY_MS = 1500;
const key = (uid: string) => `daf_stories_progress_${uid}`;
const pendingKey = (uid: string) => `daf_stories_pending_${uid}`;

function read<T>(k: string, fallback: T): T {
  try { const raw = localStorage.getItem(k); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function write(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked: the in-memory copy still works */ }
}

export class StoriesProgressStore {
  private map: Map_;
  private pending: Set<string>;
  private versions = new Map<string, string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** The server copy has been merged in at least once */
  private synced = false;
  private listeners = new Set<(m: Map_) => void>();
  private onOnline = () => { void this.flush(); };

  constructor(private userId: string) {
    this.map = read<Map_>(key(userId), {});
    this.pending = new Set(read<string[]>(pendingKey(userId), []));
    if (typeof window !== 'undefined') window.addEventListener('online', this.onOnline);
  }

  dispose() {
    if (typeof window !== 'undefined') window.removeEventListener('online', this.onOnline);
    if (this.timer) clearTimeout(this.timer);
  }

  get(): Map_ { return this.map; }

  subscribe(fn: (m: Map_) => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  /** Pull the server copy and merge it in; then send what is still pending. */
  async start(): Promise<void> {
    await this.pull();
    await this.flush();
  }

  private async pull(): Promise<void> {
    if (isDemoMode || !supabase) { this.synced = true; return; }
    try {
      const { data, error } = await supabase.from('story_progress')
        .select('story_id, finished_count, total_count, completed_at, last_active_at');
      if (error || !data) return;
      const remote: Map_ = {};
      for (const r of data) { const p = fromRow(r); if (p) remote[p.storyId] = p; }
      this.set(mergeAll(this.map, remote));
      this.synced = true;
    } catch { /* offline: the local copy is used, nothing is sent yet */ }
  }

  save(p: StoryProgress, contentVersion: string) {
    this.versions.set(p.storyId, contentVersion);
    this.pending.add(p.storyId);
    write(pendingKey(this.userId), [...this.pending]);
    this.set({ ...this.map, [p.storyId]: p });
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.flush(); }, FLUSH_DELAY_MS);
  }

  async flush(): Promise<void> {
    if (isDemoMode || !supabase) {
      this.pending.clear();
      write(pendingKey(this.userId), []);
      return;
    }
    if (this.pending.size === 0) return;
    if (!this.synced) await this.pull();
    if (!this.synced) return;
    for (const id of [...this.pending]) {
      const p = this.map[id];
      if (!p) { this.pending.delete(id); continue; }
      const row: Partial<StoryProgressRow> & { user_id: string } = { user_id: this.userId, ...toRow(p, this.versions.get(id) ?? null) };
      if (!row.completed_at) delete row.completed_at;
      if (!row.content_version) delete row.content_version;
      try {
        const { error } = await supabase.from('story_progress').upsert(row, { onConflict: 'user_id,story_id' });
        if (error) return;      // kept pending; tried again later
        this.pending.delete(id);
        write(pendingKey(this.userId), [...this.pending]);
      } catch { return; /* offline */ }
    }
  }

  private set(m: Map_) {
    this.map = m;
    write(key(this.userId), m);
    this.listeners.forEach(fn => fn(m));
  }
}
