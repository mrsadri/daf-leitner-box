import React, { useCallback, useEffect, useState } from 'react';
import { Trophy, RefreshCw, Flame, Crown, Medal, AlertTriangle, EyeOff } from 'lucide-react';
import { fetchLeaderboard, LeaderboardRow, cloudSync } from '../services/cloudSync';
import { UserProfile } from '../types/leitner';

interface LeaderboardProps {
  profile: UserProfile;
  onOpenSettings: () => void;
}

type Period = 'all' | 'week';

const faNum = (n: number) => n.toLocaleString('fa-IR');

const Avatar: React.FC<{ row: LeaderboardRow }> = ({ row }) =>
  row.avatar_url ? (
    <img src={row.avatar_url} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full object-cover shrink-0" />
  ) : (
    <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold shrink-0">
      {row.display_name.slice(0, 1)}
    </div>
  );

const RankBadge: React.FC<{ rank: number }> = ({ rank }) => {
  if (rank === 1) return <Crown className="w-5 h-5 text-amber-500" aria-label="رتبه ۱" />;
  if (rank === 2) return <Medal className="w-5 h-5 text-slate-400" aria-label="رتبه ۲" />;
  if (rank === 3) return <Medal className="w-5 h-5 text-orange-500" aria-label="رتبه ۳" />;
  return <span className="font-mono-num text-sm font-bold text-slate-600 dark:text-slate-400">{faNum(rank)}</span>;
};

export const Leaderboard: React.FC<LeaderboardProps> = ({ profile, onOpenSettings }) => {
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
  const metricLabel = period === 'week' ? 'امتیاز این هفته' : 'امتیاز';
  const metricOf = (r: LeaderboardRow) => (period === 'week' ? r.score_7d : r.score);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Trophy className="w-6 h-6 text-amber-500" />
              <span>جدول رقابت</span>
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
              امتیاز = مجموع (تعداد کارت‌های هر خانه × شماره آن خانه)؛ خانه ۰ امتیازی ندارد و هر کارت تسلط‌یافته ۶ امتیاز دارد. امتیاز هفتگی، تغییر همین امتیاز در ۷ روز اخیر است. فقط اعداد نمایش داده می‌شوند و محتوای کارت‌ها برای کسی دیده نمی‌شود.
            </p>
          </div>
          <button
            onClick={() => load(period)}
            disabled={status === 'loading'}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
            <span>به‌روزرسانی</span>
          </button>
        </div>

        <div role="tablist" className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
          {([
            { id: 'all', label: 'رتبه کل' },
            { id: 'week', label: 'این هفته' }
          ] as const).map(t => (
            <button
              key={t.id}
              role="tab"
              aria-selected={period === t.id}
              onClick={() => setPeriod(t.id)}
              className={`px-4 py-1.5 rounded-lg transition-colors ${
                period === t.id
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* My progress summary */}
      {me && (
        <div className="bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <span className="text-xs text-indigo-800 dark:text-indigo-300 block">رتبه شما</span>
            <span className="text-2xl font-bold font-mono-num text-indigo-700 dark:text-indigo-300">{faNum(me.rank)}</span>
          </div>
          <div>
            <span className="text-xs text-indigo-800 dark:text-indigo-300 block">امتیاز کل</span>
            <span className="text-2xl font-bold font-mono-num text-slate-900 dark:text-white">{faNum(me.score)}</span>
          </div>
          <div>
            <span className="text-xs text-indigo-800 dark:text-indigo-300 block">امتیاز ۷ روز اخیر</span>
            <span className="text-2xl font-bold font-mono-num text-emerald-600 dark:text-emerald-400 dir-ltr inline-block">{me.score_7d > 0 ? '+' : ''}{faNum(me.score_7d)}</span>
          </div>
          <div>
            <span className="text-xs text-indigo-800 dark:text-indigo-300 block">روزهای پیاپی تمرین</span>
            <span className="text-2xl font-bold font-mono-num text-orange-600 dark:text-orange-400 inline-flex items-center gap-1">
              <Flame className="w-5 h-5" />
              {faNum(me.streak)}
            </span>
          </div>
        </div>
      )}

      {!profile.showOnLeaderboard && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <EyeOff className="w-4 h-4 shrink-0" />
            نام شما برای دیگران پنهان است و فقط خودتان رتبه‌تان را می‌بینید.
          </span>
          <button onClick={onOpenSettings} className="underline font-semibold shrink-0">تغییر در تنظیمات</button>
        </div>
      )}

      {status === 'error' && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>دریافت جدول رقابت ممکن نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.</span>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <th scope="col" className="py-3 px-4 text-right font-semibold w-14">رتبه</th>
                <th scope="col" className="py-3 px-4 text-right font-semibold">کاربر</th>
                <th scope="col" className="py-3 px-4 text-left font-semibold whitespace-nowrap">{metricLabel}</th>
                <th scope="col" className="py-3 px-4 text-left font-semibold whitespace-nowrap hidden sm:table-cell">تسلط‌یافته</th>
                <th scope="col" className="py-3 px-4 text-left font-semibold whitespace-nowrap hidden sm:table-cell">پیاپی</th>
              </tr>
            </thead>
            <tbody>
              {status === 'loading' && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-slate-600 dark:text-slate-400">در حال دریافت…</td>
                </tr>
              )}
              {status !== 'loading' && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-slate-600 dark:text-slate-400">هنوز کسی در جدول نیست.</td>
                </tr>
              )}
              {rows.map(r => (
                <tr
                  key={r.user_id}
                  className={`border-b last:border-b-0 border-slate-100 dark:border-slate-800 ${
                    r.is_me ? 'bg-indigo-50/70 dark:bg-indigo-950/40' : ''
                  }`}
                >
                  <td className="py-3 px-4">
                    <RankBadge rank={r.rank} />
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar row={r} />
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-900 dark:text-white block truncate max-w-[12rem]">
                          {r.display_name}
                          {r.is_me && <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mr-1.5">(شما)</span>}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                          {faNum(r.learning)} کارت در لایتنر
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-left font-mono-num font-bold text-slate-900 dark:text-white">{faNum(metricOf(r))}</td>
                  <td className="py-3 px-4 text-left font-mono-num text-emerald-700 dark:text-emerald-400 hidden sm:table-cell">{faNum(r.mastered)}</td>
                  <td className="py-3 px-4 text-left font-mono-num text-orange-600 dark:text-orange-400 hidden sm:table-cell">
                    {r.streak > 0 ? `${faNum(r.streak)} روز` : '—'}
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
