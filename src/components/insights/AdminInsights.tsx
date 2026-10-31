import React, { useCallback, useEffect, useState } from 'react';
import { Globe, RefreshCw, Flag, Trash2, Check, Users, EyeOff, AlertTriangle } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { Auto, Ltr } from '../ui/Text';
import { Dialog, CATEGORY_COLORS } from './Dialog';
import { AdminInsight, adminListInsights, adminRemoveInsight, adminKeepInsight } from '../../services/sharedInsights';

/** Admin: public cards, most-reported first; keep (clear reports) or remove everywhere. */
export const AdminInsights: React.FC<{ onCardsChanged?: () => void }> = ({ onCardsChanged }) => {
  const { t, date } = useI18n();
  const s = t.shared;
  const [rows, setRows] = useState<AdminInsight[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<AdminInsight | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      setRows(await adminListInsights());
      setStatus('ready');
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const keep = async (row: AdminInsight) => {
    setBusyId(row.id);
    setMessage(null);
    try {
      await adminKeepInsight(row.id);
      await load();
    } catch (e) {
      setMessage(t.admin.actionError(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    if (!toRemove) return;
    const row = toRemove;
    setBusyId(row.id);
    setMessage(null);
    try {
      const n = await adminRemoveInsight(row.id);
      setRows(rs => rs.filter(r => r.id !== row.id));
      setMessage(s.adminRemoved(n));
      onCardsChanged?.();
      setToRemove(null);
    } catch (e) {
      setMessage(t.admin.actionError(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)));
      setToRemove(null);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4" data-testid="admin-insights">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-600 shrink-0" />
            <span>{s.adminTitle}</span>
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">{s.adminExplainer}</p>
        </div>
        <button
          onClick={() => void load()}
          disabled={status === 'loading'}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
          <span>{t.admin.refresh}</span>
        </button>
      </div>

      {message && <p className="text-xs font-semibold text-slate-700 dark:text-slate-300" role="status">{message}</p>}
      {status === 'error' && (
        <p className="flex items-center gap-2 text-xs text-red-700 dark:text-red-400"><AlertTriangle className="w-4 h-4 shrink-0" />{s.loadError}</p>
      )}
      {status === 'ready' && rows.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{s.adminEmpty}</p>}

      <div className="space-y-3">
        {rows.map(r => (
          <article
            key={r.id}
            data-testid="admin-insight"
            className={`border rounded-2xl p-4 space-y-3 ${r.openReports > 0 ? 'border-red-200 dark:border-red-900 bg-red-50/40 dark:bg-red-950/20' : 'border-slate-200 dark:border-slate-800'}`}
          >
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className={`px-2 py-0.5 rounded-md font-semibold border ${CATEGORY_COLORS[r.category]}`}>{t.categories[r.category]}</span>
              {r.openReports > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold bg-red-600 text-white"><Flag className="w-3 h-3" />{s.adminReports(r.openReports)}</span>
              )}
              {r.hidden && <span className="flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold bg-amber-500 text-white"><EyeOff className="w-3 h-3" />{s.adminHidden}</span>}
              {r.unpublishedAt && <span className="px-2 py-0.5 rounded-md font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">{s.adminUnpublished}</span>}
              <span className="ms-auto text-slate-500">{date(r.publishedAt)}</span>
            </div>
            <Auto as="h3" className="block font-bold text-slate-900 dark:text-white [overflow-wrap:anywhere] text-start">{r.title}</Auto>
            {r.content && <Auto as="p" className="block text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap [overflow-wrap:anywhere] text-start">{r.content}</Auto>}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-800 dark:text-slate-200"><Auto>{r.authorName}</Auto></span>
              {r.authorEmail && <Ltr className="font-mono">{r.authorEmail}</Ltr>}
              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{s.adminAdopters(r.adopters)}</span>
            </div>
            {r.reports.length > 0 && (
              <ul className="space-y-1 text-xs">
                {r.reports.map((rep, i) => (
                  <li key={i} className="flex flex-wrap gap-x-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-red-100 dark:border-red-900/60">
                    <Auto className="font-semibold">{rep.by}</Auto>
                    <Auto className="text-slate-600 dark:text-slate-400">{rep.reason || s.adminNoReason}</Auto>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              {r.openReports > 0 && (
                <button
                  onClick={() => void keep(r)}
                  disabled={busyId === r.id}
                  data-testid="admin-keep"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />{s.adminKeep}
                </button>
              )}
              <button
                onClick={() => setToRemove(r)}
                disabled={busyId === r.id}
                data-testid="admin-remove"
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-950 dark:text-red-300 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />{s.adminRemove}
              </button>
            </div>
          </article>
        ))}
      </div>

      {toRemove && (
        <Dialog
          title={<><Trash2 className="w-5 h-5 text-red-600 shrink-0" />{s.adminRemove}</>}
          tone="danger"
          testId="admin-remove-dialog"
          busy={busyId === toRemove.id}
          confirmLabel={s.adminRemove}
          onClose={() => setToRemove(null)}
          onConfirm={() => void remove()}
        >
          <p>{s.adminConfirmRemove(toRemove.title, toRemove.adopters)}</p>
        </Dialog>
      )}
    </section>
  );
};
