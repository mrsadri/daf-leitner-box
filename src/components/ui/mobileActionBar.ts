import { useCallback, useRef } from 'react';

/**
 * Phones: a session's action buttons stay fixed at the bottom of the screen at all times.
 * Bottom padding clears the home indicator of the installed app. Wide screens keep the normal flow.
 */
export const MOBILE_ACTION_BAR =
  'max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-20 max-sm:m-0 ' +
  'max-sm:ps-[max(1rem,env(safe-area-inset-left))] max-sm:pe-[max(1rem,env(safe-area-inset-right))] ' +
  'max-sm:pt-3 max-sm:pb-[calc(0.75rem+env(safe-area-inset-bottom))] ' +
  'max-sm:bg-slate-50/95 max-sm:dark:bg-slate-950/95 max-sm:backdrop-blur-sm max-sm:border-t max-sm:border-slate-200 max-sm:dark:border-slate-800';

/**
 * Callback ref for the element carrying MOBILE_ACTION_BAR. While that element is in the page, the body gets
 * bottom padding of the bar's height (see `body.has-action-bar` in index.css), so the end of the card and the
 * footer can scroll clear of the fixed bar. A callback ref (not an effect) because sessions render the bar
 * only on some screens, e.g. not on the "session finished" screen.
 */
export function useMobileActionBar<T extends HTMLElement>() {
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
