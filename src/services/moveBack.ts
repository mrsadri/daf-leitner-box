/**
 * "Move back one compartment", offered when a learner taps a word they already own in a story. Pure: the engine method
 * `leitnerEngine.moveBackOne` delegates here. Dates are local calendar dates as YYYY-MM-DD, like the rest of the app.
 *
 *   entryDay   = local date of card.lastReviewedAt            (null: today)
 *   newBox     = max(0, box - 1)                              (box 6, mastered, goes to 5)
 *   due        = entryDay + 2^min(5, newBox) days             (same interval as calculateNextReviewDate)
 *   nextReview = max(today, due)                              (never in the past)
 *
 * The move is not a review: lastReviewedAt and the counters stay, and no review event is written.
 */
import { MASTERED_BOX } from '../types/leitner.ts';

export interface MoveBackCard {
  box: number;
  lastReviewedAt: string | null;
  nextReviewDate: string;
}

export interface MoveBackResult {
  box: number;
  nextReviewDate: string;
  /** False for box 0: nothing lower exists, the card only becomes due today ("Review today"). */
  moved: boolean;
}

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);        // local calendar arithmetic, DST safe
  return localDate(dt);
}

export function computeMoveBack(card: MoveBackCard, today: Date = new Date()): MoveBackResult {
  const todayStr = localDate(today);
  const box = Math.min(MASTERED_BOX, Math.max(0, Math.trunc(card.box)));
  if (box === 0) return { box: 0, nextReviewDate: todayStr, moved: false };

  const newBox = box - 1;
  const entry = card.lastReviewedAt ? new Date(card.lastReviewedAt) : null;
  const entryDay = entry && !Number.isNaN(entry.getTime()) ? localDate(entry) : todayStr;
  const due = addDays(entryDay, Math.pow(2, Math.min(5, newBox)));
  return { box: newBox, nextReviewDate: due > todayStr ? due : todayStr, moved: true };
}
