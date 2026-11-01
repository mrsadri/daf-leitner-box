import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { lockAxis, releaseDecision } from '../../services/swipe';
import { swipeStep, keyStep, clampSlide, trackOffset, dragResistance } from '../../services/onboarding';
import { LeitnerIllustration, WordsIllustration, CompetitionIllustration } from './Illustrations';

const ILLUSTRATIONS = [LeitnerIllustration, WordsIllustration, CompetitionIllustration];
const SLIDE_MS = 380;
const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Telegram-style feature carousel: swipe (touch or mouse), page dots, ← / → keys and arrow buttons.
 * Each slide's illustration replays its entrance whenever the slide becomes active; inactive slides
 * show the still composition. No auto-advance.
 */
export const Onboarding: React.FC = () => {
  const { t, dir } = useI18n();
  const rtl = dir === 'rtl';
  const slides = t.onboarding.slides;
  const count = slides.length;
  const [index, setIndex] = useState(0);
  // Bumped each time a slide becomes active, so its illustration remounts and the entrance plays again
  const [plays, setPlays] = useState<number[]>(() => slides.map(() => 0));
  const [dragPx, setDragPx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; t: number; axis: 'x' | 'y' | null } | null>(null);

  const go = useCallback((next: number) => {
    const i = clampSlide(next, count);
    setIndex(prev => {
      if (i !== prev) setPlays(p => p.map((v, k) => (k === i ? v + 1 : v)));
      return i;
    });
  }, [count]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const step = keyStep(e.key, rtl);
      if (step) {
        e.preventDefault();
        setIndex(prev => {
          const i = clampSlide(prev + step, count);
          if (i !== prev) setPlays(p => p.map((v, k) => (k === i ? v + 1 : v)));
          return i;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rtl, count]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!e.isPrimary || drag.current) return;
    if ((e.target as HTMLElement).closest('button, a')) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), axis: null };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (d.axis === null) {
      d.axis = lockAxis(dx, dy);
      if (d.axis === 'y') { drag.current = null; return; }
      if (d.axis === 'x') {
        try { track.current?.setPointerCapture(e.pointerId); } catch { /* pointer gone */ }
        d.x = e.clientX;
        d.t = performance.now();
        setDragging(true);
      }
      return;
    }
    setDragPx(dragResistance(e.clientX - d.x, index, count, rtl));
  };
  const endDrag = (e: React.PointerEvent, cancelled: boolean) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (d.axis !== 'x') return;
    const dx = e.clientX - d.x;
    const decision = cancelled ? null : releaseDecision(dx, performance.now() - d.t, track.current?.offsetWidth ?? 360);
    setDragging(false);
    setDragPx(0);
    if (decision) go(index + swipeStep(decision, rtl));
  };

  const animate = !dragging && !reducedMotion();
  const PrevIcon = rtl ? ChevronRight : ChevronLeft;
  const NextIcon = rtl ? ChevronLeft : ChevronRight;

  return (
    <section
      className="relative w-full max-w-md flex-1 flex flex-col justify-center py-4 select-none"
      aria-roledescription="carousel"
      aria-label={t.onboarding.carousel}
      data-testid="onboarding"
    >
      <div
        ref={track}
        data-testid="onboarding-viewport"
        className="overflow-hidden touch-pan-y cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={e => endDrag(e, false)}
        onPointerCancel={e => endDrag(e, true)}
      >
        <div
          className="flex"
          data-testid="onboarding-track"
          style={{
            transform: `translateX(calc(${trackOffset(index, rtl)}% + ${dragPx}px))`,
            transition: animate ? `transform ${SLIDE_MS}ms cubic-bezier(.22,.8,.3,1)` : 'none'
          }}
        >
          {slides.map((s, i) => {
            const Illustration = ILLUSTRATIONS[i];
            const active = i === index;
            return (
              <div
                key={i}
                role="group"
                aria-roledescription="slide"
                aria-label={t.onboarding.slideLabel(i + 1, count)}
                aria-hidden={!active}
                inert={!active || undefined}
                data-testid="onboarding-slide"
                data-active={active}
                className="w-full shrink-0 flex flex-col items-center gap-5 px-2"
              >
                <div dir="ltr" aria-hidden="true" className={`ob-stage ${active ? '' : 'ob-static'}`}>
                  <Illustration key={plays[i]} />
                </div>
                <div className="text-center space-y-2 min-h-[8.5rem] sm:min-h-[7.5rem]">
                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white leading-snug">{s.title}</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">{s.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Arrows on wider screens; on phones swipe or the dots */}
      <button
        onClick={() => go(index - 1)}
        disabled={index === 0}
        aria-label={t.onboarding.prev}
        data-testid="onboarding-prev"
        className="max-sm:hidden absolute top-[38%] -start-14 w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-indigo-700 disabled:opacity-0 transition-opacity"
      >
        <PrevIcon className="w-5 h-5" />
      </button>
      <button
        onClick={() => go(index + 1)}
        disabled={index === count - 1}
        aria-label={t.onboarding.next}
        data-testid="onboarding-next"
        className="max-sm:hidden absolute top-[38%] -end-14 w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-indigo-700 disabled:opacity-0 transition-opacity"
      >
        <NextIcon className="w-5 h-5" />
      </button>

      <div className="flex items-center justify-center gap-2 pt-1" data-testid="onboarding-dots">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            aria-label={t.onboarding.goTo(i + 1)}
            aria-current={i === index ? 'step' : undefined}
            className="p-1.5 -m-1 group"
          >
            <span className={`block h-2 rounded-full transition-all duration-300 ${i === index ? 'w-6 bg-indigo-600' : 'w-2 bg-slate-300 dark:bg-slate-700 group-hover:bg-slate-400'}`} />
          </button>
        ))}
        <span className="sr-only" aria-live="polite">{t.onboarding.slideLabel(index + 1, count)}</span>
      </div>
    </section>
  );
};
