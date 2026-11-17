/**
 * Adjective drill results: start/finish a run against Supabase, and the records board.
 *
 *   - starting a run asks the server for a run id; if that fails (offline, daily limit, suspended) the
 *     drill still runs, as practice, and its result is never sent
 *   - a finished run's result waits in a per-user localStorage queue until it is accepted; a network
 *     failure keeps it queued for the next flush (start-up, coming back online), a server rejection
 *     (not owned, too early, out of range, older than 24h) removes it for good (queue.ts)
 *   - demo mode: runs and a small fake board live in localStorage only, no Supabase calls
 */
import { requireSupabase, supabase } from '../../shared/lib/supabase';
import { isDemoMode } from '../../shared/lib/demo';
import { isTooOld, keepAfterOutcome, type PendingFinish, type FlushOutcome } from './queue';
import { mapBoardRow, mapMyBests, type AdjectiveBoardRow } from './boardMapping';

export type { AdjectiveBoardRow } from './boardMapping';

const queueKey = (uid: string) => `daf_adjective_queue_${uid}`;
const demoRunsKey = 'daf_adjective_demo_runs';

function readQueue(uid: string): PendingFinish[] {
  try {
    const raw = localStorage.getItem(queueKey(uid));
    return raw ? (JSON.parse(raw) as PendingFinish[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(uid: string, q: PendingFinish[]) {
  try {
    if (q.length === 0) localStorage.removeItem(queueKey(uid));
    else localStorage.setItem(queueKey(uid), JSON.stringify(q));
  } catch {
    // storage full or unavailable: the queue only lives for this page load
  }
}

/** Starts a run. Returns null (practice mode) if offline, refused (daily limit, suspended) or demo-less setup fails. */
export async function startRun(): Promise<string | null> {
  if (isDemoMode) return `demo_${Date.now()}`;
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc('start_adjective_run');
    if (error || !data) return null;
    return data as string;
  } catch {
    return null;
  }
}

/** Queues a finished run's result for sending (or records it immediately in demo mode). */
export function queueFinish(uid: string, result: { id: string; score: number; answered: number }): void {
  if (isDemoMode) {
    saveDemoRun(result.score);
    return;
  }
  const q = readQueue(uid);
  q.push({ ...result, queuedAt: Date.now() });
  writeQueue(uid, q);
}

/** Sends every queued result. Safe to call repeatedly (idempotent on the server) and concurrently. */
export async function flushQueue(uid: string): Promise<void> {
  if (isDemoMode || !supabase) return;
  const db = supabase;
  const q = readQueue(uid);
  if (q.length === 0) return;
  const keep: PendingFinish[] = [];
  for (const p of q) {
    if (isTooOld(p, Date.now())) continue; // too old: the server would reject it anyway
    let outcome: FlushOutcome;
    try {
      const { error } = await db.rpc('finish_adjective_run', { p_id: p.id, p_score: p.score, p_answered: p.answered });
      outcome = error ? 'rejected' : 'accepted';
    } catch {
      outcome = 'network-error';
    }
    if (keepAfterOutcome(outcome)) keep.push(p);
  }
  writeQueue(uid, keep);
}

/** Clears this device's pending queue (called on sign-out, so the next account doesn't inherit it). */
export function clearQueue(uid: string): void {
  writeQueue(uid, []);
}

const bestKey = (uid: string) => `daf_adjective_best_${uid}`;

/** A quick local "new record?" check, so the end screen doesn't have to wait for a server round trip. */
export function updateLocalBest(uid: string, score: number): boolean {
  try {
    const prev = Number(localStorage.getItem(bestKey(uid)) || 0);
    if (score > prev && score > 0) {
      localStorage.setItem(bestKey(uid), String(score));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Records board
// ---------------------------------------------------------------------------

export type AdjectivePeriod = 'all' | 'week';

export interface AdjectiveBoard {
  rows: AdjectiveBoardRow[];
  myBestAll: number | null;
  myBestWeek: number | null;
}

export async function fetchBoard(period: AdjectivePeriod, limit = 100): Promise<AdjectiveBoard> {
  if (isDemoMode) return demoBoard(period);
  const db = requireSupabase();
  const [boardRes, bestsRes] = await Promise.all([
    db.rpc('get_adjective_board', { p_period: period, p_limit: limit }),
    db.rpc('get_my_adjective_bests')
  ]);
  if (boardRes.error) throw boardRes.error;
  const rows = ((boardRes.data || []) as Record<string, unknown>[]).map(mapBoardRow);
  const { myBestAll, myBestWeek } = mapMyBests((bestsRes.data || [])[0]);
  return { rows, myBestAll, myBestWeek };
}

// ---------------------------------------------------------------------------
// Demo mode
// ---------------------------------------------------------------------------

function readDemoRuns(): number[] {
  try {
    const raw = localStorage.getItem(demoRunsKey);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

function saveDemoRun(score: number) {
  try {
    const runs = readDemoRuns();
    runs.unshift(score);
    localStorage.setItem(demoRunsKey, JSON.stringify(runs.slice(0, 20)));
  } catch {
    // storage unavailable: the demo run still played, it just isn't remembered
  }
}

const DEMO_OTHERS: { displayName: string; top3: number[] }[] = [
  { displayName: 'Sara', top3: [14, 12, 10] },
  { displayName: 'Alexander Müller-Lüdenscheidt', top3: [9, 7, 5] }
];

function demoBoard(_period: AdjectivePeriod): AdjectiveBoard {
  const myRuns = readDemoRuns();
  const myTop3 = [...myRuns].sort((a, b) => b - a).slice(0, 3);
  const myBest = myTop3[0] ?? null;
  const rowsSource = [
    ...DEMO_OTHERS.map(o => ({ ...o, best: o.top3[0], isMe: false })),
    { displayName: 'Demo', top3: myTop3, best: myBest ?? 0, isMe: true }
  ].filter(r => r.isMe || r.best > 0);
  rowsSource.sort((a, b) => b.best - a.best);
  const rows: AdjectiveBoardRow[] = rowsSource.map((r, i) => ({
    userId: r.isMe ? 'demo-user' : r.displayName,
    displayName: r.displayName,
    avatarUrl: null,
    best: r.best,
    top3: r.top3,
    bestAt: new Date().toISOString(),
    rank: i + 1,
    isMe: r.isMe
  }));
  return { rows, myBestAll: myBest, myBestWeek: myBest };
}
