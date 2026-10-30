import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Lock, X } from 'lucide-react';
import { SILVER_FACTS, SILVER_MAX } from '../data/silverFacts';
import { SILVER_THRESHOLD } from '../services/silverLogic';
import { getSilver, onSilverChange } from '../services/silver';
import { useI18n } from '../i18n/I18nProvider';

const SILVER_FACE = 'bg-gradient-to-br from-slate-100 via-white to-slate-300 dark:from-slate-700 dark:via-slate-800 dark:to-slate-600 border border-slate-300 dark:border-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]';

/** One silver card: number, emoji and the fact in the interface language. */
export const SilverCardFace: React.FC<{ index: number; large?: boolean }> = ({ index, large = false }) => {
  const { t, lang } = useI18n();
  const fact = SILVER_FACTS[index - 1];
  if (!fact) return null;
  return (
    <div className={`relative rounded-2xl ${SILVER_FACE} ${large ? 'p-5 sm:p-6' : 'p-4'} text-slate-800 dark:text-slate-100 overflow-hidden`}>
      <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-300 mb-2">
        <span>{t.silver.numberOf(index, SILVER_MAX)}</span>
        <span aria-hidden="true" className={large ? 'text-3xl' : 'text-xl'}>{fact.emoji}</span>
      </div>
      {/* Direction from the interface language: many Persian facts start with a German word */}
      <p dir={lang === 'en' ? 'ltr' : 'rtl'} lang={lang} className={`${large ? 'text-base' : 'text-sm'} leading-relaxed text-start [overflow-wrap:anywhere]`}>
        {lang === 'en' ? fact.en : fact.fa}
      </p>
    </div>
  );
};

/** Shared modal frame (Esc, click outside, focus kept inside, review shortcuts blocked behind it). */
const Modal: React.FC<{ labelledBy: string; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ labelledBy, onClose, children, wide }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Tab' && ref.current) {
        const focusable = ref.current.querySelectorAll<HTMLElement>('button');
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
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={e => e.stopPropagation()}
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl w-full ${wide ? 'max-w-3xl' : 'max-w-md'} max-h-[90vh] flex flex-col shadow-2xl pb-[env(safe-area-inset-bottom)]`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};

/** Shown the moment a silver card is earned. */
export const SilverCardEarned: React.FC<{ index: number; onClose: () => void }> = ({ index, onClose }) => {
  const { t } = useI18n();
  return (
    <Modal labelledBy="silver-earned-title" onClose={onClose}>
      <div className="p-5 sm:p-6 space-y-4 overflow-y-auto" data-testid="silver-earned">
        <div className="text-center space-y-1">
          <h3 id="silver-earned-title" className="text-lg font-bold text-slate-900 dark:text-white">{t.silver.earnedTitle}</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">{t.silver.earnedBody}</p>
        </div>
        <SilverCardFace index={index} large />
        {index >= SILVER_MAX && <p className="text-sm font-bold text-center text-emerald-700 dark:text-emerald-300">{t.silver.complete}</p>}
        <button
          data-autofocus
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold"
        >
          {t.silver.continue}
        </button>
      </div>
    </Modal>
  );
};

/** All 30 slots: earned cards with their fact, the rest locked. */
export const SilverCollection: React.FC<{ total: number; onClose: () => void }> = ({ total, onClose }) => {
  const { t, num } = useI18n();
  return (
    <Modal labelledBy="silver-collection-title" onClose={onClose} wide>
      <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
        <div>
          <h3 id="silver-collection-title" className="text-base font-bold text-slate-900 dark:text-white">{t.silver.collectionTitle}</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">{t.silver.count(total, SILVER_MAX)} · {t.silver.howTo}</p>
        </div>
        <button data-autofocus onClick={onClose} aria-label={t.common.close} className="w-8 h-8 shrink-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4 sm:p-5 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="silver-collection">
        {Array.from({ length: SILVER_MAX }, (_, i) => i + 1).map(i =>
          i <= total ? (
            <SilverCardFace key={i} index={i} />
          ) : (
            <div key={i} className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-4 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
              <Lock className="w-4 h-4 shrink-0" />
              <span className="font-mono-num">{num(i)}</span>
              <span>{t.silver.locked}</span>
            </div>
          )
        )}
      </div>
    </Modal>
  );
};

/** Dashboard block: collection count, today's progress towards the next card, collection button. */
export const SilverWidget: React.FC = () => {
  const { t, num } = useI18n();
  const [s, setS] = useState(getSilver);
  const [open, setOpen] = useState(false);
  useEffect(() => onSilverChange(() => setS(getSilver())), []);
  const need = SILVER_THRESHOLD + 1;
  const complete = s.total >= SILVER_MAX;
  const progress = Math.min(need, s.correctToday);

  return (
    <div className={`rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${SILVER_FACE}`} data-testid="silver-widget">
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">🥈 {t.silver.widgetTitle}</span>
          <span className="text-lg font-extrabold font-mono-num text-slate-900 dark:text-white">{t.silver.count(s.total, SILVER_MAX)}</span>
        </div>
        {complete ? (
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{t.silver.complete}</p>
        ) : s.earnedToday ? (
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{t.silver.todayEarned}</p>
        ) : (
          <div className="space-y-1">
            <p className="text-xs text-slate-600 dark:text-slate-300">{t.silver.todayProgress(progress, need)}</p>
            <div className="h-1.5 w-48 max-w-full rounded-full bg-slate-300/70 dark:bg-slate-600 overflow-hidden" aria-hidden="true">
              <div className="h-full bg-slate-500 dark:bg-slate-300 rounded-full transition-all" style={{ width: `${(progress / need) * 100}%` }} />
            </div>
          </div>
        )}
        {s.total === 0 && <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{t.silver.howTo}</p>}
      </div>
      <button
        onClick={() => setOpen(true)}
        className="self-start sm:self-auto shrink-0 px-4 py-2 rounded-xl bg-white/80 hover:bg-white dark:bg-slate-900/60 dark:hover:bg-slate-900 border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-800 dark:text-slate-100"
      >
        {t.silver.collection} ({num(s.total)})
      </button>
      {open && <SilverCollection total={s.total} onClose={() => setOpen(false)} />}
    </div>
  );
};
