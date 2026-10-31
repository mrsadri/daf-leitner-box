import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { MapPin, Check } from 'lucide-react';
import type { LeitnerCard } from '../types/leitner';
import { lessonProgress, LessonStation } from '../services/lessonProgress';
import { useI18n } from '../i18n/I18nProvider';
import { SignHeading } from './ui/Icon3D';

// Our own line colours per level (no transport company's colours or logos)
const LEVEL_COLOR: Record<string, string> = { A1: '#059669', A2: '#00629d', B1: '#d97706' };
const colorOf = (s: LessonStation) => LEVEL_COLOR[s.niveau] ?? '#64748b';

/**
 * The 30 lessons of DaF kompakt as stations on one line, coloured by level, with "you are here" on the
 * first incomplete lesson. Tapping a station opens the word list filtered to that lesson.
 * Phones: the line scrolls sideways and starts centred on the current station; desktop: it fits the width.
 */
export const MetroMap: React.FC<{ catalog: LeitnerCard[]; cards: LeitnerCard[]; onOpenLesson: (lektion: string) => void }> = ({ catalog, cards, onOpenLesson }) => {
  const { t, digits } = useI18n();
  const m = t.metro;
  const { stations, current } = useMemo(
    () => lessonProgress(catalog.map(c => ({ id: c.id, lektion: c.lektion, niveau: c.niveau })), cards.map(c => c.id)),
    [catalog, cards]
  );
  const scroller = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLButtonElement>(null);

  // Centre the current station inside the line (without scrolling the page)
  useLayoutEffect(() => {
    const box = scroller.current, el = currentRef.current;
    if (!box || !el || box.scrollWidth <= box.clientWidth) return;
    // Relative to what is visible, so it works the same in LTR and RTL (whose scroll origins differ)
    const b = box.getBoundingClientRect(), e = el.getBoundingClientRect();
    box.scrollLeft += (e.left + e.width / 2) - (b.left + b.width / 2);
  }, [current, stations.length]);

  if (!stations.length) return null;
  const doneCount = stations.filter(s => s.status === 'done').length;
  const statusText = (s: LessonStation) => (s.status === 'done' ? m.done : s.status === 'partial' ? m.partial : m.none);

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xs space-y-4" data-testid="metro-map">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <SignHeading icon="tram">{m.title}</SignHeading>
          <p className="text-xs text-slate-600 dark:text-slate-400">{m.subtitle}</p>
        </div>
        <div className="text-xs text-slate-600 dark:text-slate-400 text-end space-y-0.5">
          <p className="font-semibold text-slate-800 dark:text-slate-200">{current ? m.current(current) : m.finished}</p>
          <p>{m.summary(doneCount, stations.length)}</p>
        </div>
      </div>

      <div ref={scroller} className="relative overflow-x-auto pb-2 -mx-1 px-1 [scrollbar-width:thin]">
        <ol className="flex min-w-max lg:min-w-0 pb-1" aria-label={m.title}>
          {stations.map((s, i) => {
            const color = colorOf(s);
            const isCurrent = s.lektion === current;
            const firstOfLevel = i === 0 || stations[i - 1].niveau !== s.niveau;
            const lastOfLevel = i === stations.length - 1 || stations[i + 1].niveau !== s.niveau;
            const ring = s.status === 'partial'
              ? { background: `conic-gradient(${color} ${s.percent * 3.6}deg, rgb(203 213 225) 0)` }
              : undefined;
            return (
              <li key={s.lektion} className="relative w-11 lg:w-auto lg:flex-1 flex flex-col items-center">
                {/* The line (segment coloured by level), behind the station */}
                <span
                  aria-hidden="true"
                  className={`absolute top-[calc(2.75rem+0.6875rem-3px)] h-1.5 ${firstOfLevel ? 'start-1/2' : 'start-0'} ${lastOfLevel ? 'end-1/2' : 'end-0'}`}
                  style={{ background: color }}
                />
                {firstOfLevel && (
                  <span
                    className="absolute top-0 start-1/2 px-1.5 py-0.5 rounded-md text-[10px] font-bold text-white whitespace-nowrap"
                    style={{ background: color }}
                  >
                    {s.niveau}
                  </span>
                )}
                {isCurrent && (
                  <span className="absolute top-6 flex items-center gap-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap" aria-hidden="true">
                    <MapPin className="w-3 h-3" />
                    {m.you}
                  </span>
                )}
                <button
                  ref={isCurrent ? currentRef : undefined}
                  type="button"
                  onClick={() => onOpenLesson(s.lektion)}
                  aria-label={m.station(s.lektion, s.percent, statusText(s))}
                  aria-current={isCurrent ? 'step' : undefined}
                  title={m.station(s.lektion, s.percent, statusText(s))}
                  data-status={s.status}
                  className={`relative z-[1] mt-11 rounded-full flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    isCurrent ? 'w-[1.375rem] h-[1.375rem] ring-4 ring-rose-400/40 dark:ring-rose-500/40' : 'w-[1.375rem] h-[1.375rem]'
                  }`}
                  style={s.status === 'done' ? { background: color } : s.status === 'partial' ? ring : { background: 'white', boxShadow: `inset 0 0 0 3px ${color}` }}
                >
                  {s.status === 'done' && <Check className="w-3 h-3 text-white" strokeWidth={3.5} />}
                  {s.status === 'partial' && <span className="w-3 h-3 rounded-full bg-white dark:bg-slate-900" />}
                </button>
                <span className={`mt-1.5 text-[11px] font-mono-num ${isCurrent ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                  {digits(String(Number(s.lektion)))}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-600 dark:text-slate-400">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-500" />{m.done}</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: 'conic-gradient(#64748b 180deg, rgb(203 213 225) 0)' }} />{m.partial}</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-white shadow-[inset_0_0_0_2px_#64748b]" />{m.none}</span>
      </div>
    </section>
  );
};
