/**
 * Silver cards: one collectible fact card per day once the day's correct answers pass SILVER_THRESHOLD (silverLogic.ts). The dashboard widget, the
 * "earned" dialog and the collection. Counting lives in silver.ts / silverLogic.ts.
 */
import React, { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { Dialog, Button } from '../../shared/ui';
import { SILVER_FACTS, SILVER_MAX } from './silverFacts';
import { SILVER_THRESHOLD, collectionSlots } from './silverLogic';
import { getSilver, onSilverChange } from './silver';
import { useI18n } from '../../i18n/I18nProvider';
import { Icon3D } from '../../shared/ui/Icon3D';

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
        <Icon3D name={fact.icon} size={large ? 56 : 40} />
      </div>
      {/* Direction from the interface language: many Persian facts start with a German word */}
      <p dir={lang === 'en' ? 'ltr' : 'rtl'} lang={lang} className={`${large ? 'text-base' : 'text-sm'} leading-relaxed text-start [overflow-wrap:anywhere]`}>
        {lang === 'en' ? fact.en : fact.fa}
      </p>
    </div>
  );
};

/** Shown the moment a silver card is earned. */
export const SilverCardEarned: React.FC<{ index: number; onClose: () => void }> = ({ index, onClose }) => {
  const { t } = useI18n();
  return (
    <Dialog
      onClose={onClose}
      size="md"
      testId="silver-earned"
      title={<><Icon3D name="silver-medal" size={40} className="-my-1" />{t.silver.earnedTitle}</>}
      description={t.silver.earnedBody}
      footer={<Button block data-autofocus onClick={onClose}>{t.silver.continue}</Button>}
    >
      <SilverCardFace index={index} large />
      {index >= SILVER_MAX && <p className="text-sm font-bold text-center text-emerald-700 dark:text-emerald-300">{t.silver.complete}</p>}
    </Dialog>
  );
};

/**
 * All 30 slots: earned cards in full, then the locked ones as small numbered tiles.
 * The scroll lives on a plain block wrapper, never on the grid itself: a height-limited grid shrinks rows
 * whose items clip their overflow (the card face does) down to almost nothing.
 */
export const SilverCollection: React.FC<{ total: number; onClose: () => void }> = ({ total, onClose }) => {
  const { t, num } = useI18n();
  const { earned, locked } = collectionSlots(total, SILVER_MAX);
  return (
    <Dialog
      onClose={onClose}
      size="lg"
      title={t.silver.collectionTitle}
      description={<>{t.silver.count(earned.length, SILVER_MAX)} · {t.silver.howTo}</>}
    >
      {/* The dialog body is the scroll container: a plain block, so the grid below keeps its natural row heights */}
      <div className="space-y-5" data-testid="silver-collection">
        {earned.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="silver-earned-list">
            {earned.map(i => <SilverCardFace key={i} index={i} />)}
          </div>
        )}
        {earned.length >= SILVER_MAX && (
          <p className="text-sm font-bold text-center text-emerald-700 dark:text-emerald-300">{t.silver.complete}</p>
        )}
        {locked.length > 0 && (
          <section className="space-y-2" aria-labelledby="silver-locked-title">
            <h4 id="silver-locked-title" className="text-xs font-bold text-slate-500 dark:text-slate-400">{t.silver.lockedCount(locked.length)}</h4>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))] gap-2" data-testid="silver-locked-list">
              {locked.map(i => (
                <li
                  key={i}
                  aria-label={t.silver.lockedTile(i)}
                  className="h-12 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center gap-0.5 text-slate-400 dark:text-slate-500"
                >
                  <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="font-mono-num text-xs font-semibold" aria-hidden="true">{num(i)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Dialog>
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
          <span className="flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-100"><Icon3D name="silver-medal" size={28} />{t.silver.widgetTitle}</span>
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
