import React from 'react';
import { useI18n } from '../../i18n/I18nProvider';

/**
 * Author credit and independence note. The German lines are always shown, whatever the interface
 * language; the translation of the note follows in the interface language. This is a volunteer
 * project, so it must never read as an official product of the Cultural Forum or the embassy.
 */
export const Credit: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t, lang } = useI18n();
  return (
    <div className={`text-center text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 space-y-1 ${className}`} data-testid="credit">
      <p lang="de" dir="ltr" className="font-de">
        Diese App wurde von Masih Sadri für die Deutschlernenden des Österreichischen Kulturforums Teheran entworfen und entwickelt.
      </p>
      <p lang="de" dir="ltr" className="font-de font-semibold">
        Unabhängiges, ehrenamtliches Projekt – kein offizielles Angebot des Österreichischen Kulturforums oder der Österreichischen Botschaft.
      </p>
      <p lang={lang} className="opacity-90">{t.app.independence}</p>
    </div>
  );
};

/** Thin red-white-red band (decoration in the national colours; not the flag, no emblem). */
export const AustriaStripe: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div aria-hidden="true" className={`austria-stripe ${className}`} />
);
