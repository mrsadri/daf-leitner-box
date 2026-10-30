import type { User } from '@supabase/supabase-js';
import { requireSupabase } from '../lib/supabase';
import { AppSettings, LeitnerCard, ReviewEvent, UserProfile } from '../types/leitner';
import { leitnerEngine, LEGACY_CARDS_KEY, LEGACY_SETTINGS_KEY } from './leitnerEngine';
import { isDemoMode, buildDemoCards } from '../lib/demo';

/**
 * Cloud persistence for the signed-in user (Supabase is the source of truth).
 *
 * Writes go through a queue that is debounced, retried with backoff and persisted
 * in localStorage, so answers given offline or during a network error are not lost.
 */

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
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

function cardToRow(card: LeitnerCard, userId: string): CardRow {
  const {
    id, type, box, nextReviewDate, lastReviewedAt, reviewCount, correctCount, wrongCount, createdAt,
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
    createdAt: row.created_at
  };
}

interface PersistedQueue {
  upserts: Record<string, LeitnerCard>;
  deletes: string[];
  events: ReviewEvent[];
  settings: AppSettings | null;
}

class CloudSync {
  private userId: string | null = null;
  private upserts = new Map<string, LeitnerCard>();
  private deletes = new Set<string>();
  private events: ReviewEvent[] = [];
  private settings: AppSettings | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing: Promise<void> | null = null;
  private retryDelay = 2000;
  private status: SyncStatus = 'idle';
  private listeners = new Set<(s: SyncStatus) => void>();

  constructor() {
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
    return this.upserts.size > 0 || this.deletes.size > 0 || this.events.length > 0 || this.settings !== null;
  }

  private saveQueue() {
    if (!this.userId) return;
    try {
      if (!this.hasPending()) {
        localStorage.removeItem(queueKey(this.userId));
        return;
      }
      const q: PersistedQueue = {
        upserts: Object.fromEntries(this.upserts),
        deletes: [...this.deletes],
        events: this.events,
        settings: this.settings
      };
      localStorage.setItem(queueKey(this.userId), JSON.stringify(q));
    } catch {
      // storage full / unavailable: the in-memory queue still works
    }
  }

  private loadQueue(userId: string): PersistedQueue | null {
    try {
      const raw = localStorage.getItem(queueKey(userId));
      return raw ? (JSON.parse(raw) as PersistedQueue) : null;
    } catch {
      return null;
    }
  }

  private schedule(delay = FLUSH_DELAY_MS) {
    if (!this.userId) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.flush(); }, delay);
  }

  public queueUpserts(cards: LeitnerCard[]) {
    cards.forEach(c => {
      this.upserts.set(c.id, c);
      this.deletes.delete(c.id);
    });
    this.saveQueue();
    this.schedule();
  }

  public queueDeletes(ids: string[]) {
    ids.forEach(id => {
      this.deletes.add(id);
      this.upserts.delete(id);
    });
    this.saveQueue();
    this.schedule();
  }

  public queueEvent(e: ReviewEvent) {
    this.events.push(e);
    this.saveQueue();
    this.schedule();
  }

  public queueSettings(s: AppSettings) {
    this.settings = s;
    this.saveQueue();
    this.schedule();
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
    this.flushing = (async () => {
      const db = requireSupabase();
      this.setStatus('syncing');
      try {
        if (this.deletes.size) {
          const ids = [...this.deletes];
          const { error } = await db.from('cards').delete().eq('user_id', userId).in('id', ids);
          if (error) throw error;
          ids.forEach(id => this.deletes.delete(id));
          this.saveQueue();
        }

        if (this.upserts.size) {
          const batch = [...this.upserts.values()];
          for (let i = 0; i < batch.length; i += UPSERT_CHUNK) {
            const chunk = batch.slice(i, i + UPSERT_CHUNK);
            const { error } = await db.from('cards').upsert(chunk.map(c => cardToRow(c, userId)));
            if (error) throw error;
            // Only drop entries that weren't changed again while the request was in flight
            chunk.forEach(c => {
              if (this.upserts.get(c.id) === c) this.upserts.delete(c.id);
            });
            this.saveQueue();
          }
        }

        if (this.events.length) {
          const batch = this.events.slice();
          const { error } = await db.from('review_events').insert(batch.map(e => ({
            user_id: userId,
            card_id: e.cardId,
            card_type: e.cardType,
            correct: e.correct,
            from_box: e.fromBox,
            to_box: e.toBox,
            review_day: e.reviewDay
          })));
          if (error) {
            // A stale offline event (review_day out of range) is rejected forever; drop it instead of retrying.
            if (/out of range/i.test(error.message)) this.events.splice(0, batch.length);
            else throw error;
          } else {
            this.events.splice(0, batch.length);
          }
          this.saveQueue();
        }

        if (this.settings) {
          const s = this.settings;
          const { error } = await db.from('profiles')
            .update({ settings: s, updated_at: new Date().toISOString() })
            .eq('id', userId);
          if (error) throw error;
          if (this.settings === s) this.settings = null;
          this.saveQueue();
        }

        this.retryDelay = 2000;
        this.setStatus('idle');
      } catch (err) {
        console.error('Sync failed', err);
        this.setStatus(navigator.onLine ? 'error' : 'offline');
        this.schedule(this.retryDelay);
        this.retryDelay = Math.min(this.retryDelay * 2, 60000);
      } finally {
        this.flushing = null;
      }
      // Something changed while we were flushing
      if (this.hasPending() && this.status === 'idle') this.schedule();
    })();
    return this.flushing;
  }

  /**
   * Load the user's profile and cards, wire the engine to the sync queue,
   * migrate pre-login local progress and seed brand-new accounts.
   */
  public async start(user: User): Promise<{ profile: UserProfile; offline: boolean }> {
    if (isDemoMode) return this.startDemo(user);
    const db = requireSupabase();
    this.userId = user.id;
    const meta = user.user_metadata || {};
    await leitnerEngine.loadCatalog();

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

    try {
      let { data: prof, error: profErr } = await db.from('profiles').select('*').eq('id', user.id).maybeSingle();
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
      settings = prof.settings && Object.keys(prof.settings).length ? prof.settings : null;

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
    } catch (err) {
      console.error('Could not load cloud data, falling back to local cache', err);
      const cached = leitnerEngine.readCache(user.id);
      cards = cached?.cards || [];
      settings = cached?.settings || null;
      offline = true;
      profile.onboarded = true; // don't seed or migrate on top of data we couldn't read
    }

    // Re-apply writes that never reached the server (e.g. made offline last time)
    const pending = this.loadQueue(user.id);
    if (pending) {
      const byId = new Map(cards.map(c => [c.id, c]));
      (pending.deletes || []).forEach(id => byId.delete(id));
      Object.values(pending.upserts || {}).forEach(c => byId.set(c.id, c));
      cards = [...byId.values()];
      if (pending.settings) settings = pending.settings;
      Object.values(pending.upserts || {}).forEach(c => this.upserts.set(c.id, c));
      (pending.deletes || []).forEach(id => this.deletes.add(id));
      this.events = pending.events || [];
      this.settings = pending.settings || null;
    }

    leitnerEngine.hydrate(user.id, cards, settings);
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
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.displayName !== undefined) row.display_name = patch.displayName;
    if (patch.showOnLeaderboard !== undefined) row.show_on_leaderboard = patch.showOnLeaderboard;
    if (patch.onboarded !== undefined) row.onboarded = patch.onboarded;
    const { error } = await requireSupabase().from('profiles').update(row).eq('id', this.userId);
    if (error) throw error;
  }

  /** Flush pending writes, then detach from the user (call before signing out). */
  public async stop() {
    try {
      await this.flush();
    } catch {
      // the queue stays in localStorage and is replayed on next sign-in
    }
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.userId = null;
    this.upserts.clear();
    this.deletes.clear();
    this.events = [];
    this.settings = null;
    this.setStatus('idle');
    leitnerEngine.reset();
  }
}

export const cloudSync = new CloudSync();

export interface LeaderboardRow {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  score: number;
  score_7d: number;
  mastered: number;
  learning: number;
  reviews_7d: number;
  streak: number;
  /** Silver cards collected (missing until the database part is installed) */
  silver?: number;
  rank: number;
  is_me: boolean;
}

export async function fetchLeaderboard(period: 'all' | 'week', limit = 100): Promise<LeaderboardRow[]> {
  if (isDemoMode) return DEMO_LEADERBOARD;
  const { data, error } = await requireSupabase().rpc('get_leaderboard', { p_period: period, p_limit: limit });
  if (error) throw error;
  return (data || []).map((r: Record<string, unknown>) => ({
    ...r,
    score: Number(r.score),
    score_7d: Number(r.score_7d),
    mastered: Number(r.mastered),
    learning: Number(r.learning),
    reviews_7d: Number(r.reviews_7d),
    streak: Number(r.streak),
    silver: r.silver === undefined || r.silver === null ? undefined : Number(r.silver),
    rank: Number(r.rank)
  })) as LeaderboardRow[];
}

/** Record that the user is using the app. Resolves to true if the account has been suspended. */
export async function touchPresence(): Promise<boolean> {
  if (isDemoMode) return false;
  const { data, error } = await requireSupabase().rpc('touch_presence');
  if (error) throw error;
  return data === true;
}

export interface AdminUserRow {
  user_id: string;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
  first_seen: string;
  last_seen: string | null;
  suspended_at: string | null;
  cards: number;
  reviews: number;
}

export async function adminListUsers(): Promise<AdminUserRow[]> {
  if (isDemoMode) return DEMO_ADMIN_USERS;
  const { data, error } = await requireSupabase().rpc('admin_list_users');
  if (error) throw error;
  return (data || []).map((r: Record<string, unknown>) => ({
    ...r,
    cards: Number(r.cards),
    reviews: Number(r.reviews)
  })) as AdminUserRow[];
}

export async function adminSetSuspended(userId: string, suspended: boolean) {
  const { error } = await requireSupabase().rpc('admin_set_suspended', { p_user: userId, p_suspended: suspended });
  if (error) throw error;
}

export async function adminDeleteUser(userId: string) {
  const { error } = await requireSupabase().rpc('admin_delete_user', { p_user: userId });
  if (error) throw error;
}

const DEMO_LEADERBOARD: LeaderboardRow[] = [
  { user_id: 'u1', display_name: 'Sara', avatar_url: null, score: 1840, score_7d: 210, mastered: 120, learning: 380, reviews_7d: 260, streak: 21, silver: 12, rank: 1, is_me: false },
  { user_id: 'demo-user', display_name: 'Demo', avatar_url: null, score: 960, score_7d: 85, mastered: 40, learning: 150, reviews_7d: 90, streak: 6, silver: 3, rank: 2, is_me: true },
  { user_id: 'u3', display_name: 'Alexander Müller-Lüdenscheidt', avatar_url: null, score: 410, score_7d: -12, mastered: 9, learning: 60, reviews_7d: 14, streak: 0, silver: 0, rank: 3, is_me: false }
];

const DEMO_ADMIN_USERS: AdminUserRow[] = [
  { user_id: 'demo-user', email: 'demo@example.com', display_name: 'Demo', avatar_url: null, first_seen: '2026-10-01T09:00:00Z', last_seen: new Date().toISOString(), suspended_at: null, cards: 150, reviews: 900 },
  { user_id: 'u3', email: 'a.very.long.email.address@example.com', display_name: 'Alexander Müller-Lüdenscheidt', avatar_url: null, first_seen: '2026-10-10T09:00:00Z', last_seen: '2026-10-20T18:30:00Z', suspended_at: '2026-10-21T08:00:00Z', cards: 60, reviews: 14 }
];
