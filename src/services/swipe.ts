/**
 * Decisions for the swipeable cards (pure, unit-tested in tests/swipe.test.ts).
 * A drag starts only after clear horizontal movement, so vertical scrolling of a long card stays native.
 */

export type SwipeDir = 'left' | 'right';

/** Movement (px) before deciding between a horizontal drag and a vertical scroll */
export const LOCK_DISTANCE = 10;
/** Horizontal must beat vertical by this factor to count as a drag */
export const AXIS_RATIO = 1.5;
/** A fast flick commits even below the distance threshold */
export const FLICK_SPEED = 0.6;       // px per ms
export const FLICK_MIN_DISTANCE = 40; // px

/** null = not decided yet; 'x' = horizontal drag; 'y' = let the page scroll */
export function lockAxis(dx: number, dy: number): 'x' | 'y' | null {
  if (Math.abs(dx) < LOCK_DISTANCE && Math.abs(dy) < LOCK_DISTANCE) return null;
  return Math.abs(dx) > Math.abs(dy) * AXIS_RATIO ? 'x' : 'y';
}

/** Distance that commits a swipe: 30% of the card width, at most 120px */
export const swipeThreshold = (width: number) => Math.min(120, Math.max(60, width * 0.3));

/** On release: which way the card goes, or null to spring back. */
export function releaseDecision(dx: number, ms: number, width: number): SwipeDir | null {
  const distance = Math.abs(dx);
  const speed = distance / Math.max(ms, 1);
  if (distance >= swipeThreshold(width) || (speed > FLICK_SPEED && distance > FLICK_MIN_DISTANCE)) return dx > 0 ? 'right' : 'left';
  return null;
}

/** How far a stamp has faded in while dragging (0–1) */
export const stampOpacity = (dx: number, width: number) => Math.min(1, Math.abs(dx) / swipeThreshold(width));

/** Tilt while dragging, in degrees */
export const dragRotation = (dx: number) => Math.max(-15, Math.min(15, dx / 18));
