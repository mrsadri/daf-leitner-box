/** Read models, presence and administrative RPCs, separate from the durable sync queue. */
import { requireSupabase } from '../shared/lib/supabase';
import { isDemoMode } from '../shared/lib/demo';

export interface LeaderboardRow {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  score: number;
  score_7d: number;
  mastered: number;
  learning: number;
  reviews_7d: number;
  streak: number;
  /** Silver cards collected (missing until the database part is installed) */
  silver?: number;
  rank: number;
  is_me: boolean;
}

export async function fetchLeaderboard(period: 'all' | 'week', limit = 100): Promise<LeaderboardRow[]> {
  if (isDemoMode) return DEMO_LEADERBOARD;
  const { data, error } = await requireSupabase().rpc('get_verified_leaderboard', { p_period: period, p_limit: limit });
  if (error) throw error;
  return (data || []).map((r: Record<string, unknown>) => ({
    ...r,
    score: Number(r.score),
    score_7d: Number(r.score_7d),
    mastered: Number(r.mastered),
    learning: Number(r.learning),
    reviews_7d: Number(r.reviews_7d),
    streak: Number(r.streak),
    silver: r.silver === undefined || r.silver === null ? undefined : Number(r.silver),
    rank: Number(r.rank)
  })) as LeaderboardRow[];
}

/** Record that the user is using the app. Resolves to true if the account has been suspended. */
export async function touchPresence(): Promise<boolean> {
  if (isDemoMode) return false;
  const { data, error } = await requireSupabase().rpc('touch_presence');
  if (error) throw error;
  return data === true;
}

export interface AdminUserRow {
  user_id: string;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
  first_seen: string;
  last_seen: string | null;
  suspended_at: string | null;
  cards: number;
  reviews: number;
}

export async function adminListUsers(): Promise<AdminUserRow[]> {
  if (isDemoMode) return DEMO_ADMIN_USERS;
  const { data, error } = await requireSupabase().rpc('admin_list_users');
  if (error) throw error;
  return (data || []).map((r: Record<string, unknown>) => ({
    ...r,
    cards: Number(r.cards),
    reviews: Number(r.reviews)
  })) as AdminUserRow[];
}

export async function adminSetSuspended(userId: string, suspended: boolean) {
  const { error } = await requireSupabase().rpc('admin_set_suspended', { p_user: userId, p_suspended: suspended });
  if (error) throw error;
}

export async function adminDeleteUser(userId: string) {
  const { error } = await requireSupabase().rpc('admin_delete_user', { p_user: userId });
  if (error) throw error;
}

const DEMO_LEADERBOARD: LeaderboardRow[] = [
  { user_id: 'u1', display_name: 'Sara', avatar_url: null, score: 1840, score_7d: 210, mastered: 120, learning: 380, reviews_7d: 260, streak: 21, silver: 12, rank: 1, is_me: false },
  { user_id: 'demo-user', display_name: 'Demo', avatar_url: null, score: 960, score_7d: 85, mastered: 40, learning: 150, reviews_7d: 90, streak: 6, silver: 3, rank: 2, is_me: true },
  { user_id: 'u3', display_name: 'Alexander Müller-Lüdenscheidt', avatar_url: null, score: 410, score_7d: -12, mastered: 9, learning: 60, reviews_7d: 14, streak: 0, silver: 0, rank: 3, is_me: false }
];

const DEMO_ADMIN_USERS: AdminUserRow[] = [
  { user_id: 'demo-user', email: 'demo@example.com', display_name: 'Demo', avatar_url: null, first_seen: '2026-10-01T09:00:00Z', last_seen: new Date().toISOString(), suspended_at: null, cards: 150, reviews: 900 },
  { user_id: 'u3', email: 'a.very.long.email.address@example.com', display_name: 'Alexander Müller-Lüdenscheidt', avatar_url: null, first_seen: '2026-10-10T09:00:00Z', last_seen: '2026-10-20T18:30:00Z', suspended_at: '2026-10-21T08:00:00Z', cards: 60, reviews: 14 }
];
