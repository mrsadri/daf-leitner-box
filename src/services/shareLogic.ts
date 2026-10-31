import type { LeitnerCard } from '../types/leitner';

/** Points (leaderboard score) per publication slot. Must match public.share_quota() on the server. */
export const SHARE_POINTS = 256;
export const SHARE_TITLE_MAX = 120;
export const SHARE_CONTENT_MAX = 1500;
const COPY_PREFIX = 'shared_';

/** A card someone added from the public list (read-only for them). */
export const isSharedCopy = (card: Pick<LeitnerCard, 'id'>) => card.id.startsWith(COPY_PREFIX);
export const sharedIdOf = (card: Pick<LeitnerCard, 'id'>) => (isSharedCopy(card) ? card.id.slice(COPY_PREFIX.length) : null);
export const copyIdFor = (sharedId: string) => COPY_PREFIX + sharedId;

/** The leaderboard score: the sum of box numbers over all cards. */
export const scoreOf = (cards: Pick<LeitnerCard, 'box'>[]) => cards.reduce((s, c) => s + (c.box || 0), 0);

export interface ShareQuota {
  score: number;
  allowed: number;
  used: number;
  remaining: number;
  /** Points still needed for the next slot (0 when one is free) */
  pointsToNext: number;
}

/** Every publication uses a slot for good; slots = floor(score / 256). */
export function shareQuota(score: number, used: number): ShareQuota {
  const s = Math.max(0, Math.floor(score));
  const allowed = Math.floor(s / SHARE_POINTS);
  const remaining = Math.max(0, allowed - used);
  // When over the limit (score fell), the next slot needs (used + 1) × 256 points
  const pointsToNext = remaining > 0 ? 0 : (Math.max(used, allowed) + 1) * SHARE_POINTS - s;
  return { score: s, allowed, used, remaining, pointsToNext };
}

export type PublishBlock = 'copy' | 'notInsight' | 'empty' | 'tooLong' | 'public' | 'quota';

/** Why this card can't be published right now, or null. */
export function publishBlock(card: LeitnerCard, quota: ShareQuota, isPublic: boolean): PublishBlock | null {
  if (card.type !== 'reflection') return 'notInsight';
  if (isSharedCopy(card)) return 'copy';
  if (isPublic) return 'public';
  const title = (card.title || '').trim();
  if (!title) return 'empty';
  if ([...title].length > SHARE_TITLE_MAX || [...(card.content || '').trim()].length > SHARE_CONTENT_MAX) return 'tooLong';
  if (quota.remaining <= 0) return 'quota';
  return null;
}

export type ShareErrorCode =
  | 'not_allowed' | 'not_found' | 'empty' | 'too_long' | 'already_public' | 'quota'
  | 'not_public' | 'own_card' | 'offline' | 'unknown';

/** The server raises 'share:<code>'; anything else is a network or unknown error. */
export function shareErrorCode(err: unknown): ShareErrorCode {
  const msg = err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : String(err ?? '');
  const m = msg.match(/share:([a-z_]+)/);
  const known: ShareErrorCode[] = ['not_allowed', 'not_found', 'empty', 'too_long', 'already_public', 'quota', 'not_public', 'own_card'];
  if (m && (known as string[]).includes(m[1])) return m[1] as ShareErrorCode;
  if (/failed to fetch|network|load failed|offline/i.test(msg)) return 'offline';
  return 'unknown';
}
