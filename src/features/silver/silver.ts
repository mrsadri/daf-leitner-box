/**
 * This device's silver-card counter, kept in step with the server (get_silver_status); the dashboard widget and the
 * review subscribe to changes.
 */
import { supabase } from '../../shared/lib/supabase';
import { isDemoMode } from '../../shared/lib/demo';
import { getTodayString } from '../../core/leitnerEngine';
import { SILVER_MAX } from './silverFacts';
import { SilverState, emptySilver, rollDay, afterCorrectAnswer, pendingCelebration, settleSeen } from './silverLogic';

let userId: string | null = null;
let state: SilverState = emptySilver(getTodayString());
/**
 * The highest card already celebrated on this device (per user). null until the first trustworthy status: the server's in
 * production, the saved local count in demo. Set then to the current total, so cards from before this version never pop up.
 */
let seen: number | null = null;
const listeners = new Set<() => void>();
const key = (id: string) => `daf_silver_${id}`;
const seenKey = (id: string) => `daf_silver_seen_${id}`;

function loadSeen(id: string): number | null {
  try {
    const raw = localStorage.getItem(seenKey(id));
    const n = raw === null ? NaN : Number(raw);
    return Number.isInteger(n) && n >= 0 ? Math.min(SILVER_MAX, n) : null;
  } catch { return null; }
}

function storeSeen(value: number) {
  seen = value;
  if (!userId) return;
  try { localStorage.setItem(seenKey(userId), String(value)); } catch { /* private mode: kept in memory for this page */ }
}

/** First trustworthy status: start from here. Later: quietly mark old, never-shown cards as seen. */
function settle(trusted: boolean) {
  const today = getTodayString();
  if (seen === null) {
    if (trusted) storeSeen(Math.min(SILVER_MAX, state.total));
    return;
  }
  const next = settleSeen(state, seen, today, SILVER_MAX);
  if (next !== seen) storeSeen(next);
}

function save(trusted = false) {
  if (!userId) return;
  try { localStorage.setItem(key(userId), JSON.stringify({ ...state, protocol:'verified' })); } catch { /* private mode */ }
  settle(trusted);
  listeners.forEach(fn => fn());
}

/** Load this device's count, then bring it up to date with the server (silently skipped when offline). */
export async function startSilver(id: string): Promise<void> {
  userId = id;
  seen = loadSeen(id);
  const today = getTodayString();
  try {
    const raw = localStorage.getItem(key(id));
    const cached = raw ? JSON.parse(raw) : null;
    state = cached && (isDemoMode || cached.protocol === 'verified') && Number.isInteger(cached.total) && Number.isInteger(cached.correctToday)
      ? rollDay({ ...emptySilver(today), ...cached }, today) : emptySilver(today);
  } catch {
    state = emptySilver(today);
  }
  save(isDemoMode);   // demo: the device's own count is the authority
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
    save(true);
  } catch { /* ignore */ }
}

/** Call after each correct vocabulary answer in review. Returns the number of the silver card just won, or null. */
export function recordSilverCorrect(): number | null {
  if (!userId) return null;
  if (!isDemoMode) return null; // Competitive rewards are confirmed only by the server.
  const r = afterCorrectAnswer(state, getTodayString(), SILVER_MAX);
  state = r.state;
  save(true);
  return r.earned;
}

export function getSilver(): SilverState {
  return rollDay(state, getTodayString());
}

/**
 * Today's confirmed card that this device hasn't celebrated yet, or null. In production a card counts once the server
 * has confirmed it (refreshSilver after each sync); in demo as soon as the local count earns it.
 */
export function getPendingSilver(): number | null {
  if (!userId || seen === null) return null;
  const today = getTodayString();
  return pendingCelebration(rollDay(state, today), seen, today, SILVER_MAX);
}

/** The learner closed the celebration of card `index`: don't show it again on this device. */
export function acknowledgeSilver(index: number): void {
  if (!userId) return;
  if (seen === null || index > seen) storeSeen(Math.min(SILVER_MAX, index));
  listeners.forEach(fn => fn());
}

export function onSilverChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
