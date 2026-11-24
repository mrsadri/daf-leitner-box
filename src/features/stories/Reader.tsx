/**
 * Reading one story (chapter): its picture stays pinned at the top while the whole chapter scrolls beneath it: the
 * title, the scene in the interface language, then all of the German text (always left to right), then the quiz and
 * the result. Progress is reported through onPage (the highest text block scrolled into view) and onQuizDone; the
 * parent saves it. "Continue reading" (startPage) scrolls back to that block.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, BookOpen, Type } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { Button, IconButton, Dialog } from '../../shared/ui';
import { Switch } from '../../shared/ui/Switch';
import { De } from '../../shared/ui/Text';
import { DEFAULT_READER_SETTINGS, parseReaderSettings, READER_SETTINGS_KEY } from './readerSettings';
import { imageUrl } from './content';
import { StoryText } from './StoryText';
import { Quiz } from './Quiz';
import type { Scene, WordSegment } from './types';

type Step = { kind: 'read' } | { kind: 'quiz' } | { kind: 'result'; score: number };

interface Props {
  story: Scene;
  /** Text block to scroll to (continue reading); undefined starts at the top */
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
  const [step, setStep] = useState<Step>({ kind: 'read' });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(() => {
    try { return parseReaderSettings(localStorage.getItem(READER_SETTINGS_KEY)); }
    catch { return { ...DEFAULT_READER_SETTINGS }; }
  });
  useEffect(() => {
    try { localStorage.setItem(READER_SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Reading works when storage is unavailable. */ }
  }, [settings]);
  const rootRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const blocks = useRef<(HTMLDivElement | null)[]>([]);
  const seen = useRef(startPage ?? -1);
  const latestOnPage = useRef(onPage);
  useEffect(() => { latestOnPage.current = onPage; });

  // The pinned header's height, so a block scrolled to (continue reading) is not hidden under the picture
  useLayoutEffect(() => {
    const head = headRef.current, root = rootRef.current;
    if (!head || !root) return;
    const apply = () => root.style.setProperty('--reader-head-h', `${head.offsetHeight}px`);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(head);
    return () => observer.disconnect();
  }, [step.kind]);

  // Continue reading: back to the block reached last time
  useEffect(() => {
    if (step.kind !== 'read' || !startPage) return;
    blocks.current[Math.min(startPage, total - 1)]?.scrollIntoView({ block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Progress: the highest text block that came into view (blocks are the story's pages, so saved progress keeps its meaning)
  useEffect(() => {
    if (step.kind !== 'read' || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const i = Number((entry.target as HTMLElement).dataset.page);
        if (i > seen.current) { seen.current = i; latestOnPage.current(i); }
      }
    }, { rootMargin: '0px 0px -35% 0px' });
    blocks.current.forEach(el => el && observer.observe(el));
    return () => observer.disconnect();
  }, [step.kind, total]);

  const goTo = (next: Step) => {
    setStep(next);
    window.scrollTo({ top: 0 });
  };
  // A new step gets the focus, so screen readers start there
  // eslint-disable-next-line react/exhaustive-effect-dependencies -- The step change intentionally moves focus to the new content.
  useEffect(() => { bodyRef.current?.focus({ preventScroll: true }); }, [step.kind]);

  const toQuiz = () => {
    if (seen.current < total - 1) { seen.current = total - 1; onPage(total - 1); }
    goTo({ kind: 'quiz' });
  };

  return (
    <div ref={rootRef} className="story-reader" data-testid="story-reader" style={{ '--reader-font-size': `${settings.fontSize}px` } as React.CSSProperties}>
      <div ref={headRef} className={step.kind === 'read' ? 'reader-head' : 'reader-head reader-head-plain'} data-testid="reader-head">
        <div className="reader-toolbar">
          <Button variant="ghost" size="sm" data-testid="reader-exit" icon={<ChevronLeft className="w-4 h-4 rtl:rotate-180" />} onClick={onBack}>{s.exitReader}</Button>
          {step.kind === 'read' && <IconButton label={s.readerSettings} onClick={() => setSettingsOpen(true)} data-testid="reader-settings"><Type className="w-5 h-5" /></IconButton>}
        </div>
        {step.kind === 'read' && story.image && (
          <div className="reader-picture" data-testid="reader-picture"><StoryPicture story={story} /></div>
        )}
      </div>

      <div ref={bodyRef} tabIndex={-1} className="reader-body focus:outline-none">
        {step.kind === 'read' && (
          <article className="reader-page reading-text" data-testid="story-text">
            <div className="space-y-4 mb-8" data-testid="story-intro">
              <h1 className="editorial-title text-3xl text-ink"><De className="block text-start">{story.title}</De></h1>
              <div className="space-y-1 reader-scene" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
                <h2 className="text-xs font-bold uppercase tracking-wide text-ink-soft">{s.situation}</h2>
                <p dir="auto" className="text-ink leading-relaxed">{story.situation[lang]}</p>
                <p className="text-sm text-ink-soft pt-1">{s.tapHint}</p>
              </div>
            </div>
            <div role="region" aria-label={story.title} className="space-y-6">
              {story.pages.map((page, i) => (
                <div key={i} data-page={i} ref={el => { blocks.current[i] = el; }} className="reader-block">
                  <StoryText page={page} onWord={onWord} underlines={settings.underlines} />
                </div>
              ))}
            </div>
            <div className="reader-end">
              <Button onClick={toQuiz} data-testid="story-to-quiz" icon={<ChevronRight className="w-4 h-4 rtl:rotate-180" aria-hidden />}>{s.toQuiz}</Button>
            </div>
          </article>
        )}

        {step.kind === 'quiz' && (
          <div className="reader-page">
            <Quiz story={story} onShowPageWord={onWord} onDone={(score) => { onQuizDone(score); goTo({ kind: 'result', score }); }} />
          </div>
        )}

        {step.kind === 'result' && (
          <div className="reader-page text-center space-y-4 py-4" data-testid="story-result">
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
