import React from 'react';
import type { Category, CheckResult, Mark } from '../../services/dictation/compare';
import { isTappableCategory } from '../../services/dictation/wordLink';
import { useI18n } from '../../i18n/I18nProvider';

/** Every category has its own line style, so the marks never depend on colour alone. */
const STYLE: Record<Category, string> = {
  case: 'underline decoration-dotted decoration-2 decoration-orange-500 bg-orange-50 dark:bg-orange-950/40',
  'umlaut-substitution': 'underline decoration-solid decoration-2 decoration-red-600 bg-red-50 dark:bg-red-950/40',
  'eszett-substitution': 'underline decoration-solid decoration-2 decoration-red-600 bg-red-50 dark:bg-red-950/40',
  punctuation: 'underline decoration-wavy decoration-2 decoration-blue-600 bg-blue-50 dark:bg-blue-950/40',
  spacing: 'underline decoration-dotted decoration-2 decoration-slate-500 bg-slate-200 dark:bg-slate-700',
  'typo-missing-letter': 'underline decoration-solid decoration-2 decoration-red-600 bg-red-50 dark:bg-red-950/40',
  'typo-extra-letter': 'underline decoration-solid decoration-2 decoration-red-600 bg-red-50 dark:bg-red-950/40',
  'typo-wrong-letter': 'underline decoration-solid decoration-2 decoration-red-600 bg-red-50 dark:bg-red-950/40',
  'typo-swapped-letters': 'underline decoration-solid decoration-2 decoration-red-600 bg-red-50 dark:bg-red-950/40',
  'wrong-word': 'underline decoration-solid decoration-2 decoration-red-600 bg-red-50 dark:bg-red-950/40',
  'missing-word': 'underline decoration-solid decoration-2 decoration-red-600',
  'extra-word': 'underline decoration-solid decoration-2 decoration-red-600 line-through bg-red-50 dark:bg-red-950/40',
  order: 'underline decoration-double decoration-2 decoration-purple-600 bg-purple-50 dark:bg-purple-950/40'
};

interface Props {
  result: CheckResult;
  onMarkTap?: (mark: Mark) => void;
}

type Piece =
  | { kind: 'text'; text: string; mark?: Mark; charMarks?: Set<number>; start: number }
  | { kind: 'gap'; mark: Mark };

/**
 * The learner's own text with the mistakes marked. It never prints the correct letters or words: it only shows where a
 * mistake is and what kind it is. The marks are <mark> elements with an aria-label, so screen readers announce them in place.
 */
export const FeedbackText: React.FC<Props> = ({ result, onMarkTap }) => {
  const { t } = useI18n();
  const text = result.typed;
  const cuts = new Set<number>([0, text.length]);
  const gaps = new Map<number, Mark[]>();
  for (const m of result.marks) {
    if (m.typed) { cuts.add(m.typed.start); cuts.add(m.typed.end); }
    else if (m.gapAfter !== undefined) gaps.set(m.gapAfter, [...(gaps.get(m.gapAfter) ?? []), m]);
  }
  for (const g of gaps.keys()) cuts.add(g);
  const points = [...cuts].filter(p => p >= 0 && p <= text.length).sort((a, b) => a - b);

  const pieces: Piece[] = [];
  const gapAt = (pos: number) => (gaps.get(pos) ?? []).forEach(mark => pieces.push({ kind: 'gap', mark }));
  gapAt(0);
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i], end = points[i + 1];
    if (end > start) {
      const covering = result.marks.find(m => m.typed && m.typed.start <= start && m.typed.end >= end && m.typed.end > m.typed.start);
      const chars = new Set<number>();
      covering?.chars?.forEach(c => { if (c.kind !== 'missing') chars.add(c.at); });
      pieces.push({ kind: 'text', text: text.slice(start, end), mark: covering, charMarks: chars, start });
    }
    gapAt(end);
  }

  const name = (m: Mark) => t.dictation.feedback.categories[m.category];
  return (
    <p dir="ltr" lang="de" className="text-start text-lg leading-9 break-words" data-testid="feedback-text">
      {pieces.map((p, i) => {
        if (p.kind === 'gap') {
          const tappable = isTappableCategory(p.mark.category);
          return (
            <mark
              key={i}
              role={tappable ? 'button' : undefined}
              tabIndex={tappable && onMarkTap ? 0 : undefined}
              aria-label={t.dictation.feedback.gapLabel(name(p.mark))}
              onClick={() => tappable && onMarkTap?.(p.mark)}
              onKeyDown={e => { if (tappable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onMarkTap?.(p.mark); } }}
              className="bg-transparent text-red-600 dark:text-red-400 font-bold px-0.5 cursor-pointer"
              title={t.dictation.feedback.missingHere}
            >
              ⌃
            </mark>
          );
        }
        if (!p.mark) return <span key={i}>{p.text}</span>;
        const tappable = isTappableCategory(p.mark.category) && !!onMarkTap;
        const content = p.charMarks && p.charMarks.size
          ? Array.from(p.text).map((ch, k) => (p.charMarks!.has(p.start + k)
            ? <span key={k} className="outline outline-2 outline-red-600 rounded-sm">{ch}</span>
            : <span key={k}>{ch}</span>))
          : p.text.replace(/ /g, ' ');
        return (
          <mark
            key={i}
            role={tappable ? 'button' : undefined}
            tabIndex={tappable ? 0 : undefined}
            aria-label={t.dictation.feedback.markLabel(name(p.mark), p.text.trim() || '␣')}
            onClick={() => tappable && onMarkTap!(p.mark!)}
            onKeyDown={e => { if (tappable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onMarkTap!(p.mark!); } }}
            className={`${STYLE[p.mark.category]} text-inherit rounded-sm px-0.5 ${tappable ? 'cursor-pointer' : ''}`}
          >
            {content}
          </mark>
        );
      })}
    </p>
  );
};

/** "2 mistakes: capitalization, missing comma" */
export function useSummaryLine(result: CheckResult): string {
  const { t } = useI18n();
  const names = Object.entries(result.summary.byCategory)
    .filter(([, n]) => n > 0)
    .map(([c]) => t.dictation.feedback.categories[c as Category]);
  return result.summary.total === 1 ? `${t.dictation.feedback.one}: ${names.join(', ')}` : t.dictation.feedback.summary(result.summary.total, names.join(', '));
}
