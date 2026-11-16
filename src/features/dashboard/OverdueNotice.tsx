/**
 * Explains once which cards the nightly overdue rule moved back, and why.
 */
import React, { useMemo } from 'react';
import { Dialog, Button } from '../../shared/ui';
import type { LeitnerCard } from '../../core/types';
import type { OverdueMove } from './overdueSummary';
import { summarizeOverdueMoves } from './overdueSummary';
import { useI18n } from '../../i18n/I18nProvider';
import { Icon3D } from '../../shared/ui/Icon3D';
import { De, Auto } from '../../shared/ui/Text';

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
  const summary = useMemo(() => summarizeOverdueMoves(moves), [moves]);
  const byId = useMemo(() => new Map(cards.map(c => [c.id, c])), [cards]);
  const examples = summary.cardIds.map(id => byId.get(id)).filter((c): c is LeitnerCard => !!c).slice(0, MAX_EXAMPLES);

  return (
    <Dialog
      onClose={onClose}
      size="md"
      testId="overdue-notice"
      title={<><Icon3D name="hourglass" size={40} className="-my-1" /><span>{firstTime ? o.titleFirst : o.title}</span></>}
      footer={<>
        <Button variant="secondary" onClick={onClose} data-autofocus>{o.ok}</Button>
        {dueCount > 0 && <Button onClick={onStartReview}>{o.review(dueCount)}</Button>}
      </>}
    >
      <div className="space-y-4 leading-relaxed">
          <p>{o.intro(summary.total)}</p>
          <ul className="space-y-1.5">
            {summary.groups.map(g => (
              <li key={`${g.fromBox}-${g.toBox}`} className="flex items-center justify-between gap-3 px-3 py-2 rounded-control bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40">
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

    </Dialog>
  );
};
