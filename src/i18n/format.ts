/**
 * Language helpers: locale, digits and number formatting for fa/en.
 */
export type Lang = 'fa' | 'en';

export const LANGS: Lang[] = ['fa', 'en'];
/** New visitors get English (2026-11-24); learners who used the app before keep Persian (see initialLang). */
export const DEFAULT_LANG: Lang = 'en';

/** Key prefix of the signed-in card cache: its presence marks a device that used the app before English became the default. */
export const EXISTING_USER_KEY_PREFIX = 'daf_cards_cache_';

/**
 * The language to start with: the saved choice; otherwise Persian on a device that already holds a learner's data
 * (they used the app when Persian was the default), otherwise English. Kept in step with public/interface-language.js.
 */
export function initialLang(stored: string | null, storageKeys: string[]): Lang {
  if (stored && (LANGS as string[]).includes(stored)) return stored as Lang;
  return storageKeys.some(k => k.startsWith(EXISTING_USER_KEY_PREFIX)) ? 'fa' : DEFAULT_LANG;
}

export const LOCALE: Record<Lang, string> = { fa: 'fa-IR', en: 'en-US' };

export const dirOf = (lang: Lang): 'rtl' | 'ltr' => (lang === 'fa' ? 'rtl' : 'ltr');

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** Format a number with the language's digits and grouping (۱٬۲۳۴ / 1,234). */
export const formatNumber = (lang: Lang, n: number) => n.toLocaleString(LOCALE[lang]);

/** Swap the ASCII digits inside a string (e.g. lesson "01", "A1") for Persian ones in Persian mode. */
export const localizeDigits = (lang: Lang, s: string | number) =>
  lang === 'fa' ? String(s).replace(/[0-9]/g, d => FA_DIGITS[+d]) : String(s);
