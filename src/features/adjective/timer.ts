/**
 * The drill's timer: a fixed end time, not accumulated ticks. A background tab throttles or skips
 * setInterval callbacks, but every check here only ever compares the clock to the deadline, so a
 * throttled tab never buys extra time and a late answer is never counted.
 */

export const DRILL_DURATION_MS = 5 * 60 * 1000;

export function createDeadline(now: number = Date.now(), durationMs: number = DRILL_DURATION_MS): number {
  return now + durationMs;
}

export function remainingMs(deadline: number, now: number = Date.now()): number {
  return Math.max(0, deadline - now);
}

export function isExpired(deadline: number, now: number = Date.now()): boolean {
  return now >= deadline;
}

export function formatClock(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
