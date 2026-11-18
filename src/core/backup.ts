import type { StoryProgress } from '../features/stories/types.ts';
export function parseStoryBackup(value: unknown): Record<string, StoryProgress> {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid story backup');
  const entries = Object.entries(value);
  if (entries.length > 60) throw new Error('Too many stories');
  const out: Record<string, StoryProgress> = {};
  for (const [id, raw] of entries) {
    if (!/^S(0[1-9]|10)-Q[1-6]$/.test(id) || !raw || typeof raw !== 'object') throw new Error('Invalid story');
    const p = raw as StoryProgress;
    if (p.storyId !== id || !Number.isInteger(p.page) || !Number.isInteger(p.totalPages)
        || p.page < 0 || p.page >= p.totalPages || p.totalPages > 10000
        || typeof p.updatedAt !== 'string' || !Number.isFinite(Date.parse(p.updatedAt))
        || (p.completedAt !== null && (typeof p.completedAt !== 'string' || !Number.isFinite(Date.parse(p.completedAt))))) throw new Error('Invalid progress');
    out[id] = { storyId: id, page: p.page, totalPages: p.totalPages, updatedAt: p.updatedAt, completedAt: p.completedAt };
    if (Number.isInteger(p.score) && p.score! >= 0 && p.score! <= 3) out[id].score = p.score;
  }
  return out;
}

export function backupSummary(current: { id: string }[], incoming: { id: string }[]) {
  const existing = new Set(current.map(c => c.id));
  const ids = new Set(incoming.filter(c => c && typeof c.id === 'string').map(c => c.id));
  return {
    added: [...ids].filter(id => !existing.has(id)).length,
    matched: [...ids].filter(id => existing.has(id)).length,
    removed: [...existing].filter(id => !ids.has(id)).length,
  };
}
