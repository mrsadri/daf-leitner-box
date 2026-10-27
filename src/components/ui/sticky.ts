/**
 * Phones: keep a session's action buttons in reach at the bottom of the screen while a long card scrolls.
 * The bar must be the last element of its container. Bottom padding clears the home indicator of the installed app.
 * The negative margin matches the page's side padding (px-4 on <main>).
 */
export const MOBILE_STICKY_ACTIONS =
  'max-sm:sticky max-sm:bottom-0 max-sm:z-10 max-sm:-mx-4 max-sm:px-4 max-sm:pt-3 max-sm:pb-[calc(0.75rem+env(safe-area-inset-bottom))] ' +
  'max-sm:bg-slate-50/95 max-sm:dark:bg-slate-950/95 max-sm:backdrop-blur-sm max-sm:border-t max-sm:border-slate-200 max-sm:dark:border-slate-800';
