import React, { useCallback, useEffect, useState } from 'react';
import { Trophy, RefreshCw, Flame, Crown, Medal, AlertTriangle, EyeOff } from 'lucide-react';
import { fetchLeaderboard, LeaderboardRow, cloudSync } from '../services/cloudSync';
import { UserProfile } from '../types/leitner';
import { useI18n } from '../i18n/I18nProvider';
import { Auto } from './ui/Text';

interface LeaderboardProps {
  profile: UserProfile;
  onOpenSettings: () => void;
}

type Period = 'all' | 'week';

const Avatar: React.FC<{ row: LeaderboardRow }> = ({ row }) =>
  row.avatar_url ? (
    <img src={row.avatar_url} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full object-cover shrink-0" />
  ) : (
    <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold shrink-0">
      {row.display_name.slice(0, 1)}
    </div>
  );

const RankBadge: React.FC<{ rank: number }> = ({ rank }) => {
  const { t, num } = useI18n();
  if (rank === 1) return <Crown className="w-5 h-5 text-amber-500" aria-label={t.leaderboard.rankLabel(1)} />;
  if (rank === 2) return <Medal className="w-5 h-5 text-slate-400" aria-label={t.leaderboard.rankLabel(2)} />;
  if (rank === 3) return <Medal className="w-5 h-5 text-orange-500" aria-label={t.leaderboard.rankLabel(3)} />;
  return <span className="font-mono-num text-sm font-bold text-slate-600 dark:text-slate-400">{num(rank)}</span>;
};

export const Leaderboard: React.FC<LeaderboardProps> = ({ profile, onOpenSettings }) => {
  const { t, num } = useI18n();
  const [period, setPeriod] = useState<Period>('all');
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback(async (p: Period) => {
    setStatus('loading');
    try {
      // Push this user's latest answers first so their own row is current
      await cloudSync.flush();
      setRows(await fetchLeaderboard(p));
      setStatus('ready');
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load(period);
  }, [period, load]);

  const me = rows.find(r => r.is_me);
  const metricLabel = period === 'week' ? t.leaderboard.colWeekScore : t.leaderboard.colScore;
  const metricOf = (r: LeaderboardRow) => (period === 'week' ? r.score_7d : r.score);
  const th = 'py-3 px-3 sm:px-4 font-semibold whitespace-nowrap';
  const td = 'py-3 px-3 sm:px-4';

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Trophy className="w-6 h-6 text-amber-500 shrink-0" />
              <span>{t.leaderboard.title}</span>
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">{t.leaderboard.explainer}</p>
          </div>
          <button
            onClick={() => load(period)}
            disabled={status === 'loading'}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
            <span>{t.leaderboard.refresh}</span>
          </button>
        </div>

        <div role="tablist" className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
          {([
            { id: 'all', label: t.leaderboard.tabAll },
            { id: 'week', label: t.leaderboard.tabWeek }
          ] as const).map(tab => (
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
        </div>
      </div>

      {/* My progress */}
      {me && (
        <div className="bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
          <div>
            <span className="text-xs text-indigo-800 dark:text-indigo-300 block">{t.leaderboard.myRank}</span>
            <span className="text-2xl font-bold font-mono-num text-indigo-700 dark:text-indigo-300">{num(me.rank)}</span>
          </div>
          <div>
            <span className="text-xs text-indigo-800 dark:text-indigo-300 block">{t.leaderboard.totalScore}</span>
            <span className="text-2xl font-bold font-mono-num text-slate-900 dark:text-white">{num(me.score)}</span>
          </div>
          <div>
            <span className="text-xs text-indigo-800 dark:text-indigo-300 block">{t.leaderboard.weekScore}</span>
            <span dir="ltr" className="text-2xl font-bold font-mono-num text-emerald-600 dark:text-emerald-400 inline-block">
              {t.leaderboard.signed(me.score_7d)}
            </span>
          </div>
          <div>
            <span className="text-xs text-indigo-800 dark:text-indigo-300 block">{t.leaderboard.streak}</span>
            <span className="text-2xl font-bold font-mono-num text-orange-600 dark:text-orange-400 inline-flex items-center gap-1">
              <Flame className="w-5 h-5" />
              {num(me.streak)}
            </span>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <span className="text-xs text-indigo-800 dark:text-indigo-300 block">{t.leaderboard.silverTitle}</span>
            <span className="text-2xl font-bold font-mono-num text-slate-600 dark:text-slate-300">🥈 {num(me.silver ?? 0)}</span>
          </div>
        </div>
      )}

      {!profile.showOnLeaderboard && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <EyeOff className="w-4 h-4 shrink-0" />
            {t.leaderboard.hidden}
          </span>
          <button onClick={onOpenSettings} className="underline font-semibold shrink-0">{t.leaderboard.changeInSettings}</button>
        </div>
      )}

      {status === 'error' && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{t.leaderboard.error}</span>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <th scope="col" className={`${th} text-start w-14`}>{t.leaderboard.colRank}</th>
                <th scope="col" className={`${th} text-start`}>{t.leaderboard.colUser}</th>
                <th scope="col" className={`${th} text-end`}>{metricLabel}</th>
                <th scope="col" className={`${th} text-end`} title={t.leaderboard.silverTitle}>🥈 {t.leaderboard.colSilver}</th>
                <th scope="col" className={`${th} text-end hidden sm:table-cell`}>{t.leaderboard.colMastered}</th>
                <th scope="col" className={`${th} text-end hidden sm:table-cell`}>{t.leaderboard.colStreak}</th>
              </tr>
            </thead>
            <tbody>
              {status === 'loading' && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-slate-600 dark:text-slate-400">{t.leaderboard.loading}</td>
                </tr>
              )}
              {status !== 'loading' && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-slate-600 dark:text-slate-400">{t.leaderboard.empty}</td>
                </tr>
              )}
              {rows.map(r => (
                <tr
                  key={r.user_id}
                  className={`border-b last:border-b-0 border-slate-100 dark:border-slate-800 ${r.is_me ? 'bg-indigo-50/70 dark:bg-indigo-950/40' : ''}`}
                >
                  <td className={td}>
                    <RankBadge rank={r.rank} />
                  </td>
                  <td className={td}>
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar row={r} />
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-900 dark:text-white flex items-baseline gap-1.5 min-w-0">
                          <Auto className="truncate max-w-[9rem] sm:max-w-[14rem]">{r.display_name}</Auto>
                          {r.is_me && <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium shrink-0">{t.leaderboard.you}</span>}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block">{t.leaderboard.inBoxes(r.learning)}</span>
                      </div>
                    </div>
                  </td>
                  <td className={`${td} text-end font-mono-num font-bold text-slate-900 dark:text-white`}>
                    {period === 'week' ? <span dir="ltr">{t.leaderboard.signed(metricOf(r))}</span> : num(metricOf(r))}
                  </td>
                  <td className={`${td} text-end font-mono-num font-semibold text-slate-600 dark:text-slate-300`}>{r.silver ? num(r.silver) : '—'}</td>
                  <td className={`${td} text-end font-mono-num text-emerald-700 dark:text-emerald-400 hidden sm:table-cell`}>{num(r.mastered)}</td>
                  <td className={`${td} text-end text-orange-600 dark:text-orange-400 hidden sm:table-cell whitespace-nowrap`}>
                    {r.streak > 0 ? t.common.day(r.streak) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
