/**
 * Conjugation tables (Präsens, Präteritum, Perfekt) for a verb, with irregular parts marked, and the button that opens them.
 */
import React, { useRef, useState } from 'react';
import { Table2 } from 'lucide-react';
import { Dialog, Badge, type BadgeTone } from '../ui';
import { Conjugation, ConjugatedForm, PRONOUNS } from './conjugation';
import { useI18n } from '../../i18n/I18nProvider';
import { De } from '../ui/Text';

const TENSES = [
  { key: 'praesens', label: 'Präsens' },
  { key: 'praeteritum', label: 'Präteritum' },
  { key: 'perfekt', label: 'Perfekt' }
] as const;

const KIND_TONE: Record<Conjugation['kind'], BadgeTone> = { regular: 'success', irregular: 'danger', mixed: 'warning' };

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

interface ConjugationDialogProps {
  verb: string;
  conjugation: Conjugation;
  onClose: () => void;
}

/** Conjugation tables in a dialog (bottom sheet on phones). */
export const ConjugationDialog: React.FC<ConjugationDialogProps> = ({ verb, conjugation, onClose }) => {
  const { t } = useI18n();
  return (
    <Dialog
      onClose={onClose}
      size="lg"
      testId="conjugation-dialog"
      title={<span className="flex flex-wrap items-center gap-2">
        <Table2 className="w-5 h-5 text-indigo-600 shrink-0" />
        <span>{t.conjugation.title}:</span>
        <De className="text-lg">{verb}</De>
        <Badge tone={KIND_TONE[conjugation.kind]}>{t.conjugation.kind[conjugation.kind]}</Badge>
      </span>}
      description={t.conjugation.kindHint[conjugation.kind]}
    >
      <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3" dir="ltr" lang="de">
            {TENSES.map(({ key, label }) => (
              <section key={key} className="rounded-card border border-slate-200 dark:border-slate-800 overflow-hidden">
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
    </Dialog>
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
