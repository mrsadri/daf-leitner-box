import React from 'react';
import type { PluralPart } from '../services/plural';
import { useI18n } from '../i18n/I18nProvider';
import { De } from './ui/Text';

/** Plural form(s) with their dictionary-style pattern ("die Städte  ¨-e") or a label ("singular only"). */
export const PluralInfo: React.FC<{ parts: PluralPart[]; compact?: boolean }> = ({ parts, compact = false }) => {
  const { t } = useI18n();
  return (
    <div className={`flex flex-wrap items-center ${compact ? 'gap-x-3 gap-y-1' : 'gap-x-4 gap-y-1.5'}`}>
      {parts.map((p, i) =>
        p.label ? (
          <span key={i} className="text-slate-600 dark:text-slate-400 italic">{t.plural[p.label]}</span>
        ) : (
          <span key={i} className="inline-flex items-center gap-1.5">
            {p.form && <De className={compact ? 'font-medium text-slate-700 dark:text-slate-300' : 'font-bold text-slate-900 dark:text-white'}>{p.form}</De>}
            {p.pattern && (
              <De
                title={t.plural.patternTitle(p.pattern)}
                className="px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[11px] font-mono-num font-bold"
              >
                {p.pattern}
              </De>
            )}
          </span>
        )
      )}
    </div>
  );
};
