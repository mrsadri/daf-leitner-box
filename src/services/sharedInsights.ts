import { useEffect, useState } from 'react';
import { requireSupabase } from '../lib/supabase';
import { isDemoMode } from '../lib/demo';
import { LeitnerCard, ReflectionCategory } from '../types/leitner';
import { leitnerEngine, getTodayString } from './leitnerEngine';
import { cloudSync } from './cloudSync';
import { ShareQuota, shareQuota, scoreOf, sharedIdOf, copyIdFor, SHARE_TITLE_MAX, SHARE_CONTENT_MAX } from './shareLogic';

/**
 * Public insight cards (see docs/shared-insights-plan.md). Everything goes through the
 * SECURITY DEFINER functions in supabase/migrations/20261101_shared_insights.sql.
 * Errors are thrown as-is; use shareErrorCode() to turn them into a message.
 */

export interface PublicInsight {
  id: string;
  title: string;
  content: string;
  category: ReflectionCategory;
  authorName: string;
  authorAvatar: string | null;
  publishedAt: string;
  adopters: number;
  isMine: boolean;
  iHave: boolean;
  iReported: boolean;
}

export interface Adopter {
  /** null = hidden from the leaderboard ("a user") */
  name: string | null;
  avatar: string | null;
  at: string;
}

export interface MyInsight {
  id: string;
  sourceCardId: string;
  title: string;
  content: string;
  category: ReflectionCategory;
  publishedAt: string;
  unpublishedAt: string | null;
  removedAt: string | null;
  /** Hidden from the public list by reports, waiting for an admin */
  hidden: boolean;
  adopters: Adopter[];
}

export interface AdminInsight {
  id: string;
  title: string;
  content: string;
  category: ReflectionCategory;
  authorName: string;
  authorEmail: string | null;
  publishedAt: string;
  unpublishedAt: string | null;
  hidden: boolean;
  openReports: number;
  reports: { reason: string; at: string; by: string }[];
  adopters: number;
}

export const PAGE_SIZE = 30;
export const isLive = (m: MyInsight) => !m.unpublishedAt && !m.removedAt;

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await requireSupabase().rpc(fn, args);
  if (error) throw error;
  return data as T;
}

const asCategory = (c: string): ReflectionCategory =>
  (['decision', 'motivation', 'habit', 'goal', 'note'] as const).includes(c as ReflectionCategory) ? (c as ReflectionCategory) : 'note';

// ---------------------------------------------------------------------
// Author
// ---------------------------------------------------------------------

export async function fetchQuota(): Promise<ShareQuota> {
  if (isDemoMode) return shareQuota(scoreOf(leitnerEngine.getCards()), demo.mine().length);
  await cloudSync.flush();
  const rows = await rpc<{ score: number; allowed: number; used: number }[]>('share_quota');
  const r = rows?.[0] ?? { score: 0, used: 0 };
  return shareQuota(Number(r.score), Number(r.used));
}

/** Publishes the card as it is stored on the server, so pending edits are sent first. Returns the public id. */
export async function publishInsight(cardId: string): Promise<string> {
  if (isDemoMode) return demo.publish(cardId);
  await cloudSync.flush();
  return rpc<string>('publish_insight', { p_card_id: cardId });
}

export async function unpublishInsight(id: string): Promise<void> {
  if (isDemoMode) return demo.unpublish(id);
  await rpc('unpublish_insight', { p_id: id });
  invalidateAuthors();
}

export async function fetchMyInsights(): Promise<MyInsight[]> {
  if (isDemoMode) return demo.mine();
  const rows = await rpc<Record<string, unknown>[]>('my_insights');
  return (rows || []).map(r => ({
    id: String(r.id),
    sourceCardId: String(r.source_card_id),
    title: String(r.title),
    content: String(r.content ?? ''),
    category: asCategory(String(r.category)),
    publishedAt: String(r.published_at),
    unpublishedAt: (r.unpublished_at as string) || null,
    removedAt: (r.removed_at as string) || null,
    hidden: Boolean(r.hidden),
    adopters: Array.isArray(r.adopters) ? (r.adopters as Adopter[]) : []
  }));
}

// ---------------------------------------------------------------------
// Everyone
// ---------------------------------------------------------------------

/** Newest first; pass the last item's publishedAt for the next page. */
export async function fetchPublicInsights(before?: string): Promise<PublicInsight[]> {
  if (isDemoMode) return demo.list(before);
  const rows = await rpc<Record<string, unknown>[]>('get_public_insights', { p_limit: PAGE_SIZE, p_before: before ?? null });
  return (rows || []).map(r => ({
    id: String(r.id),
    title: String(r.title),
    content: String(r.content ?? ''),
    category: asCategory(String(r.category)),
    authorName: String(r.author_name ?? ''),
    authorAvatar: (r.author_avatar as string) || null,
    publishedAt: String(r.published_at),
    adopters: Number(r.adopters) || 0,
    isMine: Boolean(r.is_mine),
    iHave: Boolean(r.i_have),
    iReported: Boolean(r.i_reported)
  }));
}

/** Adds the public card to Box 0 (due today) and returns the new card. */
export async function adoptInsight(id: string): Promise<LeitnerCard> {
  let card: LeitnerCard;
  if (isDemoMode) {
    card = demo.adopt(id);
  } else {
    // A pending "remove" of an earlier copy must reach the server before adding it again
    await cloudSync.flush();
    const rows = await rpc<{ card_id: string; data: Record<string, unknown>; next_review_date: string; created_at: string }[]>(
      'adopt_insight', { p_id: id, p_today: getTodayString() }
    );
    const r = rows?.[0];
    if (!r) throw new Error('share:not_public');
    card = {
      ...(r.data as Partial<LeitnerCard>),
      id: r.card_id,
      type: 'reflection',
      box: 0,
      nextReviewDate: r.next_review_date,
      lastReviewedAt: null,
      createdAt: r.created_at,
      reviewCount: 0,
      correctCount: 0,
      wrongCount: 0
    };
  }
  leitnerEngine.insertSyncedCard(card);
  return card;
}

export async function reportInsight(id: string, reason: string): Promise<void> {
  if (isDemoMode) return demo.report(id);
  await rpc('report_insight', { p_id: id, p_reason: reason.slice(0, 300) });
}

// ---------------------------------------------------------------------
// Author names on copies (only while the card is public)
// ---------------------------------------------------------------------

let authors = new Map<string, string>();
let authorsLoadedFor = '';
let authorsAt = 0;
const authorListeners = new Set<() => void>();

function invalidateAuthors() {
  authorsLoadedFor = '';
}

async function loadAuthors(ids: string[]) {
  const key = ids.slice().sort().join(',');
  if (key === authorsLoadedFor && Date.now() - authorsAt < 5 * 60_000) return;
  authorsLoadedFor = key;
  authorsAt = Date.now();
  try {
    const rows = isDemoMode
      ? demo.attribution(ids)
      : ids.length
        ? await rpc<{ id: string; author_name: string }[]>('insight_attribution', { p_ids: ids })
        : [];
    authors = new Map((rows || []).map(r => [String(r.id), String(r.author_name)]));
    authorListeners.forEach(fn => fn());
  } catch {
    authorsLoadedFor = '';   // offline or not installed: no names, try again later
  }
}

/** Author name per copy id (`shared_…`), for the copies among `cards` whose original is still public. */
export function useSharedAuthors(cards: LeitnerCard[]): Map<string, string> {
  const ids = cards.map(sharedIdOf).filter((x): x is string => !!x);
  const key = ids.slice().sort().join(',');
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump(x => x + 1);
    authorListeners.add(fn);
    void loadAuthors(key ? key.split(',') : []);
    return () => { authorListeners.delete(fn); };
  }, [key]);
  const byCard = new Map<string, string>();
  ids.forEach(id => {
    const name = authors.get(id);
    if (name) byCard.set(copyIdFor(id), name);
  });
  return byCard;
}

// ---------------------------------------------------------------------
// The author's publications, shared by the insights page and review (public cards are locked there)
// ---------------------------------------------------------------------

let mine: MyInsight[] = [];
let mineStatus: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
const mineListeners = new Set<() => void>();
const emitMine = () => mineListeners.forEach(fn => fn());

export async function reloadMyInsights(): Promise<void> {
  mineStatus = 'loading';
  emitMine();
  try {
    mine = await fetchMyInsights();
    mineStatus = 'ready';
  } catch (e) {
    console.error('Could not load my public cards', e);
    mineStatus = 'error';
  }
  emitMine();
}

/** Clears the cached publications (sign-out / account switch). */
export function resetSharedState() {
  mine = [];
  mineStatus = 'idle';
  authors = new Map();
  authorsLoadedFor = '';
  emitMine();
}

/** The author's publications (loaded once per app session, reload after changes). */
export function useMyInsights(enabled = true) {
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump(x => x + 1);
    mineListeners.add(fn);
    if (enabled && mineStatus === 'idle') void reloadMyInsights();
    return () => { mineListeners.delete(fn); };
  }, [enabled]);
  const live = mine.filter(isLive);
  return {
    items: mine,
    status: mineStatus,
    /** source card id → its live publication */
    liveBySource: new Map(live.map(m => [m.sourceCardId, m]))
  };
}

// ---------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------

export async function adminListInsights(): Promise<AdminInsight[]> {
  if (isDemoMode) return demo.adminList();
  const rows = await rpc<Record<string, unknown>[]>('admin_list_insights');
  return (rows || []).map(r => ({
    id: String(r.id),
    title: String(r.title),
    content: String(r.content ?? ''),
    category: asCategory(String(r.category)),
    authorName: String(r.author_name ?? ''),
    authorEmail: (r.author_email as string) || null,
    publishedAt: String(r.published_at),
    unpublishedAt: (r.unpublished_at as string) || null,
    hidden: Boolean(r.hidden),
    openReports: Number(r.open_reports) || 0,
    reports: Array.isArray(r.reports) ? (r.reports as AdminInsight['reports']) : [],
    adopters: Number(r.adopters) || 0
  }));
}

/** Takedown: unpublished for good and removed from everyone's boxes. Returns the number of copies removed. */
export async function adminRemoveInsight(id: string): Promise<number> {
  if (isDemoMode) return demo.adminRemove(id);
  const n = await rpc<number>('admin_remove_insight', { p_id: id });
  invalidateAuthors();
  // The server already deleted everyone's copies; drop this device's one too (the queued delete is a no-op)
  if (leitnerEngine.getCards().some(c => c.id === copyIdFor(id))) leitnerEngine.deleteCard(copyIdFor(id));
  return Number(n) || 0;
}

export async function adminKeepInsight(id: string): Promise<void> {
  if (isDemoMode) return demo.adminKeep(id);
  await rpc('admin_keep_insight', { p_id: id });
}

// ---------------------------------------------------------------------
// Demo mode (VITE_DEMO_MODE=1): a fake server in this browser's localStorage
// ---------------------------------------------------------------------

interface DemoRow {
  id: string; author: string; sourceCardId: string; title: string; content: string; category: ReflectionCategory;
  publishedAt: string; unpublishedAt: string | null; removedAt: string | null; reports: number; reportedByMe: boolean; adopters: Adopter[];
}

const demo = /* @__PURE__ */ (() => {
  const KEY = 'daf_demo_shared_v1';
  const ME = 'Demo';
  const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
  const seed = (): DemoRow[] => [
    { id: 'd0000000-0000-4000-8000-000000000001', author: 'Sara', sourceCardId: 's1', title: 'Fehler sind Freunde', content: 'هر اشتباه یعنی مغزم داره یاد می‌گیره. از اشتباه کردن در کلاس نترس؛ معلم برای همین اونجاست.', category: 'motivation', publishedAt: ago(2), unpublishedAt: null, removedAt: null, reports: 0, reportedByMe: false, adopters: [{ name: 'Reza', avatar: null, at: ago(1) }] },
    { id: 'd0000000-0000-4000-8000-000000000002', author: 'Reza', sourceCardId: 's2', title: 'Jeden Morgen 10 Minuten Podcast', content: 'Auf dem Weg zur Arbeit höre ich „Slow German“. Kleine Schritte, jeden Tag.', category: 'habit', publishedAt: ago(26), unpublishedAt: null, removedAt: null, reports: 0, reportedByMe: false, adopters: [] },
    { id: 'd0000000-0000-4000-8000-000000000003', author: 'Nima', sourceCardId: 's3', title: 'تا آخر ترم: B1', content: 'هر هفته یک درس کامل، هر روز مرور لایتنر، و هر جمعه یک متن کوتاه آلمانی بنویسم.', category: 'goal', publishedAt: ago(72), unpublishedAt: null, removedAt: null, reports: 0, reportedByMe: false, adopters: [] }
  ];
  const load = (): DemoRow[] => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw) as DemoRow[];
    } catch { /* ignore */ }
    const rows = seed();
    save(rows);
    return rows;
  };
  const save = (rows: DemoRow[]) => {
    try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch { /* ignore */ }
  };
  const live = (r: DemoRow) => !r.unpublishedAt && !r.removedAt && r.reports < 3;
  const fail = (code: string): never => { throw new Error(`share:${code}`); };
  const has = (id: string) => leitnerEngine.getCards().some(c => c.id === copyIdFor(id));

  return {
    mine(): MyInsight[] {
      return load().filter(r => r.author === ME).map(r => ({
        id: r.id, sourceCardId: r.sourceCardId, title: r.title, content: r.content, category: r.category,
        publishedAt: r.publishedAt, unpublishedAt: r.unpublishedAt, removedAt: r.removedAt,
        hidden: !r.unpublishedAt && !r.removedAt && r.reports >= 3,
        adopters: !r.unpublishedAt && !r.removedAt ? r.adopters : []
      })).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    },
    publish(cardId: string): string {
      const rows = load();
      const card = leitnerEngine.getCards().find(c => c.id === cardId);
      if (!card) return fail('not_found');
      if (card.type !== 'reflection' || card.id.startsWith('shared_')) return fail('not_allowed');
      const title = (card.title || '').trim();
      const content = (card.content || '').trim();
      if (!title) return fail('empty');
      if ([...title].length > SHARE_TITLE_MAX || [...content].length > SHARE_CONTENT_MAX) return fail('too_long');
      if (rows.some(r => r.author === ME && r.sourceCardId === cardId && !r.unpublishedAt && !r.removedAt)) return fail('already_public');
      const q = shareQuota(scoreOf(leitnerEngine.getCards()), rows.filter(r => r.author === ME).length);
      if (q.remaining <= 0) return fail('quota');
      const id = crypto.randomUUID();
      // Two classmates "add" it right away, so the author's list has something to show
      rows.push({ id, author: ME, sourceCardId: cardId, title, content, category: card.category || 'decision', publishedAt: new Date().toISOString(),
        unpublishedAt: null, removedAt: null, reports: 0, reportedByMe: false,
        adopters: [{ name: 'Sara', avatar: null, at: new Date().toISOString() }, { name: null, avatar: null, at: new Date().toISOString() }] });
      save(rows);
      return id;
    },
    unpublish(id: string) {
      const rows = load();
      const r = rows.find(x => x.id === id && x.author === ME && !x.unpublishedAt && !x.removedAt);
      if (!r) return fail('not_found');
      r.unpublishedAt = new Date().toISOString();
      save(rows);
      invalidateAuthors();
    },
    list(before?: string): PublicInsight[] {
      return load().filter(live).filter(r => !before || r.publishedAt < before)
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, PAGE_SIZE)
        .map(r => ({
          id: r.id, title: r.title, content: r.content, category: r.category, authorName: r.author, authorAvatar: null,
          publishedAt: r.publishedAt, adopters: r.adopters.length + (r.author !== ME && has(r.id) ? 1 : 0),
          isMine: r.author === ME, iHave: has(r.id), iReported: r.reportedByMe
        }));
    },
    adopt(id: string): LeitnerCard {
      const r = load().find(x => x.id === id);
      if (!r || !live(r)) return fail('not_public');
      if (r.author === ME) return fail('own_card');
      const existing = leitnerEngine.getCards().find(c => c.id === copyIdFor(id));
      if (existing) return existing;
      return {
        id: copyIdFor(id), type: 'reflection', box: 0, nextReviewDate: getTodayString(), lastReviewedAt: null,
        createdAt: new Date().toISOString(), reviewCount: 0, correctCount: 0, wrongCount: 0,
        title: r.title, content: r.content, category: r.category, sharedId: id
      } as LeitnerCard;
    },
    report(id: string) {
      const rows = load();
      const r = rows.find(x => x.id === id && !x.removedAt);
      if (!r) return fail('not_found');
      if (r.author === ME) return fail('own_card');
      if (!r.reportedByMe) { r.reportedByMe = true; r.reports += 1; }
      save(rows);
    },
    attribution(ids: string[]) {
      return load().filter(r => ids.includes(r.id) && live(r)).map(r => ({ id: r.id, author_name: r.author }));
    },
    adminList(): AdminInsight[] {
      return load().filter(r => !r.removedAt).map(r => ({
        id: r.id, title: r.title, content: r.content, category: r.category, authorName: r.author, authorEmail: `${r.author.toLowerCase()}@example.com`,
        publishedAt: r.publishedAt, unpublishedAt: r.unpublishedAt, hidden: !r.unpublishedAt && r.reports >= 3, openReports: r.reports,
        reports: r.reportedByMe ? [{ reason: '', at: new Date().toISOString(), by: ME }] : [], adopters: r.adopters.length + (has(r.id) ? 1 : 0)
      })).sort((a, b) => b.openReports - a.openReports || b.publishedAt.localeCompare(a.publishedAt));
    },
    adminRemove(id: string): number {
      const rows = load();
      const r = rows.find(x => x.id === id && !x.removedAt);
      if (!r) return fail('not_found');
      r.removedAt = new Date().toISOString();
      r.unpublishedAt = r.unpublishedAt || r.removedAt;
      save(rows);
      const n = r.adopters.length + (has(id) ? 1 : 0);
      if (has(id)) leitnerEngine.deleteCard(copyIdFor(id));
      invalidateAuthors();
      return n;
    },
    adminKeep(id: string) {
      const rows = load();
      const r = rows.find(x => x.id === id && !x.removedAt);
      if (!r) return fail('not_found');
      r.reports = 0;
      r.reportedByMe = false;
      save(rows);
    }
  };
})();
