export type StoryView = { kind: 'shelf' } | { kind: 'book'; n: number } | { kind: 'read'; n: number; storyId: string; continueAt?: number };

export function readStoryLocation(href: string): StoryView {
  const params = new URL(href).searchParams;
  const n = Number(params.get('book'));
  if (!Number.isInteger(n) || n < 1 || n > 10) return { kind: 'shelf' };
  const storyId = params.get('story');
  if (!storyId || !/^S\d{2}-Q[1-6]$/.test(storyId)) return { kind: 'book', n };
  const page = Number(params.get('page'));
  return { kind: 'read', n, storyId, continueAt: Number.isInteger(page) && page >= 0 && page < 1000 ? page : 0 };
}

export function writeStoryLocation(view: StoryView, replace = false): void {
  const url = new URL(window.location.href);
  for (const key of ['book', 'story', 'page']) url.searchParams.delete(key);
  if (view.kind !== 'shelf') url.searchParams.set('book', String(view.n));
  if (view.kind === 'read') {
    url.searchParams.set('story', view.storyId);
    if (view.continueAt) url.searchParams.set('page', String(view.continueAt));
  }
  if (url.href !== window.location.href) window.history[replace ? 'replaceState' : 'pushState'](null, '', url);
}
