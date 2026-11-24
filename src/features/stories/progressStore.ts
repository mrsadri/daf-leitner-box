/**
 * Stories progress on this device and in Supabase.
 *
 *   - localStorage keeps a copy (works offline, shows progress at once); changes wait in a "pending" list
 *   - pending rows are upserted into public.story_progress (row-level security: own rows only) a moment after a
 *     change, when the connection comes back, and at the next start
 *   - the server copy is merged in before anything is sent, to preserve progress known at startup. Concurrent server merges
 *     are a separate database responsibility; a missing quiz date is
 *     never sent as an empty value
 *   - demo mode: localStorage only
 */
import { parseStoryBackup } from '../../core/backup.ts';
import { mergeAll } from './progress.ts';
import { fromRow, toRow, type StoryProgressRow } from './progressRow.ts';
import type { StoryProgress } from './types.ts';

type Map_ = Record<string, StoryProgress>;
const FLUSH_DELAY_MS = 1500;
const key = (uid: string) => `daf_stories_progress_${uid}`;
const pendingKey = (uid: string) => `daf_stories_pending_${uid}`;

function read<T>(k: string, fallback: T): T {
  const raw = localStorage.getItem(k);
  return raw ? (JSON.parse(raw) as T) : fallback;
}
function write(k: string, v: unknown) {
  localStorage.setItem(k, JSON.stringify(v));
}

export interface StoriesTransport {
  pull(): Promise<Pick<StoryProgressRow, 'story_id' | 'finished_count' | 'total_count' | 'completed_at' | 'last_active_at' | 'quiz_score'>[] | null>;
  save(row: Partial<StoryProgressRow> & { user_id: string; story_id: string }): Promise<boolean>;
}

export type StorySaveStatus = 'idle' | 'pending' | 'saving' | 'error';
const RETRY_DELAYS = [2000, 5000, 15000];

export class StoriesProgressStore {
  private disposed = false;
  private retries = 0;
  private status: StorySaveStatus = 'idle';
  private lastSuccess: string | null = null;
  getSaveInfo() { return { pending:this.pending.size, lastSuccess:this.lastSuccess }; }
  private statusListeners = new Set<(s: StorySaveStatus) => void>();

  onStatus(fn: (s: StorySaveStatus) => void) {
    this.statusListeners.add(fn);
    fn(this.status);
    return () => { this.statusListeners.delete(fn); };
  }

  private setStatus(s: StorySaveStatus) {
    this.status = s;
    this.statusListeners.forEach(fn => fn(s));
  }

  private schedule(delay: number) {
    if (this.disposed) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, delay);
  }

  private failed() {
    this.setStatus('error');
    const delay = RETRY_DELAYS[this.retries++];
    if (delay !== undefined) this.schedule(delay);
  }

  retry() {
    this.retries = 0;
    return this.flush();
  }
  private flushing: Promise<void> | null = null;
  private revisions = new Map<string, number>();
  private map: Map_;
  private pending: Set<string>;
  private versions = new Map<string, string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** The server copy has been merged in at least once */
  private synced = false;
  private listeners = new Set<(m: Map_) => void>();
  private onOnline = () => { void this.retry(); };

  private userId: string;
  private transport: StoriesTransport | null;

  constructor(userId: string, transport: StoriesTransport | null) {
    this.userId = userId;
    this.transport = transport;
    this.map = parseStoryBackup(read<unknown>(key(userId), {}));
    const pending = read<unknown>(pendingKey(userId), []);
    if (!Array.isArray(pending) || pending.length > 60 || !pending.every(id => typeof id === 'string' && /^S(0[1-9]|10)-Q[1-6]$/.test(id))) throw new Error('Invalid pending story data; export local data before recovery');
    this.pending = new Set(pending);
    if (typeof window !== 'undefined') window.addEventListener('online', this.onOnline);
  }

  dispose() {
    this.disposed = true;
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
    if (!this.transport) { this.synced = true; return; }
    try {
      const data = await this.transport.pull();
      if (this.disposed || !data) return;
      const remote: Map_ = {};
      for (const r of data) { const p = fromRow(r); if (p) remote[p.storyId] = p; }
      this.set(mergeAll(this.map, remote));
      this.synced = true;
    } catch { /* offline: the local copy is used, nothing is sent yet */ }
  }

  save(p: StoryProgress, contentVersion: string) {
    this.versions.set(p.storyId, contentVersion);
    this.revisions.set(p.storyId, (this.revisions.get(p.storyId) ?? 0) + 1);
    this.pending.add(p.storyId);
    try {
      this.set({ ...this.map, [p.storyId]: p });
      write(pendingKey(this.userId), [...this.pending]);
    } catch {
      this.listeners.forEach(fn => fn(this.map));
      this.setStatus('error');
      if (this.transport) this.schedule(FLUSH_DELAY_MS);
      return;
    }
    this.retries = 0;
    this.setStatus('pending');
    this.schedule(FLUSH_DELAY_MS);
  }

  /**
   * Bring in progress made elsewhere (a guest's reading before sign-in): merged by the usual rule, so progress never
   * goes backwards, then queued for the server like any other change. Returns how many stories changed.
   */
  importFrom(entries: Map_): number {
    let changed = 0;
    for (const [id, incoming] of Object.entries(entries)) {
      if (!/^S(0[1-9]|10)-Q[1-6]$/.test(id) || !incoming || incoming.storyId !== id) continue;
      const merged = mergeAll(this.map[id] ? { [id]: this.map[id] } : {}, { [id]: incoming })[id];
      if (!merged || JSON.stringify(merged) === JSON.stringify(this.map[id])) continue;
      this.save(merged, '');
      changed++;
    }
    return changed;
  }

  flush(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.flushing) return this.flushing;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.flushing = this.flushPending().finally(() => { this.flushing = null; });
    return this.flushing;
  }

  private async flushPending(): Promise<void> {
    if (!this.transport) {
      this.pending.clear();
      write(pendingKey(this.userId), []);
      this.setStatus('idle');
      return;
    }
    if (this.pending.size === 0) return;
    this.setStatus('saving');
    if (!this.synced) await this.pull();
    if (this.disposed) return;
    if (!this.synced) { this.failed(); return; }
    for (const id of [...this.pending]) {
      if (this.disposed) return;
      const p = this.map[id];
      const revision = this.revisions.get(id);
      if (!p) { this.pending.delete(id); continue; }
      const row: Partial<StoryProgressRow> & { user_id: string; story_id: string } = { user_id: this.userId, ...toRow(p, this.versions.get(id) ?? null) };
      if (!row.completed_at) delete row.completed_at;
      if (!row.content_version) delete row.content_version;
      try {
        const saved = await this.transport.save(row);
        if (this.disposed) return;
        if (!saved) { this.failed(); return; }      // kept pending; tried again later
        this.lastSuccess = new Date().toISOString();
        if (this.revisions.get(id) === revision) this.pending.delete(id);
        else {
          // A debounce timer may already have fired while this request was pending.
          this.schedule(FLUSH_DELAY_MS);
        }
        write(pendingKey(this.userId), [...this.pending]);
      } catch { if (!this.disposed) this.failed(); return; }
    }
    this.retries = 0;
    this.setStatus(this.pending.size ? 'pending' : 'idle');
  }

  private set(m: Map_) {
    this.map = m;
    write(key(this.userId), m);
    this.listeners.forEach(fn => fn(m));
  }
}
