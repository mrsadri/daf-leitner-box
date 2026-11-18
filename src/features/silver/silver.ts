/**
 * This device's silver-card counter, kept in step with the server (get_silver_status); the dashboard widget and the
 * review subscribe to changes.
 */
import { supabase } from '../../shared/lib/supabase';
import { isDemoMode } from '../../shared/lib/demo';
import { getTodayString } from '../../core/leitnerEngine';
import { SILVER_MAX } from './silverFacts';
import { SilverState, emptySilver, rollDay, afterCorrectAnswer } from './silverLogic';

let userId: string | null = null;
let state: SilverState = emptySilver(getTodayString());
const listeners = new Set<() => void>();
const key = (id: string) => `daf_silver_${id}`;

function save() {
  if (!userId) return;
  try { localStorage.setItem(key(userId), JSON.stringify({ ...state, protocol:'verified' })); } catch { /* private mode */ }
  listeners.forEach(fn => fn());
}

/** Load this device's count, then bring it up to date with the server (silently skipped when offline). */
export async function startSilver(id: string): Promise<void> {
  userId = id;
  const today = getTodayString();
  try {
    const raw = localStorage.getItem(key(id));
    const cached = raw ? JSON.parse(raw) : null;
    state = cached && (isDemoMode || cached.protocol === 'verified') && Number.isInteger(cached.total) && Number.isInteger(cached.correctToday)
      ? rollDay({ ...emptySilver(today), ...cached }, today) : emptySilver(today);
  } catch {
    state = emptySilver(today);
  }
  save();
  await refreshSilver();
}

export async function refreshSilver(): Promise<void> {
  if (!userId || isDemoMode || !supabase) return;
  const today = getTodayString();
  const uid = userId;
  try {
    const { data, error } = await supabase.rpc('get_verified_silver_status', { p_day: today });
    if (error || !data || uid !== userId) return;   // database part not installed yet, or offline
    const row = (Array.isArray(data) ? data[0] : data) as { total: number; today_correct: number; earned_today: boolean } | undefined;
    if (!row) return;
    state = { day:today, total:Math.min(SILVER_MAX,Number(row.total)), correctToday:Number(row.today_correct), earnedToday:!!row.earned_today };
    save();
  } catch { /* ignore */ }
}

/** Call after each correct vocabulary answer in review. Returns the number of the silver card just won, or null. */
export function recordSilverCorrect(): number | null {
  if (!userId) return null;
  if (!isDemoMode) return null; // Competitive rewards are confirmed only by the server.
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
