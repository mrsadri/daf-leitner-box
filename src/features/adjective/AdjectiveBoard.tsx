import React, { useCallback } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { fetchBoard, flushQueue } from './drillSync';
import { CompetitionBoard, type BoardPeriod } from '../leaderboard/CompetitionBoard';
import { useBoardData } from '../leaderboard/useBoardData';

interface Props {
  userId: string;
  showOnLeaderboard: boolean;
  period: BoardPeriod;
  onPeriodChange: (period: BoardPeriod) => void;
  onOpenSettings: () => void;
}

export function AdjectiveBoard({ userId, showOnLeaderboard, period, onPeriodChange, onOpenSettings }: Props) {
  const { t, num } = useI18n();
  const loader = useCallback(async () => {
    await flushQueue(userId);
    return fetchBoard(period);
  }, [userId, period]);
  const { data, status, refresh } = useBoardData(loader);
  const best = period === 'all' ? data?.myBestAll : data?.myBestWeek;
  const b = t.adjective.board;
  return <CompetitionBoard period={period} onPeriodChange={onPeriodChange} status={status} refresh={refresh}
    hidden={!showOnLeaderboard} onOpenSettings={onOpenSettings} title={t.leaderboard.adjectiveTitle}
    columnScoreLabel={b.colBest} scoreLabel={t.leaderboard.personalBest} personalScore={best == null ? b.none : num(best)}
    rules={t.leaderboard.adjectiveRules} errorMessage={b.error} emptyMessage={b.empty}
    rows={(data?.rows ?? []).map(row => ({
      id: row.userId, name: row.displayName, avatar: row.avatarUrl, rank: row.rank, isMe: row.isMe,
      score: num(row.best), details: [{ label: b.colTop3, value: row.top3.length ? row.top3.map(num).join(' / ') : b.none }],
    }))} />;
}
