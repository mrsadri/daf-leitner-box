import React from 'react';
import { Languages } from 'lucide-react';
import { useI18n, Lang } from '../../i18n/I18nProvider';

const OPTIONS: { lang: Lang; label: string }[] = [
  { lang: 'fa', label: 'فارسی' },
  { lang: 'en', label: 'English' }
];

/** Segmented FA / EN control. Each label is written in its own language and direction. */
export const LanguageSwitch: React.FC<{ compact?: boolean; className?: string }> = ({ compact = false, className = '' }) => {
  const { lang, setLang, t } = useI18n();
  return (
    <div
      role="radiogroup"
      aria-label={t.common.language}
      className={`inline-flex items-center gap-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold ${className}`}
    >
      {!compact && <Languages className="w-4 h-4 mx-1.5 text-slate-500 dark:text-slate-400" aria-hidden="true" />}
      {OPTIONS.map(o => (
        <button
          key={o.lang}
          type="button"
          role="radio"
          aria-checked={lang === o.lang}
          lang={o.lang}
          dir={o.lang === 'fa' ? 'rtl' : 'ltr'}
          onClick={() => setLang(o.lang)}
          className={`rounded-md px-2.5 py-1 transition-colors ${
            lang === o.lang
              ? 'bg-white dark:bg-slate-950 text-indigo-700 dark:text-indigo-300 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {compact ? (o.lang === 'fa' ? 'فا' : 'EN') : o.label}
        </button>
      ))}
    </div>
  );
};
