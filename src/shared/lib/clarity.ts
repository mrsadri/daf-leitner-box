/**
 * Microsoft Clarity (heatmaps and session recordings) for the live site only.
 *
 * Loaded only when all of these hold, so local dev, demo builds, e2e runs and Vercel previews never call Clarity:
 *   - a production build (not dev, not `--mode demo`);
 *   - the page is served from the production host.
 * The tag is added as an external script (no inline code), so the Content-Security-Policy only needs the
 * Clarity hosts in `script-src` and `connect-src` (see `vercel.json`). Disclosed in `public/privacy.html`.
 */
export const CLARITY_PROJECT_ID = 'zkqji9nfmy';
export const CLARITY_HOSTNAME = 'daf-leitner-box.vercel.app';

export function shouldLoadClarity(env: { prod: boolean; demo: boolean; hostname: string }): boolean {
  return env.prod && !env.demo && env.hostname === CLARITY_HOSTNAME;
}

type ClarityQueue = ((...args: unknown[]) => void) & { q?: unknown[][] };

export function initClarity(): void {
  const demo = import.meta.env.MODE === 'demo' || import.meta.env.VITE_DEMO_MODE === '1';
  if (!shouldLoadClarity({ prod: import.meta.env.PROD, demo, hostname: window.location.hostname })) return;
  const w = window as unknown as { clarity?: ClarityQueue };
  if (w.clarity) return;
  // Same queue the official snippet sets up: calls made before the tag loads are replayed by it.
  const queue: ClarityQueue = (...args: unknown[]) => { (queue.q ??= []).push(args); };
  w.clarity = queue;
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`;
  document.head.appendChild(script);
}
