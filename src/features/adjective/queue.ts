/**
 * Pure decision logic for the adjective drill's pending-finish queue (drillSync.ts wires this to
 * Supabase and localStorage): a finished run waits here until it is sent, dropped as too old, or
 * rejected for good.
 */

export const QUEUE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface PendingFinish {
  id: string;
  score: number;
  answered: number;
  /** When this entry was queued on this device. */
  queuedAt: number;
}

export type FlushOutcome = 'accepted' | 'rejected' | 'network-error';

/** An entry older than this (client-side) is dropped without even being sent: the server would reject it anyway. */
export function isTooOld(entry: PendingFinish, now: number, maxAgeMs: number = QUEUE_MAX_AGE_MS): boolean {
  return now - entry.queuedAt > maxAgeMs;
}

/**
 * What a finish_adjective_run response means for the queue. supabase-js does not throw on a network
 * failure: it resolves with an error and HTTP status 0. Only the function's own refusals are final:
 * 400 (raise exception: too early, too late, out of range, finished with other values) and 403 (errcode
 * 42501: not the caller's run, suspended). Everything else is tried again later: no answer, a timeout,
 * 401 (an expired session that is still being refreshed), 404 (the function isn't there yet) or a 5xx.
 */
export function classifyFinishResponse(res: { error: unknown; status?: number }): FlushOutcome {
  if (!res.error) return 'accepted';
  return res.status === 400 || res.status === 403 ? 'rejected' : 'network-error';
}

/** Whether a queued entry should stay queued after an attempt with this outcome. */
export function keepAfterOutcome(outcome: FlushOutcome): boolean {
  return outcome === 'network-error';
}
