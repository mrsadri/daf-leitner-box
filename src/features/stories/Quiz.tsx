/**
 * The three questions at the end of a story, one at a time, in German. After an answer the right option is marked;
 * after a wrong one, the page the answer comes from can be opened. The score is passed to onDone.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Check, X, BookOpenText } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { Button, Dialog, cx } from '../../shared/ui';
import { StoryText } from './StoryText';
import type { Story, WordSegment } from './types';

export const Quiz: React.FC<{ story: Story; onDone: (score: number) => void; onShowPageWord: (w: WordSegment | string) => void }> = ({ story, onDone }) => {
  const { t } = useI18n();
  const s = t.stories;
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [showPage, setShowPage] = useState(false);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const item = story.quiz[i];
  const answered = picked !== null;
  const right = answered && picked === item.answer;

  useEffect(() => { if (answered) feedbackRef.current?.focus(); }, [answered]);

  const choose = (k: number) => {
    if (answered) return;
    setPicked(k);
    if (k === item.answer) setScore(x => x + 1);
  };
  const next = () => {
    if (i + 1 < story.quiz.length) { setI(i + 1); setPicked(null); }
    else onDone(score);
  };

  return (
    <div className="space-y-5" data-testid="story-quiz">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">{s.question(i + 1, story.quiz.length)}</p>
      <h2 id={`q-${i}`} dir="ltr" lang="de" className="font-story text-xl sm:text-2xl font-bold text-ink text-start">{item.q}</h2>
      <div role="radiogroup" aria-labelledby={`q-${i}`} className="space-y-2" dir="ltr" lang="de">
        {item.options.map((o, k) => {
          const isRight = answered && k === item.answer;
          const isWrongPick = answered && k === picked && !right;
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={picked === k}
              disabled={answered && !isRight && !isWrongPick}
              onClick={() => choose(k)}
              data-testid="quiz-option"
              data-correct={isRight || undefined}
              className={cx(
                'w-full min-h-12 px-4 py-3 rounded-control border-2 text-start font-story text-lg flex items-center justify-between gap-3 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                !answered && 'border-paper-edge bg-white/60 dark:bg-black/10 text-ink hover:border-indigo-400',
                isRight && 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100',
                isWrongPick && 'border-red-600 bg-red-50 text-red-900 dark:bg-red-950/50 dark:text-red-100',
                answered && !isRight && !isWrongPick && 'border-paper-edge text-ink-soft opacity-70',
              )}
            >
              <span>{o}</span>
              {isRight && <Check className="w-5 h-5 shrink-0" aria-hidden />}
              {isWrongPick && <X className="w-5 h-5 shrink-0" aria-hidden />}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="space-y-3">
          <p ref={feedbackRef} tabIndex={-1} role="status" className={cx('font-semibold focus:outline-none', right ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300')}>
            {right ? s.correct : s.wrong}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            {!right && <Button variant="secondary" icon={<BookOpenText className="w-4 h-4" />} onClick={() => setShowPage(true)} data-testid="show-page">{s.showPage}</Button>}
            <Button onClick={next} data-testid="quiz-next">{i + 1 < story.quiz.length ? s.nextQuestion : s.finish}</Button>
          </div>
        </div>
      )}

      {showPage && (
        <Dialog onClose={() => setShowPage(false)} size="lg" title={s.pageTitle} testId="quiz-page">
          <div className="rounded-card bg-paper border border-paper-edge p-4 sm:p-6">
            <StoryText page={story.pages[item.page]} onWord={() => undefined} />
          </div>
        </Dialog>
      )}
    </div>
  );
};
