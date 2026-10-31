import React, { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { LeitnerCard } from '../types/leitner';
import type { OverdueMove } from '../services/overdueSummary';
import { summarizeOverdueMoves } from '../services/overdueSummary';
import { useI18n } from '../i18n/I18nProvider';
import { Icon3D } from './ui/Icon3D';
import { De, Auto } from './ui/Text';

interface OverdueNoticeProps {
  moves: OverdueMove[];
  cards: LeitnerCard[];
  /** The first explanation also introduces the rule and why it exists */
  firstTime: boolean;
  dueCount: number;
  onClose: () => void;
  onStartReview: () => void;
}

const MAX_EXAMPLES = 8;

/** Explains, once, which cards the nightly overdue rule moved back and why. */
export const OverdueNotice: React.FC<OverdueNoticeProps> = ({ moves, cards, firstTime, dueCount, onClose, onStartReview }) => {
  const { t } = useI18n();
  const o = t.overdue;
  const okRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const summary = useMemo(() => summarizeOverdueMoves(moves), [moves]);
  const byId = useMemo(() => new Map(cards.map(c => [c.id, c])), [cards]);
  const examples = summary.cardIds.map(id => byId.get(id)).filter((c): c is LeitnerCard => !!c).slice(0, MAX_EXAMPLES);

  useEffect(() => {
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button');
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-xs" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="overdue-title"
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl pb-[env(safe-area-inset-bottom)]"
      >
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
          <h3 id="overdue-title" className="flex items-start gap-2 text-base font-bold text-slate-900 dark:text-white">
            <Icon3D name="hourglass" size={40} className="-my-1" />
            <span>{firstTime ? o.titleFirst : o.title}</span>
          </h3>
          <button
            onClick={onClose}
            aria-label={t.common.close}
            className="w-8 h-8 shrink-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          <p>{o.intro(summary.total)}</p>

          <ul className="space-y-1.5">
            {summary.groups.map(g => (
              <li key={`${g.fromBox}-${g.toBox}`} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40">
                <span className="font-semibold text-amber-900 dark:text-amber-200">{o.move(t.boxes.name(g.fromBox), t.boxes.name(g.toBox))}</span>
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300">{o.count(g.count)}</span>
              </li>
            ))}
          </ul>

          {examples.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-slate-500 dark:text-slate-400">{o.examples}</p>
              <div className="flex flex-wrap gap-1.5">
                {examples.map(c => (
                  <span key={c.id} className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {c.type === 'vocab' ? <De>{c.wort}</De> : <Auto>{c.title}</Auto>}
                  </span>
                ))}
                {summary.total > examples.length && <span className="text-xs text-slate-500 self-center">…</span>}
              </div>
            </div>
          )}

          {firstTime && (
            <div className="space-y-1">
              <p className="font-bold text-slate-900 dark:text-white">{o.whyTitle}</p>
              <p>{o.why}</p>
            </div>
          )}

          <div className="space-y-1">
            <p className="font-bold text-slate-900 dark:text-white">{o.ruleTitle}</p>
            <p>{o.rule}</p>
          </div>

          <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">{o.tip}</p>
        </div>

        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <button
            ref={okRef}
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm font-semibold"
          >
            {o.ok}
          </button>
          {dueCount > 0 && (
            <button
              onClick={onStartReview}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold"
            >
              {o.review(dueCount)}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
