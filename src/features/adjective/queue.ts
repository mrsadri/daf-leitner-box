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

/** Whether a queued entry should stay queued after an attempt with this outcome. */
export function keepAfterOutcome(outcome: FlushOutcome): boolean {
  return outcome === 'network-error';
}
