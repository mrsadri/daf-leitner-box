import type { SwipeDir } from './swipe';

/**
 * Slide navigation for the onboarding carousel (pure, unit-tested in tests/onboarding.test.ts).
 * In Persian (RTL) the next slide sits to the left: swiping right or pressing ← moves forward.
 */

/** +1 = next slide, -1 = previous */
export const swipeStep = (dir: SwipeDir, rtl: boolean): 1 | -1 => ((dir === 'left') !== rtl ? 1 : -1);

export function keyStep(key: string, rtl: boolean): 1 | -1 | null {
  if (key === 'ArrowRight') return rtl ? -1 : 1;
  if (key === 'ArrowLeft') return rtl ? 1 : -1;
  return null;
}

export const clampSlide = (i: number, count: number) => Math.max(0, Math.min(count - 1, i));

/** Track offset in % for the active slide (the track is a flex row, which runs right-to-left in RTL) */
export const trackOffset = (index: number, rtl: boolean) => (rtl ? 1 : -1) * index * 100;

/** Past the first or last slide the drag only gives a little (rubber band) */
export function dragResistance(dx: number, index: number, count: number, rtl: boolean): number {
  const forward = rtl ? dx > 0 : dx < 0;
  const atEdge = (forward && index === count - 1) || (!forward && index === 0);
  return atEdge ? dx * 0.3 : dx;
}
