import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fa, Messages } from './fa';
import { en } from './en';
import { Lang, LANGS, DEFAULT_LANG, LOCALE, dirOf, formatNumber, localizeDigits } from './format';

export type { Lang, Messages };

const MESSAGES: Record<Lang, Messages> = { fa, en };
const STORAGE_KEY = 'daf_lang';

function readStoredLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (LANGS as string[]).includes(stored)) return stored as Lang;
  } catch {
    // storage unavailable
  }
  return DEFAULT_LANG;
}

// Module-level mirror of the active language, for code outside React (services, error messages).
let currentLang: Lang = readStoredLang();
export const getLang = () => currentLang;
export const getMessages = () => MESSAGES[currentLang];

function applyToDocument(lang: Lang) {
  const root = document.documentElement;
  root.lang = lang;
  root.dir = dirOf(lang);
  document.title = MESSAGES[lang].app.documentTitle;
}

interface I18nValue {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  t: Messages;
  setLang: (lang: Lang) => void;
  /** Number with the language's digits: ۱۲ / 12 */
  num: (n: number) => string;
  /** Digits inside a string (lesson "01" → "۰۱") */
  digits: (s: string | number) => string;
  /** Localized date/time (Persian mode uses the Persian calendar) */
  date: (iso: string, options?: Intl.DateTimeFormatOptions) => string;
  /** "3 days ago" / "۳ روز پیش" */
  relative: (value: number, unit: Intl.RelativeTimeFormatUnit) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(currentLang);

  useEffect(() => {
    currentLang = lang;
    applyToDocument(lang);
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    currentLang = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage unavailable: the choice still applies for this page load
    }
    setLangState(next);
  }, []);

  const value = useMemo<I18nValue>(() => {
    const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
    return {
      lang,
      dir: dirOf(lang),
      t: MESSAGES[lang],
      setLang,
      num: n => formatNumber(lang, n),
      digits: s => localizeDigits(lang, s),
      date: (iso, options = { dateStyle: 'medium' }) => new Date(iso).toLocaleString(LOCALE[lang], options),
      relative: (v, unit) => rtf.format(v, unit)
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
