/**
 * Wiring of the dictation progress queue (src/services/dictation/syncCore.ts) to Supabase, localStorage and the browser
 * events. Demo mode (VITE_DEMO_MODE=1) never builds a Supabase call: everything stays in localStorage.
 */
import { isDemoMode } from '../lib/demo';
import { requireSupabase } from '../lib/supabase';
import { DICTATION_ENABLED } from '../config';
import {
  DictationQueue, MigrationMissingError, fromDbRow, fromDbStory, toRpcRow, toRpcStory,
  type StorySummary, type Transport,
} from './dictation/syncCore';
import { mergeAll, type SentenceProgress } from './dictation/progressMerge';
import { parseFlagValue, resolveFlag, type FlagState } from './dictation/flag';

const PAGE = 1000;
const DEMO_KEY = 'daf_dictation_demo';

/** PostgREST and Postgres codes for "function or table not found": the migration has not been applied. */
const MISSING_CODES = new Set(['PGRST202', 'PGRST205', '42883', '42P01']);
function isMissing(err: { code?: string; message?: string } | null): boolean {
  return !!err && (MISSING_CODES.has(err.code ?? '') || /could not find the (function|table)/i.test(err.message ?? ''));
}

const supabaseTransport: Transport = {
  async save(story, rows) {
    const { error } = await requireSupabase().rpc('save_dictation_progress', {
      p_story: story ? toRpcStory(story) : null,
      p_sentences: rows.map(toRpcRow),
    });
    if (error) throw isMissing(error) ? new MigrationMissingError() : new Error(error.message);
  },
  async load(storyIds) {
    const sb = requireSupabase();
    const rows: SentenceProgress[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb.from('story_sentence_progress').select('*').in('story_id', storyIds)
        .order('sentence_order').range(from, from + PAGE - 1);
      if (error) throw isMissing(error) ? new MigrationMissingError() : new Error(error.message);
      rows.push(...(data ?? []).map(fromDbRow));
      if (!data || data.length < PAGE) break;
    }
    const { data: st, error: stErr } = await sb.from('story_progress').select('*').in('story_id', storyIds);
    if (stErr) throw isMissing(stErr) ? new MigrationMissingError() : new Error(stErr.message);
    return { rows, stories: (st ?? []).map(fromDbStory) };
  },
};

/** Demo mode: the "server" is one localStorage key. */
const demoTransport: Transport = {
  async save(story, rows) {
    const cur = JSON.parse(localStorage.getItem(DEMO_KEY) ?? '{"rows":[],"stories":[]}') as { rows: SentenceProgress[]; stories: StorySummary[] };
    const merged = mergeAll(new Map(cur.rows.map(r => [r.sentenceId, r])), rows);
    const stories = story ? [...cur.stories.filter(s => s.storyId !== story.storyId), story] : cur.stories;
    localStorage.setItem(DEMO_KEY, JSON.stringify({ rows: [...merged.values()], stories }));
  },
  async load(storyIds) {
    const cur = JSON.parse(localStorage.getItem(DEMO_KEY) ?? '{"rows":[],"stories":[]}') as { rows: SentenceProgress[]; stories: StorySummary[] };
    return { rows: cur.rows.filter(r => storyIds.includes(r.storyId)), stories: cur.stories.filter(s => storyIds.includes(s.storyId)) };
  },
};

const browserTimers = {
  set: (fn: () => void, ms: number) => setTimeout(fn, ms),
  clear: (h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

let current: { userId: string; queue: DictationQueue } | null = null;

/** One queue per signed-in user, with per-user storage keys. */
export function dictationQueue(userId: string): DictationQueue {
  if (!current || current.userId !== userId) {
    current?.queue.clear();
    current = { userId, queue: new DictationQueue(userId, localStorage, isDemoMode ? demoTransport : supabaseTransport, browserTimers) };
  }
  return current.queue;
}

/** Sign out: remove this user's rows, queue and drafts from the device. */
export function clearDictationData(userId: string): void {
  if (current?.userId === userId) current.queue.clear();
  current = null;
  try {
    const prefix = `daf_dictation_draft_${userId}_`;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) localStorage.removeItem(k);
    }
  } catch { /* ignore */ }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => current?.queue.schedule(0));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void current?.queue.flush(); });
}

/** Reads app_flags.dictation_enabled; null when it cannot be read (fail open to the build constant, see flag.ts). */
export async function fetchRemoteFlag(): Promise<boolean | null> {
  if (isDemoMode) return null;
  try {
    const { data, error } = await requireSupabase().from('app_flags').select('value').eq('key', 'dictation_enabled').maybeSingle();
    if (error || !data) return null;
    return parseFlagValue(data.value);
  } catch {
    return null;
  }
}

/** `previewParam`: ?dictation=1 was in the URL when the page loaded (App reads it before the URL is cleaned). */
export async function loadDictationFlag(isAdmin: boolean, previewParam: boolean): Promise<FlagState> {
  const remote = await fetchRemoteFlag();
  return resolveFlag({ remote, build: DICTATION_ENABLED, isAdmin, previewParam });
}
