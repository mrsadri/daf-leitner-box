import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Table2, X } from 'lucide-react';
import { Conjugation, ConjugatedForm, PRONOUNS } from '../services/conjugation';
import { useI18n } from '../i18n/I18nProvider';
import { De } from './ui/Text';

const TENSES = [
  { key: 'praesens', label: 'Präsens' },
  { key: 'praeteritum', label: 'Präteritum' },
  { key: 'perfekt', label: 'Perfekt' }
] as const;

const KIND_STYLE = {
  regular: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  irregular: 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  mixed: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
};

const Form: React.FC<{ form: ConjugatedForm }> = ({ form }) => (
  <>
    {form.segments.map((s, i) =>
      s.irregular ? (
        <span key={i} className="text-red-600 dark:text-red-400 font-extrabold">{s.text}</span>
      ) : (
        <React.Fragment key={i}>{s.text}</React.Fragment>
      )
    )}
  </>
);

interface DialogProps {
  verb: string;
  conjugation: Conjugation;
  onClose: () => void;
}

/** Conjugation tables in a modal (bottom sheet on phones). Esc or a click outside closes it. */
export const ConjugationDialog: React.FC<DialogProps> = ({ verb, conjugation, onClose }) => {
  const { t } = useI18n();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Tab' && dialogRef.current) {
        // Keep focus inside the dialog
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])');
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
      // Review shortcuts (Space, 1, 2) must not fire behind the dialog
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="conjugation-title"
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <h3 id="conjugation-title" className="flex flex-wrap items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
              <Table2 className="w-5 h-5 text-indigo-600 shrink-0" />
              <span>{t.conjugation.title}:</span>
              <De className="text-lg">{verb}</De>
              <span className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${KIND_STYLE[conjugation.kind]}`}>
                {t.conjugation.kind[conjugation.kind]}
              </span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">{t.conjugation.kindHint[conjugation.kind]}</p>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label={t.common.close}
            className="w-8 h-8 shrink-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3" dir="ltr" lang="de">
            {TENSES.map(({ key, label }) => (
              <section key={key} className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <h4 className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 text-xs font-bold text-slate-700 dark:text-slate-200 font-de">{label}</h4>
                <table className="w-full text-sm font-de">
                  <tbody>
                    {conjugation[key].map(form => (
                      <tr key={form.person} className="border-t border-slate-100 dark:border-slate-800 first:border-t-0">
                        <th scope="row" className="py-1.5 ps-3 pe-2 text-start font-normal text-slate-500 dark:text-slate-400 whitespace-nowrap align-top w-0">
                          {PRONOUNS[form.person]}
                        </th>
                        <td className="py-1.5 pe-3 font-semibold text-slate-900 dark:text-white">
                          <Form form={form} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
          {conjugation.kind !== 'regular' && (
            <p className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <span className="text-red-600 dark:text-red-400 font-extrabold font-de" dir="ltr">ä</span>
              {t.conjugation.legend}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

/** "Conjugation" button that opens the dialog; returns focus to itself when the dialog closes. */
export const ConjugationButton: React.FC<{ verb: string; conjugation: Conjugation | null; disabled?: boolean; className?: string }> = ({
  verb,
  conjugation,
  disabled = false,
  className = ''
}) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  if (!conjugation) return null;
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        title={disabled ? t.conjugation.locked : undefined}
        onClick={e => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        <Table2 className="w-4 h-4" />
        <span>{t.conjugation.button}</span>
      </button>
      {open && (
        <ConjugationDialog
          verb={verb}
          conjugation={conjugation}
          onClose={() => {
            setOpen(false);
            requestAnimationFrame(() => buttonRef.current?.focus());
          }}
        />
      )}
    </>
  );
};
