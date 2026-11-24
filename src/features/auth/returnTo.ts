/**
 * Where a guest was reading when they chose to sign in. Google sign-in returns to the site's root, so the story's
 * place (book/story/page) is kept on the device for a short while and put back into the address once signed in.
 */
const KEY = 'daf_return_to';
const MAX_AGE_MS = 60 * 60 * 1000;
const PARAMS = ['book', 'story', 'page'] as const;

export function saveReturnTo(href = window.location.href): void {
  const from = new URL(href).searchParams;
  const keep: Record<string, string> = {};
  for (const k of PARAMS) { const v = from.get(k); if (v !== null) keep[k] = v; }
  try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), params: keep })); } catch { /* storage unavailable */ }
}

/** The saved place as URL parameters (once: it is removed), or null when there is none or it is over an hour old. */
export function takeReturnTo(now = Date.now()): Record<string, string> | null {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); localStorage.removeItem(KEY); } catch { return null; }
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { at?: unknown; params?: unknown };
    if (typeof value.at !== 'number' || now - value.at > MAX_AGE_MS || !value.params || typeof value.params !== 'object') return null;
    const out: Record<string, string> = {};
    for (const k of PARAMS) {
      const v = (value.params as Record<string, unknown>)[k];
      if (typeof v === 'string' && /^[A-Za-z0-9-]{1,12}$/.test(v)) out[k] = v;
    }
    return Object.keys(out).length ? out : null;
  } catch { return null; }
}

/** After sign-in: open Stories at the saved place (the address only; the screen reads it when it opens). */
export function restoreReturnTo(): void {
  const params = takeReturnTo();
  if (!params) return;
  const url = new URL(window.location.href);
  for (const k of PARAMS) url.searchParams.delete(k);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('go', 'stories');
  window.history.replaceState(null, '', url);
}
