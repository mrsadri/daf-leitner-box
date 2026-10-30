/**
 * Silver cards: a day (the user's local day) with more than SILVER_THRESHOLD correct vocabulary answers
 * in review earns the next silver card, at most one per day and SILVER_MAX in total, counted from
 * SILVER_START. The server computes the same from review_events (get_silver_status, get_leaderboard);
 * this is the device's running count, so the card can appear the moment it is earned. Pure, unit-tested.
 */

export const SILVER_THRESHOLD = 15;
export const SILVER_START = '2026-10-31';

export interface SilverState {
  day: string;            // YYYY-MM-DD, local
  correctToday: number;
  earnedToday: boolean;
  total: number;
}

export interface SilverServerStatus {
  total: number;
  todayCorrect: number;
  earnedToday: boolean;
}

export const emptySilver = (day: string): SilverState => ({ day, correctToday: 0, earnedToday: false, total: 0 });

/** A new day starts from zero; the collection stays. */
export function rollDay(state: SilverState, today: string): SilverState {
  return state.day === today ? state : { day: today, correctToday: 0, earnedToday: false, total: state.total };
}

/** Count one correct answer; `earned` is the number (1-based) of the card won with it, if any. */
export function afterCorrectAnswer(state: SilverState, today: string, max: number): { state: SilverState; earned: number | null } {
  const s = { ...rollDay(state, today) };
  s.correctToday += 1;
  if (today >= SILVER_START && !s.earnedToday && s.correctToday > SILVER_THRESHOLD && s.total < max) {
    s.earnedToday = true;
    s.total += 1;
    return { state: s, earned: s.total };
  }
  return { state: s, earned: null };
}

/** Combine the device's count with the server's (other devices, earlier sessions). */
export function mergeServer(state: SilverState, server: SilverServerStatus, today: string, max: number): SilverState {
  const s = rollDay(state, today);
  return {
    day: today,
    correctToday: Math.max(s.correctToday, server.todayCorrect),
    earnedToday: s.earnedToday || server.earnedToday,
    total: Math.min(max, Math.max(s.total, server.total))
  };
}
