import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Check, Flag, Loader2, RefreshCw, Users, AlertTriangle } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { Auto } from '../ui/Text';
import { Icon3D } from '../ui/Icon3D';
import { Dialog, CATEGORY_COLORS, MiniAvatar } from './Dialog';
import { PublicInsight, PAGE_SIZE, fetchPublicInsights, adoptInsight, reportInsight } from '../../services/sharedInsights';
import { shareErrorCode } from '../../services/shareLogic';

const NOTICE_KEY = 'daf_share_add_notice_v1';
const noticeDone = () => { try { return localStorage.getItem(NOTICE_KEY) === '1'; } catch { return false; } };
const markNoticeDone = () => { try { localStorage.setItem(NOTICE_KEY, '1'); } catch { /* private mode */ } };

interface Props {
  onCardAdded: () => void;
  toast: (msg: string) => void;
}

/** Cards other people made public: add to your box, report. */
export const PublicInsightsList: React.FC<Props> = ({ onCardAdded, toast }) => {
  const { t, date } = useI18n();
  const s = t.shared;
  const [items, setItems] = useState<PublicInsight[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noticeFor, setNoticeFor] = useState<PublicInsight | null>(null);
  const [reportFor, setReportFor] = useState<PublicInsight | null>(null);
  const [reason, setReason] = useState('');
  const [reporting, setReporting] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const rows = await fetchPublicInsights();
      setItems(rows);
      setHasMore(rows.length === PAGE_SIZE);
      setStatus('ready');
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const loadMore = async () => {
    const last = items[items.length - 1];
    if (!last) return;
    setLoadingMore(true);
    try {
      const rows = await fetchPublicInsights(last.publishedAt);
      setItems(prev => [...prev, ...rows.filter(r => !prev.some(p => p.id === r.id))]);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (e) {
      toast(s.errors[shareErrorCode(e)]);
    } finally {
      setLoadingMore(false);
    }
  };

  const patch = (id: string, change: Partial<PublicInsight>) =>
    setItems(prev => prev.map(r => (r.id === id ? { ...r, ...change } : r)));

  const add = async (item: PublicInsight) => {
    setBusyId(item.id);
    try {
      await adoptInsight(item.id);
      patch(item.id, { iHave: true, adopters: item.iHave ? item.adopters : item.adopters + 1 });
      onCardAdded();
      toast(s.addedToast);
    } catch (e) {
      const code = shareErrorCode(e);
      toast(s.errors[code]);
      if (code === 'not_public') setItems(prev => prev.filter(r => r.id !== item.id));
    } finally {
      setBusyId(null);
    }
  };

  const onAdd = (item: PublicInsight) => {
    if (noticeDone()) void add(item);
    else setNoticeFor(item);
  };

  const sendReport = async () => {
    if (!reportFor) return;
    setReporting(true);
    try {
      await reportInsight(reportFor.id, reason.trim());
      patch(reportFor.id, { iReported: true });
      toast(s.reportedToast);
      setReportFor(null);
      setReason('');
    } catch (e) {
      toast(s.errors[shareErrorCode(e)]);
    } finally {
      setReporting(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="public-insights">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex items-start gap-3">
        <Icon3D name="handshake" size={44} className="-my-1 shrink-0" />
        <div className="space-y-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400 min-w-0 flex-1">
          <p>{s.publicIntro}</p>
          <p className="flex items-start gap-1.5 text-slate-700 dark:text-slate-300">
            <Users className="w-3.5 h-3.5 mt-0.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
            <span>{s.nameNotice}</span>
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={status === 'loading'}
          aria-label={t.leaderboard.refresh}
          title={t.leaderboard.refresh}
          className="w-9 h-9 shrink-0 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {status === 'loading' && items.length === 0 && (
        <div className="flex justify-center py-10 text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>
      )}

      {status === 'error' && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-red-800 dark:text-red-300">
          <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{s.loadError}</span>
          <button onClick={() => void load()} className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900 font-semibold">{t.common.retry}</button>
        </div>
      )}

      {status === 'ready' && items.length === 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-sm text-slate-600 dark:text-slate-400">
          {s.publicEmpty}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map(item => {
          const long = item.content.length > 220 || item.content.split('\n').length > 5;
          const open = expanded.has(item.id);
          return (
            <article
              key={item.id}
              data-testid="public-card"
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-2xs min-w-0"
            >
              <div className="space-y-3 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${CATEGORY_COLORS[item.category]}`}>{t.categories[item.category]}</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">{date(item.publishedAt)}</span>
                </div>
                <Auto as="h3" className="block font-bold text-base text-slate-900 dark:text-white break-words [overflow-wrap:anywhere] text-start">{item.title}</Auto>
                {item.content && (
                  <div>
                    <Auto as="p" className={`block text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere] text-start ${long && !open ? 'line-clamp-5' : ''}`}>
                      {item.content}
                    </Auto>
                    {long && (
                      <button
                        onClick={() => setExpanded(prev => { const n = new Set(prev); if (open) n.delete(item.id); else n.add(item.id); return n; })}
                        className="mt-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {open ? t.common.showLess : t.common.showMore}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <MiniAvatar name={item.authorName} url={item.authorAvatar} />
                    <Auto className="font-semibold text-slate-800 dark:text-slate-200 truncate">{item.authorName}</Auto>
                  </span>
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{s.inBoxes(item.adopters)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  {item.isMine ? (
                    <span className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{s.yours}</span>
                  ) : item.iHave ? (
                    <span data-testid="public-added" className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <Check className="w-4 h-4" />{s.added}
                    </span>
                  ) : (
                    <button
                      onClick={() => onAdd(item)}
                      disabled={busyId === item.id}
                      data-testid="public-add"
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60"
                    >
                      {busyId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      <span>{busyId === item.id ? s.adding : s.add}</span>
                    </button>
                  )}
                  {!item.isMine && (
                    <button
                      onClick={() => setReportFor(item)}
                      disabled={item.iReported}
                      data-testid="public-report"
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] text-slate-500 hover:text-red-600 dark:hover:text-red-400 disabled:hover:text-slate-500 disabled:opacity-70"
                    >
                      <Flag className="w-3.5 h-3.5" />
                      <span>{item.iReported ? s.reported : s.report}</span>
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <button
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-60"
          >
            {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
            {s.more}
          </button>
        </div>
      )}

      {noticeFor && (
        <Dialog
          title={s.addNoticeTitle}
          testId="add-notice"
          confirmLabel={s.addNoticeConfirm}
          onClose={() => setNoticeFor(null)}
          onConfirm={() => {
            markNoticeDone();
            const item = noticeFor;
            setNoticeFor(null);
            void add(item);
          }}
        >
          <p className="flex items-start gap-2"><Users className="w-4 h-4 mt-1 shrink-0 text-indigo-600 dark:text-indigo-400" /><span>{s.nameNotice}</span></p>
        </Dialog>
      )}

      {reportFor && (
        <Dialog
          title={<><Flag className="w-5 h-5 text-red-600 shrink-0" />{s.reportTitle}</>}
          testId="report-dialog"
          tone="danger"
          busy={reporting}
          confirmLabel={s.reportSend}
          onClose={() => { setReportFor(null); setReason(''); }}
          onConfirm={() => void sendReport()}
        >
          <Auto as="p" className="block font-bold text-slate-900 dark:text-white [overflow-wrap:anywhere]">{reportFor.title}</Auto>
          <p>{s.reportBody}</p>
          <label className="block space-y-1.5">
            <span className="text-xs text-slate-600 dark:text-slate-400">{s.reportReason}</span>
            <textarea
              dir="auto"
              rows={2}
              maxLength={300}
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </label>
        </Dialog>
      )}
    </div>
  );
};
