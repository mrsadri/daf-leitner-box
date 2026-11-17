/**
 * Pure mapping from the raw rows get_adjective_board()/get_my_adjective_bests() return to the shapes
 * the UI uses (drillSync.ts wires this to Supabase).
 */

export interface AdjectiveBoardRow {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  best: number;
  top3: number[];
  bestAt: string;
  rank: number;
  isMe: boolean;
}

export function mapBoardRow(r: Record<string, unknown>): AdjectiveBoardRow {
  return {
    userId: String(r.user_id),
    displayName: String(r.display_name),
    avatarUrl: (r.avatar_url as string | null) ?? null,
    best: Number(r.best),
    top3: ((r.top3 as number[] | null) || []).map(Number),
    bestAt: String(r.best_at),
    rank: Number(r.rank),
    isMe: Boolean(r.is_me)
  };
}

export interface MyBests {
  myBestAll: number | null;
  myBestWeek: number | null;
}

export function mapMyBests(row: Record<string, unknown> | undefined): MyBests {
  const r = row || {};
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return { myBestAll: n(r.best_all), myBestWeek: n(r.best_week) };
}
