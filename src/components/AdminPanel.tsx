import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheck, RefreshCw, AlertTriangle, Search, PauseCircle, PlayCircle, Trash2, Loader2, X } from 'lucide-react';
import { adminListUsers, adminSetSuspended, adminDeleteUser, AdminUserRow } from '../services/cloudSync';
import { UserProfile } from '../types/leitner';
import { useI18n } from '../i18n/I18nProvider';
import { Auto, Ltr } from './ui/Text';
import { AdminInsights } from './insights/AdminInsights';

interface AdminPanelProps {
  profile: UserProfile;
  /** Removing a public card may delete the admin's own copy */
  onCardsChanged?: () => void;
}

/** Pick the coarsest sensible unit for "x minutes/hours/days ago" */
function relativeParts(iso: string): [number, Intl.RelativeTimeFormatUnit] {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (Math.abs(minutes) < 60) return [minutes, 'minute'];
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return [hours, 'hour'];
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return [days, 'day'];
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return [months, 'month'];
  return [Math.round(days / 365), 'year'];
}

const DAY_MS = 24 * 60 * 60 * 1000;

const Avatar: React.FC<{ row: AdminUserRow }> = ({ row }) =>
  row.avatar_url ? (
    <img src={row.avatar_url} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full object-cover shrink-0" />
  ) : (
    <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold shrink-0">
      {row.display_name.slice(0, 1)}
    </div>
  );

/** Typed confirmation before a permanent delete. */
const DeleteDialog: React.FC<{
  row: AdminUserRow;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ row, busy, onCancel, onConfirm }) => {
  const { t } = useI18n();
  const [typed, setTyped] = useState('');
  const expected = row.email || row.display_name;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
            <Trash2 className="w-5 h-5 shrink-0" />
            {t.admin.deleteTitle}
          </h2>
          <button onClick={onCancel} disabled={busy} aria-label={t.common.close} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          {t.admin.deleteBody(row.display_name)}
        </p>
        <label className="block space-y-1.5">
          <span className="text-xs text-slate-600 dark:text-slate-400">{t.admin.typeToConfirm} <Ltr className="font-mono inline-block">{expected}</Ltr></span>
          <input
            value={typed}
            onChange={e => setTyped(e.target.value)}
            dir="ltr"
            autoFocus
            className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </label>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} disabled={busy} className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200">
            {t.common.cancel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy || typed.trim().toLowerCase() !== expected.toLowerCase()}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 flex items-center gap-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {t.admin.deleteForever}
          </button>
        </div>
      </div>
    </div>
  );
};

export const AdminPanel: React.FC<AdminPanelProps> = ({ profile, onCardsChanged }) => {
  const { t, num, date, relative } = useI18n();
  const formatDate = (iso: string | null) => (iso ? date(iso, { dateStyle: 'medium', timeStyle: 'short' }) : '—');
  const ago = (iso: string | null) => (iso ? relative(...relativeParts(iso)) : '');
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<AdminUserRow | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      setRows(await adminListUsers());
      setStatus('ready');
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => r.display_name.toLowerCase().includes(q) || (r.email || '').toLowerCase().includes(q));
  }, [rows, query]);

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * DAY_MS;
    return {
      total: rows.length,
      active7d: rows.filter(r => r.last_seen && new Date(r.last_seen).getTime() >= weekAgo).length,
      suspended: rows.filter(r => r.suspended_at).length
    };
  }, [rows]);

  const toggleSuspend = async (row: AdminUserRow) => {
    const suspend = !row.suspended_at;
    if (suspend && !window.confirm(t.admin.confirmSuspend(row.display_name))) return;
    setBusyId(row.user_id);
    setActionError(null);
    try {
      await adminSetSuspended(row.user_id, suspend);
      setRows(rs => rs.map(r => (r.user_id === row.user_id ? { ...r, suspended_at: suspend ? new Date().toISOString() : null } : r)));
    } catch (e) {
      console.error(e);
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const row = toDelete;
    setBusyId(row.user_id);
    setActionError(null);
    try {
      await adminDeleteUser(row.user_id);
      setRows(rs => rs.filter(r => r.user_id !== row.user_id));
      setToDelete(null);
    } catch (e) {
      console.error(e);
      setActionError(e instanceof Error ? e.message : String(e));
      setToDelete(null);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-indigo-600 shrink-0" />
              <span>{t.admin.title}</span>
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
              {t.admin.explainer}
            </p>
          </div>
          <button
            onClick={load}
            disabled={status === 'loading'}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
            <span>{t.admin.refresh}</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: t.admin.total, value: stats.total, cls: 'text-slate-900 dark:text-white' },
            { label: t.admin.active7d, value: stats.active7d, cls: 'text-emerald-600 dark:text-emerald-400' },
            { label: t.admin.suspended, value: stats.suspended, cls: 'text-amber-600 dark:text-amber-400' }
          ].map(s => (
            <div key={s.label} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
              <span className="text-[11px] text-slate-600 dark:text-slate-400 block">{s.label}</span>
              <span className={`text-xl font-bold font-mono-num ${s.cls}`}>{num(s.value)}</span>
            </div>
          ))}
        </div>

        <label className="relative block">
          <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            dir="auto"
            placeholder={t.admin.search}
            className="w-full ps-9 pe-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>
      </div>

      {status === 'error' && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{t.admin.loadError}</span>
        </div>
      )}

      {actionError && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{t.admin.actionError(actionError)}</span>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <th scope="col" className="py-3 px-4 text-start font-semibold">{t.admin.colUser}</th>
                <th scope="col" className="py-3 px-4 text-start font-semibold whitespace-nowrap">{t.admin.colFirstSeen}</th>
                <th scope="col" className="py-3 px-4 text-start font-semibold whitespace-nowrap">{t.admin.colLastSeen}</th>
                <th scope="col" className="py-3 px-4 text-end font-semibold whitespace-nowrap hidden md:table-cell">{t.admin.colCards}</th>
                <th scope="col" className="py-3 px-4 text-end font-semibold">{t.admin.colAction}</th>
              </tr>
            </thead>
            <tbody>
              {status === 'loading' && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-slate-600 dark:text-slate-400">{t.admin.loading}</td>
                </tr>
              )}
              {status === 'ready' && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-slate-600 dark:text-slate-400">{t.admin.empty}</td>
                </tr>
              )}
              {filtered.map(r => {
                const isMe = r.user_id === profile.id;
                const busy = busyId === r.user_id;
                return (
                  <tr
                    key={r.user_id}
                    className={`border-b last:border-b-0 border-slate-100 dark:border-slate-800 ${r.suspended_at ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar row={r} />
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 min-w-0 max-w-[14rem]">
                            <Auto className="truncate">{r.display_name}</Auto>
                            {isMe && <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium shrink-0">{t.admin.you}</span>}
                            {r.suspended_at && (
                              <span className="text-[10px] font-semibold shrink-0 px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200">
                                {t.admin.suspendedBadge}
                              </span>
                            )}
                          </span>
                          <Ltr className="text-[11px] text-slate-500 dark:text-slate-400 block truncate max-w-[14rem] text-start">{r.email}</Ltr>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatDate(r.first_seen)}</td>
                    <td className="py-3 px-4 text-xs whitespace-nowrap">
                      <span className="text-slate-700 dark:text-slate-300 block">{formatDate(r.last_seen)}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">{ago(r.last_seen)}</span>
                    </td>
                    <td className="py-3 px-4 text-end font-mono-num text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap hidden md:table-cell">
                      {num(r.cards)} / {num(r.reviews)}
                    </td>
                    <td className="py-3 px-4">
                      {isMe ? (
                        <span className="text-[11px] text-slate-400 block text-end">—</span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => toggleSuspend(r)}
                            disabled={busy}
                            title={r.suspended_at ? t.admin.restoreTitle : t.admin.suspend}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap disabled:opacity-50 ${
                              r.suspended_at
                                ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-300'
                                : 'bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-950 dark:hover:bg-amber-900 dark:text-amber-300'
                            }`}
                          >
                            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : r.suspended_at ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
                            <span className="hidden sm:inline">{r.suspended_at ? t.admin.restore : t.admin.suspend}</span>
                          </button>
                          <button
                            onClick={() => setToDelete(r)}
                            disabled={busy}
                            title={t.admin.deleteForever}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-950 dark:hover:bg-red-900 dark:text-red-300 disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{t.admin.deleteForever}</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AdminInsights onCardsChanged={onCardsChanged} />

      {toDelete && (
        <DeleteDialog
          row={toDelete}
          busy={busyId === toDelete.user_id}
          onCancel={() => setToDelete(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
};
