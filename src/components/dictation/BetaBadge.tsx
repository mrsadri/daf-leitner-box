import React from 'react';
import { useI18n } from '../../i18n/I18nProvider';

export const BetaBadge: React.FC = () => {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 align-middle">
      {t.dictation.beta}
    </span>
  );
};
