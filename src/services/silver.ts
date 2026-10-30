import { supabase } from '../lib/supabase';
import { isDemoMode } from '../lib/demo';
import { getTodayString } from './leitnerEngine';
import { SILVER_MAX } from '../data/silverFacts';
import { SilverState, emptySilver, rollDay, afterCorrectAnswer, mergeServer } from './silverLogic';

let userId: string | null = null;
let state: SilverState = emptySilver(getTodayString());
const listeners = new Set<() => void>();
const key = (id: string) => `daf_silver_${id}`;

function save() {
  if (!userId) return;
  try { localStorage.setItem(key(userId), JSON.stringify(state)); } catch { /* private mode */ }
  listeners.forEach(fn => fn());
}

/** Load this device's count, then bring it up to date with the server (silently skipped when offline). */
export async function startSilver(id: string): Promise<void> {
  userId = id;
  const today = getTodayString();
  try {
    const raw = localStorage.getItem(key(id));
    state = raw ? rollDay({ ...emptySilver(today), ...JSON.parse(raw) }, today) : emptySilver(today);
  } catch {
    state = emptySilver(today);
  }
  save();
  await refreshSilver();
}

export async function refreshSilver(): Promise<void> {
  if (!userId || isDemoMode || !supabase) return;
  const today = getTodayString();
  try {
    const { data, error } = await supabase.rpc('get_silver_status', { p_day: today });
    if (error || !data) return;   // database part not installed yet, or offline
    const row = (Array.isArray(data) ? data[0] : data) as { total: number; today_correct: number; earned_today: boolean } | undefined;
    if (!row) return;
    state = mergeServer(state, { total: Number(row.total), todayCorrect: Number(row.today_correct), earnedToday: !!row.earned_today }, today, SILVER_MAX);
    save();
  } catch { /* ignore */ }
}

/** Call after each correct vocabulary answer in review. Returns the number of the silver card just won, or null. */
export function recordSilverCorrect(): number | null {
  if (!userId) return null;
  const r = afterCorrectAnswer(state, getTodayString(), SILVER_MAX);
  state = r.state;
  save();
  return r.earned;
}

export function getSilver(): SilverState {
  return rollDay(state, getTodayString());
}

export function onSilverChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
