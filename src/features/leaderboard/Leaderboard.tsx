import React, { Suspense, lazy, useCallback, useRef, useState } from 'react';
import { fetchLeaderboard, cloudSync } from '../../core/cloudSync';
import type { UserProfile } from '../../core/types';
import { useI18n } from '../../i18n/I18nProvider';
import { CompetitionBoard, type BoardPeriod } from './CompetitionBoard';
import { useBoardData } from './useBoardData';

const AdjectiveBoard = lazy(() => import('../adjective/AdjectiveBoard').then(m => ({ default: m.AdjectiveBoard })));
export type LeaderboardTopTab = 'leitner' | 'adjective';
interface LeaderboardProps {
  profile: UserProfile;
  onOpenSettings: () => void;
  showAdjective?: boolean;
  topTab?: LeaderboardTopTab;
  onTopTabChange?: (tab: LeaderboardTopTab) => void;
}

function LeitnerBoard({ period, onPeriodChange, profile, onOpenSettings }: {
  period: BoardPeriod; onPeriodChange: (period: BoardPeriod) => void; profile: UserProfile; onOpenSettings: () => void;
}) {
  const { t, num } = useI18n();
  const loader = useCallback(async () => {
    await cloudSync.flush();
    return fetchLeaderboard(period);
  }, [period]);
  const { data, status, refresh } = useBoardData(loader);
  const b = t.leaderboard;
  return <CompetitionBoard period={period} onPeriodChange={onPeriodChange} status={status} refresh={refresh}
    hidden={!profile.showOnLeaderboard} onOpenSettings={onOpenSettings}
    columnScoreLabel={b.colScore} weekLabel={b.tabBalance} title={b.leitnerTitle} scoreLabel={period === 'all' ? b.totalScore : b.weekScore}
    rules={b.explainer} errorMessage={b.error} emptyMessage={b.empty}
    rows={(data ?? []).map(row => ({
      id: row.user_id, name: row.display_name, avatar: row.avatar_url, rank: row.rank, isMe: row.is_me,
      score: period === 'all' ? num(row.score) : b.signed(row.score_7d),
      details: [
        { label: b.silverTitle, value: num(row.silver ?? 0) },
        { label: b.colMastered, value: num(row.mastered) },
        { label: b.streak, value: t.common.day(row.streak) },
        { label: b.learningCards, value: num(row.learning) },
      ],
    }))} />;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ profile, onOpenSettings, showAdjective = true, topTab: topTabProp, onTopTabChange }) => {
  const { t, dir } = useI18n();
  const [localTab, setLocalTab] = useState<LeaderboardTopTab>('leitner');
  const topTab = showAdjective ? (topTabProp ?? localTab) : 'leitner';
  const setTopTab = onTopTabChange ?? setLocalTab;
  const [period, setPeriod] = useState<BoardPeriod>('all');
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabs = [{ id: 'leitner', label: t.leaderboard.topTabLeitner }, { id: 'adjective', label: t.leaderboard.topTabAdjective }] as const;
  return <div className="max-w-4xl mx-auto space-y-7 pb-12 text-slate-900 dark:text-slate-100" data-testid="competition-page">
    <div className="space-y-3">
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">{t.leaderboard.title}</h1>
      <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">{t.leaderboard.subtitle}</p>
    </div>
    {showAdjective && <div role="tablist" aria-label={t.leaderboard.title} className="flex gap-6 border-b border-slate-200 dark:border-slate-800">
      {tabs.map((tab, i) => <button key={tab.id} type="button" ref={element => { tabRefs.current[i] = element; }}
        role="tab" id={`competition-tab-${tab.id}`} aria-controls="competition-panel" aria-selected={topTab === tab.id} tabIndex={topTab === tab.id ? 0 : -1}
        onClick={() => setTopTab(tab.id)} onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : (i + (event.key === 'ArrowRight' ? (dir === 'rtl' ? -1 : 1) : (dir === 'rtl' ? 1 : -1)) + 2) % 2;
          setTopTab(tabs[next].id); tabRefs.current[next]?.focus();
        }} className={`py-3 px-1 min-h-11 text-sm font-semibold border-b-2 focus-visible:outline-2 focus-visible:outline-indigo-500 ${topTab === tab.id ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300' : 'border-transparent text-slate-500'}`}>
        {tab.label}
      </button>)}
    </div>}
    <div id="competition-panel" role={showAdjective ? 'tabpanel' : undefined} aria-labelledby={showAdjective ? `competition-tab-${topTab}` : undefined}>
      {topTab === 'adjective' ? <Suspense fallback={<p role="status" className="py-16 text-center text-sm text-slate-500">{t.leaderboard.loading}</p>}>
        <AdjectiveBoard userId={profile.id} showOnLeaderboard={profile.showOnLeaderboard} period={period} onPeriodChange={setPeriod} onOpenSettings={onOpenSettings} />
      </Suspense> : <LeitnerBoard profile={profile} onOpenSettings={onOpenSettings} period={period} onPeriodChange={setPeriod} />}
    </div>
  </div>;
};
