/** Footer: app name, the method in one line each, and the credit for the 3D icons (required by their licence). */
import React from 'react';
import { useI18n } from '../i18n/I18nProvider';

export const AppFooter: React.FC = () => {
  const { t } = useI18n();
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 py-6 text-xs text-slate-600 dark:text-slate-400">
      <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center md:justify-between gap-3 text-center md:text-start">
        <div className="dot-list flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <span className="font-bold text-slate-800 dark:text-slate-200">{t.app.footerName}</span>
          <span>{t.app.footerBook}</span>
        </div>
        <div className="dot-list flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <span>{t.app.footerFormula}</span>
          <span>{t.app.footerDrop}</span>
          <span>{t.app.footerCloud}</span>
          <a href="https://www.thiings.co" target="_blank" rel="noopener noreferrer" lang="de" className="underline underline-offset-2 hover:text-slate-800 dark:hover:text-slate-200">3D-Icons: thiings.co</a>
        </div>
      </div>
    </footer>
  );
};
