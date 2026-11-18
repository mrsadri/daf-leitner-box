/**
 * The «صفت‌ها» tab in «رقابت»: adjective drill records, ranked by best score then by the top 3 scores.
 * Same period switch (all-time / this week) as the Leitner board; separate numbers entirely.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Crown, Medal, AlertTriangle, EyeOff, RefreshCw } from 'lucide-react';
import { buttonClass } from '../../shared/ui';
import { Auto } from '../../shared/ui/Text';
import { useI18n } from '../../i18n/I18nProvider';
import { fetchBoard, flushQueue, type AdjectiveBoardRow, type AdjectivePeriod } from './drillSync';

interface Props {
  userId: string;
  showOnLeaderboard: boolean;
}

const Avatar: React.FC<{ row: AdjectiveBoardRow }> = ({ row }) =>
  row.avatarUrl ? (
    <img src={row.avatarUrl} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full object-cover shrink-0" />
  ) : (
    <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold shrink-0">
      {row.displayName.slice(0, 1)}
    </div>
  );

const RankBadge: React.FC<{ rank: number }> = ({ rank }) => {
  const { num } = useI18n();
  if (rank === 1) return <Crown className="w-5 h-5 text-amber-500" />;
  if (rank === 2) return <Medal className="w-5 h-5 text-slate-400" />;
  if (rank === 3) return <Medal className="w-5 h-5 text-orange-500" />;
  return <span className="font-mono-num text-sm font-bold text-slate-600 dark:text-slate-400">{num(rank)}</span>;
};

export function AdjectiveBoard({ userId, showOnLeaderboard }: Props) {
  const { t, num } = useI18n();
  const b = t.adjective.board;
  const [period, setPeriod] = useState<AdjectivePeriod>('all');
  const [rows, setRows] = useState<AdjectiveBoardRow[]>([]);
  const [myBestWeek, setMyBestWeek] = useState<number | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback(async (p: AdjectivePeriod) => {
    setStatus('loading');
    try {
      // Send any pending finished runs first, so this caller's own row is current.
      await flushQueue(userId);
      const board = await fetchBoard(p);
      setRows(board.rows);
      setMyBestWeek(board.myBestWeek);
      setStatus('ready');
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  }, [userId]);

  // eslint-disable-next-line react/set-state-in-effect -- The stable fetch callback marks a new remote query as loading before awaiting it.
  useEffect(() => { load(period); }, [period, load]);

  const overall = rows[0];
  const th = 'py-3 px-3 sm:px-4 font-semibold whitespace-nowrap';
  const td = 'py-3 px-3 sm:px-4';

  return (
    <div className="space-y-6">
      <div role="tablist" className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
        {([{ id: 'all', label: t.leaderboard.tabAll }, { id: 'week', label: t.leaderboard.tabWeek }] as const).map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={period === tab.id}
            onClick={() => setPeriod(tab.id)}
            className={`px-4 py-1.5 rounded-lg transition-colors ${
              period === tab.id
                ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <button onClick={() => load(period)} disabled={status === 'loading'} className={`${buttonClass('ghost', 'sm')} ms-1`}>
          <RefreshCw className={`w-4 h-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
          <span>{b.refresh}</span>
        </button>
      </div>

      <div className="bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
        <div>
          <span className="text-xs text-indigo-800 dark:text-indigo-300 block">{period === 'week' ? t.leaderboard.tabWeek : t.leaderboard.tabAll}</span>
          <span className="text-lg font-bold text-slate-900 dark:text-white block">
            {overall ? <>{overall.displayName} · <span className="font-mono-num">{num(overall.best)}</span></> : b.none}
          </span>
        </div>
        <div>
          <span className="text-xs text-indigo-800 dark:text-indigo-300 block">{t.leaderboard.myRank}</span>
          <span className="text-lg font-bold font-mono-num text-slate-900 dark:text-white block">
            {rows.find(r => r.isMe) ? num(rows.find(r => r.isMe)!.rank) : b.none}
          </span>
        </div>
        <div>
          <span className="text-xs text-indigo-800 dark:text-indigo-300 block">{t.leaderboard.tabWeek}</span>
          <span className="text-lg font-bold font-mono-num text-slate-900 dark:text-white block">
            {myBestWeek === null ? b.none : num(myBestWeek)}
          </span>
        </div>
      </div>

      {!showOnLeaderboard && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
          <EyeOff className="w-4 h-4 shrink-0" />
          <span>{b.hiddenNotice}</span>
        </div>
      )}

      {status === 'error' && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{b.error}</span>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <th scope="col" className={`${th} text-start w-14`}>{b.colRank}</th>
                <th scope="col" className={`${th} text-start`}>{b.colUser}</th>
                <th scope="col" className={`${th} text-end`}>{b.colBest}</th>
                <th scope="col" className={`${th} text-end hidden sm:table-cell`}>{b.colTop3}</th>
              </tr>
            </thead>
            <tbody>
              {status === 'loading' && rows.length === 0 && (
                <tr><td colSpan={4} className="py-12 text-center text-xs text-slate-600 dark:text-slate-400">{b.loading}</td></tr>
              )}
              {status !== 'loading' && rows.length === 0 && (
                <tr><td colSpan={4} className="py-12 text-center text-xs text-slate-600 dark:text-slate-400">{b.empty}</td></tr>
              )}
              {rows.map(r => (
                <tr key={r.userId} className={`border-b last:border-b-0 border-slate-100 dark:border-slate-800 ${r.isMe ? 'bg-indigo-50/70 dark:bg-indigo-950/40' : ''}`}>
                  <td className={td}><RankBadge rank={r.rank} /></td>
                  <td className={td}>
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar row={r} />
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-900 dark:text-white flex items-baseline gap-1.5 min-w-0">
                          <Auto className="truncate max-w-[9rem] sm:max-w-[14rem]">{r.displayName}</Auto>
                          {r.isMe && <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium shrink-0">{t.leaderboard.you}</span>}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className={`${td} text-end font-mono-num font-bold text-slate-900 dark:text-white`}>{num(r.best)}</td>
                  <td className={`${td} text-end hidden sm:table-cell`}>
                    <div className="flex justify-end gap-1.5 font-mono-num text-xs text-slate-600 dark:text-slate-400">
                      {[0, 1, 2].map(i => (
                        <span key={i} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                          {r.top3[i] !== undefined ? num(r.top3[i]) : b.none}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
