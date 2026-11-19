/**
 * Reading one story like a picture book: a cover (picture + the scene in the interface language), the German pages
 * (swipe, buttons or arrow keys; always left to right, even in the Persian interface), then the quiz and the result.
 * Progress is reported through onPage / onQuizDone; the parent saves it.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, BookOpen, Menu, Type, EyeOff } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { Button, IconButton, Dialog, isDialogOpen } from '../../shared/ui';
import { Switch } from '../../shared/ui/Switch';
import { De } from '../../shared/ui/Text';
import { DEFAULT_READER_SETTINGS, parseReaderSettings, READER_SETTINGS_KEY } from './readerSettings';
import { imageUrl } from './content';
import { StoryText } from './StoryText';
import { Quiz } from './Quiz';
import type { Scene, WordSegment } from './types';

type Step = { kind: 'cover' } | { kind: 'page'; i: number } | { kind: 'quiz' } | { kind: 'result'; score: number };

interface Props {
  story: Scene;
  /** Page to open at (continue reading); undefined starts at the cover */
  startPage?: number;
  hasNext: boolean;
  onPage: (page: number) => void;
  onQuizDone: (score: number) => void;
  onWord: (w: WordSegment | string) => void;
  onNextStory: () => void;
  onBack: () => void;
}

export const StoryPicture: React.FC<{ story: Scene; className?: string }> = ({ story, className = '' }) => {
  const { lang } = useI18n();
  if (!story.image) {
    return (
      <div className={`aspect-[4/3] rounded-card bg-paper-edge/60 flex flex-col items-center justify-center gap-2 text-ink-soft ${className}`}>
        <BookOpen className="w-8 h-8" aria-hidden />
        <De className="editorial-title text-xl text-center px-6">{story.title}</De>
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
  const [controls, setControls] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(() => {
    try { return parseReaderSettings(localStorage.getItem(READER_SETTINGS_KEY)); }
    catch { return { ...DEFAULT_READER_SETTINGS }; }
  });
  useEffect(() => {
    try { localStorage.setItem(READER_SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Reading works when storage is unavailable. */ }
  }, [settings]);
  const pageRef = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const controlsToggle = useRef<HTMLButtonElement>(null);

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
      if (e.key !== 'Escape' && (e.target as HTMLElement)?.closest('[data-word-navigation]')) return;
      if (isDialogOpen() || (e.target as HTMLElement)?.closest('input, textarea, select')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); setControls(true); forward(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); setControls(true); back(); }
      if (e.key === 'Escape') { e.preventDefault(); setControls(true); controlsToggle.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [forward, back]);

  // A new page gets the focus, so screen readers start reading it
  // eslint-disable-next-line react/exhaustive-effect-dependencies -- The page transition intentionally triggers focus on the new rendered page.
  useEffect(() => { pageRef.current?.focus({ preventScroll: true }); }, [step]);

  const onTouchStart = (e: React.TouchEvent) => {
    swiped.current = false;
    touch.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) swiped.current = true;
    if (isDialogOpen() || window.getSelection()?.toString() || Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) forward(); else back();    // swipe left = next page, like turning a page of a German book
  };

  const anim = dir === 1 ? 'story-turn-next' : 'story-turn-prev';

  return (
    <div className="story-reader" data-testid="story-reader" style={{ '--reader-font-size': `${settings.fontSize}px` } as React.CSSProperties}>
      <div className={step.kind !== 'page' || controls ? 'reader-toolbar' : 'reader-reveal'}>
        {(step.kind !== 'page' || controls) && <Button variant="ghost" size="sm" data-testid="reader-exit" icon={<ChevronLeft className="w-4 h-4 rtl:rotate-180" />} onClick={onBack}>{s.exitReader}</Button>}
        {step.kind === 'page' && <div className="flex items-center gap-2">
          {controls && <IconButton label={s.readerSettings} onClick={() => setSettingsOpen(true)} data-testid="reader-settings"><Type className="w-5 h-5" /></IconButton>}
          <IconButton ref={controlsToggle} label={controls ? s.hideControls : s.showControls} aria-expanded={controls}
            data-testid="reader-controls-toggle" onClick={() => setControls(value => !value)}>
            {controls ? <EyeOff className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </IconButton>
        </div>}
      </div>

      <div
        ref={pageRef}
        tabIndex={-1}
        key={step.kind === 'page' ? `p${step.i}` : step.kind}
        className={`reader-page ${step.kind === 'page' ? 'reading-text' : ''} focus:outline-none ${anim}`}
        onClick={event => {
          if (step.kind !== 'page' || swiped.current || isDialogOpen() || window.getSelection()?.toString()) return;
          if ((event.target as HTMLElement).closest('button, [role="button"], a, input')) return;
          setControls(value => !value);
        }}
        onTouchStart={step.kind === 'page' || step.kind === 'cover' ? onTouchStart : undefined}
        onTouchEnd={step.kind === 'page' || step.kind === 'cover' ? onTouchEnd : undefined}
        aria-label={step.kind === 'page' ? s.page(step.i + 1, total) : undefined}
        role={step.kind === 'page' ? 'region' : undefined}
      >
        {step.kind === 'cover' && (
          <div className="editorial-feature" data-testid="story-cover" dir="ltr">
            <StoryPicture story={story} />
            <div className="space-y-5" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
            <h1 className="editorial-title text-3xl text-ink"><De className="block text-start">{story.title}</De></h1>
            <div className="space-y-1">
              <h2 className="text-xs font-bold uppercase tracking-wide text-ink-soft">{s.situation}</h2>
              <p dir="auto" className="text-ink leading-relaxed">{story.situation[lang]}</p>
            </div>
            <p className="text-sm text-ink-soft">{s.tapHint}</p>
            <Button block onClick={forward} data-testid="story-start">{s.start}</Button>
            </div>
          </div>
        )}

        {step.kind === 'page' && (
          <div className="space-y-6">
            <StoryText page={story.pages[step.i]} onWord={onWord} underlines={settings.underlines} />
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

      {step.kind === 'page' && controls && (
        <div className="reader-bottom" dir="ltr">
          <Button variant="secondary" onClick={back} icon={<ChevronLeft className="w-4 h-4" />} aria-label={s.prev}>
            <span className="hidden sm:inline">{s.prev}</span>
          </Button>
          <span className="text-caption text-ink-soft" aria-label={s.page(step.i + 1, total)}>{step.i + 1} / {total}</span>
          <Button onClick={forward} data-testid="story-next">
            {step.i + 1 < total ? <span className="hidden sm:inline">{s.next}</span> : s.toQuiz}
            <ChevronRight className="w-4 h-4" aria-hidden />
            {step.i + 1 < total && <span className="sr-only sm:hidden">{s.next}</span>}
          </Button>
        </div>
      )}
      {settingsOpen && <Dialog title={s.readerSettings} onClose={() => setSettingsOpen(false)} size="sm" testId="reading-settings">
        <label className="block space-y-3">
          <span className="flex justify-between gap-3"><span>{s.fontSize}</span><output>{settings.fontSize}</output></span>
          <input className="w-full accent-indigo-600 min-h-11" type="range" min={18} max={32} step={1} value={settings.fontSize}
            onChange={event => setSettings(value => ({ ...value, fontSize: Number(event.target.value) }))} />
        </label>
        <div className="flex items-center justify-between gap-4">
          <span>{s.underlines}</span><Switch label={s.underlines} checked={settings.underlines} onChange={underlines => setSettings(value => ({ ...value, underlines }))} />
        </div>
        <div className="rounded-control bg-paper p-4" style={{ fontSize: settings.fontSize }}>
          <De className="font-story leading-relaxed">{story.pages[0][0].slice(0, 5).map((segment, i) => typeof segment === 'string' ? segment :
            <span key={i} className={settings.underlines && segment.g ? `gender-${segment.g}` : undefined}>{segment.t}</span>)}</De>
        </div>
      </Dialog>}
    </div>
  );
};
