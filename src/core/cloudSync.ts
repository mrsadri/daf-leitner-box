/**
 * Cloud persistence for the signed-in user (Supabase is the source of truth).
 *
 * Writes go through a queue that is debounced, retried with backoff and persisted
 * in localStorage, so answers given offline or during a network error are not lost.
 */
import type { Database, Json } from './database.types';
import { validatePersistedQueue } from './queueValidation';
import { validSettings } from './settingsValidation';
import type { User } from '@supabase/supabase-js';
import { requireSupabase } from '../shared/lib/supabase';
import { AppSettings, LeitnerCard, ReviewEvent, UserProfile } from './types';
import { leitnerEngine, isRemovedSharedCopy, LEGACY_CARDS_KEY, LEGACY_SETTINGS_KEY, DEFAULT_SETTINGS } from './leitnerEngine';
import { isDemoMode, buildDemoCards } from '../shared/lib/demo';


export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

const PAGE_SIZE = 1000;
const UPSERT_CHUNK = 500;
const FLUSH_DELAY_MS = 800;
const queueKey = (userId: string) => `daf_sync_queue_${userId}`;

interface CardRow {
  user_id: string;
  id: string;
  type: LeitnerCard['type'];
  box: number;
  next_review_date: string;
  last_reviewed_at: string | null;
  review_count: number;
  correct_count: number;
  wrong_count: number;
  data: Record<string, Json | undefined>;
  created_at: string;
  updated_at: string;
}

function cardToRow(card: LeitnerCard, userId: string): CardRow {
  const {
    id, type, box, nextReviewDate, lastReviewedAt, reviewCount, correctCount, wrongCount, createdAt, syncStamp: _syncStamp,
    ...data
  } = card;
  return {
    user_id: userId,
    id,
    type,
    box,
    next_review_date: nextReviewDate,
    last_reviewed_at: lastReviewedAt,
    review_count: reviewCount || 0,
    correct_count: correctCount || 0,
    wrong_count: wrongCount || 0,
    data,
    created_at: createdAt,
    updated_at: new Date().toISOString()
  };
}

function rowToCard(row: CardRow): LeitnerCard {
  return {
    ...(row.data as Partial<LeitnerCard>),
    id: row.id,
    type: row.type,
    box: row.box,
    nextReviewDate: row.next_review_date,
    lastReviewedAt: row.last_reviewed_at,
    reviewCount: row.review_count,
    correctCount: row.correct_count,
    wrongCount: row.wrong_count,
    createdAt: row.created_at,
    syncStamp: row.updated_at
  };
}

interface SyncBatch {
  operation: string; revision: number; upserts: CardRow[]; deletes: string[]; events: ReviewEvent[];
  settings: Partial<AppSettings> | null; versions: Record<string, number>; settingsVersion: number;
}
interface PersistedQueue {
  protocol?: 2;
  bases?: Record<string, string | null>;
  versions?: Record<string, number>;
  settingsBase?: Partial<AppSettings>;
  settingsVersion?: number;
  inflight?: SyncBatch | null;
  upserts: Record<string, LeitnerCard>;
  deletes: string[];
  events: ReviewEvent[];
  settings: Partial<AppSettings> | null;
}

export class CloudSync {
  private generation = 0;
  private revision = 0;
  private serverStamps = new Map<string, string>();
  private bases: Record<string, string | null> = Object.create(null);
  private versions = new Map<string, number>();
  private serial = 0;
  private settingsVersion = 0;
  private settingsBase: Partial<AppSettings> = {};
  private knownSettings: Partial<AppSettings> = {};
  private inflight: SyncBatch | null = null;

  /** Synchronous unmount barrier: pending writes already have their per-user durable copy. */
  public detach() {
    this.generation++;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.flushing = null;
    this.userId = null;
    this.lastSuccess = null; this.lastErrorCode = null; this.storageError = false;
    this.upserts.clear(); this.deletes.clear(); this.events = []; this.settings = null;
    this.serverStamps.clear(); this.bases = Object.create(null); this.versions.clear();
    this.serial = 0; this.revision = 0; this.settingsVersion = 0;
    this.settingsBase = {}; this.knownSettings = {}; this.inflight = null;
    leitnerEngine.reset();
    this.retryDelay = 2000;
    this.setStatus('idle');
  }

  private userId: string | null = null;
  private upserts = new Map<string, LeitnerCard>();
  private deletes = new Set<string>();
  private events: ReviewEvent[] = [];
  private settings: Partial<AppSettings> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing: Promise<void> | null = null;
  private retryDelay = 2000;
  private lastSuccess: string | null = null;
  private lastErrorCode: string | null = null;
  private storageError = false;
  public getSyncInfo() {
    let rejected = 0, conflicts = 0;
    try { rejected = JSON.parse(localStorage.getItem(`daf_rejected_reviews_${this.userId}`) || '[]').length; } catch { /* unavailable */ }
    try { conflicts = JSON.parse(localStorage.getItem(`daf_sync_conflicts_${this.userId}`) || '[]').length; } catch { /* unavailable */ }
    return { storageError:this.storageError, errorCode:this.lastErrorCode, conflicts, pending: this.upserts.size + this.deletes.size + this.events.length + (this.settings ? 1 : 0), lastSuccess: this.lastSuccess, rejected };
  }

  private status: SyncStatus = 'idle';
  private listeners = new Set<(s: SyncStatus) => void>();

  constructor(private readonly getDb = requireSupabase) {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.schedule(0));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') void this.flush();
      });
    }
  }

  public onStatus(fn: (s: SyncStatus) => void) {
    this.listeners.add(fn);
    fn(this.status);
    return () => { this.listeners.delete(fn); };
  }

  private setStatus(s: SyncStatus) {
    if (s === this.status) return;
    this.status = s;
    this.listeners.forEach(fn => fn(s));
  }

  private hasPending() {
    return this.inflight !== null || this.upserts.size > 0 || this.deletes.size > 0 || this.events.length > 0 || this.settings !== null;
  }

  private saveQueue(strict = false) {
    if (!this.userId) return;
    try {
      if (!this.hasPending()) {
        localStorage.removeItem(queueKey(this.userId));
        this.storageError = false;
        return;
      }
      const q: PersistedQueue = {
        protocol: 2, bases: this.bases, versions: Object.fromEntries(this.versions),
        settingsBase: this.settingsBase, settingsVersion: this.settingsVersion, inflight: this.inflight,
        upserts: Object.fromEntries(this.upserts),
        deletes: [...this.deletes],
        events: this.events,
        settings: this.settings
      };
      localStorage.setItem(queueKey(this.userId), JSON.stringify(q));
      this.storageError = false;
      this.listeners.forEach(fn => fn(this.status));
    } catch (error) {
      this.storageError = true;
      this.setStatus('error');
      this.listeners.forEach(fn => fn(this.status));
      if (strict) throw error;
      // In-memory work remains available; the UI explicitly warns that reload is unsafe.
    }
  }

  private loadQueue(userId: string): PersistedQueue | null {
    const raw = localStorage.getItem(queueKey(userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    validatePersistedQueue(parsed);
    const q = parsed as PersistedQueue;
    q.upserts = Object.fromEntries(Object.entries(q.upserts).filter(([id]) => !isRemovedSharedCopy({ id })));
    return q;
  }

  private schedule(delay = FLUSH_DELAY_MS) {
    if (!this.userId) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.flush(); }, delay);
  }

  public queueUpserts(cards: LeitnerCard[]) {
    cards.filter(c => !isRemovedSharedCopy(c)).forEach(c => {
      if (!Object.hasOwn(this.bases, c.id)) this.bases[c.id] = this.serverStamps.get(c.id) ?? null;
      this.versions.set(c.id, ++this.serial);
      this.upserts.set(c.id, c);
      this.deletes.delete(c.id);
    });
    this.saveQueue();
    this.schedule();
  }

  public queueDeletes(ids: string[]) {
    ids.forEach(id => {
      if (!Object.hasOwn(this.bases, id)) this.bases[id] = this.serverStamps.get(id) ?? null;
      this.versions.set(id, ++this.serial);
      this.deletes.add(id);
      this.upserts.delete(id);
    });
    this.saveQueue();
    this.schedule();
  }

  public queueEvent(e: ReviewEvent) {
    this.events.push({ ...e, operationId: e.operationId ?? crypto.randomUUID() });
    this.saveQueue();
    this.schedule();
  }

  public queueSettings(s: AppSettings) {
    const patch = Object.fromEntries(Object.entries(s).filter(([key, value]) => value !== this.knownSettings[key as keyof AppSettings]));
    for (const key of Object.keys(patch) as (keyof AppSettings)[]) {
      if (!Object.hasOwn(this.settingsBase, key)) Object.assign(this.settingsBase, { [key]: this.knownSettings[key] });
    }
    this.settings = { ...this.settings, ...patch };
    this.knownSettings = { ...s };
    this.settingsVersion = ++this.serial;
    this.saveQueue(); this.schedule();
  }

  private async snapshot(userId: string) {
    const db = this.getDb();
    for (let attempt = 0; attempt < 3; attempt++) {
      const before = await db.rpc('get_sync_revision');
      if (before.error) throw before.error;
      const prof = await db.from('profiles').select('*').eq('id', userId).single();
      if (prof.error) throw prof.error;
      const cards: LeitnerCard[] = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const page = await db.from('cards').select('*').eq('user_id', userId).order('id').range(from, from + PAGE_SIZE - 1);
        if (page.error) throw page.error;
        cards.push(...(page.data as CardRow[]).map(rowToCard));
        if (page.data.length < PAGE_SIZE) break;
      }
      const after = await db.rpc('get_sync_revision');
      if (after.error) throw after.error;
      if (Number(before.data) === Number(after.data)) return { revision: Number(after.data), cards, settings: validSettings(prof.data.settings) };
    }
    throw new Error('Server changed during snapshot; retry');
  }

  private archiveConflict(userId: string, record: unknown) {
    const key = `daf_sync_conflicts_${userId}`;
    const previous = JSON.parse(localStorage.getItem(key) || '[]');
    localStorage.setItem(key, JSON.stringify([...previous, { at: new Date().toISOString(), ...record as object }]));
  }

  private async reconcile(userId: string, active: () => boolean) {
    const remote = await this.snapshot(userId);
    if (!active()) return;
    const byId = new Map(remote.cards.map(card => [card.id, card]));
    const affected = new Set([...this.upserts.keys(), ...this.deletes]);
    for (const id of affected) {
      const stamp = byId.get(id)?.syncStamp ?? null;
      if (this.bases[id] !== stamp) {
        this.archiveConflict(userId, { cardId: id, card: this.upserts.get(id), deleted: this.deletes.has(id),
          events: this.events.filter(e => e.cardId === id), server: byId.get(id) });
        this.upserts.delete(id); this.deletes.delete(id); this.versions.delete(id);
        this.events = this.events.filter(e => e.cardId !== id);
      }
    }
    for (const key of Object.keys(this.settings ?? {}) as (keyof AppSettings)[]) {
      if (({ ...DEFAULT_SETTINGS, ...remote.settings })[key] !== this.settingsBase[key]) {
        this.archiveConflict(userId, { settings: { [key]: this.settings?.[key] }, server: { [key]: remote.settings[key] } });
        delete this.settings?.[key]; delete this.settingsBase[key];
      }
    }
    if (this.settings && !Object.keys(this.settings).length) this.settings = null;
    this.revision = remote.revision;
    this.serverStamps = new Map(remote.cards.filter(c => c.syncStamp).map(c => [c.id, c.syncStamp!]));
    for (const id of affected) if (this.upserts.has(id) || this.deletes.has(id)) this.bases[id] = this.serverStamps.get(id) ?? null;
    this.deletes.forEach(id => byId.delete(id)); this.upserts.forEach(card => byId.set(card.id, card));
    leitnerEngine.hydrate(userId, [...byId.values()], { ...remote.settings, ...this.settings });
    this.inflight = null; this.saveQueue();
  }

  /** Push everything pending to Supabase. Safe to call concurrently. */
  public flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    if (!this.userId || !this.hasPending()) return Promise.resolve();
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const userId = this.userId;
    const generation = this.generation;
    const active = () => generation === this.generation && this.userId === userId;
    // Defer execution until the promise is assigned, even when local persistence throws synchronously.
    this.flushing = Promise.resolve().then(async () => {
      this.setStatus('syncing');
      try {
        const db = this.getDb();
        if (!active()) return;
        for (let attempt = 0; this.hasPending() && attempt < 10; attempt++) {
          if (!active()) return;
          if (!this.inflight) {
            const upserts = [...this.upserts.values()].slice(0, UPSERT_CHUNK);
            const deletes = [...this.deletes].slice(0, UPSERT_CHUNK);
            const ids = new Set([...upserts.map(c => c.id), ...deletes]);
            const events = this.events.filter(e => ids.has(e.cardId) || !this.upserts.has(e.cardId));
            this.inflight = {
              operation: crypto.randomUUID(), revision: this.revision,
              upserts: upserts.map(c => cardToRow(c, userId)), deletes, events,
              settings: this.settings ? { ...this.settings } : null, settingsVersion: this.settingsVersion,
              versions: Object.fromEntries([...ids].map(id => [id, this.versions.get(id) ?? 0])),
            };
          }
          // Reconfirm durability on every retry, including a previously failed local write.
          this.saveQueue(true);
          const batch = this.inflight;
          const result = await db.rpc('apply_sync_batch', {
            p_operation: batch.operation, p_revision: batch.revision, p_expected_user:userId,
            p_upserts: batch.upserts as unknown as Json, p_deletes: batch.deletes,
            p_events: batch.events as unknown as Json, p_settings: batch.settings ? { ...batch.settings } : null,
          });
          if (!active()) return;
          if (result.error) throw result.error;
          const receipt = result.data as { conflict: boolean; revision: number; stamps?: Record<string, string>; personal?: string[] };
          if (!receipt || typeof receipt.conflict !== 'boolean' || !Number.isSafeInteger(receipt.revision)) throw new Error('Invalid sync receipt');
          if (receipt.conflict) { await this.reconcile(userId, active); continue; }
          this.revision = receipt.revision;
          for (const [id, version] of Object.entries(batch.versions)) {
            const stamp = receipt.stamps?.[id];
            if (stamp) this.serverStamps.set(id, stamp); else this.serverStamps.delete(id);
            if (this.versions.get(id) === version) {
              this.upserts.delete(id); this.deletes.delete(id); this.versions.delete(id); delete this.bases[id];
            } else this.bases[id] = stamp ?? null;
          }
          leitnerEngine.acknowledgeSyncStamps(Object.fromEntries(Object.keys(batch.versions).map(id => [id, receipt.stamps?.[id] ?? null])));
          const sent = new Set(batch.events.map(e => e.operationId));
          this.events = this.events.filter(e => !sent.has(e.operationId));
          if (batch.settingsVersion === this.settingsVersion) { this.settings = null; this.settingsBase = {}; }
          else if (batch.settings) {
            for (const key of Object.keys(batch.settings) as (keyof AppSettings)[]) {
              if (this.settings?.[key] === batch.settings[key]) { delete this.settings?.[key]; delete this.settingsBase[key]; }
              else Object.assign(this.settingsBase, { [key]: batch.settings[key] });
            }
            if (this.settings && !Object.keys(this.settings).length) this.settings = null;
          }
          if (receipt.personal?.length) {
            const key = `daf_rejected_reviews_${userId}`;
            const previous = JSON.parse(localStorage.getItem(key) || '[]');
            localStorage.setItem(key, JSON.stringify([...previous, ...batch.events.filter(e => receipt.personal!.includes(e.operationId!))]));
          }
          this.inflight = null; this.saveQueue();
        }
        this.retryDelay = 2000;
        this.lastErrorCode = null;
        this.lastSuccess = new Date().toISOString();
        this.setStatus('idle');
      } catch (err) {
        if (active()) this.lastErrorCode = (err as {code?:string})?.code ?? null;
        if (!active()) return;
        if (this.lastErrorCode === '54000') { this.inflight = null; this.saveQueue(); }
        console.error('Sync failed', err);
        this.setStatus(navigator.onLine ? 'error' : 'offline');
        this.schedule(this.retryDelay);
        this.retryDelay = Math.min(this.retryDelay * 2, 60000);
      } finally {
        if (active()) this.flushing = null;
      }
      // Something changed while we were flushing
      if (active() && this.hasPending() && this.status === 'idle') this.schedule();
    });
    return this.flushing;
  }

  /**
   * Load the user's profile and cards, wire the engine to the sync queue,
   * migrate pre-login local progress and seed brand-new accounts.
   */
  public async start(user: User): Promise<{ profile: UserProfile; offline: boolean }> {
    if (isDemoMode) return this.startDemo(user);
    this.detach();
    const generation = this.generation;
    if (generation !== this.generation) throw new Error('Session changed');
    const db = this.getDb();
    this.userId = user.id;
    const meta = user.user_metadata || {};
    await leitnerEngine.loadCatalog();
    if (generation !== this.generation) throw new Error('Session changed');

    let profile: UserProfile = {
      id: user.id,
      displayName: meta.full_name || meta.name || (user.email || '').split('@')[0] || 'کاربر',
      avatarUrl: meta.avatar_url || null,
      email: user.email || null,
      showOnLeaderboard: true,
      onboarded: false,
      isAdmin: false,
      suspended: false
    };

    let cards: LeitnerCard[];
    let settings: Partial<AppSettings> | null = null;
    let offline = false;

    let loadedRevision = 0;
    try {
      const before = await db.rpc('get_sync_revision');
      if (before.error) throw before.error;
      let { data: prof, error: profErr } = await db.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (generation !== this.generation) throw new Error('Session changed');
      if (profErr) throw profErr;
      if (!prof) {
        // The auth trigger normally creates it; this covers projects where it wasn't installed.
        const inserted = await db.from('profiles')
          .insert({ id: user.id, display_name: profile.displayName.slice(0, 40), avatar_url: profile.avatarUrl })
          .select('*')
          .single();
        if (inserted.error) throw inserted.error;
        prof = inserted.data;
      }
      profile = {
        ...profile,
        displayName: prof.display_name,
        avatarUrl: prof.avatar_url ?? profile.avatarUrl,
        showOnLeaderboard: prof.show_on_leaderboard,
        onboarded: prof.onboarded,
        suspended: Boolean(prof.suspended_at)
      };
      if (profile.suspended) {
        // A suspended account can't read or write its cards; don't wire up sync at all.
        this.userId = null;
        return { profile, offline: false };
      }
      // Fails (→ false) until the admin functions in supabase/schema.sql are installed
      const { data: isAdmin } = await db.rpc('is_admin');
      profile.isAdmin = isAdmin === true;
      settings = validSettings(prof.settings);

      cards = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await db.from('cards')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        cards.push(...(data as CardRow[]).map(rowToCard));
        if (!data || data.length < PAGE_SIZE) break;
      }
      const after = await db.rpc('get_sync_revision');
      if (after.error) throw after.error;
      if (Number(before.data) !== Number(after.data)) {
        const consistent = await this.snapshot(user.id);
        cards = consistent.cards; settings = consistent.settings; loadedRevision = consistent.revision;
      } else loadedRevision = Number(after.data);
    } catch (err) {
      if (generation !== this.generation) throw new Error('Session changed', { cause: err });
      console.error('Could not load cloud data, falling back to local cache', err);
      const cached = leitnerEngine.readCache(user.id);
      cards = cached?.cards || [];
      settings = cached?.settings || null;
      offline = true;
      profile.onboarded = true; // don't seed or migrate on top of data we couldn't read
    }

    if (generation !== this.generation) throw new Error('Session changed');
    this.revision = loadedRevision;
    this.serverStamps = new Map(cards.filter(c => c.syncStamp).map(c => [c.id, c.syncStamp!]));
    // Re-apply writes that never reached the server (e.g. made offline last time)
    const pending = this.loadQueue(user.id);
    if (pending) {
      this.bases = pending.bases ?? Object.fromEntries(Object.keys(pending.upserts ?? {}).map(id => [id, null]));
      this.versions = new Map(Object.entries(pending.versions ?? Object.fromEntries([...Object.keys(pending.upserts ?? {}), ...(pending.deletes ?? [])].map((id,i) => [id, i + 1]))));
      this.serial = Math.max(0, ...this.versions.values(), pending.settingsVersion ?? 0);
      this.settingsVersion = pending.settingsVersion ?? 0; this.settingsBase = pending.settingsBase ?? {};
      this.inflight = pending.inflight ?? null;
      const byId = new Map(cards.map(c => [c.id, c]));
      (pending.deletes || []).forEach(id => byId.delete(id));
      Object.values(pending.upserts || {}).forEach(c => byId.set(c.id, c));
      cards = [...byId.values()];
      if (pending.settings) settings = pending.settings;
      Object.values(pending.upserts || {}).forEach(c => this.upserts.set(c.id, c));
      (pending.deletes || []).forEach(id => this.deletes.add(id));
      this.events = (pending.events || []).map(event => ({ ...event, operationId: event.operationId ?? crypto.randomUUID() }));
      this.settings = pending.settings || null;
    }

    leitnerEngine.hydrate(user.id, cards, settings);
    if (pending && !offline && !this.inflight) {
      await this.reconcile(user.id, () => generation === this.generation);
      if (generation !== this.generation) throw new Error('Session changed');
    }
    this.knownSettings = { ...leitnerEngine.getSettings() };
    leitnerEngine.setHooks({
      onCardsUpserted: c => this.queueUpserts(c),
      onCardsDeleted: ids => this.queueDeletes(ids),
      onSettingsChanged: s => this.queueSettings(s),
      onReview: e => this.queueEvent(e)
    });

    if (!profile.onboarded) {
      if (cards.length === 0) this.migrateLegacyLocalData();
      if (leitnerEngine.getCards().length === 0) leitnerEngine.seedFirstWords();
      profile.onboarded = true;
      this.updateProfile({ onboarded: true }).catch(err => console.error('Could not mark profile onboarded', err));
    }

    this.saveQueue(); // Persist assigned IDs before the first request; reloads must reuse them.
    this.schedule(0);
    return { profile, offline };
  }

  /** Demo mode: everything stays in this browser's localStorage; no hooks, so nothing is ever queued for the server. */
  private async startDemo(user: User): Promise<{ profile: UserProfile; offline: boolean }> {
    const catalog = await leitnerEngine.loadCatalog();
    const cached = leitnerEngine.readCache(user.id);
    leitnerEngine.hydrate(user.id, cached?.cards.length ? cached.cards : buildDemoCards(catalog), cached?.settings || null);
    leitnerEngine.setHooks(null);
    const profile: UserProfile = {
      id: user.id, displayName: 'Demo', avatarUrl: null, email: user.email || null,
      showOnLeaderboard: true, onboarded: true, isAdmin: true, suspended: false
    };
    return { profile, offline: false };
  }

  /** Progress saved before Google sign-in existed lives under un-namespaced keys; move it into the first account that signs in on this browser. */
  private migrateLegacyLocalData() {
    try {
      const raw = localStorage.getItem(LEGACY_CARDS_KEY);
      if (!raw) return;
      const legacySettings = localStorage.getItem(LEGACY_SETTINGS_KEY);
      const result = leitnerEngine.importData(JSON.stringify({
        cards: JSON.parse(raw),
        settings: legacySettings ? JSON.parse(legacySettings) : undefined
      }));
      if (result.ok) {
        // Keep a copy instead of deleting, but make sure a second account doesn't import it again.
        localStorage.setItem(`${LEGACY_CARDS_KEY}_migrated`, raw);
        localStorage.removeItem(LEGACY_CARDS_KEY);
        localStorage.removeItem(LEGACY_SETTINGS_KEY);
      }
    } catch (e) {
      console.error('Legacy migration failed', e);
    }
  }

  public async updateProfile(patch: Partial<Pick<UserProfile, 'displayName' | 'showOnLeaderboard' | 'onboarded'>>) {
    if (!this.userId) return;
    const row: Database['public']['Tables']['profiles']['Update'] = { updated_at: new Date().toISOString() };
    if (patch.displayName !== undefined) row.display_name = patch.displayName;
    if (patch.showOnLeaderboard !== undefined) row.show_on_leaderboard = patch.showOnLeaderboard;
    if (patch.onboarded !== undefined) row.onboarded = patch.onboarded;
    const { error } = await this.getDb().from('profiles').update(row).eq('id', this.userId);
    if (error) throw error;
  }

  /** Flush pending writes, then detach from the user (call before signing out). */
  public async stop() {
    const generation = this.generation;
    try {
      await this.flush();
    } catch {
      // Durable work stays scoped to its account for the next sign-in.
    }
    if (generation !== this.generation) return;
    this.detach();
  }

}

export const cloudSync = new CloudSync();

export { fetchLeaderboard, touchPresence, adminListUsers, adminSetSuspended, adminDeleteUser } from './cloudApi';
export type { LeaderboardRow, AdminUserRow } from './cloudApi';
