import React from 'react';

/** Author credit. Always German, whatever the interface language. */
export const Credit: React.FC<{ className?: string }> = ({ className = '' }) => (
  <p lang="de" dir="ltr" className={`font-de text-center text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 ${className}`}>
    Diese App wurde von Masih Sadri für die Deutschlernenden des Österreichischen Kulturforums Teheran entworfen und entwickelt.
  </p>
);
