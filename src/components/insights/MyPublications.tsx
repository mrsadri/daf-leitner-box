import React, { useState } from 'react';
import { Users, EyeOff, Loader2, Globe, Ban, Undo2 } from 'lucide-react';
import { LeitnerCard } from '../../types/leitner';
import { useI18n } from '../../i18n/I18nProvider';
import { Auto } from '../ui/Text';
import { Dialog, CATEGORY_COLORS, MiniAvatar } from './Dialog';
import { MyInsight, isLive, unpublishInsight, reloadMyInsights, useMyInsights } from '../../services/sharedInsights';
import { ShareQuota, shareErrorCode } from '../../services/shareLogic';

interface Props {
  cards: LeitnerCard[];
  quota: ShareQuota | null;
  onChanged: () => void;
  toast: (msg: string) => void;
}

export const QuotaBox: React.FC<{ quota: ShareQuota | null }> = ({ quota }) => {
  const { t, num } = useI18n();
  const s = t.shared;
  return (
    <div className="bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-4 sm:p-5 space-y-3" data-testid="share-quota">
      <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-200">{s.quotaTitle}</h3>
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { label: s.quotaScore, value: quota?.score },
          { label: s.quotaUsed, value: quota ? `${num(quota.used)} / ${num(quota.allowed)}` : undefined },
          { label: s.quotaLeft, value: quota?.remaining }
        ].map(x => (
          <div key={x.label}>
            <span className="block text-[11px] text-indigo-800 dark:text-indigo-300">{x.label}</span>
            <span dir="ltr" className="inline-block text-xl font-bold font-mono-num text-slate-900 dark:text-white">
              {x.value === undefined ? '…' : typeof x.value === 'number' ? num(x.value) : x.value}
            </span>
          </div>
        ))}
      </div>
      {quota && quota.remaining === 0 && (
        <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-300">{s.quotaNext(quota.pointsToNext)}</p>
      )}
      <p className="text-xs text-indigo-900/80 dark:text-indigo-200/80 leading-relaxed">{s.quotaRule}</p>
    </div>
  );
};

export const MyPublications: React.FC<Props> = ({ cards, quota, onChanged, toast }) => {
  const { t, date } = useI18n();
  const s = t.shared;
  const { items, status } = useMyInsights();
  const [confirm, setConfirm] = useState<MyInsight | null>(null);
  const [busy, setBusy] = useState(false);
  const cardIds = new Set(cards.map(c => c.id));

  const unpublish = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await unpublishInsight(confirm.id);
      await reloadMyInsights();
      onChanged();
      toast(s.unpublished);
      setConfirm(null);
    } catch (e) {
      toast(s.errors[shareErrorCode(e)]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="my-publications">
      <QuotaBox quota={quota} />
      <p className="text-xs text-slate-600 dark:text-slate-400">{s.quotaHowTo}</p>

      {status === 'loading' && items.length === 0 && (
        <div className="flex justify-center py-8 text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>
      )}
      {status === 'error' && <p className="text-xs text-red-700 dark:text-red-400">{s.loadError}</p>}
      {status === 'ready' && items.length === 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-sm text-slate-600 dark:text-slate-400">
          {s.publishedEmpty}
        </div>
      )}

      <div className="space-y-3">
        {items.map(m => {
          const live = isLive(m);
          return (
            <article key={m.id} data-testid="my-publication" className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 space-y-3 ${live ? 'border-indigo-200 dark:border-indigo-800' : 'border-slate-200 dark:border-slate-800 opacity-80'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className={`px-2 py-0.5 rounded-md font-semibold border ${CATEGORY_COLORS[m.category]}`}>{t.categories[m.category]}</span>
                <span className="text-slate-500 dark:text-slate-400">{s.publishedOn(date(m.publishedAt))}</span>
              </div>
              <Auto as="h3" className="block font-bold text-base text-slate-900 dark:text-white break-words [overflow-wrap:anywhere] text-start">{m.title}</Auto>

              <p className={`flex items-center gap-1.5 text-xs font-semibold ${
                m.removedAt ? 'text-red-700 dark:text-red-400' : m.hidden ? 'text-amber-700 dark:text-amber-400' : live ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
              }`} data-testid="publication-status">
                {m.removedAt ? <Ban className="w-4 h-4" /> : m.hidden ? <EyeOff className="w-4 h-4" /> : live ? <Globe className="w-4 h-4" /> : <Undo2 className="w-4 h-4" />}
                <span>
                  {m.removedAt ? s.statusRemoved(date(m.removedAt)) : m.hidden ? s.statusHidden : live ? s.statusLive : s.statusUnpublished(date(m.unpublishedAt!))}
                </span>
              </p>

              {live && (
                <div className="space-y-2" data-testid="adopters">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <Users className="w-4 h-4" />
                    <span>{s.adoptersTitle}</span>
                    <span className="text-slate-500 font-normal">({s.inBoxes(m.adopters.length)})</span>
                  </p>
                  {m.adopters.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">{s.adoptersNone}</p>
                  ) : (
                    <ul className="flex flex-wrap gap-1.5">
                      {m.adopters.map((a, i) => (
                        <li key={`${a.at}-${i}`} className="flex items-center gap-1.5 ps-1 pe-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300">
                          <MiniAvatar name={a.name} url={a.avatar} />
                          <Auto>{a.name ?? s.anonymous}</Auto>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {live && !cardIds.has(m.sourceCardId) && <p className="text-xs text-slate-500 dark:text-slate-400">{s.sourceGone}</p>}

              {live && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                  <button
                    onClick={() => setConfirm(m)}
                    data-testid="unpublish"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                  >
                    <Undo2 className="w-4 h-4" />{s.unpublish}
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {confirm && (
        <Dialog
          title={s.unpublishTitle}
          testId="unpublish-dialog"
          busy={busy}
          confirmLabel={s.unpublishConfirm}
          onClose={() => setConfirm(null)}
          onConfirm={() => void unpublish()}
        >
          <Auto as="p" className="block font-bold text-slate-900 dark:text-white [overflow-wrap:anywhere]">{confirm.title}</Auto>
          <p>{s.unpublishBody(confirm.adopters.length)}</p>
        </Dialog>
      )}
    </div>
  );
};
