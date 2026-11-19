import React from 'react';
import { RefreshCw, Trophy, EyeOff } from 'lucide-react';
import { Button, SegmentedControl } from '../../shared/ui';
import { Auto } from '../../shared/ui/Text';
import { useI18n } from '../../i18n/I18nProvider';

export type BoardPeriod = 'all' | 'week';
export interface CompetitionRow {
  id: string; name: string; avatar: string | null; rank: number; isMe: boolean;
  score: string; details: { label: string; value: string }[];
}

export function CompetitionBoard({ period, onPeriodChange, status, refresh, rows, scoreLabel, personalScore,
  hidden, onOpenSettings, rules, title, errorMessage, emptyMessage, weekLabel, columnScoreLabel }: {
  period: BoardPeriod; onPeriodChange: (period: BoardPeriod) => void;
  status: 'loading' | 'ready' | 'error'; refresh: () => void; rows: CompetitionRow[];
  scoreLabel: string; personalScore?: string; hidden: boolean; onOpenSettings: () => void;
  rules: string; title: string; errorMessage: string; emptyMessage: string; weekLabel?: string; columnScoreLabel?: string;
}) {
  const { t, num } = useI18n();
  const b = t.leaderboard;
  const me = rows.find(row => row.isMe);
  const ready = status === 'ready';
  const periodLabel = period === 'all' ? b.tabAll : (weekLabel ?? b.tabWeek);
  return <section className="space-y-7" aria-label={title} data-testid="competition-board" aria-busy={status === 'loading'}>
    <div className="flex items-center justify-between flex-wrap gap-3">
      <SegmentedControl value={period} onChange={onPeriodChange} label={b.periodLabel}
        options={[{ value: 'all', label: b.tabAll }, { value: 'week', label: weekLabel ?? b.tabWeek }]} />
      <Button variant="ghost" size="sm" onClick={refresh} disabled={status === 'loading'} icon={<RefreshCw className={`w-4 h-4 ${status === 'loading' ? 'animate-spin' : ''}`} aria-hidden />}>
        {b.refresh}
      </Button>
    </div>
    {hidden && <div className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
      <EyeOff className="w-5 h-5 shrink-0 mt-1" aria-hidden />
      <div><p>{b.hidden}</p><Button variant="ghost" size="sm" onClick={onOpenSettings}>{b.changeInSettings}</Button></div>
    </div>}
    {status === 'loading' && <div role="status" className="py-16 text-center text-sm text-slate-500">{b.loading}</div>}
    {status === 'error' && <div role="alert" className="rounded-card border border-red-200 dark:border-red-900 p-6 space-y-3 text-red-700 dark:text-red-300">
      <p>{errorMessage}</p><Button variant="secondary" onClick={refresh}>{b.refresh}</Button>
    </div>}
    {ready && <>
      <div className="competition-summary" data-testid="competition-summary">
        <div className="space-y-2">
          <p className="text-sm text-slate-600 dark:text-slate-300">{b.myRank} <span className="text-caption">· {periodLabel}</span></p>
          <p className="competition-number" data-testid="personal-rank">{me ? num(me.rank) : '—'}</p>
          {!me && <p className="text-caption text-slate-500">{b.noRank}</p>}
        </div>
        <div className="space-y-2">
          <p className="text-sm text-slate-600 dark:text-slate-300">{scoreLabel}</p>
          <p className="competition-number" data-testid="personal-score"><bdi dir="ltr">{personalScore ?? me?.score ?? '—'}</bdi></p>
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex items-baseline justify-between flex-wrap gap-2"><h2 className="text-xl font-semibold">{title}</h2><span className="text-caption text-slate-500">{periodLabel}</span></div>
        {rows.length === 0 ? <p className="py-10 text-sm text-slate-500" role="status">{emptyMessage}</p> :
          <table className="competition-table">
            <caption className="sr-only">{title} · {periodLabel}</caption>
            <thead><tr><th scope="col">{b.colRank}</th><th scope="col">{b.colUser}</th><th scope="col" className="text-end">{columnScoreLabel ?? scoreLabel}</th></tr></thead>
            <tbody>{rows.map(row => <tr key={row.id} className={row.isMe ? 'competition-me' : undefined}>
              <td><span className="inline-flex items-center flex-wrap gap-1 font-mono-num">{num(row.rank)}{row.rank <= 3 && <Trophy className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-300" aria-hidden />}</span></td>
              <td><div className="flex items-start gap-3 min-w-0">
                {row.avatar ? <img src={row.avatar} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full shrink-0 object-cover hidden sm:block" />
                  : <span aria-hidden className="w-9 h-9 rounded-full shrink-0 bg-slate-100 dark:bg-slate-800 items-center justify-center hidden sm:flex">{row.name.slice(0, 1)}</span>}
                <div className="min-w-0 flex-1"><p className="font-semibold break-words"><Auto>{row.name}</Auto> {row.isMe && <span className="text-caption text-indigo-700 dark:text-indigo-300">{b.you}</span>}</p>
                  {row.details.length > 0 && <details className="mt-1 text-caption text-slate-600 dark:text-slate-300">
                    <summary className="cursor-pointer py-1 w-fit focus-visible:outline-2 focus-visible:outline-indigo-500">{b.details}</summary>
                    <dl className="space-y-2 py-2">{row.details.map(detail => <div key={detail.label}><dt>{detail.label}</dt><dd className="font-mono-num"><bdi>{detail.value}</bdi></dd></div>)}</dl>
                  </details>}
                </div>
              </div></td>
              <td className="text-end font-semibold font-mono-num"><bdi dir="ltr">{row.score}</bdi></td>
            </tr>)}</tbody>
          </table>}
      </div>
    </>}
    <details className="border-t border-slate-200 dark:border-slate-800 pt-5 text-sm text-slate-600 dark:text-slate-300">
      <summary className="cursor-pointer w-fit py-2 focus-visible:outline-2 focus-visible:outline-indigo-500">{b.rulesTitle}</summary>
      <p className="max-w-2xl leading-7 pt-3">{rules}</p>
    </details>
  </section>;
}
