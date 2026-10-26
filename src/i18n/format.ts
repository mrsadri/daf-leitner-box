export type Lang = 'fa' | 'en';

export const LANGS: Lang[] = ['fa', 'en'];
export const DEFAULT_LANG: Lang = 'fa';

export const LOCALE: Record<Lang, string> = { fa: 'fa-IR', en: 'en-US' };

export const dirOf = (lang: Lang): 'rtl' | 'ltr' => (lang === 'fa' ? 'rtl' : 'ltr');

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** Format a number with the language's digits and grouping (۱٬۲۳۴ / 1,234). */
export const formatNumber = (lang: Lang, n: number) => n.toLocaleString(LOCALE[lang]);

/** Swap the ASCII digits inside a string (e.g. lesson "01", "A1") for Persian ones in Persian mode. */
export const localizeDigits = (lang: Lang, s: string | number) =>
  lang === 'fa' ? String(s).replace(/[0-9]/g, d => FA_DIGITS[+d]) : String(s);
