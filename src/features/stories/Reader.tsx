/**
 * Reading one story like a picture book: a cover (picture + the scene in the interface language), the German pages
 * (swipe, buttons or arrow keys; always left to right, even in the Persian interface), then the quiz and the result.
 * Progress is reported through onPage / onQuizDone; the parent saves it.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { Button, ProgressDots, isDialogOpen } from '../../shared/ui';
import { imageUrl } from './content';
import { StoryText } from './StoryText';
import { Quiz } from './Quiz';
import type { Story, WordSegment } from './types';

type Step = { kind: 'cover' } | { kind: 'page'; i: number } | { kind: 'quiz' } | { kind: 'result'; score: number };

interface Props {
  story: Story;
  /** Page to open at (continue reading); undefined starts at the cover */
  startPage?: number;
  hasNext: boolean;
  onPage: (page: number) => void;
  onQuizDone: (score: number) => void;
  onWord: (w: WordSegment | string) => void;
  onNextStory: () => void;
  onBack: () => void;
}

export const StoryPicture: React.FC<{ story: Story; className?: string }> = ({ story, className = '' }) => {
  const { t, lang } = useI18n();
  if (!story.image) {
    return (
      <div className={`aspect-[4/3] rounded-card bg-paper-edge/60 flex flex-col items-center justify-center gap-2 text-ink-soft ${className}`}>
        <ImageOff className="w-8 h-8" aria-hidden />
        <span className="text-sm">{t.stories.noImage}</span>
      </div>
    );
  }
  return (
    <img
      src={imageUrl(story.image.key)}
      srcSet={`${imageUrl(story.image.key, true)} 800w, ${imageUrl(story.image.key)} 1600w`}
      sizes="(max-width: 640px) calc(100vw - 2rem), 600px"
      width={story.image.w} height={story.image.h}
      alt={story.image.alt ? story.image.alt[lang] : ''}
      decoding="async"
      className={`w-full h-auto aspect-[4/3] object-cover rounded-card ${className}`}
    />
  );
};

export const Reader: React.FC<Props> = ({ story, startPage, hasNext, onPage, onQuizDone, onWord, onNextStory, onBack }) => {
  const { t, lang } = useI18n();
  const s = t.stories;
  const total = story.pages.length;
  const [step, setStep] = useState<Step>(startPage !== undefined ? { kind: 'page', i: Math.min(startPage, total - 1) } : { kind: 'cover' });
  const [dir, setDir] = useState<1 | -1>(1);
  const pageRef = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const go = useCallback((next: Step, direction: 1 | -1) => {
    setDir(direction);
    setStep(next);
    if (next.kind === 'page') onPage(next.i);
    window.scrollTo({ top: 0 });
  }, [onPage]);

  const forward = useCallback(() => {
    if (step.kind === 'cover') go({ kind: 'page', i: 0 }, 1);
    else if (step.kind === 'page') go(step.i + 1 < total ? { kind: 'page', i: step.i + 1 } : { kind: 'quiz' }, 1);
  }, [step, total, go]);
  const back = useCallback(() => {
    if (step.kind === 'page') go(step.i > 0 ? { kind: 'page', i: step.i - 1 } : { kind: 'cover' }, -1);
  }, [step, go]);

  // Arrow keys turn pages (German reads left to right, so → is forward in both interface languages)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('[data-word-navigation]')) return;
      if (isDialogOpen() || (e.target as HTMLElement)?.closest('input, textarea, select')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); forward(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [forward, back]);

  // A new page gets the focus, so screen readers start reading it
  // eslint-disable-next-line react/exhaustive-effect-dependencies -- The page transition intentionally triggers focus on the new rendered page.
  useEffect(() => { pageRef.current?.focus({ preventScroll: true }); }, [step]);

  const onTouchStart = (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) forward(); else back();    // swipe left = next page, like turning a page of a German book
  };

  const anim = dir === 1 ? 'story-turn-next' : 'story-turn-prev';

  return (
    <div className="max-w-2xl mx-auto pb-16 space-y-4" data-testid="story-reader">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" icon={<ChevronLeft className="w-4 h-4 rtl:rotate-180" />} onClick={onBack}>{s.backToBook}</Button>
        {step.kind === 'page' && <span className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">{s.page(step.i + 1, total)}</span>}
      </div>

      <div
        ref={pageRef}
        tabIndex={-1}
        key={step.kind === 'page' ? `p${step.i}` : step.kind}
        className={`rounded-sheet bg-paper border border-paper-edge shadow-md p-5 sm:p-8 focus:outline-none ${anim}`}
        onTouchStart={step.kind === 'page' || step.kind === 'cover' ? onTouchStart : undefined}
        onTouchEnd={step.kind === 'page' || step.kind === 'cover' ? onTouchEnd : undefined}
        aria-label={step.kind === 'page' ? s.page(step.i + 1, total) : undefined}
        role={step.kind === 'page' ? 'region' : undefined}
      >
        {step.kind === 'cover' && (
          <div className="space-y-5" data-testid="story-cover">
            <StoryPicture story={story} />
            <h1 dir="ltr" lang="de" className="font-story-title text-3xl text-ink text-center">{story.title}</h1>
            <div className="space-y-1">
              <h2 className="text-xs font-bold uppercase tracking-wide text-ink-soft">{s.situation}</h2>
              <p dir="auto" className="text-ink leading-relaxed">{story.situation[lang]}</p>
            </div>
            <p className="text-sm text-ink-soft">{s.tapHint}</p>
            <Button block onClick={forward} data-testid="story-start">{s.start}</Button>
          </div>
        )}

        {step.kind === 'page' && (
          <div className="space-y-6">
            <StoryText page={story.pages[step.i]} onWord={onWord} />
            <ProgressDots total={total} current={step.i} label={s.page(step.i + 1, total)} />
          </div>
        )}

        {step.kind === 'quiz' && (
          <Quiz story={story} onShowPageWord={onWord} onDone={(score) => { onQuizDone(score); go({ kind: 'result', score }, 1); }} />
        )}

        {step.kind === 'result' && (
          <div className="text-center space-y-4 py-4" data-testid="story-result">
            <h2 className="font-story-title text-3xl text-ink">{s.resultTitle}</h2>
            <p className="text-lg text-ink">{s.score(step.score, story.quiz.length)}</p>
            <p className="text-ink-soft">{hasNext ? s.nextOpened : s.bookDone}</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
              {hasNext && <Button onClick={onNextStory} data-testid="next-story">{s.nextStory}</Button>}
              <Button variant="secondary" onClick={onBack}>{s.backToBook}</Button>
            </div>
          </div>
        )}
      </div>

      {step.kind === 'page' && (
        <div className="flex items-center justify-between gap-3" dir="ltr">
          <Button variant="secondary" onClick={back} icon={<ChevronLeft className="w-4 h-4" />} aria-label={s.prev}>
            <span className="hidden sm:inline">{s.prev}</span>
          </Button>
          <Button onClick={forward} data-testid="story-next">
            {step.i + 1 < total ? <span className="hidden sm:inline">{s.next}</span> : s.toQuiz}
            <ChevronRight className="w-4 h-4" aria-hidden />
            {step.i + 1 < total && <span className="sr-only sm:hidden">{s.next}</span>}
          </Button>
        </div>
      )}
    </div>
  );
};
