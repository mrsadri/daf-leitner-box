/**
 * The queue behind dictation progress sync (docs/dictation/09-data-model.md, "Client persistence"). Everything the
 * environment provides (storage, transport, timers, clock) is injected, so it is unit-tested with node --test.
 * `src/services/dictationSync.ts` wires it to Supabase, localStorage and the browser events.
 *
 * Design, like cloudSync: an in-memory map of dirty rows, persisted so a closed tab loses nothing, flushed after a
 * debounce, retried with backoff from 2 s to 60 s. The client sends ABSOLUTE totals; the server merges with greatest(),
 * so a retry is idempotent. If the migration is missing the queue stops retrying and keeps everything local.
 */
import { mergeAll, mergeSentence, type SentenceProgress } from './progressMerge.ts';

export interface StorySummary {
  storyId: string;
  finishedCount: number;
  totalCount: number;
  lastSentenceId: string | null;
  contentVersion: string | null;
}

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline' | 'unavailable';

export interface Transport {
  save(story: StorySummary | null, rows: SentenceProgress[]): Promise<void>;
  load(storyIds: string[]): Promise<{ rows: SentenceProgress[]; stories: StorySummary[] }>;
}

export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface Timers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

/** Thrown by a transport when the dictation tables or function do not exist yet (migration not applied). */
export class MigrationMissingError extends Error {
  constructor() { super('dictation migration missing'); this.name = 'MigrationMissingError'; }
}

export const FLUSH_DELAY_MS = 800;
export const BATCH_SIZE = 500;
export const RETRY_START_MS = 2000;
export const RETRY_MAX_MS = 60000;
export const rowsKey = (uid: string) => `daf_dictation_rows_${uid}`;
export const queueKey = (uid: string) => `daf_dictation_queue_${uid}`;
export const draftKey = (uid: string, sentenceId: string) => `daf_dictation_draft_${uid}_${sentenceId}`;

// ---------- row mapping (camelCase in the app, snake_case in the database) -----------------------------------------

export function toRpcRow(r: SentenceProgress) {
  return {
    story_id: r.storyId, sentence_id: r.sentenceId, sentence_order: r.sentenceOrder, status: r.status,
    attempts: r.attempts, mistakes: r.mistakes, skips: r.skips, listens: r.listens, leitner_actions: r.leitnerActions,
    content_hash: r.contentHash, first_correct_at: r.firstCorrectAt, last_attempt_at: r.lastAttemptAt,
  };
}

export function fromDbRow(r: Record<string, unknown>): SentenceProgress {
  return {
    storyId: String(r.story_id), sentenceId: String(r.sentence_id), sentenceOrder: Number(r.sentence_order ?? 0),
    status: r.status as SentenceProgress['status'], attempts: Number(r.attempts ?? 0), mistakes: Number(r.mistakes ?? 0),
    skips: Number(r.skips ?? 0), listens: Number(r.listens ?? 0), leitnerActions: Number(r.leitner_actions ?? 0),
    contentHash: (r.content_hash as string | null) ?? null, firstCorrectAt: (r.first_correct_at as string | null) ?? null,
    lastAttemptAt: (r.last_attempt_at as string | null) ?? null,
  };
}

export function toRpcStory(s: StorySummary) {
  return { story_id: s.storyId, finished_count: s.finishedCount, total_count: s.totalCount,
    last_sentence_id: s.lastSentenceId, content_version: s.contentVersion };
}

export function fromDbStory(r: Record<string, unknown>): StorySummary {
  return { storyId: String(r.story_id), finishedCount: Number(r.finished_count ?? 0), totalCount: Number(r.total_count ?? 0),
    lastSentenceId: (r.last_sentence_id as string | null) ?? null, contentVersion: (r.content_version as string | null) ?? null };
}

// ---------- the queue ----------------------------------------------------------------------------------------------

interface Persisted { dirty: string[]; stories: Record<string, StorySummary> }

export class DictationQueue {
  private rows = new Map<string, SentenceProgress>();
  private dirty = new Set<string>();
  private stories = new Map<string, StorySummary>();
  private timer: unknown = null;
  private flushing: Promise<void> | null = null;
  private retryDelay = RETRY_START_MS;
  private status: SyncStatus = 'idle';
  private listeners = new Set<(s: SyncStatus) => void>();
  private noticeListeners = new Set<() => void>();
  private noticeSent = false;
  private readonly uid: string;
  private readonly storage: Storage;
  private readonly transport: Transport;
  private readonly timers: Timers;

  constructor(uid: string, storage: Storage, transport: Transport, timers: Timers) {
    this.uid = uid;
    this.storage = storage;
    this.transport = transport;
    this.timers = timers;
    this.restore();
  }

  // -- observers
  onStatus(fn: (s: SyncStatus) => void): () => void { this.listeners.add(fn); fn(this.status); return () => { this.listeners.delete(fn); }; }
  /** Called once per session when the migration is missing ("progress is kept on this device"). */
  onUnavailableNotice(fn: () => void): () => void { this.noticeListeners.add(fn); return () => { this.noticeListeners.delete(fn); }; }
  getStatus(): SyncStatus { return this.status; }
  private setStatus(s: SyncStatus) { if (s !== this.status) { this.status = s; this.listeners.forEach(fn => fn(s)); } }

  // -- local state
  getRows(): ReadonlyMap<string, SentenceProgress> { return this.rows; }
  getStory(storyId: string): StorySummary | undefined { return this.stories.get(storyId); }
  pendingCount(): number { return this.dirty.size; }

  private restore(): void {
    try {
      const rows = this.storage.getItem(rowsKey(this.uid));
      if (rows) for (const r of JSON.parse(rows) as SentenceProgress[]) this.rows.set(r.sentenceId, r);
      const q = this.storage.getItem(queueKey(this.uid));
      if (q) {
        const p = JSON.parse(q) as Persisted;
        p.dirty.forEach(id => { if (this.rows.has(id)) this.dirty.add(id); });
        for (const [k, v] of Object.entries(p.stories ?? {})) this.stories.set(k, v);
      }
    } catch { /* corrupt cache: start empty, the server still has the rows */ }
  }

  private persist(): void {
    try {
      this.storage.setItem(rowsKey(this.uid), JSON.stringify([...this.rows.values()]));
      if (this.dirty.size === 0 && this.stories.size === 0) this.storage.removeItem(queueKey(this.uid));
      else this.storage.setItem(queueKey(this.uid), JSON.stringify({ dirty: [...this.dirty], stories: Object.fromEntries(this.stories) } satisfies Persisted));
    } catch { /* storage full or unavailable: the in-memory queue still works */ }
  }

  // -- writes
  /** Merge a row into the local state (same rules as the server) and queue it. Returns the merged row. */
  record(row: SentenceProgress, story?: StorySummary): SentenceProgress {
    const merged = mergeSentence(this.rows.get(row.sentenceId), row);
    this.rows.set(row.sentenceId, merged);
    this.dirty.add(row.sentenceId);
    if (story) this.stories.set(story.storyId, story);
    this.persist();
    this.schedule(FLUSH_DELAY_MS);
    return merged;
  }

  setStory(story: StorySummary): void {
    this.stories.set(story.storyId, story);
    this.persist();
    this.schedule(FLUSH_DELAY_MS);
  }

  /** Merge rows from the server into the local state; local dirty rows are kept and win on conflicts through the merge rules. */
  async load(storyIds: string[]): Promise<ReadonlyMap<string, SentenceProgress>> {
    if (this.status === 'unavailable') return this.rows;
    try {
      const { rows, stories } = await this.transport.load(storyIds);
      this.rows = mergeAll(this.rows, rows);
      for (const s of stories) if (!this.stories.has(s.storyId)) this.stories.set(s.storyId, s);
      this.persist();
    } catch (e) {
      if (e instanceof MigrationMissingError) this.markUnavailable();
      else this.setStatus(this.isOffline() ? 'offline' : 'error');
    }
    return this.rows;
  }

  // -- flushing
  schedule(ms: number): void {
    if (this.status === 'unavailable') return;
    if (this.timer !== null) this.timers.clear(this.timer);
    this.timer = this.timers.set(() => { this.timer = null; void this.flush(); }, ms);
  }

  flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    if (this.status === 'unavailable' || (this.dirty.size === 0 && this.stories.size === 0)) return Promise.resolve();
    this.flushing = this.doFlush().finally(() => { this.flushing = null; });
    return this.flushing;
  }

  private isOffline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine === false;
  }

  private async doFlush(): Promise<void> {
    this.setStatus('syncing');
    try {
      const ids = [...this.dirty];
      const byStory = new Map<string, SentenceProgress[]>();
      for (const id of ids) {
        const r = this.rows.get(id);
        if (r) byStory.set(r.storyId, [...(byStory.get(r.storyId) ?? []), r]);
      }
      for (const storyId of new Set([...byStory.keys(), ...this.stories.keys()])) {
        const rows = byStory.get(storyId) ?? [];
        const summary = this.stories.get(storyId) ?? null;
        for (let i = 0; i < Math.max(1, rows.length); i += BATCH_SIZE) {
          const chunk = rows.slice(i, i + BATCH_SIZE);
          if (chunk.length === 0 && !summary) break;
          await this.transport.save(i === 0 ? summary : null, chunk);
          chunk.forEach(r => this.dirty.delete(r.sentenceId));
          this.persistSoft();
        }
        this.stories.delete(storyId);
      }
      this.persist();
      this.retryDelay = RETRY_START_MS;
      this.setStatus('idle');
      if (this.dirty.size > 0) this.schedule(FLUSH_DELAY_MS);     // rows recorded while this flush was running
    } catch (e) {
      if (e instanceof MigrationMissingError) { this.markUnavailable(); return; }
      this.setStatus(this.isOffline() ? 'offline' : 'error');
      this.persist();
      this.schedule(this.retryDelay);
      this.retryDelay = Math.min(RETRY_MAX_MS, this.retryDelay * 2);
    }
  }

  private persistSoft(): void { this.persist(); }

  private markUnavailable(): void {
    this.setStatus('unavailable');
    if (this.timer !== null) { this.timers.clear(this.timer); this.timer = null; }
    this.persist();
    if (!this.noticeSent) { this.noticeSent = true; this.noticeListeners.forEach(fn => fn()); }
  }

  /** Sign out: forget everything this user left on the device (rows, queue, drafts are removed by the caller's key list). */
  clear(): void {
    if (this.timer !== null) { this.timers.clear(this.timer); this.timer = null; }
    this.rows.clear(); this.dirty.clear(); this.stories.clear();
    try { this.storage.removeItem(rowsKey(this.uid)); this.storage.removeItem(queueKey(this.uid)); } catch { /* ignore */ }
  }
}

// ---------- drafts (a sentence in progress) ------------------------------------------------------------------------

export interface Draft { text: string; hash: string; ts: number }
export const MAX_DRAFTS = 20;

/** Draft text is ignored when the sentence's hash changed since it was written. */
export function readDraft(storage: Storage, uid: string, sentenceId: string, currentHash: string): string | null {
  try {
    const raw = storage.getItem(draftKey(uid, sentenceId));
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    return d.hash === currentHash && typeof d.text === 'string' ? d.text : null;
  } catch { return null; }
}

/** Write a draft and keep at most MAX_DRAFTS: the oldest are removed. `allKeys` is every storage key (to find old drafts). */
export function writeDraft(storage: Storage, uid: string, allKeys: () => string[], sentenceId: string, hash: string, text: string, now: number): void {
  const prefix = `daf_dictation_draft_${uid}_`;
  try {
    if (!text.trim()) { storage.removeItem(draftKey(uid, sentenceId)); return; }
    storage.setItem(draftKey(uid, sentenceId), JSON.stringify({ text, hash, ts: now } satisfies Draft));
    const drafts = allKeys().filter(k => k.startsWith(prefix)).map(k => {
      try { return { k, ts: (JSON.parse(storage.getItem(k) ?? '{}') as Draft).ts ?? 0 }; } catch { return { k, ts: 0 }; }
    }).sort((a, b) => a.ts - b.ts);
    for (const old of drafts.slice(0, Math.max(0, drafts.length - MAX_DRAFTS))) storage.removeItem(old.k);
  } catch { /* storage full: drafts are a convenience */ }
}

export function clearDraft(storage: Storage, uid: string, sentenceId: string): void {
  try { storage.removeItem(draftKey(uid, sentenceId)); } catch { /* ignore */ }
}
