import React, { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { SwipeDir, lockAxis, releaseDecision, stampOpacity, dragRotation } from '../../services/swipe';

export interface SwipeCardHandle {
  /** Animate the card out (buttons / keys); runs onSwipe afterwards, or bounces when not allowed. */
  fly: (dir: SwipeDir) => void;
}

interface SwipeCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick'> {
  /** Changes when a new card is shown: resets position and plays the enter animation */
  cardKey: string;
  /** How the new card comes in: fade (next), rewind (back, from the left), none */
  enter?: 'fade' | 'rewind' | 'none';
  onSwipe: (dir: SwipeDir) => void;
  /** true = allowed; a string = not allowed (the card springs back; '' means silently) */
  canSwipe?: (dir: SwipeDir) => true | string;
  onBlocked?: (dir: SwipeDir, reason: string) => void;
  /** Called after a committed swipe by finger (not by button or key) */
  onGesture?: (dir: SwipeDir) => void;
  stamps: { left: string; right: string };
  onClick?: () => void;
  children: React.ReactNode;
}

const FLY_MS = 220;
// No card motion with reduced motion, or on desktop (mouse/trackpad): there buttons and keys change the card at once
const reducedMotion = () => typeof window !== 'undefined' &&
  !!(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || window.matchMedia?.('(hover: hover) and (pointer: fine)').matches);
// Drags never start on controls inside the card
const INTERACTIVE = 'button, a, input, textarea, select, label, [data-no-swipe]';

/**
 * A card that can be dragged left or right with a finger (dating-app style): it tilts, a stamp fades in,
 * and past the threshold it flies out. Vertical scrolling stays native (touch-action: pan-y), the mouse
 * doesn't drag (text stays selectable), and nothing reacts while a card is flying out.
 */
export const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(function SwipeCard(
  { cardKey, enter = 'fade', onSwipe, canSwipe, onBlocked, onGesture, stamps, onClick, className = '', style, children, ...rest },
  ref
) {
  const el = useRef<HTMLDivElement>(null);
  const leftStamp = useRef<HTMLDivElement>(null);
  const rightStamp = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; t: number; axis: 'x' | 'y' | null; dx: number } | null>(null);
  const busy = useRef(false);
  // Without animation (desktop), a short pause after each answer keeps an accidental double click from answering two cards
  const cooldownUntil = useRef(0);
  const suppressClick = useRef(false);
  const latest = useRef({ onSwipe, canSwipe, onBlocked, onGesture });
  latest.current = { onSwipe, canSwipe, onBlocked, onGesture };

  const setStamps = (dx: number) => {
    const w = el.current?.offsetWidth ?? 360;
    const o = stampOpacity(dx, w);
    if (rightStamp.current) rightStamp.current.style.opacity = String(dx > 0 ? o : 0);
    if (leftStamp.current) leftStamp.current.style.opacity = String(dx < 0 ? o : 0);
  };

  const place = (dx: number, animate: boolean) => {
    const node = el.current;
    if (!node) return;
    node.style.transition = animate && !reducedMotion() ? `transform ${FLY_MS}ms ease-out` : 'none';
    node.style.transform = dx === 0 ? '' : `translateX(${dx}px) rotate(${dragRotation(dx)}deg)`;
    setStamps(dx);
  };

  const bounce = (dir: SwipeDir, reason: string) => {
    place(0, true);
    const node = el.current;
    if (node && !reducedMotion()) {
      node.animate?.(
        [{ transform: 'translateX(0)' }, { transform: `translateX(${dir === 'right' ? 10 : -10}px)` }, { transform: 'translateX(0)' }],
        { duration: 240, easing: 'ease-out' }
      );
    }
    if (reason) latest.current.onBlocked?.(dir, reason);
  };

  const commit = (dir: SwipeDir, byGesture: boolean) => {
    const allowed = latest.current.canSwipe ? latest.current.canSwipe(dir) : true;
    if (allowed !== true) {
      bounce(dir, allowed);
      return;
    }
    busy.current = true;
    if (byGesture) latest.current.onGesture?.(dir);
    const node = el.current;
    const finish = () => {
      latest.current.onSwipe(dir);
      // If the same card stays (e.g. the action didn't move on), bring it back and unlock
      requestAnimationFrame(() => {
        if (busy.current) {
          busy.current = false;
          place(0, false);
          if (node) node.style.opacity = '';
        }
      });
    };
    if (!node || reducedMotion()) {
      setStamps(0);
      cooldownUntil.current = performance.now() + 200;
      finish();
      return;
    }
    const width = node.offsetWidth || 360;
    const dx = (dir === 'right' ? 1 : -1) * (width * 1.3 + 80);
    node.style.transition = `transform ${FLY_MS}ms ease-in, opacity ${FLY_MS}ms ease-in`;
    node.style.transform = `translateX(${dx}px) rotate(${dir === 'right' ? 18 : -18}deg)`;
    node.style.opacity = '0';
    setStamps(dir === 'right' ? width : -width);
    window.setTimeout(finish, FLY_MS);
  };

  useImperativeHandle(ref, () => ({
    fly: (dir: SwipeDir) => {
      if (busy.current || performance.now() < cooldownUntil.current) return;
      commit(dir, false);
    }
  }));

  // A new card: reset and play the enter animation
  useLayoutEffect(() => {
    const node = el.current;
    busy.current = false;
    drag.current = null;
    if (!node) return;
    node.style.transition = 'none';
    node.style.transform = '';
    node.style.opacity = '';
    setStamps(0);
    if (enter !== 'none' && !reducedMotion()) {
      node.animate?.(
        enter === 'rewind'
          ? [{ transform: 'translateX(-70%) rotate(-10deg)', opacity: 0 }, { transform: 'none', opacity: 1 }]
          : [{ transform: 'scale(0.97)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: enter === 'rewind' ? 260 : 180, easing: 'ease-out' }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardKey]);

  useEffect(() => () => { busy.current = false; }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' || !e.isPrimary || busy.current || drag.current) return;
    if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), axis: null, dx: 0 };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (d.axis === null) {
      d.axis = lockAxis(dx, dy);
      if (d.axis === 'y') { drag.current = null; return; }
      if (d.axis === 'x') {
        try { el.current?.setPointerCapture?.(e.pointerId); } catch { /* pointer already gone */ }
        d.t = performance.now();
        d.x = e.clientX;   // start from here, so the card doesn't jump by the lock distance
      }
      return;
    }
    d.dx = e.clientX - d.x;
    suppressClick.current = true;
    place(d.dx, false);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (d.axis !== 'x') return;
    const dir = cancelled ? null : releaseDecision(d.dx, performance.now() - d.t, el.current?.offsetWidth ?? 360);
    if (dir) commit(dir, true);
    else place(0, true);
  };

  return (
    <div
      ref={el}
      {...rest}
      className={`relative ${className}`}
      style={{ ...style, touchAction: 'pan-y' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={e => endDrag(e, false)}
      onPointerCancel={e => endDrag(e, true)}
      onClickCapture={e => {
        // The click that follows a drag must not flip the card
        if (suppressClick.current) {
          suppressClick.current = false;
          e.stopPropagation();
          e.preventDefault();
        }
      }}
      onClick={onClick}
    >
      <div
        ref={rightStamp}
        aria-hidden="true"
        className="pointer-events-none absolute top-5 left-5 z-10 px-3 py-1 rounded-xl border-[3px] border-emerald-500 text-emerald-600 dark:text-emerald-400 text-lg font-extrabold -rotate-12 bg-white/80 dark:bg-slate-900/80 opacity-0"
        data-testid="stamp-right"
      >
        {stamps.right}
      </div>
      <div
        ref={leftStamp}
        aria-hidden="true"
        className="pointer-events-none absolute top-5 right-5 z-10 px-3 py-1 rounded-xl border-[3px] border-rose-500 text-rose-600 dark:text-rose-400 text-lg font-extrabold rotate-12 bg-white/80 dark:bg-slate-900/80 opacity-0"
        data-testid="stamp-left"
      >
        {stamps.left}
      </div>
      {children}
    </div>
  );
});
