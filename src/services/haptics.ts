import { leitnerEngine } from './leitnerEngine';

/** A short vibration for a committed swipe (Android; iOS has no web vibration), if haptic feedback is on. */
export function vibrate() {
  if (leitnerEngine.getSettings().hapticFeedback) navigator.vibrate?.(12);
}
