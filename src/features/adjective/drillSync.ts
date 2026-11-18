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
import { declinePhrase, type DeclineParams, type Round } from './grammar';
import { requireSupabase, supabase } from '../../shared/lib/supabase';
import { isDemoMode } from '../../shared/lib/demo';
import { parsePendingFinishes, isTooOld, keepAfterOutcome, classifyFinishResponse, type PendingFinish, type FlushOutcome } from './queue';
import { mapBoardRow, mapMyBests, type AdjectiveBoardRow } from './boardMapping';

export type { AdjectiveBoardRow } from './boardMapping';

const queueKey = (uid: string) => `daf_adjective_queue_${uid}`;
const demoRunsKey = 'daf_adjective_demo_runs';
/** How long the start button waits for a run id before the run goes ahead as practice. */
const START_TIMEOUT_MS = 10_000;

interface IssuedRun { db: NonNullable<typeof supabase>; userId: string; pending: number; questions: Round[]; deadline: number; chain: Promise<void> }
const issuedRuns = new Map<string, IssuedRun>();
const syncListeners = new Map<string, Set<() => void>>();
const lastResults = new Map<string, VerifiedResult>();
const queueErrors = new Set<string>();
const inFlight = new Map<string, Promise<VerifiedResult[]>>();
const notify = (uid: string) => syncListeners.get(uid)?.forEach(fn => fn());
export function onDrillSync(uid: string, fn: () => void) {
  const set = syncListeners.get(uid) ?? new Set(); set.add(fn); syncListeners.set(uid,set);
  return () => { set.delete(fn); if (!set.size) syncListeners.delete(uid); };
}
export function drillSyncInfo(uid: string) {
  let pending = 0;
  try { pending = readQueue(uid).length; } catch { queueErrors.add(uid); }
  for (const run of issuedRuns.values()) if (run.userId===uid) pending += run.pending;
  return { pending, error:queueErrors.has(uid), lastResult:lastResults.get(uid) ?? null };
}
export interface VerifiedResult { id: string; score: number; answered: number }
export function issuedRound(id: string | null, index: number): Round | null { return id ? issuedRuns.get(id)?.questions[index] ?? null : null; }
export function runDeadline(id: string | null): number | null { return id ? issuedRuns.get(id)?.deadline ?? null : null; }
export function submitRunAnswer(id: string, ordinal: number, answers: { article?: string; adjective?: string; noun?: string }): Promise<boolean> {
  const run = issuedRuns.get(id);
  if (!run) return Promise.resolve(false);
  const db = run.db;
  let accepted = false;
  run.pending++; notify(run.userId);
  const work = run.chain.then(async () => {
    for (let attempt=0; attempt<2; attempt++) {
      try {
        const result = await db.rpc('answer_verified_adjective', { p_run:id, p_ordinal:ordinal,
          p_answers: { article:answers.article??null, adjective:answers.adjective??null, noun:answers.noun??null } })
          .abortSignal(AbortSignal.timeout(5000));
        if (!result.error) { accepted = true; return; }
        if (result.status === 400 || result.status === 403) return;
      } catch { /* one retry uses the same immutable answer identity */ }
    }
  });
  run.chain = work.catch(() => {}).finally(() => { run.pending--; if (!accepted) queueErrors.add(run.userId); notify(run.userId); });
  return run.chain.then(() => accepted);
}

function readQueue(uid: string): PendingFinish[] {
  const raw = localStorage.getItem(queueKey(uid));
  return raw ? parsePendingFinishes(JSON.parse(raw)) : [];
}

function writeQueue(uid: string, q: PendingFinish[]) {
  try {
    if (q.length === 0) localStorage.removeItem(queueKey(uid));
    else localStorage.setItem(queueKey(uid), JSON.stringify(q));
    queueErrors.delete(uid); notify(uid);
  } catch {
    queueErrors.add(uid); notify(uid);
    throw new Error('Drill result could not be saved on this device');
    // The caller must explain that this result is not durable.
  }
}

/** Starts a run. Returns null (practice mode) if offline, refused (daily limit, suspended) or demo-less setup fails. */
export async function startRun(uid: string, db = supabase): Promise<string | null> {
  if (isDemoMode) return `demo_${Date.now()}`;
  if (!db) return null;
  try {
    const began = Date.now();
    const { data, error } = await db.rpc('start_verified_adjective_run').abortSignal(AbortSignal.timeout(START_TIMEOUT_MS));
    if (error || !data) return null;
    const result = data as unknown as { id: string; questions: { ordinal:number; params:DeclineParams }[]; durationMs:number };
    if (typeof result.id !== 'string' || result.questions.length !== 150) return null;
    const questions = result.questions.map(q => ({ ...q.params, id:`verified_${q.ordinal}`, phrase:declinePhrase(q.params) }));
    issuedRuns.set(result.id, { db, userId:uid, pending:0, questions, deadline:Date.now() + Math.min(300000,result.durationMs) - (Date.now()-began)/2, chain:Promise.resolve() });
    return result.id;
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
  if (q.some(entry => entry.id===result.id)) return;
  q.push({ ...result, ...(issuedRuns.has(result.id) ? { protocol:'verified' as const } : {}), queuedAt: Date.now() });
  writeQueue(uid, q);
}

/** Sends every queued result. Safe to call repeatedly (idempotent on the server) and concurrently. */
export function flushQueue(uid: string, db = supabase): Promise<VerifiedResult[]> {
  const existing = inFlight.get(uid); if (existing) return existing;
  const promise = flushQueueImpl(uid, db).catch(error => { queueErrors.add(uid); throw error; }).finally(() => { inFlight.delete(uid); notify(uid); });
  inFlight.set(uid,promise); return promise;
}
async function flushQueueImpl(uid: string, db: typeof supabase): Promise<VerifiedResult[]> {
  if (isDemoMode || !db) return [];
  const accepted: VerifiedResult[] = [];
  const q = readQueue(uid);
  if (q.length === 0) return [];
  const keep: PendingFinish[] = [];
  for (const p of q) {
    if (isTooOld(p, Date.now())) continue; // too old: the server would reject it anyway
    let outcome: FlushOutcome;
    try {
      await issuedRuns.get(p.id)?.chain;
      if (p.protocol === 'verified') {
        const result = await db.rpc('finish_verified_adjective_run', { p_id:p.id });
        outcome = classifyFinishResponse(result);
        if (result.error?.message.includes('finished too early')) outcome='network-error';
        if (!result.error && result.data?.[0]) {
          const confirmed = { id:p.id, ...result.data[0] }; accepted.push(confirmed); lastResults.set(uid,confirmed); issuedRuns.delete(p.id);
        }
      } else outcome = classifyFinishResponse(await db.rpc('finish_adjective_run', { p_id: p.id, p_score: p.score, p_answered: p.answered }));
    } catch {
      outcome = 'network-error';
    }
    if (keepAfterOutcome(outcome)) keep.push(p);
  }
  // A run that finished while this flush was waiting on the network was queued meanwhile: keep it too
  const sent = new Set(q.map(p => p.id));
  writeQueue(uid, [...keep, ...readQueue(uid).filter(p => !sent.has(p.id))]);
  if (keep.length) { queueErrors.add(uid); notify(uid); }
  return accepted;
}

/** Clears this device's pending queue (called on sign-out, so the next account doesn't inherit it). */
export function clearQueue(uid: string): void {
  writeQueue(uid, []);
  for (const [id,run] of issuedRuns) if (run.userId===uid) issuedRuns.delete(id);
  lastResults.delete(uid); queueErrors.delete(uid); notify(uid);
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
    db.rpc('get_verified_adjective_board', { p_period: period, p_limit: limit }),
    db.rpc('get_my_verified_adjective_bests')
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
