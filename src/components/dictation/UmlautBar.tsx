import React, { useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';

interface Props {
  onInsert: (ch: string) => void;
}

/**
 * ä ö ü ß buttons. The buttons never take focus (onMouseDown and onPointerDown call preventDefault), so the keyboard
 * stays open on phones. The order is fixed left to right in both text directions: these are letters, not controls.
 */
export const UmlautBar: React.FC<Props> = ({ onInsert }) => {
  const { t } = useI18n();
  const [upper, setUpper] = useState(false);
  const letters = upper ? ['Ä', 'Ö', 'Ü'] : ['ä', 'ö', 'ü', 'ß'];
  const keep = (e: React.SyntheticEvent) => e.preventDefault();
  return (
    <div dir="ltr" className="flex items-center gap-2" role="group" aria-label="ä ö ü ß">
      {letters.map(ch => (
        <button
          key={ch}
          type="button"
          lang="de"
          aria-label={t.dictation.stage.umlaut(ch)}
          onMouseDown={keep}
          onPointerDown={keep}
          onClick={() => onInsert(ch)}
          className="min-w-11 h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-lg font-semibold text-slate-800 dark:text-slate-100 active:scale-95 focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          {ch}
        </button>
      ))}
      <button
        type="button"
        aria-label={t.dictation.stage.shift}
        aria-pressed={upper}
        onMouseDown={keep}
        onPointerDown={keep}
        onClick={() => setUpper(u => !u)}
        className={`min-w-11 h-11 px-3 rounded-lg border text-sm font-bold focus-visible:ring-2 focus-visible:ring-indigo-500 ${
          upper ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800'
        }`}
      >
        ⇧
      </button>
    </div>
  );
};
