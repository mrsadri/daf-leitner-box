import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle, AlertCircle, PencilLine, Lightbulb } from 'lucide-react';
import { checkPerfekt, PerfektResult } from '../services/perfekt';
import { useI18n } from '../i18n/I18nProvider';
import { De } from './ui/Text';
import type { PerfektGuide } from '../services/perfektGuide';
import { PerfektHint, PerfektExplanation } from './PerfektGuide';

interface PerfektQuizProps {
  /** Accepted answers, e.g. ["ist gerudert", "hat gerudert"] */
  accepted: string[];
  /** Called once the answer is graded (not for "missing auxiliary", which only asks for a retry) */
  onGraded: (result: PerfektResult) => void;
  /** Practice: no effect on the card's box (new-words session) */
  practice?: boolean;
  /** How the verb forms its Perfekt: a hint button before answering, the explanation after (beginner boxes) */
  guide?: PerfektGuide | null;
}

const UMLAUTS = ['ä', 'ö', 'ü', 'ß'];

/** "ist gekommen" with the auxiliary emphasised. */
const PerfektForm: React.FC<{ value: string }> = ({ value }) => {
  const [aux, ...rest] = value.split(' ');
  return (
    <De className="font-bold">
      <span className="text-indigo-700 dark:text-indigo-300">{aux}</span> {rest.join(' ')}
    </De>
  );
};

/**
 * Typing quiz for a verb's Perfekt. Grades once: after a graded answer the field is locked
 * and the parent decides what happens to the card. Remount (key) for the next card.
 */
export const PerfektQuiz: React.FC<PerfektQuizProps> = ({ accepted, onGraded, practice = false, guide = null }) => {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [result, setResult] = useState<PerfektResult | null>(null);
  const [needsAux, setNeedsAux] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);

  // Focus the field on devices with a keyboard; on phones the on-screen keyboard would cover the card
  useEffect(() => {
    if (window.matchMedia?.('(pointer: fine)').matches) inputRef.current?.focus({ preventScroll: true });
  }, []);

  const graded = result !== null;

  const submit = () => {
    if (graded || !value.trim()) return;
    const r = checkPerfekt(value, accepted);
    if (r.verdict === 'missingAux') {
      setNeedsAux(true);
      inputRef.current?.focus();
      return;
    }
    setNeedsAux(false);
    setResult(r);
    onGraded(r);
  };

  const insert = (ch: string) => {
    const el = inputRef.current;
    if (!el || graded) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + ch + value.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + ch.length, start + ch.length);
    });
  };

  const others = result ? accepted.filter(a => a !== result.expected) : [];

  return (
    <div
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-2xs"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <label htmlFor="perfekt-input" className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
          <PencilLine className="w-4 h-4 text-indigo-600 shrink-0" />
          {t.perfekt.label}
        </label>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">{practice ? t.perfekt.practice : t.perfekt.hint}</span>
      </div>

      <form
        className="flex gap-2"
        onSubmit={e => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          ref={inputRef}
          id="perfekt-input"
          type="text"
          dir="ltr"
          lang="de"
          value={value}
          onChange={e => {
            setValue(e.target.value);
            setNeedsAux(false);
          }}
          disabled={graded}
          placeholder={t.perfekt.placeholder}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="done"
          aria-invalid={result ? !result.correct : undefined}
          aria-describedby="perfekt-feedback"
          className={`flex-1 min-w-0 px-3.5 py-2.5 text-base font-de bg-slate-50 dark:bg-slate-800 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-80 ${
            result ? (result.correct ? 'border-emerald-400 dark:border-emerald-700' : 'border-red-400 dark:border-red-700') : 'border-slate-200 dark:border-slate-700'
          }`}
        />
        <button
          type="submit"
          disabled={graded || !value.trim()}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors shrink-0"
        >
          {t.perfekt.check}
        </button>
      </form>

      {!graded && (
        <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5" dir="ltr">
          {UMLAUTS.map(ch => (
            <button
              key={ch}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => insert(ch)}
              title={t.perfekt.insert(ch)}
              aria-label={t.perfekt.insert(ch)}
              className="w-9 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-de text-sm font-semibold"
            >
              {ch}
            </button>
          ))}
        </div>
        {guide && (
          <button
            type="button"
            onClick={() => setHintOpen(o => !o)}
            aria-expanded={hintOpen}
            className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold transition-colors ${
              hintOpen ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200' : 'bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 dark:text-amber-300'
            }`}
          >
            <Lightbulb className="w-4 h-4" />
            {t.perfektGuide.hint}
          </button>
        )}
        </div>
      )}

      {!graded && guide && hintOpen && <PerfektHint guide={guide} />}

      <div id="perfekt-feedback" aria-live="polite">
        {needsAux && (
          <p className="flex items-start gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {t.perfekt.missingAux}
          </p>
        )}

        {result && (
          <div
            className={`p-3 rounded-xl border text-sm space-y-1 ${
              result.correct
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
            }`}
          >
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              {result.correct ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
              <span className="font-semibold">
                {result.verdict === 'correct' ? t.perfekt.correct
                  : result.verdict === 'almost' ? t.perfekt.almost
                  : result.verdict === 'wrongAux' ? t.perfekt.wrongAux
                  : t.perfekt.wrong}
              </span>
              {result.verdict !== 'correct' && <PerfektForm value={result.expected} />}
            </p>
            {result.missingSich && <p className="text-xs">{t.perfekt.missingSich}</p>}
            {others.length > 0 && (
              <p className="text-xs flex flex-wrap items-center gap-x-1.5">
                <span>{t.perfekt.alsoCorrect}</span>
                {others.map(o => <PerfektForm key={o} value={o} />)}
              </p>
            )}
          </div>
        )}
      </div>

      {graded && guide && <PerfektExplanation guide={guide} />}
    </div>
  );
};
