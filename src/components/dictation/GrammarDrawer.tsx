import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, PanelRightClose, PanelRightOpen, X } from 'lucide-react';
import type { GrammarCard, GrammarFile, Sentence, Sequence } from '../../types/dictation';
import { useI18n } from '../../i18n/I18nProvider';
import { pickDrawerContent } from '../../services/dictation/grammarDrawer';

/** True while the media query matches; re-evaluates on resize and rotation. */
export function useMediaQuery(query: string): boolean {
  const get = () => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches;
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    const mql = window.matchMedia?.(query);
    if (!mql) return;
    const on = () => setMatches(mql.matches);
    on();
    mql.addEventListener('change', on);
    return () => mql.removeEventListener('change', on);
  }, [query]);
  return matches;
}

/** Button that is always visible on wide screens: collapses and expands the grammar column. */
export const GrammarToggle: React.FC<{ open: boolean; count: number; onToggle: () => void; controls: string }> = ({ open, count, onToggle, controls }) => {
  const { t } = useI18n();
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={controls}
      className="hidden lg:inline-flex min-h-11 px-3 items-center gap-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-500">
      {open ? <PanelRightClose className="w-4 h-4 rtl:-scale-x-100" aria-hidden /> : <PanelRightOpen className="w-4 h-4 rtl:-scale-x-100" aria-hidden />}
      {open ? t.dictation.grammar.hide : t.dictation.grammar.show}
      {!open && count > 0 && <span className="rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 text-xs px-2 py-0.5">{t.dictation.grammar.points(count)}</span>}
    </button>
  );
};

const CardView: React.FC<{ card: GrammarCard; expanded: boolean; onToggle: () => void; first: boolean }> = ({ card, expanded, onToggle, first }) => {
  const { t } = useI18n();
  const bodyId = `grammar-card-${card.id}`;
  return (
    <li className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <button type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={bodyId}
        className="w-full min-h-11 px-3 py-2 flex items-start justify-between gap-2 text-start rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-500">
        <span className="min-w-0">
          <span dir="ltr" lang="de" className="block text-sm font-semibold text-slate-900 dark:text-white text-start">{card.title}</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">{card.level} · {t.dictation.grammar.lesson(card.lesson)}{first ? ` · ${t.dictation.grammar.firstTime}` : ''}</span>
        </span>
        {expanded ? <ChevronUp className="w-4 h-4 mt-1 shrink-0" aria-hidden /> : <ChevronDown className="w-4 h-4 mt-1 shrink-0" aria-hidden />}
      </button>
      {expanded && (
        <div id={bodyId} dir="ltr" lang="de" className="px-3 pb-3 space-y-2 text-sm text-slate-800 dark:text-slate-200 text-start">
          {card.rule.split('\n').map((p, i) => <p key={i} className="leading-6">{p}</p>)}
          {card.table && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>{card.table.head.map((h, i) => <th key={i} scope="col" className="border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-start font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {card.table.rows.map((r, i) => (
                    <tr key={i}>{r.map((c, j) => j === 0 && card.table!.head[0] === ''
                      ? <th key={j} scope="row" className="border border-slate-200 dark:border-slate-700 px-2 py-1 text-start font-semibold">{c}</th>
                      : <td key={j} className="border border-slate-200 dark:border-slate-700 px-2 py-1">{c}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {card.examples.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400"><span dir="auto">{t.dictation.grammar.examples}</span></p>
              <ul className="list-disc ps-5 space-y-0.5">
                {card.examples.map(e => <li key={e.id}>{e.text}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
};

interface Props {
  file: GrammarFile;
  storyBlock: number;
  sequence: Sequence;
  trigger: Sentence | null;       // the sentence the learner most recently entered
  desktop: boolean;
  open: boolean;                  // wide screens: column open
  sheetOpen: boolean;             // phones: full sheet open
  onSheetOpenChange: (open: boolean) => void;
  id: string;
}

/** Cards for the points of the last entered sentence (or of the whole sequence before the first entry). */
export const GrammarDrawer: React.FC<Props> = ({ file, storyBlock, sequence, trigger, desktop, open, sheetOpen, onSheetOpenChange, id }) => {
  const { t } = useI18n();
  const content = pickDrawerContent(file, storyBlock, sequence, trigger);
  const sequenceContent = trigger ? pickDrawerContent(file, storyBlock, sequence, null) : content;
  const empty = trigger !== null && content.fresh.length + content.again.length === 0;
  const shown = empty ? sequenceContent : content;
  const total = content.fresh.length + content.again.length;
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [announce, setAnnounce] = useState('');
  const firstRender = useRef(true);

  // new trigger: open the first card of the sentence, never move focus or scroll, announce politely
  useEffect(() => {
    setExpanded(new Set(trigger && content.fresh.length + content.again.length > 0 ? [[...content.fresh, ...content.again][0].id] : []));
    if (firstRender.current) { firstRender.current = false; return; }
    setAnnounce(t.dictation.grammar.updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger?.id]);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onSheetOpenChange(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheetOpen, onSheetOpenChange]);

  const toggle = (cid: string) => setExpanded(prev => { const n = new Set(prev); if (n.has(cid)) n.delete(cid); else n.add(cid); return n; });

  // a plain function, not a component: a component type created in render would remount the cards and drop focus
  const group = (title: string, cards: GrammarCard[]) => cards.length === 0 ? null : (
    <section key={title} aria-label={title} className="space-y-2">
      <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">{title}</h3>
      <ul className="space-y-2">
        {cards.map(c => <CardView key={c.id} card={c} expanded={expanded.has(c.id)} onToggle={() => toggle(c.id)} first={shown.firstHere.has(c.id)} />)}
      </ul>
    </section>
  );

  const body = (
    <div className="space-y-3">
      {trigger && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          <span className="font-semibold">{t.dictation.grammar.forLast}</span>
          <span dir="ltr" lang="de" className="mt-0.5 block text-start text-slate-700 dark:text-slate-300">{trigger.text}</span>
        </p>
      )}
      {empty && <p className="text-sm text-slate-700 dark:text-slate-200">{t.dictation.grammar.noneHere}</p>}
      {empty && <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.dictation.grammar.sequenceList}</h3>}
      {!trigger && <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.dictation.grammar.inSequence}</h3>}
      {shown.fresh.length + shown.again.length === 0 && <p className="text-sm text-slate-600 dark:text-slate-300">{t.dictation.grammar.nothingInSequence}</p>}
      {group(t.dictation.grammar.newHere, shown.fresh)}
      {group(t.dictation.grammar.alsoUsed, shown.again)}
      <p className="text-[11px] text-slate-400">{t.dictation.grammar.note}</p>
    </div>
  );

  const live = <div aria-live="polite" className="sr-only">{announce}</div>;

  if (desktop) {
    return (
      <>
        {live}
        {open && (
          <aside id={id} aria-label={t.dictation.grammar.title} className="w-80 shrink-0 sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"><BookOpen className="w-4 h-4 text-indigo-600" aria-hidden />{t.dictation.grammar.title}</h2>
            {body}
          </aside>
        )}
      </>
    );
  }

  // phone and tablet: a peek bar in the page flow (never covers the input) and a bottom sheet opened on tap
  return (
    <>
      {live}
      <div id={id} className="mt-4">
        <button type="button" onClick={() => onSheetOpenChange(!sheetOpen)} aria-expanded={sheetOpen}
          className="w-full min-h-11 px-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-800 dark:text-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500">
          <span className="inline-flex items-center gap-2"><BookOpen className="w-4 h-4 text-indigo-600" aria-hidden />{t.dictation.grammar.title}</span>
          <span className="rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 text-xs px-2 py-0.5">{t.dictation.grammar.points(total)}</span>
        </button>
      </div>
      {sheetOpen && (
        <section role="region" aria-label={t.dictation.grammar.title}
          className="fixed inset-x-0 bottom-0 z-40 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"><BookOpen className="w-4 h-4 text-indigo-600" aria-hidden />{t.dictation.grammar.title}</h2>
            <button type="button" onClick={() => onSheetOpenChange(false)} aria-label={t.dictation.grammar.hide} className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-500">
              <X className="w-5 h-5" aria-hidden />
            </button>
          </div>
          {body}
        </section>
      )}
    </>
  );
};
