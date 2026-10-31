import { useCallback, useRef } from 'react';

/**
 * A session's action buttons stay fixed at the bottom of the screen at all times (phones and desktop).
 * Bottom padding clears the home indicator of the installed app.
 */
export const FIXED_ACTION_BAR =
  'fixed inset-x-0 bottom-0 z-20 m-0 ' +
  'ps-[max(1rem,env(safe-area-inset-left))] pe-[max(1rem,env(safe-area-inset-right))] ' +
  'pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] ' +
  'bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800';

/**
 * Callback ref for the element carrying FIXED_ACTION_BAR. While that element is in the page, the body gets
 * bottom padding of the bar's height (see `body.has-action-bar` in index.css), so the end of the card and the
 * footer can scroll clear of the fixed bar. A callback ref (not an effect) because sessions render the bar
 * only on some screens, e.g. not on the "session finished" screen.
 */
export function useFixedActionBar<T extends HTMLElement>() {
  const cleanup = useRef<(() => void) | null>(null);
  return useCallback((el: T | null) => {
    cleanup.current?.();
    cleanup.current = null;
    if (!el) return;
    const body = document.body;
    const update = () => body.style.setProperty('--action-bar-h', `${el.offsetHeight}px`);
    update();
    body.classList.add('has-action-bar');
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(el);
    cleanup.current = () => {
      observer?.disconnect();
      body.classList.remove('has-action-bar');
      body.style.removeProperty('--action-bar-h');
    };
  }, []);
}
